import { useEffect, useRef, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Cell, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Search, MapPin, Briefcase, Clock, Building2,
  RefreshCw, XCircle, ArrowRight, CheckCircle2, AlertTriangle,
} from 'lucide-react'
import { getMerchants, getMerchantScore } from '../api'
import type { MerchantSummary, ScoreResponse } from '../types'

// ── Constants ─────────────────────────────────────────────────────────────

const BAND_COLOR: Record<string, string> = {
  Platinum: '#a78bfa',
  Gold:     '#3b82f6',
  Silver:   '#f59e0b',
  Refused:  '#ef4444',
}

const LAYER_COLORS = ['#6366f1', '#10b981', '#f59e0b']

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN').format(n)
}

function bandFromScore(s: number): string {
  if (s >= 750) return 'Platinum'
  if (s >= 500) return 'Gold'
  if (s >= 350) return 'Silver'
  return 'Refused'
}

// ── Skeleton ──────────────────────────────────────────────────────────────

function Sk({ w = 'w-full', h = 'h-4' }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} rounded bg-[#1f2937] animate-pulse`} />
}

function ScoreSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4 pb-5 border-b border-[#1f2937]">
        <Sk w="w-9" h="h-9" />
        <div className="space-y-2 flex-1"><Sk w="w-48" h="h-5" /><Sk w="w-32" h="h-3" /></div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Sk h="h-40" /><Sk h="h-40" /><Sk h="h-40" />
      </div>
      <Sk h="h-10" />
      <Sk h="h-12" />
      <div className="grid grid-cols-2 gap-4"><Sk h="h-44" /><Sk h="h-44" /></div>
      <div className="grid grid-cols-3 gap-4"><Sk h="h-52" /><Sk h="h-52" /><Sk h="h-52" /></div>
    </div>
  )
}

// ── Reusable primitives ───────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#111827] border border-[#1f2937] rounded-lg ${className}`}>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[#6b7280] mb-3">
      {children}
    </p>
  )
}

function BandBadge({ band }: { band: string }) {
  const color = BAND_COLOR[band] ?? '#6b7280'
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase"
      style={{ color, border: `1px solid ${color}40`, background: `${color}14` }}
    >
      {band}
    </span>
  )
}

// ── Score ring ────────────────────────────────────────────────────────────

function ScoreRing({ score, band }: { score: number; band: string }) {
  const r = 56
  const circ = 2 * Math.PI * r
  const dash = (score / 1000) * circ
  const color = BAND_COLOR[band] ?? '#6366f1'

  return (
    <div className="relative flex items-center justify-center w-32 h-32">
      <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#1f2937" strokeWidth="8" />
        <circle
          cx="64" cy="64" r={r}
          fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="text-3xl font-semibold text-white tabular-nums">{score}</span>
        <span className="text-[10px] text-[#6b7280] mt-1">/1000</span>
      </div>
    </div>
  )
}

// ── Merchant picker ───────────────────────────────────────────────────────

