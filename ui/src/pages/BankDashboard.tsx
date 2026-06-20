import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Cell, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Search, MapPin, Briefcase, Clock, Building2,
  RefreshCw, XCircle, ArrowRight, AlertTriangle,
  ChevronDown, ChevronRight, Shield, Users, TrendingUp,
} from 'lucide-react'
import { getMerchantProfile, getMerchants, getMerchantScore } from '../api'
import type { MerchantProfile, MerchantSummary, ScoreResponse } from '../types'
import { useAppState } from '../store'

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

// Derive loan recommendation from score data
function getRecommendation(score: ScoreResponse): {
  label: string
  color: string
  borderColor: string
  icon: string
} {
  if (score.fraud_flagged) {
    return { label: '✗ DECLINE — Fraud Risk', color: '#ef4444', borderColor: '#ef4444', icon: '✗' }
  }
  if (score.gate_status === 'FLAGGED') {
    return { label: '⚠ REVIEW REQUIRED', color: '#f59e0b', borderColor: '#f59e0b', icon: '⚠' }
  }
  if (score.score >= 650) {
    return { label: '✓ APPROVE', color: '#10b981', borderColor: '#10b981', icon: '✓' }
  }
  if (score.score >= 450) {
    return { label: '⚡ CAUTIOUS APPROVE', color: '#f59e0b', borderColor: '#f59e0b', icon: '⚡' }
  }
  return { label: '✗ DECLINE — Insufficient Trust Score', color: '#ef4444', borderColor: '#ef4444', icon: '✗' }
}

// Derive sidebar dot color per merchant
function recoDot(score: ScoreResponse | undefined): string {
  if (!score) return '#374151'
  const r = getRecommendation(score)
  return r.borderColor
}

// ── Skeleton ──────────────────────────────────────────────────────────────

function Sk({ w = 'w-full', h = 'h-4' }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} rounded bg-[#1f2937] animate-pulse`} />
}

function ScoreSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="rounded-lg border border-[#1f2937] bg-[#111827] px-4 py-3 flex items-center gap-3">
        <div className="w-4 h-4 rounded-full border-2 border-[#6366f1] border-t-transparent animate-spin" />
        <div>
          <p className="text-sm font-semibold text-white">Analysing merchant profile…</p>
          <p className="text-xs text-[#6b7280]">Running score, graph trust, fairness audit, and AI summary.</p>
        </div>
      </div>
      {/* Header */}
      <div className="pb-5 border-b border-[#1f2937] space-y-2">
        <Sk w="w-64" h="h-8" />
        <Sk w="w-48" h="h-4" />
      </div>
      {/* Decision card */}
      <Sk h="h-52" />
      {/* AI Summary */}
      <Sk h="h-32" />
      {/* Evidence cards */}
      <div className="grid grid-cols-3 gap-4">
        <Sk h="h-56" /><Sk h="h-56" /><Sk h="h-56" />
      </div>
    </div>
  )
}

// ── Reusable primitives ───────────────────────────────────────────────────

