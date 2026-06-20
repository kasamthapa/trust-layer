"""
graph.py — TrustLayer social trust graph engine.

Models the merchant vouch network as a directed weighted graph and derives
two outputs:

  1. Trust scores  — EigenTrust-style PageRank propagation. A vouch from a
                     highly-trusted merchant is worth more than a vouch from
                     an unknown one, naturally rewarding deep community roots.

  2. Fraud ring detection — Louvain community detection on the undirected
                            projection. Any small, fully-internal cluster with
                            zero outside connections is flagged as a likely
                            collusion ring.

These outputs feed back into scoring.py (network_trust_score) and are
surfaced in the API for the UI graph visualisation.
"""

import json
import logging
import os
from functools import lru_cache

import networkx as nx

logger = logging.getLogger(__name__)
import community as community_louvain  # python-louvain

from config.settings import (
    SEED_DATA_PATH,
    MAX_VOUCHES_GIVEN,
    MAX_VOUCHES_RECEIVED,
    VOUCH_DEFAULT_IMPACT,
)
from src.scoring import get_all_merchants, load_merchants_from_db

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# PageRank damping factor — industry standard 0.85.
# Remaining 0.15 is "teleportation": the random chance a trust-walker
# jumps to a random node, preventing trust from pooling in isolated sinks.
_PAGERANK_ALPHA = 0.85

# A fraud ring is characterised by: small size, dense internal edges,
# and very few external connections. One bridge edge should not launder a
# dense scam cluster into the healthy network during the demo or in practice.
_FRAUD_MAX_CLUSTER_SIZE = 7
_FRAUD_MIN_INTERNAL_EDGE_RATIO = 1  # internal_edges >= members (fully meshed or close)
_FRAUD_MAX_EXTERNAL_BRIDGES = 1     # tolerate one attempted bridge without clearing fraud


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------

