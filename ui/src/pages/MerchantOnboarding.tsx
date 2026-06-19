import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Check, ChevronRight, Plus, X, CheckCircle2,
  CreditCard, Zap, Wifi, Smartphone, FileText,
  Lock, UploadCloud,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────

interface ProfileData {
  name: string
  phone: string
  citizenship_no: string
  business_name: string
  business_pan: string
  occupation: string
  location: string
  months_active: string
}

interface DataSourcesData {
  connected_sources: string[]
  verified_cashflow: number
  verified_bill_rate: number
  verified_qr_consistency: number
}

interface LoanData {
  loan_amount: string
  loan_purpose: string
  voucher_input: string
  vouchers: string[]
}

// ── Constants ─────────────────────────────────────────────────────────────

const STEPS = [
  'Business Profile',
  'Behavioural Data',
  'Psychometric Quiz',
  'Loan Request',
]

const OCCUPATIONS = [
  'Tea Shop', 'Grocery Store', 'Vegetable Vendor', 'Tailor',
  'Pharmacy', 'Mobile Repair', 'Street Food', 'Other',
]

const LOCATIONS = ['Kathmandu', 'Lalitpur', 'Bhaktapur', 'Kirtipur', 'Patan']

const LOAN_PURPOSES = [
  'Inventory Purchase', 'Equipment Upgrade', 'Business Expansion',
  'Working Capital', 'Other',
]

const QUIZ: { question: string; options: [string, string][] }[] = [
  {
    question: 'A friend lent you NPR 5,000 for your business. Your business had a good month. What do you do first?',
    options: [
      ['A', 'Invest it back into the business'],
      ['B', 'Return the money to your friend immediately'],
      ['C', 'Save it for emergencies'],
      ['D', 'Use it for family needs'],
    ],
  },
  {
    question: 'Your business had a slow month and you couldn\'t pay all your bills. What do you do?',
    options: [
      ['A', 'Take a new loan to cover the bills'],
      ['B', 'Negotiate with suppliers for more time'],
      ['C', 'Reduce business expenses immediately'],
      ['D', 'Ask family for help'],
    ],
  },
  {
    question: 'You have NPR 10,000 saved. A neighbor offers you a business opportunity with high returns but some risk. What do you do?',
    options: [
      ['A', 'Invest all NPR 10,000 immediately'],
      ['B', 'Invest half and keep half as backup'],
      ['C', 'Ask for more information before deciding'],
      ['D', 'Decline and keep the savings safe'],
    ],
  },
  {
    question: 'You receive a loan of NPR 50,000 for inventory. You find a supplier selling at 20% discount but you need to pay today. What do you do?',
    options: [
      ['A', 'Pay immediately and use the discount'],
      ['B', 'Check if you still have enough for other expenses first'],
      ['C', 'Skip the discount to be safe'],
      ['D', 'Ask the lender if this is okay first'],
    ],
  },
  {
    question: 'Your business is growing and you need more staff. But hiring means less profit for 3 months. What do you do?',
    options: [
      ['A', 'Hire immediately — growth is the priority'],
      ['B', 'Wait until you have 6 months of savings as buffer'],
      ['C', 'Start with part-time help to test first'],
      ['D', 'Manage alone and grow slowly'],
    ],
  },
]

// ── Primitives ────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#6b7280] mb-1.5">
      {children}
    </p>
  )
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-[#4b5563] mt-1">{children}</p>
}

