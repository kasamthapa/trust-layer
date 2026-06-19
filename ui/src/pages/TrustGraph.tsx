import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useNavigate } from 'react-router-dom'
import {
  ChevronDown, ChevronUp, ZoomIn, ZoomOut, AlertTriangle,
} from 'lucide-react'
import { getGraph } from '../api'
import type { GraphNode, GraphResponse } from '../types'

// ── Types ─────────────────────────────────────────────────────────────────

type SimNode = GraphNode & {
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

interface SimLink {
  source: string | SimNode
  target: string | SimNode
  weight: number
  isFraud: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────

function bandFromScore(s: number): string {
  if (s >= 750) return 'Platinum'
  if (s >= 500) return 'Gold'
  if (s >= 350) return 'Silver'
  return 'Refused'
}

const BAND_COLOR: Record<string, string> = {
  Platinum: '#a78bfa',
  Gold: '#3b82f6',
  Silver: '#f59e0b',
  Refused: '#ef4444',
}

// ── Stat card ─────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-3 space-y-1">
      <p className="text-[10px] font-semibold tracking-[0.1em] uppercase text-[#6b7280]">{label}</p>
      <p className="text-lg font-semibold tabular-nums" style={{ color: color ?? '#f9fafb' }}>{value}</p>
    </div>
  )
}

// ── Band badge ────────────────────────────────────────────────────────────