function MerchantCard({ m, active, band, onClick }: {
  m: MerchantSummary; active: boolean; band?: string; onClick: () => void
}) {
  const color = band ? BAND_COLOR[band] : '#374151'
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded border transition-colors
        ${active ? 'bg-[#1a2332] border-[#374151]' : 'bg-transparent border-transparent hover:bg-[#111827] hover:border-[#1f2937]'}`}
      style={{ borderLeftColor: color, borderLeftWidth: 2 }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-white font-medium truncate">{m.name}</p>
        {band && <BandBadge band={band} />}
      </div>
      <p className="text-xs text-[#6b7280] truncate mt-0.5">{m.occupation}</p>
      <div className="flex gap-3 mt-1 text-[11px] text-[#4b5563]">
        <span className="flex items-center gap-1"><MapPin size={9} />{m.location}</span>
        <span className="flex items-center gap-1"><Clock size={9} />{m.months_active}mo</span>
      </div>
    </button>
  )
}

// ── Zone 1 components ─────────────────────────────────────────────────────

function ScorePanel({ score }: { score: ScoreResponse }) {
  return (
    <Card className="p-5 flex flex-col items-center gap-4">
      <SectionLabel>Credit Score</SectionLabel>
      <ScoreRing score={score.score} band={score.band} />
      <BandBadge band={score.band} />
      <div className="w-full space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-[#6b7280]">Data confidence</span>
          <span className="text-white">{(score.confidence * 100).toFixed(0)}%</span>
        </div>
        <div className="h-1 rounded-full bg-[#1f2937] overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${score.confidence * 100}%`,
              background: score.confidence >= 0.6 ? '#10b981' : '#f59e0b',
            }}
          />
        </div>
      </div>
      <div className="w-full grid grid-cols-2 gap-2 text-xs">
        <div className="bg-[#0d1117] border border-[#1f2937] rounded p-2 text-center">
          <p className="text-[#6b7280] text-[10px] uppercase tracking-wide">Ceiling</p>
          <p className="text-[#10b981] font-semibold mt-0.5">NPR {fmt(score.loan_ceiling)}</p>
        </div>
        <div className="bg-[#0d1117] border border-[#1f2937] rounded p-2 text-center">
          <p className="text-[#6b7280] text-[10px] uppercase tracking-wide">Requested</p>
          <p className={`font-semibold mt-0.5 ${score.requested_loan > score.loan_ceiling ? 'text-[#ef4444]' : 'text-white'}`}>
            NPR {fmt(score.requested_loan)}
          </p>
        </div>
      </div>
    </Card>
  )
}

function FormulaPanel({ score }: { score: ScoreResponse }) {
  const lb = score.layer_breakdown
  const fBand = bandFromScore(lb.formula_score)
  const gBand = bandFromScore(lb.graph_score)
  return (
    <Card className="p-5 flex flex-col gap-4">
      <SectionLabel>Rule-Based Formula</SectionLabel>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold text-white tabular-nums">{lb.formula_score}</span>
          <span className="text-xs text-[#6b7280]">/1000</span>
        </div>
        <div className="mt-1"><BandBadge band={fBand} /></div>
      </div>
      <p className="text-xs text-[#6b7280] leading-relaxed flex-1">
        Behavioural signals weighted by data confidence. Bill payment, QR consistency, airtime frequency, transaction stability.
      </p>
      <div className="border-t border-[#1f2937] pt-3">
        <SectionLabel>Community Trust</SectionLabel>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold text-white tabular-nums">{lb.graph_score}</span>
          <span className="text-xs text-[#6b7280]">/1000</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <BandBadge band={gBand} />
          {score.fraud_flagged && (
            <span className="text-[11px] font-semibold text-[#ef4444]">fraud ring</span>
          )}
        </div>
        <p className="text-xs text-[#6b7280] mt-2 leading-relaxed">
          PageRank trust propagation across the 25-merchant vouch network.
        </p>
      </div>
    </Card>
  )
}

function FusionBar({ lb, mlBand, mlConf }: {
  lb: ScoreResponse['layer_breakdown']
  mlBand: string
  mlConf: number
}) {
  return (
    <Card className="px-4 py-3">
      <p className="text-xs text-[#6b7280] font-mono">
        <span className="text-white font-semibold">Final Score:</span>
        {' '}70% × Formula ({lb.formula_score}) + 30% × Graph ({lb.graph_score})
        {' '}= <span className="text-white font-semibold">{lb.final_fused}</span>
        <span className="text-[#4b5563] ml-3">·</span>
        <span className="text-[#4b5563] ml-3">ML Advisory: {mlBand} ({(mlConf * 100).toFixed(0)}%)</span>
      </p>
    </Card>
  )
}

