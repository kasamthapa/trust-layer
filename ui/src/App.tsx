import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import {
  Shield, Activity, Users, Building2, GitBranch,
  ChevronRight, Database, Network, AlertTriangle,
  CheckCircle2, User,
} from 'lucide-react'
import { getHealth, getMerchants, getGraph } from './api'
import type { HealthResponse, MerchantSummary, GraphResponse } from './types'

// ── Landing page ──────────────────────────────────────────────────────────

function LandingPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [merchants, setMerchants] = useState<MerchantSummary[]>([])
  const [graph, setGraph] = useState<GraphResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([getHealth(), getMerchants(), getGraph()]).then(
      ([h, m, g]) => {
        if (h.status === 'fulfilled') setHealth(h.value)
        if (m.status === 'fulfilled') setMerchants(m.value)
        if (g.status === 'fulfilled') setGraph(g.value)
        setLoading(false)
      }
    )
  }, [])

  const statusOk = health?.status === 'ok'
  const fraudCount = graph?.stats.fraud_count ?? 5
  const edgeCount  = graph?.stats.total_edges ?? 37

  return (
    <main className="flex-1 flex flex-col">

      {/* ── Stats bar ──────────────────────────────────────────────────── */}
      <div className="border-b border-[#2d2b52] bg-[#1a1833]/60 backdrop-blur-sm px-6 py-2.5 flex items-center gap-3 flex-wrap text-xs overflow-x-auto">

        <div className="tl-stat-pill">
          <span
            className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-[#94a3b8] animate-pulse' : statusOk ? 'bg-[#10b981]' : 'bg-[#f59e0b]'}`}
          />
          <span className="text-[#f1f5f9] font-medium">
            System Status:&nbsp;
          </span>
          {loading ? 'Checking…' : statusOk ? 'Operational' : 'Degraded'}
        </div>

        <div className="tl-stat-pill">
          <Users size={12} className="text-[#6366f1]" />
          <span className="text-[#f1f5f9] font-medium">Merchants Enrolled:</span>
          <span className="text-[#6366f1] font-semibold">
            {loading ? '…' : merchants.length}
          </span>
        </div>

        <div className="tl-stat-pill">
          <Network size={12} className="text-[#6366f1]" />
          <span className="text-[#f1f5f9] font-medium">Trust Connections:</span>
          <span className="text-[#6366f1] font-semibold">
            {loading ? '…' : edgeCount}
          </span>
        </div>

        <div className="tl-stat-pill">
          <AlertTriangle size={12} className="text-[#ef4444]" />
          <span className="text-[#f1f5f9] font-medium">Fraud Nodes Detected:</span>
          <span className="text-[#ef4444] font-semibold">
            {loading ? '…' : fraudCount}
          </span>
        </div>

        <div className="tl-stat-pill ml-auto">
          <Shield size={12} className="text-[#10b981]" />
          <span className="text-[#10b981] font-semibold">NRB Sandbox Compliant</span>
        </div>
      </div>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 max-w-5xl mx-auto w-full">

        <div className="text-center mb-12">
          <p className="text-[10px] font-bold tracking-[0.25em] text-[#6366f1] uppercase mb-4">
            Alternative Credit Infrastructure
          </p>
          <h1 className="text-6xl font-bold text-[#f1f5f9] tracking-tight mb-4 leading-none">
            TrustLayer
          </h1>
          <p className="text-[#94a3b8] text-lg max-w-lg mx-auto leading-relaxed">
            Open-source credit trust middleware for collateral-free MSME lending in Nepal
          </p>
        </div>

        {/* ── Action cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-3xl">

          {/* Merchant card */}
          <div className="tl-card p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-lg bg-[#1e1b4b] border border-[#2d2b52] flex items-center justify-center">
                <User size={18} className="text-[#6366f1]" />
              </div>
              <span className="badge-accent">Mobile-first flow</span>
            </div>
            <div className="flex-1">
              <h2 className="text-[#f1f5f9] font-semibold text-lg mb-2 leading-snug">
                Merchant Onboarding Flow
              </h2>
              <p className="text-[#94a3b8] text-sm leading-relaxed">
                Simulate how a merchant submits behavioral data, completes psychometric
                assessment, and requests community vouches to build their trust score.
              </p>
            </div>
            <Link
              to="/onboard"
              className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-semibold transition-colors no-underline"
            >
              Launch Merchant Flow
              <ChevronRight size={16} />
            </Link>
          </div>

          {/* Bank officer card */}
          <div className="tl-card p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-lg bg-[#1e1b4b] border border-[#2d2b52] flex items-center justify-center">
                <Building2 size={18} className="text-[#6366f1]" />
              </div>
              <span className="badge-accent">BFI Integration Layer</span>
            </div>
            <div className="flex-1">
              <h2 className="text-[#f1f5f9] font-semibold text-lg mb-2 leading-snug">
                Bank Officer Dashboard
              </h2>
              <p className="text-[#94a3b8] text-sm leading-relaxed">
                Review merchant trust scores, fraud detection results, fairness audits,
                and AI-generated lending summaries across all enrolled merchants.
              </p>
            </div>
            <Link
              to="/bank"
              className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-[#3730a3] hover:border-[#6366f1] hover:bg-[#1e1b4b] text-[#f1f5f9] text-sm font-semibold transition-colors no-underline"
            >
              Open Dashboard
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>

        {/* ── System layer indicators ───────────────────────────────────── */}
        {health && (
          <div className="mt-8 flex items-center gap-3 flex-wrap justify-center">
            {(
              [
                ['database',     health.database,     'NeonDB'],
                ['ml_layer',     health.ml_layer,     'XGBoost ML'],
                ['graph_engine', health.graph_engine, 'NetworkX Graph'],
                ['ai_layer',     health.ai_layer,     'Gemma3 AI'],
              ] as [string, string, string][]
            ).map(([, value, label]) => {
              const ok = ['connected','loaded','ready','reachable'].includes(value)
              return (
                <div key={label} className="flex items-center gap-1.5 text-xs text-[#94a3b8]">
                  {ok
                    ? <CheckCircle2 size={12} className="text-[#10b981]" />
                    : <AlertTriangle size={12} className="text-[#f59e0b]" />
                  }
                  <span className={ok ? 'text-[#f1f5f9]' : 'text-[#f59e0b]'}>{label}</span>
                  <span className="text-[#3d3b62]">·</span>
                  <span>{value}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Footer info bar ────────────────────────────────────────────── */}
      <div className="border-t border-[#2d2b52] bg-[#1a1833]/40 px-6 py-3 flex items-center justify-between flex-wrap gap-3 text-[11px] text-[#94a3b8]">
        <div className="flex items-center gap-2 flex-wrap">
          <Database size={11} className="text-[#3730a3]" />
          <span>Powered by:</span>
          {['FastAPI', 'PostgreSQL (NeonDB)', 'XGBoost', 'NetworkX', 'Gemma3 4B (Local AI)'].map((t, i, a) => (
            <span key={t}>
              <span className="text-[#f1f5f9] font-medium">{t}</span>
              {i < a.length - 1 && <span className="text-[#3d3b62] mx-1">·</span>}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Shield size={11} className="text-[#10b981]" />
          <span>Regulatory context:</span>
          <span className="text-[#f1f5f9] font-medium">NRB Digital Lending Guidelines 2082</span>
          <span className="text-[#3d3b62]">·</span>
          <span className="text-[#f1f5f9] font-medium">Fintech Regulatory Sandbox</span>
        </div>
      </div>

    </main>
  )
}

// ── Placeholder pages ─────────────────────────────────────────────────────

function OnboardPage() {
  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <div className="text-center text-[#94a3b8]">
        <User size={32} className="mx-auto mb-3 text-[#6366f1]" />
        <h2 className="text-2xl font-semibold text-[#f1f5f9] mb-2">Merchant Onboarding</h2>
        <p>Full onboarding flow — coming next.</p>
      </div>
    </main>
  )
}

function BankPage() {
  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <div className="text-center text-[#94a3b8]">
        <Building2 size={32} className="mx-auto mb-3 text-[#6366f1]" />
        <h2 className="text-2xl font-semibold text-[#f1f5f9] mb-2">Bank Officer Dashboard</h2>
        <p>Credit review dashboard — coming next.</p>
      </div>
    </main>
  )
}

function GraphPage() {
  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <div className="text-center text-[#94a3b8]">
        <GitBranch size={32} className="mx-auto mb-3 text-[#6366f1]" />
        <h2 className="text-2xl font-semibold text-[#f1f5f9] mb-2">Trust Graph</h2>
        <p>Vouch network visualisation — coming next.</p>
      </div>
    </main>
  )
}

// ── Header ────────────────────────────────────────────────────────────────

function Header({ health }: { health: HealthResponse | null }) {
  const location = useLocation()
  const navLinks = [
    { to: '/',       label: 'Home' },
    { to: '/onboard', label: 'Merchant Flow' },
    { to: '/bank',    label: 'Bank Dashboard' },
    { to: '/graph',   label: 'Trust Graph' },
  ]
  const statusOk = health?.status === 'ok'

  return (
    <header className="flex items-center justify-between px-5 py-2.5 border-b border-[#2d2b52] bg-[#1a1833]/90 backdrop-blur-sm sticky top-0 z-50">

      {/* Logo */}
      <Link to="/" className="flex items-center gap-2.5 no-underline shrink-0">
        <div className="w-7 h-7 rounded-md bg-[#1e1b4b] border border-[#3730a3] flex items-center justify-center">
          <Shield size={14} className="text-[#6366f1]" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-bold text-[#f1f5f9] text-sm tracking-tight">TrustLayer</span>
          <span className="text-[9px] font-semibold tracking-[0.18em] text-[#6366f1] uppercase">
            Credit Middleware v1.0
          </span>
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex items-center gap-0.5">
        {navLinks.map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors no-underline
              ${location.pathname === to
                ? 'bg-[#2d2b52] text-[#f1f5f9]'
                : 'text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#2d2b52]'
              }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {/* Right status cluster */}
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="text-[11px] font-medium text-[#94a3b8] hidden sm:inline">
          API {health?.version ? `v${health.version}` : 'v1.0.0'}
        </span>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0f3d2e] border border-[#10b981]/30">
          <Shield size={10} className="text-[#10b981]" />
          <span className="text-[10px] font-bold text-[#10b981] tracking-wide uppercase hidden sm:inline">
            NRB Sandbox
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Activity size={12} className="text-[#94a3b8]" />
          <span
            className={`w-2 h-2 rounded-full ${
              health === null
                ? 'bg-[#94a3b8] animate-pulse'
                : statusOk
                ? 'bg-[#10b981]'
                : 'bg-[#f59e0b] animate-pulse'
            }`}
            title={health?.status ?? 'connecting…'}
          />
        </div>
      </div>
    </header>
  )
}

// ── App shell ─────────────────────────────────────────────────────────────

function AppShell() {
  const [health, setHealth] = useState<HealthResponse | null>(null)

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth(null))
    const id = setInterval(
      () => getHealth().then(setHealth).catch(() => setHealth(null)),
      30_000
    )
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <Header health={health} />
      <Routes>
        <Route path="/"        element={<LandingPage />} />
        <Route path="/onboard" element={<OnboardPage />} />
        <Route path="/bank"    element={<BankPage />} />
        <Route path="/graph"   element={<GraphPage />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
