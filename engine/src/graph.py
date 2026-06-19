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
import os
from functools import lru_cache

import networkx as nx
import community as community_louvain  # python-louvain

from config.settings import SEED_DATA_PATH
from src.scoring import get_all_merchants

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# PageRank damping factor — industry standard 0.85.
# Remaining 0.15 is "teleportation": the random chance a trust-walker
# jumps to a random node, preventing trust from pooling in isolated sinks.
_PAGERANK_ALPHA = 0.85

# A fraud ring is characterised by: small size, dense internal edges,
# and zero external connections. These two thresholds define "small" and "dense".
_FRAUD_MAX_CLUSTER_SIZE = 7       # rings larger than this are too obvious / unlikely
_FRAUD_MIN_INTERNAL_EDGE_RATIO = 1  # internal_edges >= members (fully meshed or close)


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------

def _load_vouches() -> list[dict]:
    """Load the vouches array from seed_data.json."""
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
    for m in get_all_merchants():
        G.add_node(
            m["id"],
            name=m["name"],
            occupation=m["occupation"],
            location=m["location"],
            community_fraud_flag=m["community_fraud_flag"],
        )

    # --- Add edges with raw weights first ---
    for vouch in _load_vouches():
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

    A community is flagged as a fraud ring when ALL three conditions hold:
      1. size <= _FRAUD_MAX_CLUSTER_SIZE  — rings are small by nature
      2. internal_edges >= members        — members vouch each other densely
      3. external_edges == 0              — zero connections to outside world

    Condition 3 is the decisive one: every legitimate merchant eventually
    connects to the broader community. A ring that vouches only internally
    is trying to manufacture trust that has no real-world grounding.

    Returns a set of merchant IDs belonging to detected fraud rings.
    """
    undirected = G.to_undirected()

    # partition maps node -> community_id (integer label)
    partition: dict[str, int] = community_louvain.best_partition(undirected)

    # Group nodes by community id
    communities: dict[int, list[str]] = {}
    for node, community_id in partition.items():
        communities.setdefault(community_id, []).append(node)

    fraud_nodes: set[str] = set()

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

        is_dense_enough = internal_edges >= size * _FRAUD_MIN_INTERNAL_EDGE_RATIO
        is_isolated = external_edges == 0

        if is_dense_enough and is_isolated:
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
            "occupation": data.get("occupation", ""),
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