function Card({ children, className = '', style }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties
}) {
  return (
    <div className={`bg-[#111827] border border-[#1f2937] rounded-lg ${className}`} style={style}>
      {children}
    </div>
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

function ScoreRing({ score, band }: { score: number; band: string }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const dash = Math.min(score / 1000, 1) * circ
  const color = BAND_COLOR[band] ?? '#6366f1'
  return (
    <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
      <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#1f2937" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="text-2xl font-bold text-white tabular-nums">{score}</span>
        <span className="text-[10px] text-[#6b7280] mt-0.5">/1000</span>
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[#6b7280]">
      {children}
    </p>
  )
}

// ── Merchant picker card ──────────────────────────────────────────────────

function MerchantCard({ m, active, dotColor, onClick }: {
  m: MerchantSummary; active: boolean; dotColor: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded border transition-colors
        ${active ? 'bg-[#1a2332] border-[#374151]' : 'bg-transparent border-transparent hover:bg-[#111827] hover:border-[#1f2937]'}`}
    >
      <div className="flex items-start gap-2">
        <div
          className="mt-1.5 w-2 h-2 rounded-full shrink-0 transition-colors"
          style={{ background: dotColor }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white font-medium truncate">{m.name}</p>
          <p className="text-xs text-[#6b7280] truncate mt-0.5">{m.business_type}</p>
          <div className="flex gap-3 mt-1 text-[11px] text-[#4b5563]">
            <span className="flex items-center gap-1"><MapPin size={9} />{m.location}</span>
            <span className="flex items-center gap-1"><Clock size={9} />{m.months_active}mo</span>
          </div>
        </div>
      </div>
    </button>
  )
}

// ── Section 1: Merchant Header ────────────────────────────────────────────

function MerchantHeader({ score }: { score: ScoreResponse }) {
  return (
    <div className="pb-5 border-b border-[#1f2937]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white leading-tight">{score.name}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-[#6b7280]">
            <span className="flex items-center gap-1.5"><Briefcase size={12} />{score.business_type}</span>
            <span className="flex items-center gap-1.5"><MapPin size={12} />{score.location}</span>
            <span className="font-mono text-[#4b5563] text-xs">{score.merchant_id}</span>
          </div>
          <p className="text-sm text-[#9ca3af] mt-1">
            {score.layer_breakdown.formula_score > 0
              ? `${Math.round(score.confidence * 100 / 10) * 10 > 12 ? Math.round(score.confidence * 100 / 10) * 10 : 12} months in business`
              : 'New merchant'
            }
          </p>
        </div>
        <span className="shrink-0 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-900/40 text-indigo-300 border border-indigo-700/40">
          Active Application
        </span>
      </div>
    </div>
  )
}

// ── Section 2: Loan Decision Card ─────────────────────────────────────────

function LoanDecisionCard({ score }: { score: ScoreResponse }) {
  const rec = getRecommendation(score)
  const overCeiling = score.requested_loan > score.loan_ceiling
  const overPct = overCeiling
    ? Math.round(((score.requested_loan - score.loan_ceiling) / score.loan_ceiling) * 100)
    : 0

  return (
    <div
      className="bg-[#131b2e] border border-[#1f2937] rounded-lg overflow-hidden"
      style={{ borderLeftColor: rec.borderColor, borderLeftWidth: 4 }}
    >
      <div className="p-5 space-y-5">

        {/* Top row: label + recommendation */}
        <div className="flex items-center justify-between">
          <Label>Loan Recommendation</Label>
          <span
            className="text-sm font-bold px-3 py-1 rounded"
            style={{ color: rec.color, background: `${rec.color}14`, border: `1px solid ${rec.color}30` }}
          >
            {rec.label}
          </span>
        </div>

        {/* Three stat boxes */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#0d1117] border border-[#1f2937] rounded-lg p-4 flex flex-col items-center">
            <Label>Credit Score</Label>
            <div className="mt-2"><ScoreRing score={score.score} band={score.band} /></div>
            <div className="mt-2"><BandBadge band={score.band} /></div>
          </div>
          <div className="bg-[#0d1117] border border-[#1f2937] rounded-lg p-4 text-center">
            <Label>Safe Loan Ceiling</Label>
            <p className="text-2xl font-bold text-[#10b981] tabular-nums mt-2">NPR {fmt(score.loan_ceiling)}</p>
            <p className="text-[11px] text-[#4b5563] mt-1">Based on verified cashflow</p>
          </div>
          <div className="bg-[#0d1117] border border-[#1f2937] rounded-lg p-4 text-center">
            <Label>Requested Amount</Label>
            <p
              className="text-2xl font-bold tabular-nums mt-2"
              style={{ color: overCeiling ? '#ef4444' : '#10b981' }}
            >
              NPR {fmt(score.requested_loan)}
            </p>
            <p className={`text-[11px] mt-1 ${overCeiling ? 'text-[#ef4444]' : 'text-[#4b5563]'}`}>
              {overCeiling ? `${overPct}% above ceiling` : 'Within safe range'}
            </p>
          </div>
        </div>

        {/* Confidence bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Confidence Level</Label>
            <span className="text-sm font-semibold text-white">{(score.confidence * 100).toFixed(0)}%</span>
          </div>
          <div className="h-2 rounded-full bg-[#1f2937] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${score.confidence * 100}%`,
                background: score.confidence >= 0.6 ? '#10b981' : '#f59e0b',
              }}
            />
          </div>
          <p className="text-xs text-[#6b7280]">
            Based on {Math.round(score.confidence * 24)} months of verified activity
          </p>
        </div>

        {/* Warning box — only if flagged */}
        {score.gate_status === 'FLAGGED' && (
          <div
            className="flex items-start gap-3 rounded-lg px-4 py-3 border"
            style={{
              background: score.fraud_flagged ? '#7f1d1d20' : '#78350f20',
              borderColor: score.fraud_flagged ? '#ef444440' : '#f59e0b40',
            }}
          >
            <AlertTriangle
              size={16}
              className="shrink-0 mt-0.5"
              style={{ color: score.fraud_flagged ? '#ef4444' : '#f59e0b' }}
            />
            <div>
              <p className="text-sm font-semibold" style={{ color: score.fraud_flagged ? '#ef4444' : '#f59e0b' }}>
                {score.fraud_flagged ? 'Fraud Risk Detected' : 'Loan Amount Anomaly'}
              </p>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: score.fraud_flagged ? '#fca5a5' : '#fcd34d' }}>
                {score.fraud_flagged
                  ? 'This merchant is part of a detected circular vouching ring. Their community vouches are from an isolated group with no external connections.'
                  : overCeiling
                    ? `The requested loan amount is ${overPct}% above the recommended safe ceiling based on verified monthly cashflow.`
                    : score.gate_reason ?? 'This application has been flagged for manual review.'
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Section 3: AI Assessment ──────────────────────────────────────────────

function AIAssessmentSection({ text }: { text: string | null }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <Label>Loan Officer Summary</Label>
        <span className="text-[11px] text-[#4b5563]">AI Generated · Local · Private</span>
      </div>
      {text ? (
        <p className="text-[15px] text-[#d1d5db] leading-relaxed">{text}</p>
      ) : (
        <p className="text-sm text-[#4b5563] animate-pulse">Generating assessment…</p>
      )}
    </Card>
  )
}

// ── Section 4: Evidence Cards ─────────────────────────────────────────────

function EvidenceRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <span className={`text-sm shrink-0 mt-0.5 ${ok ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
        {ok ? '✓' : '⚠'}
      </span>
      <p className={`text-sm leading-snug ${ok ? 'text-[#9ca3af]' : 'text-[#f87171]'}`}>{label}</p>
    </div>
  )
}

function EvidenceRowAmber({ label }: { label: string }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <span className="text-sm shrink-0 mt-0.5 text-[#f59e0b]">⚡</span>
      <p className="text-sm leading-snug text-[#fcd34d]">{label}</p>
    </div>
  )
}

function StatLine({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#1f2937] last:border-0">
      <span className="text-sm text-[#6b7280]">{label}</span>
      <span className="text-sm font-semibold" style={{ color: color ?? '#ffffff' }}>{value}</span>
    </div>
  )
}

function pctColor(v: number) {
  return v >= 0.8 ? '#10b981' : v >= 0.6 ? '#f59e0b' : '#ef4444'
}

function PaymentBehaviorCard({ score }: { score: ScoreResponse }) {
  const lb = score.layer_breakdown
  const overall = lb.formula_score >= 650 ? 'Strong' : lb.formula_score >= 450 ? 'Moderate' : 'Weak'
  const overallColor = lb.formula_score >= 650 ? '#10b981' : lb.formula_score >= 450 ? '#f59e0b' : '#ef4444'

  // Reconstruct approximate ratios from formula score; real values come from explanation
  const bills = score.explanation.find(e => e.factor.toLowerCase().includes('bill'))
  const qr    = score.explanation.find(e => e.factor.toLowerCase().includes('qr') || e.factor.toLowerCase().includes('digital'))
  const air   = score.explanation.find(e => e.factor.toLowerCase().includes('airtime'))
  const stab  = score.explanation.find(e => e.factor.toLowerCase().includes('stabil') || e.factor.toLowerCase().includes('volatil'))

  return (
    <Card className="p-5 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={15} className="text-[#6366f1]" />
        <p className="text-sm font-semibold text-white">Payment Behavior</p>
      </div>
      <div className="flex-1 divide-y divide-[#1f2937]">
        {bills && (
          <StatLine
            label="Bill payments"
            value={bills.direction === '+' ? 'On time' : 'Irregular'}
            color={bills.direction === '+' ? '#10b981' : '#ef4444'}
          />
        )}
        {qr && (
          <StatLine
            label="Digital payment usage"
            value={qr.direction === '+' ? 'Consistent' : 'Low'}
            color={qr.direction === '+' ? '#10b981' : '#ef4444'}
          />
        )}
        {air && (
          <StatLine
            label="Airtime regularity"
            value={air.direction === '+' ? 'Regular' : 'Irregular'}
            color={air.direction === '+' ? '#10b981' : '#ef4444'}
          />
        )}
        {stab && (
          <StatLine
            label="Income stability"
            value={stab.direction === '+' ? 'Stable' : 'Volatile'}
            color={stab.direction === '+' ? '#10b981' : '#ef4444'}
          />
        )}
        {!bills && !qr && !air && !stab && (
          score.explanation.slice(0, 4).map((e, i) => (
            <StatLine
              key={i}
              label={e.factor}
              value={e.direction === '+' ? 'Good' : 'Weak'}
              color={e.direction === '+' ? '#10b981' : '#ef4444'}
            />
          ))
        )}
      </div>
      <div className="mt-4 pt-3 border-t border-[#1f2937] flex items-center justify-between">
        <span className="text-xs text-[#6b7280]">Overall assessment</span>
        <span className="text-sm font-bold" style={{ color: overallColor }}>{overall}</span>
      </div>
    </Card>
  )
}

function CommunityStandingCard({ score }: { score: ScoreResponse }) {
  const vs = score.vouch_stats
  const lb = score.layer_breakdown

  const overall = score.fraud_flagged
    ? 'Fraud risk'
    : lb.graph_score >= 600 ? 'Trusted'
    : 'Limited network'
  const overallColor = score.fraud_flagged ? '#ef4444' : lb.graph_score >= 600 ? '#10b981' : '#f59e0b'

  return (
    <Card className="p-5 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Users size={15} className="text-[#10b981]" />
        <p className="text-sm font-semibold text-white">Community Standing</p>
      </div>
      <div className="flex-1 divide-y divide-[#1f2937]">
        <StatLine label="Vouches received" value={`${vs.vouches_received} of 5 maximum`} />
        <StatLine label="Vouches given" value={`${vs.vouches_given} of 5 maximum`} />
        <StatLine label="Network trust score" value={`${lb.graph_score} / 1000`} color={pctColor(lb.graph_score / 1000)} />
        <div className="py-1.5">
          {vs.fraud_association ? (
            <EvidenceRow ok={false} label="Vouched for a flagged merchant" />
          ) : (
            <EvidenceRow ok={true} label="No fraud associations" />
          )}
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-[#1f2937] flex items-center justify-between">
        <span className="text-xs text-[#6b7280]">Overall standing</span>
        <span className="text-sm font-bold" style={{ color: overallColor }}>{overall}</span>
      </div>
    </Card>
  )
}

function RiskAssessmentCard({ score }: { score: ScoreResponse }) {
  const overCeiling = score.requested_loan > score.loan_ceiling
  const thinFile    = score.confidence < 0.4
  const fa          = score.fairness_audit
  const faOk        = fa.status === 'passed'

  return (
    <Card className="p-5 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Shield size={15} className="text-[#f59e0b]" />
        <p className="text-sm font-semibold text-white">Risk Assessment</p>
      </div>
      <div className="flex-1 divide-y divide-[#1f2937]">
        <div className="py-0.5">
          {overCeiling
            ? <EvidenceRow ok={false} label="Loan exceeds safe ceiling" />
            : <EvidenceRow ok={true} label="Loan within safe range" />
          }
        </div>
        <div className="py-0.5">
          {score.fraud_flagged
            ? <EvidenceRow ok={false} label="Fraud ring member" />
            : <EvidenceRow ok={true} label="No fraud detected" />
          }
        </div>
        <div className="py-0.5">
          {thinFile
            ? <EvidenceRowAmber label="Limited history — use caution" />
            : <EvidenceRow ok={true} label="Sufficient history" />
          }
        </div>
        <div className="py-0.5">
          <div className="flex items-start gap-2.5 py-1.5">
            <span className={`text-sm shrink-0 mt-0.5 ${faOk ? 'text-[#10b981]' : 'text-[#f59e0b]'}`}>
              {faOk ? '✓' : '⚡'}
            </span>
            <p className={`text-sm leading-snug ${faOk ? 'text-[#9ca3af]' : 'text-[#fcd34d]'}`}>
              {fa.title}
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ── Section 5: Technical Details (collapsible) ────────────────────────────

function TechSignalCard({ title, score, band, children }: {
  title: string; score: number; band: string; children: React.ReactNode
}) {
  return (
    <Card className="p-4 flex flex-col gap-3">
      <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[#6b7280]">{title}</p>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-white tabular-nums">{score}</span>
          <span className="text-xs text-[#4b5563]">/1000</span>
        </div>
        <div className="mt-1.5"><BandBadge band={band} /></div>
      </div>
      <div className="border-t border-[#1f2937] pt-3 space-y-3 text-xs text-[#9ca3af] leading-relaxed">
        {children}
      </div>
    </Card>
  )
}

function TechRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[#4b5563]">{label}</p>
      <div>{children}</div>
    </div>
  )
}

function TechnicalDetails({ score }: { score: ScoreResponse }) {
  const lb = score.layer_breakdown
  const fBand = bandFromScore(lb.formula_score)
  const gBand = bandFromScore(lb.graph_score)
  const mlColor = BAND_COLOR[score.ml_band] ?? '#6b7280'

  const chartData = [
    { name: 'Formula',  value: lb.formula_score },
    { name: 'Graph',    value: lb.graph_score   },
    { name: 'Fused',    value: lb.final_fused   },
  ]

  return (
    <div className="space-y-4 pt-4">

      {/* Fusion equation */}
      <Card className="px-4 py-3 space-y-1">
        <p className="text-xs font-mono">
          <span className="text-[#6b7280]">Final Score = </span>
          <span className="text-white font-semibold">70%</span>
          <span className="text-[#6b7280]"> × Formula ({lb.formula_score}) + </span>
          <span className="text-white font-semibold">30%</span>
          <span className="text-[#6b7280]"> × Graph ({lb.graph_score}) = </span>
          <span className="text-white font-bold">{lb.final_fused}</span>
        </p>
        <p className="text-[11px] text-[#4b5563]">
          ML predicts <span className="text-[#6b7280]">{score.ml_band}</span> ({(score.ml_confidence * 100).toFixed(0)}% confidence) — shadow mode, not in final score
        </p>
      </Card>

      {/* Three signal cards */}
      <div className="grid grid-cols-3 gap-4">
        <TechSignalCard title="Rule-Based Formula" score={lb.formula_score} band={fBand}>
          <TechRow label="What This Measures">
            Behavioral consistency — bills, QR payments, airtime, cashflow stability. Weighted by data confidence.
          </TechRow>
          <TechRow label="Weight">
            <span className="text-white font-semibold">70%</span> — primary signal
          </TechRow>
          <TechRow label="Formula">
            <span className="font-mono text-[10px] text-[#6b7280]">60% bills + 30% QR + 20% airtime + 10% stability</span>
          </TechRow>
        </TechSignalCard>

        <TechSignalCard title="Community Trust (PageRank)" score={lb.graph_score} band={gBand}>
          <TechRow label="What This Measures">
            Voucher network trust. A vouch from a highly trusted merchant carries more weight.
          </TechRow>
          <TechRow label="Weight">
            <span className="text-white font-semibold">30%</span> — supporting signal
          </TechRow>
          {score.fraud_flagged && (
            <div className="flex items-start gap-1.5 rounded border border-[#ef444440] bg-[#ef444410] px-2 py-1.5">
              <span className="text-[#ef4444] shrink-0">⚠</span>
              <p className="text-[#ef4444]">Fraud ring detected — isolated vouching cluster</p>
            </div>
          )}
        </TechSignalCard>

        <TechSignalCard title="ML Pattern Recognition" score={lb.ml_score} band={score.ml_band}>
          <TechRow label="What This Measures">
            XGBoost trained on 2,000 synthetic profiles. Finds patterns the formula may miss.
          </TechRow>
          <TechRow label="Weight">
            <span className="text-white font-semibold">0%</span> — advisory only
          </TechRow>
          <TechRow label="Prediction">
            <span className="font-bold" style={{ color: mlColor }}>{score.ml_band}</span>
            <span className="text-[#6b7280] ml-2">({(score.ml_confidence * 100).toFixed(0)}% confidence)</span>
          </TechRow>
        </TechSignalCard>
      </div>

      {/* Layer chart + SHAP */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[#6b7280] mb-3">Layer Breakdown</p>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 4 }}>
              <XAxis type="number" domain={[0, 1000]} hide />
              <YAxis
                type="category" dataKey="name" width={50}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false} tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                contentStyle={{ background: '#0d1117', border: '1px solid #1f2937', borderRadius: 6, fontSize: 12, color: '#f9fafb' }}
                formatter={(v) => [`${Number(v ?? 0)} / 1000`]}
              />
              <Bar dataKey="value" radius={3} label={{ position: 'right', fill: '#6b7280', fontSize: 11 }}>
                {chartData.map((_, i) => <Cell key={i} fill={LAYER_COLORS[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-[#4b5563] mt-2 leading-relaxed">{lb.ml_note}</p>
        </Card>

        {score.shap_factors.length > 0 && (
          <Card className="p-4">
            <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[#6b7280] mb-3">SHAP Feature Impact (ML)</p>
            <div className="space-y-2.5">
              {score.shap_factors.slice(0, 5).map((s, i) => {
                const pos = s.direction === '+'
                const max = Math.max(...score.shap_factors.map(x => Math.abs(x.impact)), 0.0001)
                const pct = (Math.abs(s.impact) / max) * 100
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
          </Card>
        )}
      </div>

      {/* Fairness audit + Key factors */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4" style={{ borderLeftColor: score.fairness_audit.status === 'passed' ? '#10b981' : '#f59e0b', borderLeftWidth: 3 } as React.CSSProperties}>
          <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[#6b7280] mb-3">Fairness Audit</p>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-white">{score.fairness_audit.title}</p>
            {score.fairness_audit.adjustment > 0 && (
              <span className="text-xs font-semibold text-[#f59e0b]">+{score.fairness_audit.adjustment} pts</span>
            )}
          </div>
          {score.fairness_audit.status === 'corrected' && (
            <div className="flex items-center gap-2 text-xs text-[#9ca3af] mb-2 font-mono">
              <span>{score.fairness_audit.before_score}</span>
              <span className="text-[#f59e0b]">+{score.fairness_audit.adjustment}</span>
              <ArrowRight size={11} className="text-[#4b5563]" />
              <span className="text-white font-semibold">{score.fairness_audit.after_score}</span>
            </div>
          )}
          <p className="text-xs text-[#9ca3af] leading-relaxed">{score.fairness_audit.summary}</p>
        </Card>

        <Card className="p-4">
          <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[#6b7280] mb-3">Key Score Factors</p>
          <div className="space-y-2">
            {score.explanation.slice(0, 5).map((e, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className={`font-bold shrink-0 ${e.direction === '+' ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>{e.direction}</span>
                <span className="text-[#9ca3af] leading-relaxed"><span className="text-white font-medium">{e.factor}:</span> {e.detail}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function TechnicalToggle({ score }: { score: ScoreResponse }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-[#1f2937] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#111827] transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown size={14} className="text-[#6b7280]" /> : <ChevronRight size={14} className="text-[#6b7280]" />}
          <span className="text-sm text-[#6b7280] font-medium">Technical Scoring Details</span>
          <span className="text-[11px] text-[#374151]">for developers &amp; judges</span>
        </div>
        <span className="text-[11px] text-[#374151]">{open ? 'Collapse' : 'Expand'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          <TechnicalDetails score={score} />
        </div>
      )}
    </div>
  )
}


function DetailCell({ label, value }: { label: string; value: React.ReactNode }) {
  const display = value === null || value === undefined || value === '' ? 'Not captured yet' : value
  return (
    <div className="rounded-lg border border-[#1f2937] bg-[#0d1117] px-3 py-2.5">
      <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[#4b5563]">{label}</p>
      <div className="mt-1 text-sm text-[#d1d5db] break-words">{display}</div>
    </div>
  )
}

function fmtOptionalNpr(value?: number | null) {
  if (value === null || value === undefined) return null
  return `NPR ${fmt(value)}`
}

function fmtRatio(value?: number | null) {
  if (value === null || value === undefined) return null
  return `${Math.round(value * 100)}%`
}

function MerchantDetailsToggle({ profile, loading }: { profile: MerchantProfile | null; loading: boolean }) {
  const [open, setOpen] = useState(false)
  const sources = profile?.connected_sources
    ? profile.connected_sources.split(',').map(s => s.trim()).filter(Boolean).join(', ')
    : null
  const inferredBusinessName = profile
    ? profile.business_name || `${profile.name} · ${profile.business_type}`
    : null
  return (
    <div className="border border-[#1f2937] rounded-lg overflow-hidden bg-[#0d1117]/40">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#111827] transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown size={14} className="text-[#6b7280]" /> : <ChevronRight size={14} className="text-[#6b7280]" />}
          <span className="text-sm text-[#d1d5db] font-semibold">Merchant Details</span>
          <span className="text-[11px] text-[#4b5563]">submitted onboarding information</span>
        </div>
        <span className="text-[11px] text-[#374151]">{open ? 'Collapse' : 'Expand'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          {loading ? (
            <div className="grid grid-cols-3 gap-3 pt-1">
              {Array.from({ length: 9 }).map((_, i) => <Sk key={i} h="h-16" />)}
            </div>
          ) : profile ? (
            <div className="grid grid-cols-3 gap-3 pt-1">
              <DetailCell label="Merchant ID" value={profile.id} />
              <DetailCell label="Owner Name" value={profile.name} />
              <DetailCell label="Phone" value={profile.phone} />
              <DetailCell label="Business Name" value={inferredBusinessName} />
              <DetailCell label="Business Type" value={profile.business_type} />
              <DetailCell label="PAN Number" value={profile.business_pan || 'Not captured on older records'} />
              <DetailCell label="Citizenship No." value={profile.citizenship_no || 'Not captured on older records'} />
              <DetailCell label="Location" value={profile.location} />
              <DetailCell label="Months Active" value={`${profile.months_active} months`} />
              <DetailCell label="Cashflow" value={fmtOptionalNpr(profile.cashflow_monthly_npr)} />
              <DetailCell label="Requested Loan" value={fmtOptionalNpr(profile.requested_loan_npr)} />
              <DetailCell label="Loan Purpose" value={profile.loan_purpose || 'Working capital'} />
              <DetailCell label="Bill Payment" value={fmtRatio(profile.bill_payment_ratio)} />
              <DetailCell label="QR Consistency" value={fmtRatio(profile.qr_transaction_consistency)} />
              <DetailCell label="Airtime Regularity" value={fmtRatio(profile.airtime_topup_frequency)} />
              <DetailCell label="Volatility" value={fmtRatio(profile.transaction_volatility)} />
              <DetailCell label="Last Transaction" value={profile.days_since_last_transaction != null ? `${profile.days_since_last_transaction} days ago` : null} />
              <DetailCell label="Connected Sources" value={sources || 'Verified behaviour signals available'} />
            </div>
          ) : (
            <p className="pt-2 text-sm text-[#6b7280]">Merchant details are not available.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────

export default function BankDashboard() {
  const { dataVersion }                 = useAppState()
  const [searchParams]                  = useSearchParams()
  const [merchants, setMerchants]       = useState<MerchantSummary[]>([])
  const [query, setQuery]               = useState('')
  const [selected, setSelected]         = useState<string>('')
  const [score, setScore]               = useState<ScoreResponse | null>(null)
  const [profile, setProfile]           = useState<MerchantProfile | null>(null)
  const [loadingList, setLoadingList]   = useState(true)
  const [loadingScore, setLoadingScore] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const rightRef   = useRef<HTMLDivElement>(null)
  const scoreCache = useRef<Record<string, ScoreResponse>>({})

  // fetchScore — checks ref cache first, never conflicts with selection state
  function fetchScore(id: string) {
    if (!id) return
    if (scoreCache.current[id]) {
      setScore(scoreCache.current[id])
      setLoadingScore(false)
      return
    }
    setLoadingScore(true)
    setScore(null)
    setError(null)
    getMerchantScore(id)
      .then(s => {
        scoreCache.current[id] = s
        // Only apply if this is still the selected merchant
        setSelected(cur => { if (cur === id) { setScore(s); setLoadingScore(false) } return cur })
        rightRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      })
      .catch(() => { setError('Failed to load score. Please retry.'); setLoadingScore(false) })
  }

  function fetchProfile(id: string) {
    if (!id) return
    setLoadingProfile(true)
    getMerchantProfile(id)
      .then(p => {
        setSelected(cur => { if (cur === id) setProfile(p); return cur })
      })
      .catch(() => setProfile(null))
      .finally(() => setLoadingProfile(false))
  }

  // Effect 1: Load & sort merchants on mount and whenever dataVersion bumps (new onboarding)
  useEffect(() => {
    scoreCache.current = {}   // clear stale cache on refresh
    setLoadingList(true)
    getMerchants()
      .then(list => {
        const sorted = [...list].sort((a, b) => {
          const numA = parseInt(a.id.replace(/\D/g, ''), 10)
          const numB = parseInt(b.id.replace(/\D/g, ''), 10)
          return numB - numA   // newest (highest number) first
        })
        setMerchants(sorted)
        setLoadingList(false)
        // Check if we came from onboarding with a ?merchant= param
        const paramId = searchParams.get('merchant')
        const target  = paramId && sorted.find(m => m.id === paramId) ? paramId : (sorted[0]?.id ?? '')
        setSelected(target)
        fetchScore(target)
      })
      .catch(() => {
        setError('Failed to load merchant list. Is the engine running?')
        setLoadingList(false)
      })
  }, [dataVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Effect 2: Fetch score whenever selected changes (user clicks a merchant)
  useEffect(() => {
    if (selected) {
      fetchScore(selected)
      fetchProfile(selected)
    }
  }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = merchants.filter(m =>
    m.name.toLowerCase().includes(query.toLowerCase()) ||
    m.business_type.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="flex-1 flex overflow-hidden h-[calc(100vh-49px)]">

      {/* Sidebar */}
      <aside className="w-[280px] shrink-0 flex flex-col border-r border-[#1f2937] bg-[#0d1117]">
        <div className="px-3 pt-3 pb-2 border-b border-[#1f2937]">
          <div className="mb-3 pb-2 border-b border-[#1f2937]">
            <img src="/trustlayer-logo.png" alt="TrustLayer" style={{ height: '28px', objectFit: 'contain' }} />
          </div>
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
                  key={m.id}
                  m={m}
                  active={m.id === selected}
                  dotColor={recoDot(scoreCache.current[m.id])}
                  onClick={() => setSelected(m.id)}
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

        {!loadingScore && score && (
          <div className="p-6 space-y-6 max-w-4xl mx-auto pb-16">

            {/* Section 1: Merchant Header */}
            <MerchantHeader score={score} />

            {/* Section 2: Loan Decision */}
            <LoanDecisionCard score={score} />

            {/* Submitted Merchant Details */}
            <MerchantDetailsToggle profile={profile} loading={loadingProfile} />

            {/* Section 3: AI Assessment */}
            <AIAssessmentSection text={score.ai_summary} />

            {/* Section 4: Evidence Summary */}
            <div>
              <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[#4b5563] mb-3">Evidence Summary</p>
              <div className="grid grid-cols-3 gap-4">
                <PaymentBehaviorCard score={score} />
                <CommunityStandingCard score={score} />
                <RiskAssessmentCard score={score} />
              </div>
            </div>

            {/* Section 5: Technical Details (collapsible) */}
            <TechnicalToggle score={score} />

          </div>
        )}

        {!loadingScore && !score && !error && (
          <div className="flex flex-col items-center justify-center h-full text-center p-12">
            <Building2 size={28} className="mb-3 text-[#374151]" />
            <p className="text-sm text-[#6b7280]">Select a merchant to review their application</p>
          </div>
        )}
      </div>
    </div>
  )
}