function Input({
  value, onChange, placeholder = '', type = 'text', min, max,
}: {
  value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; min?: number; max?: number
}) {
  return (
    <input
      type={type}
      value={value}
      min={min}
      max={max}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2.5 rounded bg-[#0d1117] border border-[#1f2937] text-sm text-white placeholder-[#4b5563] focus:outline-none focus:border-[#374151] transition-colors"
    />
  )
}

function Select({
  value, onChange, options, placeholder = 'Select…',
}: {
  value: string; onChange: (v: string) => void
  options: string[]; placeholder?: string
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2.5 rounded bg-[#0d1117] border border-[#1f2937] text-sm text-white focus:outline-none focus:border-[#374151] transition-colors appearance-none"
      style={{ colorScheme: 'dark' }}
    >
      <option value="" disabled>{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

// (Slider removed — Step 2 now uses data source connections)

function NextButton({
  onClick, label = 'Continue', disabled = false,
}: {
  onClick: () => void; label?: string; disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-2 py-3 rounded bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
    >
      {label} <ChevronRight size={15} />
    </button>
  )
}

// ── Step indicator ────────────────────────────────────────────────────────

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => {
        const done    = i < current
        const active  = i === current
        const last    = i === STEPS.length - 1
        return (
          <div key={label} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                  ${done   ? 'bg-[#6366f1] text-white'
                  : active ? 'bg-[#6366f1] text-white ring-2 ring-[#6366f1]/30'
                           : 'bg-[#111827] border border-[#1f2937] text-[#4b5563]'}`}
              >
                {done ? <Check size={13} /> : i + 1}
              </div>
              <span
                className={`text-[10px] font-medium whitespace-nowrap
                  ${active ? 'text-white' : done ? 'text-[#6b7280]' : 'text-[#374151]'}`}
              >
                {label}
              </span>
            </div>
            {!last && (
              <div
                className="flex-1 h-px mx-1.5 mb-4 transition-colors"
                style={{ background: done ? '#6366f1' : '#1f2937' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Step 1 ────────────────────────────────────────────────────────────────

function Step1({
  data, setData, onNext,
}: {
  data: ProfileData
  setData: React.Dispatch<React.SetStateAction<ProfileData>>
  onNext: () => void
}) {
  const set = (k: keyof ProfileData) => (v: string) =>
    setData(d => ({ ...d, [k]: v }))

  const valid =
    data.name && data.phone && data.citizenship_no &&
    data.business_name && data.occupation && data.location && data.months_active

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-white">Business Profile</h2>
        <p className="text-xs text-[#6b7280] mt-0.5">Tell us about yourself and your business.</p>
      </div>

      <div className="space-y-3">
        <div>
          <Label>Full Name</Label>
          <Input value={data.name} onChange={set('name')} placeholder="Sunita Thapa" />
        </div>
        <div>
          <Label>Phone Number</Label>
          <Input value={data.phone} onChange={set('phone')} placeholder="98XXXXXXXX" />
        </div>
        <div>
          <Label>Citizenship Number</Label>
          <Input value={data.citizenship_no} onChange={set('citizenship_no')} placeholder="XX-XX-XXXX-XXXXX" />
        </div>
        <div>
          <Label>Business Name</Label>
          <Input value={data.business_name} onChange={set('business_name')} placeholder="Sunita Tea Stall" />
        </div>
        <div>
          <Label>Business PAN</Label>
          <Input value={data.business_pan} onChange={set('business_pan')} placeholder="9-digit PAN" />
        </div>
        <div>
          <Label>Occupation</Label>
          <Select value={data.occupation} onChange={set('occupation')} options={OCCUPATIONS} />
        </div>
        <div>
          <Label>Location</Label>
          <Select value={data.location} onChange={set('location')} options={LOCATIONS} />
        </div>
        <div>
          <Label>Months in Business</Label>
          <Input
            value={data.months_active} onChange={set('months_active')}
            type="number" min={1} max={60} placeholder="e.g. 18"
          />
          <FieldHint>How many months has your business been operating?</FieldHint>
        </div>
      </div>

      <NextButton onClick={onNext} disabled={!valid} />
    </div>
  )
}

// ── Step 2 — Data Sources ─────────────────────────────────────────────────

type SourceId = 'payments' | 'nea' | 'isp' | 'mobile' | 'bank'
type ConnectState = 'idle' | 'connecting' | 'connected'

interface SourceConfig {
  id: SourceId
  icon: React.ReactNode
  title: string
  description: string
  checks: string
  mockResult: string
  input?: { label: string; placeholder: string; type?: string }
  select?: { label: string; options: string[] }
  uploadMode?: boolean
}

const DATA_SOURCES: SourceConfig[] = [
  {
    id: 'payments',
    icon: <CreditCard size={16} />,
    title: 'eSewa / Khalti / FonePay',
    description: 'Verify your QR payment transaction history',
    checks: 'Transaction frequency, consistency, and digital payment volume',
    mockResult: '847 transactions verified · 94% consistency · Last transaction: 2 days ago',
  },
  {
    id: 'nea',
    icon: <Zap size={16} />,
    title: 'Nepal Electricity Authority (NEA)',
    description: 'Verify your electricity bill payment history',
    checks: 'On-time payment rate over the last 12 months',
    mockResult: '11/12 bills paid on time · 91.7% payment rate · Account active 3 years',
    input: { label: 'NEA Customer Number', placeholder: 'e.g. 0123456789' },
  },
  {
    id: 'isp',
    icon: <Wifi size={16} />,
    title: 'Internet Service Provider',
    description: 'Verify broadband or fiber bill payments',
    checks: 'Regular payment consistency for WorldLink, Subisu, or other ISPs',
    mockResult: '12/12 months paid on time · 100% consistency · WorldLink fiber',
    select: { label: 'Select ISP', options: ['WorldLink', 'Subisu', 'CG Net', 'Other'] },
  },
  {
    id: 'mobile',
    icon: <Smartphone size={16} />,
    title: 'NTC / Ncell Mobile Account',
    description: 'Verify mobile usage and airtime top-up patterns',
    checks: 'Top-up frequency and regularity as a financial discipline signal',
    mockResult: '28 top-ups in last 6 months · Regular weekly pattern · NTC prepaid',
    input: { label: 'Mobile Number', placeholder: '98XXXXXXXX' },
  },
  {
    id: 'bank',
    icon: <FileText size={16} />,
    title: 'Bank Statement',
    description: 'Upload last 6 months statement for cashflow analysis',
    checks: 'Monthly cashflow, income stability, and transaction patterns',
    mockResult: 'Statement analysed · Avg monthly cashflow: NPR 85,000 · Low volatility',
    uploadMode: true,
  },
]

const STRENGTH: Record<number, { label: string; color: string; note: string }> = {
  0: { label: 'None',     color: '#374151', note: 'Connect at least one source to continue.' },
  1: { label: 'Minimal',  color: '#ef4444', note: 'Score will rely heavily on psychometric assessment.' },
  2: { label: 'Moderate', color: '#f59e0b', note: 'Sufficient for basic credit assessment.' },
  3: { label: 'Moderate', color: '#f59e0b', note: 'Sufficient for basic credit assessment.' },
  4: { label: 'Strong',   color: '#10b981', note: 'High confidence credit assessment possible.' },
  5: { label: 'Strong',   color: '#10b981', note: 'High confidence credit assessment possible.' },
}

// ── Inline panel primitives ───────────────────────────────────────────────

function PanelInput({
  value, onChange, placeholder, type = 'text',
}: {
  value: string; onChange: (v: string) => void; placeholder: string; type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={type === 'password' ? 'current-password' : 'off'}
      className="w-full px-3 py-2 rounded bg-[#0d1117] border border-[#1f2937] text-xs text-white placeholder-[#4b5563] focus:outline-none focus:border-[#374151] transition-colors"
    />
  )
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-white mb-3">{children}</p>
}

function PanelActionBtn({
  onClick, disabled, loading, loadingLabel, label,
}: {
  onClick: () => void; disabled: boolean; loading: boolean; loadingLabel: string; label: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full flex items-center justify-center gap-2 py-2 rounded bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
    >
      {loading
        ? <><div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />{loadingLabel}</>
        : label
      }
    </button>
  )
}

function CancelLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-center text-[11px] text-[#4b5563] hover:text-[#9ca3af] transition-colors py-1"
    >
      Cancel
    </button>
  )
}

// ── Per-source inline panels ──────────────────────────────────────────────

function PaymentsPanel({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [user, setUser]       = useState('')
  const [pass, setPass]       = useState('')
  const [loading, setLoading] = useState(false)

  function handleAuth() {
    if (!user || !pass) return
    setLoading(true)
    setTimeout(onDone, 2000)
  }

  return (
    <div className="mt-3 rounded-lg border border-[#2d3748] bg-[#111827] p-4 space-y-3 animate-in">
      <PanelTitle>Authorize TrustLayer</PanelTitle>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[11px] font-bold" style={{ color: '#00c853' }}>e</span>
        <span className="text-[11px] font-semibold text-[#6b7280]">eSewa · Secure OAuth</span>
      </div>
      <PanelInput value={user} onChange={setUser} placeholder="eSewa ID / Mobile Number" />
      <PanelInput value={pass} onChange={setPass} placeholder="Password" type="password" />
      <p className="text-[10px] text-[#4b5563] leading-relaxed">
        TrustLayer will only read your transaction history. We cannot make payments.
      </p>
      <PanelActionBtn
        onClick={handleAuth}
        disabled={!user || !pass}
        loading={loading}
        loadingLabel="Verifying with eSewa…"
        label="Authorize Access"
      />
      <CancelLink onClick={onCancel} />
    </div>
  )
}

function NEAPanel({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [custNo, setCustNo]   = useState('')
  const [loading, setLoading] = useState(false)

  function handleFetch() {
    if (!custNo) return
    setLoading(true)
    setTimeout(onDone, 1500)
  }

  return (
    <div className="mt-3 rounded-lg border border-[#2d3748] bg-[#111827] p-4 space-y-3 animate-in">
      <PanelTitle>Verify NEA Account</PanelTitle>
      <PanelInput value={custNo} onChange={setCustNo} placeholder="e.g. 12345678" />
      <PanelActionBtn
        onClick={handleFetch}
        disabled={!custNo}
        loading={loading}
        loadingLabel="Fetching payment history from NEA…"
        label="Fetch Records"
      />
      <CancelLink onClick={onCancel} />
    </div>
  )
}

function ISPPanel({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [isp, setIsp]         = useState('')
  const [accId, setAccId]     = useState('')
  const [loading, setLoading] = useState(false)

  function handleVerify() {
    if (!isp || !accId) return
    setLoading(true)
    setTimeout(onDone, 1500)
  }

  return (
    <div className="mt-3 rounded-lg border border-[#2d3748] bg-[#111827] p-4 space-y-3 animate-in">
      <PanelTitle>Verify ISP Account</PanelTitle>
      <select
        value={isp}
        onChange={e => setIsp(e.target.value)}
        className="w-full px-3 py-2 rounded bg-[#0d1117] border border-[#1f2937] text-xs text-white focus:outline-none focus:border-[#374151] transition-colors appearance-none"
        style={{ colorScheme: 'dark' }}
      >
        <option value="">Select Provider…</option>
        {['WorldLink', 'Subisu', 'CG Net', 'Vianet', 'Other'].map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <PanelInput value={accId} onChange={setAccId} placeholder="Account / Customer ID" />
      <PanelActionBtn
        onClick={handleVerify}
        disabled={!isp || !accId}
        loading={loading}
        loadingLabel="Verifying account…"
        label="Verify Account"
      />
      <CancelLink onClick={onCancel} />
    </div>
  )
}

function MobilePanel({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [phone, setPhone]       = useState('')
  const [otpSent, setOtpSent]   = useState(false)
  const [otp, setOtp]           = useState('')
  const [otpError, setOtpError] = useState(false)
  const [loading, setLoading]   = useState(false)

  function handleSendOtp() {
    if (!phone) return
    setLoading(true)
    setTimeout(() => { setLoading(false); setOtpSent(true) }, 1000)
  }

  function handleVerifyOtp() {
    if (otp !== '1234') { setOtpError(true); return }
    setOtpError(false)
    setLoading(true)
    setTimeout(onDone, 1000)
  }

  return (
    <div className="mt-3 rounded-lg border border-[#2d3748] bg-[#111827] p-4 space-y-3 animate-in">
      <PanelTitle>Verify Mobile Number</PanelTitle>
      {!otpSent ? (
        <>
          <PanelInput value={phone} onChange={setPhone} placeholder="98XXXXXXXX" />
          <PanelActionBtn
            onClick={handleSendOtp}
            disabled={!phone}
            loading={loading}
            loadingLabel="Sending OTP…"
            label="Send OTP"
          />
        </>
      ) : (
        <>
          <p className="text-[11px] text-[#6b7280]">Enter 4-digit code sent to your number</p>
          <PanelInput
            value={otp}
            onChange={v => { setOtp(v); setOtpError(false) }}
            placeholder="4-digit OTP"
          />
          {otpError && (
            <p className="text-[11px] text-[#ef4444]">Incorrect code. Try again.</p>
          )}
          <p className="text-[10px] text-[#4b5563]">Enter <span className="font-mono text-[#6b7280]">1234</span> for demo</p>
          <PanelActionBtn
            onClick={handleVerifyOtp}
            disabled={otp.length !== 4}
            loading={loading}
            loadingLabel="Verifying…"
            label="Verify OTP"
          />
        </>
      )}
      <CancelLink onClick={onCancel} />
    </div>
  )
}

function BankPanel({ onDone, onCancel }: { onDone: (filename: string) => void; onCancel: () => void }) {
  const [filename, setFilename] = useState('')
  const [loading, setLoading]   = useState(false)
  const [dragging, setDragging] = useState(false)

  function handleFile(file: File | null) {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) return
    setFilename(file.name)
    setLoading(true)
    setTimeout(() => onDone(file.name), 2000)
  }

  return (
    <div className="mt-3 rounded-lg border border-[#2d3748] bg-[#111827] p-4 space-y-3 animate-in">
      <PanelTitle>Upload Bank Statement</PanelTitle>

      {loading ? (
        <div className="flex items-center gap-2 py-3 justify-center">
          <div className="w-3 h-3 rounded-full border-2 border-[#6366f1] border-t-transparent animate-spin" />
          <span className="text-xs text-[#6b7280]">Analysing statement…</span>
        </div>
      ) : (
        <label
          className="flex flex-col items-center justify-center gap-2 py-6 rounded-lg cursor-pointer transition-colors"
          style={{
            border: `1.5px dashed ${dragging ? '#6366f1' : '#374151'}`,
            background: dragging ? 'rgba(99,102,241,0.05)' : 'transparent',
          }}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0] ?? null) }}
        >
          <UploadCloud size={20} className="text-[#4b5563]" />
          <span className="text-[11px] text-[#6b7280] text-center leading-relaxed px-2">
            {filename
              ? <span className="text-white font-medium">{filename}</span>
              : 'Drag and drop your bank statement PDF or click to browse'
            }
          </span>
          <input
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={e => handleFile(e.target.files?.[0] ?? null)}
          />
        </label>
      )}

      {!loading && <p className="text-[10px] text-[#4b5563]">Accepted format: PDF only · Last 6 months</p>}
      {!loading && <CancelLink onClick={onCancel} />}
    </div>
  )
}

// ── SourceCard — card header + inline panel toggling ─────────────────────

function SourceCard({
  src,
  state,
  onConnected,
}: {
  src: SourceConfig
  state: ConnectState
  onConnected: (id: SourceId, meta?: { filename?: string }) => void
}) {
  const [panelOpen, setPanelOpen] = useState(false)
  const [uploadedFile, setUploadedFile] = useState('')

  const connected = state === 'connected'

  function handleDone(meta?: { filename?: string }) {
    setPanelOpen(false)
    onConnected(src.id, meta)
    if (meta?.filename) setUploadedFile(meta.filename)
  }

  return (
    <div
      className="rounded-lg border transition-colors"
      style={{
        borderColor: connected ? 'rgba(16,185,129,0.4)' : panelOpen ? '#374151' : '#1f2937',
        background: connected ? 'rgba(16,185,129,0.04)' : '#0d1117',
      }}
    >
      <div className="p-4 space-y-2">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 w-8 h-8 rounded flex items-center justify-center shrink-0"
              style={{
                background: connected ? 'rgba(16,185,129,0.12)' : '#111827',
                border: `1px solid ${connected ? 'rgba(16,185,129,0.3)' : '#1f2937'}`,
                color: connected ? '#10b981' : '#6b7280',
              }}
            >
              {src.icon}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white leading-tight">{src.title}</p>
              <p className="text-[11px] text-[#6b7280] mt-0.5">{src.description}</p>
            </div>
          </div>
          <span
            className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={connected
              ? { color: '#10b981', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }
              : { color: '#4b5563', background: '#111827', border: '1px solid #1f2937' }
            }
          >
            {connected ? 'Connected' : 'Not Connected'}
          </span>
        </div>

        {/* What it checks */}
        <p className="text-[11px] text-[#4b5563] leading-relaxed">{src.checks}</p>

        {/* Verified result */}
        {connected && (
          <p className="text-[11px] font-medium" style={{ color: '#10b981' }}>
            ✓ {src.mockResult}
            {uploadedFile && <span className="text-[#6b7280] ml-2">({uploadedFile})</span>}
          </p>
        )}

        {/* Connect / Upload button — only when idle (not yet expanded or connected) */}
        {!connected && !panelOpen && (
          <button
            onClick={() => setPanelOpen(true)}
            className="mt-1 w-full flex items-center justify-center gap-2 py-2 rounded border border-[#374151] bg-[#111827] text-xs font-semibold text-[#9ca3af] hover:text-white hover:border-[#4b5563] transition-colors"
          >
            {src.uploadMode ? 'Upload PDF' : 'Connect'}
          </button>
        )}
      </div>

      {/* Inline panels */}
      {panelOpen && !connected && (
        <div className="px-4 pb-4">
          {src.id === 'payments' && (
            <PaymentsPanel onDone={() => handleDone()} onCancel={() => setPanelOpen(false)} />
          )}
          {src.id === 'nea' && (
            <NEAPanel onDone={() => handleDone()} onCancel={() => setPanelOpen(false)} />
          )}
          {src.id === 'isp' && (
            <ISPPanel onDone={() => handleDone()} onCancel={() => setPanelOpen(false)} />
          )}
          {src.id === 'mobile' && (
            <MobilePanel onDone={() => handleDone()} onCancel={() => setPanelOpen(false)} />
          )}
          {src.id === 'bank' && (
            <BankPanel
              onDone={filename => handleDone({ filename })}
              onCancel={() => setPanelOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  )
}

function Step2({
  data, setData, onNext,
}: {
  data: DataSourcesData
  setData: React.Dispatch<React.SetStateAction<DataSourcesData>>
  onNext: () => void
}) {
  const [states, setStates] = useState<Record<SourceId, ConnectState>>({
    payments: 'idle', nea: 'idle', isp: 'idle', mobile: 'idle', bank: 'idle',
  })

  function handleConnected(id: SourceId, _meta?: { filename?: string }) {
    setStates(s => ({ ...s, [id]: 'connected' }))
    setData(d => {
      const next = { ...d, connected_sources: [...d.connected_sources, id] }
      if (id === 'bank')     next.verified_cashflow       = 85000
      if (id === 'nea')      next.verified_bill_rate      = 0.917
      if (id === 'payments') next.verified_qr_consistency = 0.94
      return next
    })
  }

  const count = data.connected_sources.length
  const strength = STRENGTH[Math.min(count, 5)]

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-white">Verify Your Business Data</h2>
        <p className="text-xs text-[#6b7280] mt-0.5 leading-relaxed">
          Connect your existing accounts to automatically verify your business activity. Your data is encrypted and only used for credit assessment.
        </p>
      </div>

      {/* Source cards */}
      <div className="space-y-3">
        {DATA_SOURCES.map(src => (
          <SourceCard
            key={src.id}
            src={src}
            state={states[src.id]}
            onConnected={handleConnected}
          />
        ))}
      </div>

      {/* Summary */}
      <div className="rounded-lg border border-[#1f2937] bg-[#111827] p-4 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#6b7280]">Sources connected</span>
          <span className="font-semibold text-white tabular-nums">{count} of 5</span>
        </div>

        {/* Strength bar */}
        <div className="space-y-1.5">
          <div className="h-1.5 rounded-full bg-[#1f2937] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(count / 5) * 100}%`, background: strength.color }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span style={{ color: strength.color }} className="font-semibold">{strength.label}</span>
            <span className="text-[#4b5563]">{strength.note}</span>
          </div>
        </div>

        <p className="text-[10px] text-[#4b5563] leading-relaxed">
          Connecting more sources increases your credit confidence score and may improve your loan ceiling.
        </p>
      </div>

      {/* Privacy note */}
      <div className="flex items-start gap-2">
        <Lock size={11} className="text-[#4b5563] mt-0.5 shrink-0" />
        <p className="text-[10px] text-[#4b5563] leading-relaxed">
          Your data is processed locally and shared only with your chosen financial institution. TrustLayer does not store raw financial data.
        </p>
      </div>

      <NextButton
        onClick={onNext}
        disabled={count === 0}
        label={count === 0 ? 'Connect at least one source' : `Continue with ${count} verified source${count !== 1 ? 's' : ''}`}
      />
    </div>
  )
}

// ── Step 3 ────────────────────────────────────────────────────────────────

function Step3({ onDone }: { onDone: (answers: string[]) => void }) {
  const [qIndex, setQIndex]       = useState(0)
  const [answers, setAnswers]     = useState<string[]>([])
  const [selected, setSelected]   = useState<string | null>(null)
  const [analysing, setAnalysing] = useState(false)

  const q = QUIZ[qIndex]
  const isLast = qIndex === QUIZ.length - 1

  function handleNext() {
    if (!selected) return
    const next = [...answers, selected]
    if (isLast) {
      setAnswers(next)
      setAnalysing(true)
      setTimeout(() => onDone(next), 2000)
    } else {
      setAnswers(next)
      setSelected(null)
      setQIndex(i => i + 1)
    }
  }

  if (analysing) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="w-10 h-10 rounded-full border-2 border-[#6366f1] border-t-transparent animate-spin" />
        <p className="text-sm font-medium text-white">Analysing your responses…</p>
        <p className="text-xs text-[#6b7280]">This takes just a moment</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-white">Character Assessment</h2>
        <p className="text-xs text-[#6b7280] mt-0.5 leading-relaxed">
          5 short questions to help us understand your financial approach. There are no right or wrong answers.
        </p>
      </div>

      <div className="flex items-center gap-2">
        {QUIZ.map((_, i) => (
          <div
            key={i}
            className="flex-1 h-1 rounded-full transition-colors"
            style={{ background: i < qIndex ? '#6366f1' : i === qIndex ? '#6366f1' : '#1f2937', opacity: i === qIndex ? 1 : i < qIndex ? 0.6 : 1 }}
          />
        ))}
      </div>
      <p className="text-[11px] text-[#6b7280]">Question {qIndex + 1} of {QUIZ.length}</p>

      <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-4">
        <p className="text-sm text-white leading-relaxed font-medium">{q.question}</p>
      </div>

      <div className="space-y-2">
        {q.options.map(([letter, text]) => {
          const active = selected === letter
          return (
            <button
              key={letter}
              onClick={() => setSelected(letter)}
              className="w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors"
              style={{
                background: active ? 'rgba(99,102,241,0.12)' : '#0d1117',
                borderColor: active ? '#6366f1' : '#1f2937',
                color: active ? '#fff' : '#9ca3af',
              }}
            >
              <span className="font-bold mr-3" style={{ color: active ? '#818cf8' : '#4b5563' }}>
                {letter}
              </span>
              {text}
            </button>
          )
        })}
      </div>

      <NextButton
        onClick={handleNext}
        label={isLast ? 'Submit Assessment' : 'Next Question'}
        disabled={!selected}
      />
    </div>
  )
}

// ── Step 4 ────────────────────────────────────────────────────────────────

function Step4({
  data, setData, onSubmit, submitting,
}: {
  data: LoanData
  setData: React.Dispatch<React.SetStateAction<LoanData>>
  onSubmit: () => void
  submitting: boolean
}) {
  const set = (k: keyof LoanData) => (v: string) =>
    setData(d => ({ ...d, [k]: v }))

  function addVoucher() {
    const pan = data.voucher_input.trim()
    if (!pan || data.vouchers.length >= 3 || data.vouchers.includes(pan)) return
    setData(d => ({ ...d, vouchers: [...d.vouchers, pan], voucher_input: '' }))
  }

  function removeVoucher(pan: string) {
    setData(d => ({ ...d, vouchers: d.vouchers.filter(v => v !== pan) }))
  }

  const valid = data.loan_amount && data.loan_purpose

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-white">Loan Request</h2>
        <p className="text-xs text-[#6b7280] mt-0.5">Tell us about the loan you need.</p>
      </div>

      <div className="space-y-3">
        <div>
          <Label>Loan Amount Requested (NPR)</Label>
          <Input
            value={data.loan_amount} onChange={set('loan_amount')}
            type="number" placeholder="e.g. 50000"
          />
        </div>
        <div>
          <Label>Loan Purpose</Label>
          <Select value={data.loan_purpose} onChange={set('loan_purpose')} options={LOAN_PURPOSES} />
        </div>
      </div>

      <div className="h-px bg-[#1f2937]" />

      <div className="space-y-3">
        <div>
          <Label>Community Vouch Request</Label>
          <p className="text-[11px] text-[#6b7280] mb-2 leading-relaxed">
            Ask a fellow merchant to vouch for you. Vouches improve your trust score. Optional but recommended.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            value={data.voucher_input}
            onChange={e => set('voucher_input')(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addVoucher()}
            placeholder="Voucher's Business PAN"
            className="flex-1 px-3 py-2.5 rounded bg-[#0d1117] border border-[#1f2937] text-sm text-white placeholder-[#4b5563] focus:outline-none focus:border-[#374151] transition-colors"
          />
          <button
            onClick={addVoucher}
            disabled={!data.voucher_input.trim() || data.vouchers.length >= 3}
            className="px-3 py-2.5 rounded bg-[#111827] border border-[#1f2937] hover:border-[#374151] disabled:opacity-40 disabled:cursor-not-allowed text-[#9ca3af] hover:text-white transition-colors"
          >
            <Plus size={15} />
          </button>
        </div>

        <p className="text-[10px] text-[#4b5563]">We will notify them via SMS to confirm your vouch request. Max 3 vouchers.</p>

        {data.vouchers.length > 0 && (
          <div className="space-y-1.5">
            {data.vouchers.map(pan => (
              <div
                key={pan}
                className="flex items-center justify-between px-3 py-2 rounded bg-[#111827] border border-[#1f2937]"
              >
                <span className="text-xs font-mono text-[#9ca3af]">{pan}</span>
                <button
                  onClick={() => removeVoucher(pan)}
                  className="text-[#4b5563] hover:text-[#ef4444] transition-colors ml-2"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onSubmit}
        disabled={!valid || submitting}
        className="w-full flex items-center justify-center gap-2 py-3 rounded bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
      >
        {submitting ? (
          <>
            <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            Submitting…
          </>
        ) : (
          <>Submit Application <ChevronRight size={15} /></>
        )}
      </button>
    </div>
  )
}

// ── Success screen ────────────────────────────────────────────────────────

function SuccessScreen({ name }: { name: string }) {
  const refId = `TL-${Math.floor(100000 + Math.random() * 900000)}`

  return (
    <div className="flex flex-col items-center text-center gap-5 py-4">
      <div className="w-14 h-14 rounded-full bg-[rgba(16,185,129,0.12)] border border-[rgba(16,185,129,0.3)] flex items-center justify-center">
        <CheckCircle2 size={28} className="text-[#10b981]" />
      </div>

      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-white">Application Submitted Successfully</h2>
        <p className="text-sm text-[#6b7280]">Your TrustLayer Credit Profile has been created.</p>
      </div>

      <div className="w-full bg-[#111827] border border-[#1f2937] rounded-lg p-4 space-y-3 text-left">
        <p className="text-[10px] font-semibold tracking-[0.1em] uppercase text-[#6b7280]">Credit Profile Preview</p>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">{name || 'Applicant'}</p>
            <p className="text-[11px] text-[#6b7280] mt-0.5">TrustLayer Member</p>
          </div>
          <div
            className="px-2.5 py-1 rounded text-xs font-bold"
            style={{ color: '#6366f1', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}
          >
            New
          </div>
        </div>

        <div className="h-px bg-[#1f2937]" />

        <div className="flex items-center justify-between">
          <p className="text-[11px] text-[#6b7280]">Preliminary Score</p>
          <p className="text-xs font-semibold text-[#6b7280] animate-pulse">Calculating…</p>
        </div>

        <div className="h-1.5 rounded-full bg-[#1f2937] overflow-hidden">
          <div className="h-full w-2/3 rounded-full bg-[#6366f1] animate-pulse" />
        </div>

        <p className="text-[11px] text-[#6b7280] leading-relaxed">
          Your bank will review your application within 24 hours.
        </p>

        <div className="flex items-center justify-between pt-1">
          <p className="text-[10px] text-[#4b5563]">Reference ID</p>
          <p className="text-[11px] font-mono font-semibold text-[#9ca3af]">{refId}</p>
        </div>
      </div>

      <div className="w-full flex flex-col gap-2">
        <Link
          to="/bank"
          className="w-full flex items-center justify-center gap-2 py-3 rounded bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-semibold transition-colors no-underline"
        >
          View My Score <ChevronRight size={14} />
        </Link>
        <Link
          to="/"
          className="w-full flex items-center justify-center py-3 rounded border border-[#1f2937] hover:border-[#374151] text-[#9ca3af] hover:text-white text-sm font-semibold transition-colors no-underline"
        >
          Done
        </Link>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function MerchantOnboarding() {
  const [step, setStep]         = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [profile, setProfile] = useState<ProfileData>({
    name: '', phone: '', citizenship_no: '', business_name: '',
    business_pan: '', occupation: '', location: '', months_active: '',
  })

  const [dataSources, setDataSources] = useState<DataSourcesData>({
    connected_sources: [],
    verified_cashflow: 0,
    verified_bill_rate: 0,
    verified_qr_consistency: 0,
  })

  const [loanData, setLoanData] = useState<LoanData>({
    loan_amount: '', loan_purpose: '', voucher_input: '', vouchers: [],
  })

  function handleQuizDone(_answers: string[]) {
    setStep(3)
  }

  function handleSubmit() {
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      setSubmitted(true)
    }, 1800)
  }

  return (
    <main className="flex-1 flex flex-col bg-[#0f0e1a]">
      <div className="flex-1 flex flex-col items-center py-8 px-4">
        <div className="w-full max-w-[480px]">

          {submitted ? (
            <SuccessScreen name={profile.name} />
          ) : (
            <>
              <StepBar current={step} />

              <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-5">
                {step === 0 && (
                  <Step1 data={profile} setData={setProfile} onNext={() => setStep(1)} />
                )}
                {step === 1 && (
                  <Step2 data={dataSources} setData={setDataSources} onNext={() => setStep(2)} />
                )}
                {step === 2 && (
                  <Step3 onDone={handleQuizDone} />
                )}
                {step === 3 && (
                  <Step4
                    data={loanData} setData={setLoanData}
                    onSubmit={handleSubmit} submitting={submitting}
                  />
                )}
              </div>
            </>
          )}

          <p className="text-center text-[10px] text-[#374151] mt-6">
            Powered by <span className="text-[#4b5563] font-semibold">TrustLayer</span> · Alternative Credit Infrastructure
          </p>
        </div>
      </div>
    </main>
  )
}