function GateBanner({ status, reason }: { status: string; reason: string | null }) {
  const ok = status === 'CLEAR'
  return (
    <div
      className="px-4 py-3 rounded border border-[#1f2937]"
      style={{ borderLeftColor: ok ? '#10b981' : '#ef4444', borderLeftWidth: 3 }}
    >
      <div className="flex items-center gap-2">
        {ok
          ? <CheckCircle2 size={14} className="text-[#10b981] shrink-0" />
          : <AlertTriangle size={14} className="text-[#ef4444] shrink-0" />
        }
        <span className={`text-sm font-semibold ${ok ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
          {ok ? 'GATE CLEAR' : 'GATE FLAGGED'}
        </span>
        <span className="text-xs text-[#6b7280] ml-1">
          {ok ? `Ceiling NPR ${fmt(0)}` : reason}
        </span>
      </div>
    </div>
  )
}

// ── Zone 2: Key Factors ───────────────────────────────────────────────────

function KeyFactors({ items }: { items: ScoreResponse['explanation'] }) {
  return (
    <Card className="p-4 h-full">
      <SectionLabel>Key Factors</SectionLabel>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-[#1f2937]">
            <th className="text-left text-[#6b7280] font-medium pb-2 pr-3">Factor</th>
            <th className="text-left text-[#6b7280] font-medium pb-2 pr-3 w-6">Dir</th>
            <th className="text-left text-[#6b7280] font-medium pb-2">Detail</th>
          </tr>
        </thead>
        <tbody>
          {items.map((e, i) => (
            <tr key={i} className="border-b border-[#1f2937] last:border-0">
              <td className="py-2 pr-3 text-white font-medium whitespace-nowrap">{e.factor}</td>
              <td className="py-2 pr-3">
                <span className={`font-bold ${e.direction === '+' ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                  {e.direction}
                </span>
              </td>
              <td className="py-2 text-[#9ca3af] leading-relaxed">{e.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

// ── Zone 2: Fairness Audit ────────────────────────────────────────────────

function FairnessAuditCard({ fa }: { fa: ScoreResponse['fairness_audit'] }) {
  const accentColor = fa.status === 'passed' ? '#10b981' : fa.status === 'corrected' ? '#f59e0b' : '#ef4444'
  return (
    <Card
      className="p-4 h-full"
      style={{ borderLeftColor: accentColor, borderLeftWidth: 3 } as React.CSSProperties}
    >
      <SectionLabel>Fairness Audit</SectionLabel>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-white">{fa.title}</p>
        {fa.adjustment > 0 && (
          <span className="text-xs font-semibold text-[#f59e0b]">+{fa.adjustment} pts</span>
        )}
      </div>

      {fa.status === 'corrected' && (
        <div className="flex items-center gap-2 text-xs text-[#9ca3af] mb-3 font-mono">
          <span>{fa.before_score}</span>
          <span className="text-[#f59e0b]">+{fa.adjustment}</span>
          <ArrowRight size={11} className="text-[#4b5563]" />
          <span className="text-white font-semibold">{fa.after_score}</span>
          <span className="text-[#4b5563] ml-1 text-[10px] not-mono">{fa.policy}</span>
        </div>
      )}

      <p className="text-xs text-[#9ca3af] leading-relaxed mb-3">{fa.summary}</p>

      {fa.reasons.length > 0 && (
        <ul className="space-y-1.5">
          {fa.reasons.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-[#6b7280]">
              <span className="shrink-0 mt-1.5 w-1 h-1 rounded-full bg-[#374151]" />
              {r}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// ── Zone 3: Layer breakdown chart ─────────────────────────────────────────

function LayerChart({ lb }: { lb: ScoreResponse['layer_breakdown'] }) {
  const data = [
    { name: 'Formula',  value: lb.formula_score },
    { name: 'Graph',    value: lb.graph_score   },
    { name: 'Fused',    value: lb.final_fused   },
  ]
  return (
    <Card className="p-4 h-full">
      <SectionLabel>Layer Breakdown</SectionLabel>
      <ResponsiveContainer width="100%" height={130}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 4 }}>
          <XAxis type="number" domain={[0, 1000]} hide />
          <YAxis
            type="category" dataKey="name" width={50}
            tick={{ fill: '#6b7280', fontSize: 11, fontFamily: 'Inter' }}
            axisLine={false} tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            contentStyle={{ background: '#0d1117', border: '1px solid #1f2937', borderRadius: 6, fontSize: 12, color: '#f9fafb' }}
            formatter={(v: number) => [`${v} / 1000`]}
          />
          <Bar dataKey="value" radius={3} label={{ position: 'right', fill: '#6b7280', fontSize: 11 }}>
            {data.map((_, i) => <Cell key={i} fill={LAYER_COLORS[i]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-[#4b5563] mt-2 leading-relaxed">{lb.ml_note}</p>
    </Card>
  )
}

// ── Zone 3: AI Assessment ─────────────────────────────────────────────────

function AIAssessmentCard({ text }: { text: string | null }) {
  return (
    <Card className="p-4 h-full flex flex-col gap-3">
      <div>
        <SectionLabel>AI Assessment</SectionLabel>
        <p className="text-[10px] text-[#4b5563]">Gemma3 4B · Local inference · No external API</p>
      </div>
      <div className="flex-1">
        {text ? (
          <p className="text-xs text-[#9ca3af] leading-relaxed">{text}</p>
        ) : (
          <p className="text-xs text-[#4b5563] animate-pulse">Generating…</p>
        )}
      </div>
    </Card>
  )
}

// ── Zone 3: ML Advisory ───────────────────────────────────────────────────

function MLAdvisoryCard({ score }: { score: ScoreResponse }) {
  const top3 = score.shap_factors.slice(0, 3)
  const maxImpact = Math.max(...top3.map(s => Math.abs(s.impact)), 0.0001)

  return (
    <Card className="p-4 h-full flex flex-col gap-3">
      <SectionLabel>ML Advisory Signal</SectionLabel>

      <div className="flex items-center gap-2">
        <BandBadge band={score.ml_band} />
        <span className="text-xs text-[#6b7280]">{(score.ml_confidence * 100).toFixed(1)}% confidence</span>
      </div>

      {top3.length > 0 && (
        <div className="space-y-2 flex-1">
          {top3.map((s, i) => {
            const pct = (Math.abs(s.impact) / maxImpact) * 100
            const pos = s.direction === '+'
            return (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#9ca3af] truncate">{s.feature.replace(/_/g, ' ')}</span>
                  <span className={`font-medium ml-2 shrink-0 ${pos ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                    {pos ? '+' : ''}{s.impact.toFixed(3)}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-[#1f2937] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pos ? '#10b981' : '#ef4444' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-[10px] text-[#4b5563] italic leading-relaxed mt-auto">
        {score.layer_breakdown.ml_note}
      </p>
    </Card>
  )
}

// ── Zone divider ──────────────────────────────────────────────────────────

function Zone({ n, label, children }: { n: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[10px] font-bold text-[#374151] tabular-nums">{n}</span>
        <span className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[#4b5563]">{label}</span>
        <div className="flex-1 h-px bg-[#1f2937]" />
      </div>
      {children}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────

export default function BankDashboard() {
  const [merchants, setMerchants]       = useState<MerchantSummary[]>([])
  const [query, setQuery]               = useState('')
  const [selected, setSelected]         = useState<string>('M001')
  const [score, setScore]               = useState<ScoreResponse | null>(null)
  const [scoreCache, setScoreCache]     = useState<Record<string, ScoreResponse>>({})
  const [loadingList, setLoadingList]   = useState(true)
  const [loadingScore, setLoadingScore] = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const rightRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getMerchants()
      .then(list => { setMerchants(list); setLoadingList(false) })
      .catch(() => { setError('Failed to load merchant list. Is the engine running?'); setLoadingList(false) })
  }, [])

  useEffect(() => {
    if (!selected) return
    if (scoreCache[selected]) { setScore(scoreCache[selected]); return }
    setLoadingScore(true)
    setError(null)
    getMerchantScore(selected)
      .then(s => {
        setScore(s)
        setScoreCache(c => ({ ...c, [selected]: s }))
        setLoadingScore(false)
        rightRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      })
      .catch(() => { setError('Failed to load score. Please retry.'); setLoadingScore(false) })
  }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = merchants.filter(m =>
    m.name.toLowerCase().includes(query.toLowerCase()) ||
    m.occupation.toLowerCase().includes(query.toLowerCase())
  )
  const bandOf = (id: string) => scoreCache[id]?.band

  return (
    <div className="flex-1 flex overflow-hidden h-[calc(100vh-49px)]">

      {/* Sidebar */}
      <aside className="w-[280px] shrink-0 flex flex-col border-r border-[#1f2937] bg-[#0d1117]">
        <div className="px-3 pt-3 pb-2 border-b border-[#1f2937]">
          <div className="flex items-center gap-2 mb-2.5">
            <Building2 size={13} className="text-[#6b7280]" />
            <span className="text-xs font-semibold text-[#9ca3af]">Applications</span>
            <span className="ml-auto text-[10px] text-[#4b5563] font-mono">{merchants.length}</span>
          </div>
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#4b5563]" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Filter merchants…"
              className="w-full pl-7 pr-2.5 py-1.5 rounded bg-[#111827] border border-[#1f2937] text-xs text-white placeholder-[#4b5563] focus:outline-none focus:border-[#374151] transition-colors"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {loadingList
            ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded bg-[#111827] animate-pulse" />)
            : filtered.map(m => (
                <MerchantCard
                  key={m.id} m={m} active={m.id === selected}
                  band={bandOf(m.id)} onClick={() => setSelected(m.id)}
                />
              ))
          }
          {!loadingList && filtered.length === 0 && (
            <p className="text-center text-xs text-[#4b5563] py-8">No results for "{query}"</p>
          )}
        </div>
      </aside>

      {/* Main panel */}
      <div ref={rightRef} className="flex-1 overflow-y-auto bg-[#0f0e1a]">

        {error && (
          <div className="m-5 px-4 py-3 rounded border border-[#1f2937]" style={{ borderLeftColor: '#ef4444', borderLeftWidth: 3 }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-[#ef4444]">
                <XCircle size={13} />{error}
              </div>
              <button
                onClick={() => { setError(null); setSelected(s => s) }}
                className="flex items-center gap-1.5 text-xs text-[#6b7280] hover:text-white transition-colors"
              >
                <RefreshCw size={11} /> Retry
              </button>
            </div>
          </div>
        )}

        {loadingScore && <ScoreSkeleton />}

        {!loadingScore && score && (() => {
          const lb = score.layer_breakdown

          return (
            <div className="p-5 space-y-7 max-w-4xl mx-auto pb-12">

              {/* Identity strip */}
              <div className="flex items-center gap-3 pb-4 border-b border-[#1f2937]">
                <div className="w-8 h-8 rounded bg-[#111827] border border-[#1f2937] flex items-center justify-center shrink-0">
                  <Briefcase size={13} className="text-[#6b7280]" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-white leading-tight">{score.name}</h2>
                  <div className="flex items-center gap-3 text-[11px] text-[#6b7280] flex-wrap mt-0.5">
                    <span className="flex items-center gap-1"><Briefcase size={9} />{score.occupation}</span>
                    <span className="flex items-center gap-1"><MapPin size={9} />{score.location}</span>
                    <span className="font-mono text-[#374151]">{score.merchant_id}</span>
                  </div>
                </div>
              </div>

              {/* Zone 1 */}
              <Zone n="01" label="Verdict">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <ScorePanel score={score} />
                  <div className="col-span-2">
                    <FormulaPanel score={score} />
                  </div>
                </div>
                <div className="space-y-2">
                  <FusionBar lb={lb} mlBand={score.ml_band} mlConf={score.ml_confidence} />
                  <GateBanner status={score.gate_status} reason={score.gate_reason} />
                </div>
              </Zone>

              {/* Zone 2 */}
              <Zone n="02" label="Evidence">
                <div className="grid grid-cols-2 gap-4">
                  <KeyFactors items={score.explanation} />
                  <FairnessAuditCard fa={score.fairness_audit} />
                </div>
              </Zone>

              {/* Zone 3 */}
              <Zone n="03" label="Detail">
                <div className="grid grid-cols-3 gap-4">
                  <LayerChart lb={lb} />
                  <AIAssessmentCard text={score.ai_summary} />
                  <MLAdvisoryCard score={score} />
                </div>
              </Zone>

            </div>
          )
        })()}

        {!loadingScore && !score && !error && (
          <div className="flex flex-col items-center justify-center h-full text-center p-12">
            <Building2 size={28} className="mb-3 text-[#374151]" />
            <p className="text-xs text-[#6b7280]">Select a merchant to review their application</p>
          </div>
        )}
      </div>
    </div>
  )
}