function BandBadge({ score }: { score: number }) {
  const band = bandFromScore(score)
  const color = BAND_COLOR[band]
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase"
      style={{ color, border: `1px solid ${color}40`, background: `${color}14` }}
    >
      {band}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────

export default function TrustGraph() {
  const [graphData, setGraphData] = useState<GraphResponse | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [selected, setSelected]   = useState<SimNode | null>(null)
  const [howOpen, setHowOpen]     = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef       = useRef<SVGSVGElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zoomRef      = useRef<any>(null)
  // Store D3 node selection so selected-highlight effect can update strokes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeSelRef   = useRef<any>(null)
  const navigate     = useNavigate()

  // ── Fetch graph data ──────────────────────────────────────────────────

  useEffect(() => {
    getGraph()
      .then(data => { setGraphData(data); setLoading(false) })
      .catch(() => { setError('Failed to load graph data. Is the engine running?'); setLoading(false) })
  }, [])

  // ── Build D3 simulation ───────────────────────────────────────────────

  useEffect(() => {
    if (!graphData || !svgRef.current || !containerRef.current) return

    const width  = containerRef.current.clientWidth  || 900
    const height = containerRef.current.clientHeight || 700

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove()

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)

    const g = svg.append('g')

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => { g.attr('transform', event.transform) })

    svg.call(zoom)
    zoomRef.current = zoom

    // Initial transform — centered at slight zoom-out
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.75))

    // Build node/link data copies (D3 mutates them with x/y)
    const fraudSet = new Set(graphData.fraud_ring_ids)
    const nodes: SimNode[] = graphData.nodes.map(n => ({ ...n }))
    const links: SimLink[] = graphData.edges.map(e => ({
      source:  e.source,
      target:  e.target,
      weight:  e.weight,
      isFraud: fraudSet.has(e.source) && fraudSet.has(e.target),
    }))

    // Force simulation
    const simulation = d3.forceSimulation<SimNode>(nodes)
      .force('link',      d3.forceLink<SimNode, SimLink>(links).id(d => d.id).distance(100))
      .force('charge',    d3.forceManyBody<SimNode>().strength(-200))
      .force('center',    d3.forceCenter(0, 0))
      .force('collision', d3.forceCollide<SimNode>().radius(30))

    // ── Edges ───────────────────────────────────────────────────────────

    const link = g.append('g')
      .selectAll<SVGLineElement, SimLink>('line')
      .data(links)
      .join('line')
      .attr('stroke',       d => d.isFraud ? 'rgba(239,68,68,0.7)' : 'rgba(99,102,241,0.35)')
      .attr('stroke-width', d => d.isFraud ? 2 : 1)

    // ── Fraud glow halos ────────────────────────────────────────────────

    const fraudGlow = g.append('g')
      .selectAll<SVGCircleElement, SimNode>('circle.glow')
      .data(nodes.filter(n => n.fraud))
      .join('circle')
      .attr('class',        'glow')
      .attr('r',            22)
      .attr('fill',         'rgba(239,68,68,0.15)')
      .attr('stroke',       'rgba(239,68,68,0.4)')
      .attr('stroke-width', 1)

    // ── Node circles ────────────────────────────────────────────────────

    const nodeRadius = (d: SimNode) => d.fraud ? 16 : d.trust > 0.6 ? 14 : 12
    const nodeFill   = (d: SimNode) => d.fraud ? '#ef4444' : d.trust > 0.6 ? '#10b981' : '#6366f1'

    const node = g.append('g')
      .selectAll<SVGCircleElement, SimNode>('circle.node')
      .data(nodes)
      .join('circle')
      .attr('class',  'node')
      .attr('r',      nodeRadius)
      .attr('fill',   nodeFill)
      .attr('stroke',       'rgba(255,255,255,0.2)')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('click', (_event, d) => { setSelected(d) })
      .call(
        d3.drag<SVGCircleElement, SimNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x; d.fy = d.y
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null; d.fy = null
          })
      )

    // Store for the highlight effect
    nodeSelRef.current = node

    // ── Labels ──────────────────────────────────────────────────────────

    const label = g.append('g')
      .selectAll<SVGTextElement, SimNode>('text')
      .data(nodes)
      .join('text')
      .text(d => d.name.split(' ')[0])
      .attr('font-size',   '11px')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('fill',        'rgba(255,255,255,0.85)')
      .attr('text-anchor', 'middle')
      .attr('dy',          d => nodeRadius(d) + 14)
      .style('pointer-events', 'none')
      .style('user-select',    'none')

    // ── Tick ────────────────────────────────────────────────────────────

    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as SimNode).x ?? 0)
        .attr('y1', d => (d.source as SimNode).y ?? 0)
        .attr('x2', d => (d.target as SimNode).x ?? 0)
        .attr('y2', d => (d.target as SimNode).y ?? 0)

      fraudGlow
        .attr('cx', d => d.x ?? 0)
        .attr('cy', d => d.y ?? 0)

      node
        .attr('cx', d => d.x ?? 0)
        .attr('cy', d => d.y ?? 0)

      label
        .attr('x', d => d.x ?? 0)
        .attr('y', d => d.y ?? 0)
    })

    // Auto-select M001 when simulation settles
    simulation.on('end', () => {
      const m001 = nodes.find(n => n.id === 'M001')
      if (m001) setSelected(m001)
    })

    return () => { simulation.stop() }
  }, [graphData])

  // ── Update node highlight when selection changes ───────────────────────

  useEffect(() => {
    if (!nodeSelRef.current) return
    nodeSelRef.current
      .attr('stroke',       (d: SimNode) => selected?.id === d.id ? '#ffffff' : 'rgba(255,255,255,0.2)')
      .attr('stroke-width', (d: SimNode) => selected?.id === d.id ? 3 : 1)
  }, [selected])

  // ── Zoom controls ─────────────────────────────────────────────────────

  function zoomIn() {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.3)
  }
  function zoomOut() {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.7)
  }
  function resetView() {
    if (!svgRef.current || !zoomRef.current || !containerRef.current) return
    const w = containerRef.current.clientWidth  || 900
    const h = containerRef.current.clientHeight || 700
    d3.select(svgRef.current)
      .transition().duration(400)
      .call(zoomRef.current.transform, d3.zoomIdentity.translate(w / 2, h / 2).scale(0.75))
  }

  // ── Fraud ring node names ─────────────────────────────────────────────

  const fraudNodes = graphData?.nodes.filter(n => n.fraud) ?? []

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 49px)' }}>

      {/* ── Left: graph canvas ──────────────────────────────────────── */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-[#0f0e1a]">

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-[#6366f1] border-t-transparent animate-spin" />
              <p className="text-xs text-[#6b7280]">Loading trust network…</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <p className="text-sm text-[#ef4444]">{error}</p>
          </div>
        )}

        <svg ref={svgRef} className="w-full h-full" />

        {/* Legend overlay */}
        <div className="absolute bottom-4 left-4 bg-[#111827]/90 border border-[#1f2937] rounded-lg px-3 py-2.5 space-y-1.5 pointer-events-none">
          {[
            { color: '#10b981', label: 'High Trust Merchant' },
            { color: '#6366f1', label: 'Standard Merchant' },
            { color: '#ef4444', label: 'Fraud Ring Member' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-[10px] text-[#9ca3af]">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-0.5 border-t border-[#1f2937] mt-1">
            <span className="w-5 h-px" style={{ background: 'rgba(99,102,241,0.6)' }} />
            <span className="text-[10px] text-[#9ca3af]">Trust Vouch (weight = trust strength)</span>
          </div>
        </div>

        {/* Zoom controls */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-1">
          {([
            { icon: <ZoomIn size={13} />,  action: zoomIn,    label: 'Zoom in'  },
            { icon: <ZoomOut size={13} />, action: zoomOut,   label: 'Zoom out' },
          ] as { icon: React.ReactNode; action: () => void; label: string }[]).map(({ icon, action, label }) => (
            <button
              key={label}
              onClick={action}
              title={label}
              className="w-8 h-8 flex items-center justify-center rounded bg-[#111827] border border-[#1f2937] text-[#9ca3af] hover:text-white hover:border-[#374151] transition-colors"
            >
              {icon}
            </button>
          ))}
          <button
            onClick={resetView}
            title="Reset view"
            className="w-8 h-8 flex items-center justify-center rounded bg-[#111827] border border-[#1f2937] text-[10px] font-bold text-[#9ca3af] hover:text-white hover:border-[#374151] transition-colors"
          >
            ⊡
          </button>
        </div>
      </div>

      {/* ── Right: details panel ─────────────────────────────────────── */}
      <div className="w-[300px] shrink-0 flex flex-col border-l border-[#1f2937] bg-[#0d1117] overflow-y-auto">
        <div className="p-4 space-y-5">

          {/* Network stats */}
          <div>
            <p className="text-[10px] font-semibold tracking-[0.1em] uppercase text-[#6b7280] mb-3">
              Network Overview
            </p>
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Merchants"   value={graphData?.stats.total_nodes ?? '—'} />
              <StatCard label="Connections" value={graphData?.stats.total_edges ?? '—'} />
              <StatCard
                label="Fraud Detected"
                value={graphData?.stats.fraud_count ?? '—'}
                color="#ef4444"
              />
              <StatCard
                label="Avg Trust"
                value={graphData ? graphData.stats.avg_trust.toFixed(2) : '—'}
                color="#10b981"
              />
            </div>
          </div>

          {/* Fraud alert */}
          {fraudNodes.length > 0 && (
            <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: 'rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.05)' }}>
              <div className="flex items-center gap-2">
                <AlertTriangle size={13} className="text-[#ef4444] shrink-0" />
                <p className="text-xs font-semibold text-[#ef4444]">Fraud Ring Detected</p>
              </div>
              <p className="text-[11px] text-[#f87171] leading-relaxed">
                {fraudNodes.length} merchants flagged in isolated vouching cluster
              </p>
              <p className="text-[11px] text-[#6b7280] leading-relaxed">
                These merchants only vouch for each other with zero external connections.
              </p>
              <p className="text-[11px] text-[#6b7280] leading-relaxed">
                Loan applications from these merchants are automatically blocked.
              </p>
              <div className="pt-1 border-t border-[rgba(239,68,68,0.2)] space-y-1">
                {fraudNodes.map(n => (
                  <div key={n.id} className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] shrink-0" />
                    <span className="text-[11px] text-[#f87171] font-medium">{n.name}</span>
                    <span className="text-[10px] text-[#4b5563] ml-auto font-mono">{n.id}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selected node */}
          {selected ? (
            <div>
              <p className="text-[10px] font-semibold tracking-[0.1em] uppercase text-[#6b7280] mb-3">
                Selected Merchant
              </p>
              <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-white">{selected.name}</p>
                  <p className="text-[11px] text-[#6b7280] mt-0.5">{selected.occupation}</p>
                  <p className="text-[11px] text-[#4b5563]">{selected.location}</p>
                </div>

                <div className="h-px bg-[#1f2937]" />

                {/* Trust score bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#6b7280]">Network Trust</span>
                    <span className="text-white font-semibold tabular-nums">
                      {(selected.trust * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#1f2937] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${selected.trust * 100}%`,
                        background: selected.fraud ? '#ef4444' : selected.trust > 0.7 ? '#10b981' : '#6366f1',
                      }}
                    />
                  </div>
                </div>

                {/* Credit score + band */}
                {selected.score > 0 && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-[#6b7280]">Credit Score</p>
                      <p className="text-xl font-semibold text-white tabular-nums mt-0.5">
                        {selected.score}
                      </p>
                    </div>
                    <BandBadge score={selected.score} />
                  </div>
                )}

                {/* Fraud status */}
                <div className="flex items-center gap-2">
                  {selected.fraud ? (
                    <>
                      <AlertTriangle size={12} className="text-[#ef4444]" />
                      <span className="text-xs font-semibold text-[#ef4444]">Fraud Ring Member</span>
                    </>
                  ) : (
                    <>
                      <span className="text-[#10b981] text-xs">✓</span>
                      <span className="text-xs font-semibold text-[#10b981]">Clean</span>
                    </>
                  )}
                </div>

                <button
                  onClick={() => navigate('/bank')}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded bg-[#6366f1] hover:bg-[#4f46e5] text-white text-xs font-semibold transition-colors"
                >
                  View Full Assessment →
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-4 text-center">
              <p className="text-xs text-[#4b5563]">Click any node to view merchant details</p>
            </div>
          )}

          {/* How it works — collapsible */}
          <div className="bg-[#111827] border border-[#1f2937] rounded-lg overflow-hidden">
            <button
              onClick={() => setHowOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <p className="text-xs font-semibold text-[#9ca3af]">How Trust Propagation Works</p>
              {howOpen
                ? <ChevronUp size={13} className="text-[#4b5563]" />
                : <ChevronDown size={13} className="text-[#4b5563]" />
              }
            </button>
            {howOpen && (
              <div className="px-4 pb-4 space-y-2 border-t border-[#1f2937]">
                {[
                  'Merchants vouch for each other creating a directed trust network.',
                  'TrustLayer uses PageRank to propagate trust — a vouch from a trusted merchant is worth more than a vouch from an untrusted one.',
                  'Louvain community detection identifies isolated clusters — groups that only vouch internally with no external connections.',
                  'Fraud rings appear as dense isolated red clusters. Legitimate networks show diverse outward connections.',
                ].map((text, i) => (
                  <div key={i} className="flex items-start gap-2 pt-2">
                    <span className="text-[10px] font-bold text-[#374151] shrink-0 mt-0.5">{i + 1}.</span>
                    <p className="text-[11px] text-[#6b7280] leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
