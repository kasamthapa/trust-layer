import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import {
  Shield, Activity, Users,
  ChevronRight, Database, Network, AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import { getHealth, getMerchants, getGraph } from './api'
import type { HealthResponse, MerchantSummary, GraphResponse } from './types'
import BankDashboard from './pages/BankDashboard'
import MerchantOnboarding from './pages/MerchantOnboarding'
import TrustGraph from './pages/TrustGraph'
import VouchReview from './pages/VouchReview'

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
      <div className="border-b border-[#1f2937] bg-[#0d1117] px-6 py-2 flex items-center gap-3 flex-wrap text-xs overflow-x-auto">

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
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 max-w-xl mx-auto w-full text-center">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-[#6b7280] uppercase mb-5">
          Alternative Credit Infrastructure · Nepal
        </p>
        <h1 className="text-5xl font-semibold text-white tracking-tight mb-4 leading-none">
          TrustLayer
        </h1>
        <p className="text-[#6b7280] text-sm max-w-sm mx-auto leading-relaxed mb-10">
          Credit trust middleware for collateral-free MSME lending — behavioral signals, community vouching, fairness audit.
        </p>

        <div className="flex items-center gap-3">
          <Link
            to="/onboard"
            className="flex items-center gap-2 px-5 py-2.5 rounded bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-semibold transition-colors no-underline"
          >
            Merchant Flow <ChevronRight size={13} />
          </Link>
          <Link
            to="/bank"
            className="flex items-center gap-2 px-5 py-2.5 rounded border border-[#1f2937] hover:border-[#374151] text-[#9ca3af] hover:text-white text-sm font-semibold transition-colors no-underline"
          >
            Bank Dashboard <ChevronRight size={13} />
          </Link>
        </div>

        {health && (
          <div className="mt-10 flex items-center gap-5 flex-wrap justify-center">
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
                <div key={label} className="flex items-center gap-1.5 text-xs">
                  {ok
                    ? <CheckCircle2 size={11} className="text-[#10b981]" />
                    : <AlertTriangle size={11} className="text-[#f59e0b]" />
                  }
                  <span className={ok ? 'text-[#6b7280]' : 'text-[#f59e0b]'}>{label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div className="border-t border-[#1f2937] px-6 py-3 flex items-center justify-between flex-wrap gap-3 text-[11px] text-[#4b5563]">
        <div className="flex items-center gap-2 flex-wrap">
          <Database size={11} />
          <span>FastAPI · PostgreSQL · XGBoost · NetworkX · Gemma3 4B</span>
        </div>
        <div className="flex items-center gap-2">
          <Shield size={11} className="text-[#10b981]" />
          <span>NRB Digital Lending Guidelines 2082 · Fintech Regulatory Sandbox</span>
        </div>
      </div>

    </main>
  )
}

// ── Placeholder pages ─────────────────────────────────────────────────────

function OnboardPage() {
  return <MerchantOnboarding />
}

function BankPage() {
  return <BankDashboard />
}

function GraphPage() {
  return <TrustGraph />
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
    <header className="flex items-center justify-between px-5 py-2.5 border-b border-[#1f2937] bg-[#0d1117] sticky top-0 z-50">

      {/* Logo */}
      <Link to="/" className="flex items-center gap-2.5 no-underline shrink-0">
        <div className="w-6 h-6 rounded bg-[#111827] border border-[#1f2937] flex items-center justify-center">
          <Shield size={13} className="text-[#6366f1]" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-semibold text-white text-sm">TrustLayer</span>
          <span className="text-[9px] text-[#6b7280] tracking-[0.15em] uppercase">
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
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors no-underline
              ${location.pathname === to
                ? 'bg-[#111827] text-white'
                : 'text-[#6b7280] hover:text-white hover:bg-[#111827]'
              }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {/* Right */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[11px] text-[#4b5563] hidden sm:inline font-mono">
          API {health?.version ? `v${health.version}` : 'v1.0.0'}
        </span>
        <span className="text-[10px] text-[#10b981] hidden sm:inline">NRB Sandbox</span>
        <div className="flex items-center gap-1.5">
          <Activity size={11} className="text-[#4b5563]" />
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              health === null
                ? 'bg-[#4b5563] animate-pulse'
                : statusOk
                ? 'bg-[#10b981]'
                : 'bg-[#f59e0b] animate-pulse'
            }`}
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
        <Route path="/vouch"   element={<VouchReview />} />
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