def _load_vouches() -> list[dict]:
    """Load vouches from PostgreSQL when available, otherwise seed_data.json."""
    try:
        from src.database import get_connection
        conn = get_connection()
        if conn is not None:
            with conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT from_id, to_id, weight, note
                        FROM vouches
                        ORDER BY id
                        """
                    )
                    rows = cur.fetchall()
            conn.close()
            if rows:
                return [
                    {"from_id": r[0], "to_id": r[1], "weight": r[2], "note": r[3] or ""}
                    for r in rows
                ]
    except Exception as exc:
        logger.warning("Could not load DB vouches; falling back to seed data: %s", exc)

    path = os.path.join(os.path.dirname(__file__), "..", SEED_DATA_PATH)
    with open(os.path.normpath(path), "r", encoding="utf-8") as f:
        return json.load(f)["vouches"]


def build_graph() -> nx.DiGraph:
    """
    Construct the merchant vouch network as a directed weighted graph.

    Nodes  — one per merchant, carrying display attributes.
    Edges  — one per vouch (from_id → to_id), carrying normalised weight.

    Weight normalisation (trust budget mechanic):
        Each merchant has exactly 1.0 unit of trust to distribute.
        Vouching for N people gives each vouch a weight of raw_weight / total,
        so vouching many people dilutes each individual endorsement.
        This discourages vouching strangers purely to game the system.
    """
    G = nx.DiGraph()

    # --- Add nodes ---
    # load_merchants_from_db() tries PostgreSQL first and falls back to JSON
    # automatically, so this function works with or without a live database.
    for m in load_merchants_from_db():
        G.add_node(
            m["id"],
            name=m["name"],
            business_type=m["business_type"],
            location=m["location"],
            community_fraud_flag=m["community_fraud_flag"],
        )

    # --- Load and enforce vouch limits before adding edges ---
    raw_vouches = _load_vouches()

    # Group by giver and by receiver to enforce per-merchant limits
    from collections import defaultdict
    given_by: dict[str, list[dict]] = defaultdict(list)
    received_by: dict[str, list[dict]] = defaultdict(list)
    for v in raw_vouches:
        given_by[v["from_id"]].append(v)
        received_by[v["to_id"]].append(v)

    allowed_vouches: set[tuple[str, str]] = set()

    for giver, vouches in given_by.items():
        if len(vouches) > MAX_VOUCHES_GIVEN:
            vouches = sorted(vouches, key=lambda v: v["weight"], reverse=True)[:MAX_VOUCHES_GIVEN]
            logger.warning(
                "Merchant %s exceeded MAX_VOUCHES_GIVEN (%d); trimmed to top %d by weight.",
                giver, MAX_VOUCHES_GIVEN, MAX_VOUCHES_GIVEN,
            )
        for v in vouches:
            allowed_vouches.add((v["from_id"], v["to_id"]))

    # Build receiver-side allowed set after giver trim, then apply receiver cap
    recv_counts: dict[str, list[tuple[str, str, float]]] = defaultdict(list)
    for (fid, tid) in allowed_vouches:
        weight = next(v["weight"] for v in raw_vouches if v["from_id"] == fid and v["to_id"] == tid)
        recv_counts[tid].append((fid, tid, weight))

    final_allowed: set[tuple[str, str]] = set()
    for receiver, edges in recv_counts.items():
        if len(edges) > MAX_VOUCHES_RECEIVED:
            edges = sorted(edges, key=lambda e: e[2], reverse=True)[:MAX_VOUCHES_RECEIVED]
            logger.warning(
                "Merchant %s exceeded MAX_VOUCHES_RECEIVED (%d); trimmed to top %d by weight.",
                receiver, MAX_VOUCHES_RECEIVED, MAX_VOUCHES_RECEIVED,
            )
        for (fid, tid, _) in edges:
            final_allowed.add((fid, tid))

    for vouch in raw_vouches:
        if (vouch["from_id"], vouch["to_id"]) not in final_allowed:
            continue
        G.add_edge(
            vouch["from_id"],
            vouch["to_id"],
            weight=vouch["weight"],
            note=vouch.get("note", ""),
        )

    # --- Normalise outgoing weights per source node ---
    for node in G.nodes():
        out_edges = list(G.out_edges(node, data=True))
        if not out_edges:
            continue
        total_weight = sum(data["weight"] for _, _, data in out_edges)
        for _, target, data in out_edges:
            # Replace raw weight with its share of this node's trust budget.
            G[node][target]["weight"] = data["weight"] / total_weight

    return G


# ---------------------------------------------------------------------------
# Trust score computation
# ---------------------------------------------------------------------------

def compute_trust_scores(G: nx.DiGraph) -> dict[str, float]:
    """
    Run PageRank on the vouch graph to derive EigenTrust-style scores.

    PageRank treats a vouch from a highly-ranked merchant as worth more
    than a vouch from an unknown one — trust propagates transitively.
    This means M001 (vouched by established anchors M011 and M012) inherits
    credibility from the whole network around those anchors.

    Scores are normalised to [0.0, 1.0] by dividing by the maximum value,
    so the most-trusted merchant always scores 1.0 and the rest are relative.
    """
    raw_scores: dict[str, float] = nx.pagerank(G, weight="weight", alpha=_PAGERANK_ALPHA)

    max_score = max(raw_scores.values()) if raw_scores else 1.0
    # Guard against a degenerate graph where all scores are 0.
    if max_score == 0:
        max_score = 1.0

    return {node: score / max_score for node, score in raw_scores.items()}


# ---------------------------------------------------------------------------
# Fraud ring detection
# ---------------------------------------------------------------------------

def detect_fraud_rings(G: nx.DiGraph) -> set[str]:
    """
    Identify closed collusion rings using Louvain community detection.

    Louvain works on undirected graphs, so we project first.  It partitions
    every node into communities that maximise modularity (dense internal
    connections, sparse external ones).

    A community is flagged as a fraud ring when it is small, internally dense,
    and has at most a tiny number of bridge edges. A single bridge should be
    treated as attempted trust laundering, not proof that the whole cluster is
    legitimate.

    Merchants already marked with community_fraud_flag=1 are always included.
    This prevents a known scam group from turning blue just because one normal
    merchant connects to it.

    Returns a set of merchant IDs belonging to detected fraud rings.
    """
    undirected = G.to_undirected()

    # partition maps node -> community_id (integer label)
    partition: dict[str, int] = community_louvain.best_partition(undirected)

    # Group nodes by community id
    communities: dict[int, list[str]] = {}
    for node, community_id in partition.items():
        communities.setdefault(community_id, []).append(node)

    fraud_nodes: set[str] = {
        node
        for node, data in G.nodes(data=True)
        if int(data.get("community_fraud_flag") or 0) == 1
    }

    for community_id, members in communities.items():
        member_set = set(members)
        size = len(members)

        if size > _FRAUD_MAX_CLUSTER_SIZE:
            # Too large to be a tight collusion ring.
            continue

        # Count edges that stay inside the cluster (using undirected graph)
        internal_edges = sum(
            1
            for u, v in undirected.edges(members)
            if u in member_set and v in member_set
        )

        # Count edges that cross the cluster boundary
        external_edges = sum(
            1
            for u, v in undirected.edges(members)
            if u not in member_set or v not in member_set
        )

        flagged_inside = sum(
            1
            for node in members
            if int(G.nodes[node].get("community_fraud_flag") or 0) == 1
        )
        is_dense_enough = internal_edges >= size * _FRAUD_MIN_INTERNAL_EDGE_RATIO
        has_tiny_boundary = external_edges <= _FRAUD_MAX_EXTERNAL_BRIDGES
        majority_known_fraud = flagged_inside >= max(2, size // 2)

        if is_dense_enough and (has_tiny_boundary or majority_known_fraud):
            fraud_nodes.update(members)

    return fraud_nodes


# ---------------------------------------------------------------------------
# Aggregated graph data (used by the API)
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def get_graph_data() -> dict:
    """
    Build the full graph, compute trust scores and fraud rings, and return
    a serialisable dict ready for the API response.

    Cached after first call — the underlying data does not change at runtime.

    Returns:
        nodes         — list of node dicts for graph visualisation
        edges         — list of edge dicts for graph visualisation
        fraud_ring_ids — list of merchant IDs flagged by ring detection
        stats         — summary counts for the dashboard header
    """
    G = build_graph()
    trust_scores = compute_trust_scores(G)
    fraud_ids = detect_fraud_rings(G)

    nodes = [
        {
            "id": node,
            "name": data.get("name", ""),
            "business_type": data.get("business_type", ""),
            "location": data.get("location", ""),
            "trust": round(trust_scores.get(node, 0.5), 4),
            "fraud": node in fraud_ids,
            # Placeholder — final composite score is set by the API layer
            # after personal score and network trust are combined.
            "score": 0,
        }
        for node, data in G.nodes(data=True)
    ]

    edges = [
        {
            "source": u,
            "target": v,
            "weight": round(data.get("weight", 0.0), 4),
        }
        for u, v, data in G.edges(data=True)
    ]

    trust_values = [n["trust"] for n in nodes]
    avg_trust = round(sum(trust_values) / len(trust_values), 4) if trust_values else 0.0

    stats = {
        "total_nodes": G.number_of_nodes(),
        "total_edges": G.number_of_edges(),
        "fraud_count": len(fraud_ids),
        "avg_trust": avg_trust,
    }

    return {
        "nodes": nodes,
        "edges": edges,
        "fraud_ring_ids": sorted(fraud_ids),
        "stats": stats,
    }


# ---------------------------------------------------------------------------
# Single-merchant lookup
# ---------------------------------------------------------------------------

def compute_vouch_stats(G: nx.DiGraph) -> dict[str, dict]:
    """
    Return per-merchant vouch usage stats and fraud association flag.

    For each node returns:
      vouches_given            — number of outgoing vouch edges
      vouches_received         — number of incoming vouch edges
      vouches_given_remaining  — MAX_VOUCHES_GIVEN - vouches_given
      vouches_received_remaining — MAX_VOUCHES_RECEIVED - vouches_received
      fraud_association        — True if any merchant they vouched for is in a
                                 detected fraud ring
    """
    graph_data = get_graph_data()
    fraud_set = set(graph_data["fraud_ring_ids"])

    result: dict[str, dict] = {}
    for node in G.nodes():
        given    = G.out_degree(node)
        received = G.in_degree(node)
        # Check if any merchant this node has vouched for is fraud-flagged
        fraud_assoc = any(
            target in fraud_set
            for _, target in G.out_edges(node)
        )
        result[node] = {
            "vouches_given":              given,
            "vouches_received":           received,
            "vouches_given_remaining":    max(0, MAX_VOUCHES_GIVEN - given),
            "vouches_received_remaining": max(0, MAX_VOUCHES_RECEIVED - received),
            "fraud_association":          fraud_assoc,
        }
    return result


def compute_default_impact(merchant_id: str, defaulted_merchant_id: str, G: nx.DiGraph) -> float:
    """
    Calculate how much a merchant's trust score should fall if a merchant
    they vouched for defaults on their loan.

    Returns vouch_weight * VOUCH_DEFAULT_IMPACT if the edge exists, else 0.0.
    """
    if not G.has_edge(merchant_id, defaulted_merchant_id):
        return 0.0
    weight = G[merchant_id][defaulted_merchant_id].get("weight", 0.0)
    return round(weight * VOUCH_DEFAULT_IMPACT, 4)


def get_merchant_trust(merchant_id: str) -> float:
    """
    Return the normalised PageRank trust score for a single merchant.

    Returns 0.5 (neutral default) if the merchant is not present in the
    graph — this keeps the scoring pipeline safe even before the graph
    is fully populated.
    """
    graph_data = get_graph_data()
    for node in graph_data["nodes"]:
        if node["id"] == merchant_id:
            return node["trust"]
    return 0.5
