import { useState } from "react";
import { createMerchant } from "../api";
import { useAppState } from "../store";
import {
  ChevronRight,
  Plus,
  X,
  CheckCircle2,
  CreditCard,
  Zap,
  Wifi,
  Smartphone,
  FileText,
  Lock,
  UploadCloud,
  ArrowLeft,
  Landmark,
  Globe,
  Send,
  Wallet,
  Banknote,
  Briefcase,
  PiggyBank,
  ArrowUpRight,
  LayoutGrid,
  Home,
  MoreHorizontal,
  Bell,
  User,
  Search,
  PenLine,
  ShoppingCart,
  ArrowDownLeft,
  Receipt,
  Phone,
  Users,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

interface ProfileData {
  name: string;
  phone: string;
  citizenship_no: string;
  business_name: string;
  business_pan: string;
  business_type: string;
  custom_business_type: string;
  location: string;
  months_active: string;
}

interface DataSourcesData {
  connected_sources: string[];
  verified_cashflow: number;
  verified_bill_rate: number;
  verified_qr_consistency: number;
}

interface LoanData {
  loan_amount: string;
  loan_purpose: string;
  voucher_input: string;
  vouchers: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────

const NABIL = "#00a651";

const STEPS = [
  "Business Profile",
  "Verify Data",
  "Character Quiz",
  "Loan Request",
];

const OCCUPATIONS = [
  "Tea Shop",
  "Grocery Store",
  "Vegetable Vendor",
  "Tailor",
  "Pharmacy",
  "Mobile Repair",
  "Street Food",
  "Other",
];

const LOCATIONS = ["Kathmandu", "Lalitpur", "Bhaktapur", "Kirtipur", "Patan"];

const LOAN_PURPOSES = [
  "Inventory Purchase",
  "Equipment Upgrade",
  "Business Expansion",
  "Working Capital",
  "Other",
];

const QUIZ: { question: string; options: [string, string][] }[] = [
  {
    question:
      "A friend lent you NPR 5,000 for your business. Your business had a good month. What do you do first?",
    options: [
      ["A", "Invest it back into the business"],
      ["B", "Return the money to your friend immediately"],
      ["C", "Save it for emergencies"],
      ["D", "Use it for family needs"],
    ],
  },
  {
    question:
      "Your business had a slow month and you couldn't pay all your bills. What do you do?",
    options: [
      ["A", "Take a new loan to cover the bills"],
      ["B", "Negotiate with suppliers for more time"],
      ["C", "Reduce business expenses immediately"],
      ["D", "Ask family for help"],
    ],
  },
  {
    question:
      "You have NPR 10,000 saved. A neighbor offers you a business opportunity with high returns but some risk. What do you do?",
    options: [
      ["A", "Invest all NPR 10,000 immediately"],
      ["B", "Invest half and keep half as backup"],
      ["C", "Ask for more information before deciding"],
      ["D", "Decline and keep the savings safe"],
    ],
  },
  {
    question:
      "You receive a loan of NPR 50,000 for inventory. You find a supplier selling at 20% discount but you need to pay today. What do you do?",
    options: [
      ["A", "Pay immediately and use the discount"],
      ["B", "Check if you still have enough for other expenses first"],
      ["C", "Skip the discount to be safe"],
      ["D", "Ask the lender if this is okay first"],
    ],
  },
  {
    question:
      "Your business is growing and you need more staff. But hiring means less profit for 3 months. What do you do?",
    options: [
      ["A", "Hire immediately — growth is the priority"],
      ["B", "Wait until you have 6 months of savings as buffer"],
      ["C", "Start with part-time help to test first"],
      ["D", "Manage alone and grow slowly"],
    ],
  },
];

// ── Nabil-themed primitives ───────────────────────────────────────────────

function NLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold tracking-wide uppercase text-gray-500 mb-1.5">
      {children}
    </p>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-gray-400 mt-1">{children}</p>;
}

function NInput({
  value,
  onChange,
  placeholder = "",
  type = "text",
  min,
  max,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type={type}
      value={value}
      min={min}
      max={max}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none transition-colors"
      style={{ borderColor: "#d1d5db" }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = NABIL;
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = "#d1d5db";
      }}
    />
  );
}

function NSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 text-sm text-gray-900 focus:outline-none appearance-none"
      style={{ borderColor: value ? "#d1d5db" : "#d1d5db" }}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function GreenButton({
  onClick,
  label = "Continue",
  disabled = false,
  loading = false,
}: {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full flex items-center justify-center gap-2 py-3.5 text-white text-sm font-semibold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background: NABIL, borderRadius: 50 }}
    >
      {loading ? (
        <>
          <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
          Processing…
        </>
      ) : (
        <>
          {label} <ChevronRight size={15} />
        </>
      )}
    </button>
  );
}

// ── Step dots ─────────────────────────────────────────────────────────────

function StepDots({ current }: { current: number }) {
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div className="flex items-center gap-2">
        {STEPS.map((_, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <div key={i} className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full transition-colors"
                style={{
                  background: done || active ? NABIL : "#d1d5db",
                  transform: active ? "scale(1.3)" : "scale(1)",
                }}
              />
              {i < STEPS.length - 1 && (
                <div
                  className="w-6 h-px"
                  style={{ background: done ? NABIL : "#d1d5db" }}
                />
              )}
            </div>
          );
        })}
      </div>
      <p className="text-sm font-semibold" style={{ color: NABIL }}>
        {STEPS[current]}
      </p>
      <p className="text-xs text-gray-400">
        Step {current + 1} of {STEPS.length}
      </p>
    </div>
  );
}

// ── Step 1 ────────────────────────────────────────────────────────────────

function Step1({
  data,
  setData,
  onNext,
}: {
  data: ProfileData;
  setData: React.Dispatch<React.SetStateAction<ProfileData>>;
  onNext: () => void;
}) {
  const set = (k: keyof ProfileData) => (v: string) =>
    setData((d) => ({ ...d, [k]: v }));
  const businessTypeValid =
    data.business_type &&
    (data.business_type !== "Other" || data.custom_business_type.trim().length >= 2);
  const valid =
    data.name &&
    data.phone &&
    data.citizenship_no &&
    data.business_name &&
    businessTypeValid &&
    data.location &&
    data.months_active;

  return (
    <div className="space-y-4">
      <div className="mb-2">
        <h2 className="text-base font-bold text-gray-900">Business Profile</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Tell us about yourself and your business.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <NLabel>Full Name</NLabel>
          <NInput
            value={data.name}
            onChange={set("name")}
            placeholder="Sunita Thapa"
          />
        </div>
        <div>
          <NLabel>Phone Number</NLabel>
          <NInput
            value={data.phone}
            onChange={set("phone")}
            placeholder="98XXXXXXXX"
          />
        </div>
        <div>
          <NLabel>Citizenship Number</NLabel>
          <NInput
            value={data.citizenship_no}
            onChange={set("citizenship_no")}
            placeholder="XX-XX-XXXX-XXXXX"
          />
        </div>
        <div>
          <NLabel>Business Name</NLabel>
          <NInput
            value={data.business_name}
            onChange={set("business_name")}
            placeholder="Sunita Tea Stall"
          />
        </div>
        <div>
          <NLabel>Business PAN</NLabel>
          <NInput
            value={data.business_pan}
            onChange={set("business_pan")}
            placeholder="9-digit PAN"
          />
        </div>
        <div>
          <NLabel>Type of Business</NLabel>
          <NSelect
            value={data.business_type}
            onChange={(value) =>
              setData((d) => ({
                ...d,
                business_type: value,
                custom_business_type: value === "Other" ? d.custom_business_type : "",
              }))
            }
            options={OCCUPATIONS}
          />
          {data.business_type === "Other" && (
            <div className="mt-3">
              <NLabel>Enter Business Type</NLabel>
              <NInput
                value={data.custom_business_type}
                onChange={set("custom_business_type")}
                placeholder="e.g. Dairy supplier, farm tools shop"
              />
              <FieldHint>Use the actual business category shown to lenders.</FieldHint>
            </div>
          )}
        </div>
        <div>
          <NLabel>Location</NLabel>
          <NSelect
            value={data.location}
            onChange={set("location")}
            options={LOCATIONS}
          />
        </div>
        <div>
          <NLabel>Months in Business</NLabel>
          <NInput
            value={data.months_active}
            onChange={set("months_active")}
            type="number"
            min={1}
            max={60}
            placeholder="e.g. 18"
          />
          <FieldHint>
            How many months has your business been operating?
          </FieldHint>
        </div>
      </div>

      <GreenButton onClick={onNext} disabled={!valid} />
    </div>
  );
}

// ── Step 2 — Data Sources ─────────────────────────────────────────────────

type SourceId = "payments" | "nea" | "isp" | "mobile" | "bank";
type ConnectState = "idle" | "connecting" | "connected";

interface SourceConfig {
  id: SourceId;
  icon: React.ReactNode;
  title: string;
  description: string;
  checks: string;
  mockResult: string;
  input?: { label: string; placeholder: string; type?: string };
  select?: { label: string; options: string[] };
  uploadMode?: boolean;
}

const DATA_SOURCES: SourceConfig[] = [
  {
    id: "payments",
    icon: <CreditCard size={16} />,
    title: "eSewa / Khalti / FonePay",
    description: "Verify your QR payment transaction history",
    checks: "Transaction frequency, consistency, and digital payment volume",
    mockResult:
      "847 transactions verified · 94% consistency · Last transaction: 2 days ago",
  },
  {
    id: "nea",
    icon: <Zap size={16} />,
    title: "Nepal Electricity Authority (NEA)",
    description: "Verify your electricity bill payment history",
    checks: "On-time payment rate over the last 12 months",
    mockResult:
      "11/12 bills paid on time · 91.7% payment rate · Account active 3 years",
    input: { label: "NEA Customer Number", placeholder: "e.g. 0123456789" },
  },
  {
    id: "isp",
    icon: <Wifi size={16} />,
    title: "Internet Service Provider",
    description: "Verify broadband or fiber bill payments",
    checks: "Regular payment consistency for WorldLink, Subisu, or other ISPs",
    mockResult:
      "12/12 months paid on time · 100% consistency · WorldLink fiber",
    select: {
      label: "Select ISP",
      options: ["WorldLink", "Subisu", "CG Net", "Other"],
    },
  },
  {
    id: "mobile",
    icon: <Smartphone size={16} />,
    title: "NTC / Ncell Mobile Account",
    description: "Verify mobile usage and airtime top-up patterns",
    checks: "Top-up frequency and regularity as a financial discipline signal",
    mockResult:
      "28 top-ups in last 6 months · Regular weekly pattern · NTC prepaid",
    input: { label: "Mobile Number", placeholder: "98XXXXXXXX" },
  },
  {
    id: "bank",
    icon: <FileText size={16} />,
    title: "Bank Statement",
    description: "Upload last 6 months statement for cashflow analysis",
    checks: "Monthly cashflow, income stability, and transaction patterns",
    mockResult:
      "Statement analysed · Avg monthly cashflow: NPR 85,000 · Low volatility",
    uploadMode: true,
  },
];

const STRENGTH: Record<number, { label: string; color: string; note: string }> =
  {
    0: {
      label: "None",
      color: "#d1d5db",
      note: "Connect at least one source to continue.",
    },
    1: {
      label: "Minimal",
      color: "#ef4444",
      note: "Score will rely heavily on psychometric assessment.",
    },
    2: {
      label: "Moderate",
      color: "#f59e0b",
      note: "Sufficient for basic credit assessment.",
    },
    3: {
      label: "Moderate",
      color: "#f59e0b",
      note: "Sufficient for basic credit assessment.",
    },
    4: {
      label: "Strong",
      color: NABIL,
      note: "High confidence credit assessment possible.",
    },
    5: {
      label: "Strong",
      color: NABIL,
      note: "High confidence credit assessment possible.",
    },
  };

// Inline panel inputs — light theme

function PanelInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={type === "password" ? "current-password" : "off"}
      className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
    />
  );
}

function PanelBtn({
  onClick,
  disabled,
  loading,
  loadingLabel,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
  loadingLabel: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full text-white text-sm font-semibold disabled:opacity-40 transition-opacity"
      style={{ background: NABIL }}
    >
      {loading ? (
        <>
          <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
          {loadingLabel}
        </>
      ) : (
        label
      )}
    </button>
  );
}

function CancelLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
    >
      Cancel
    </button>
  );
}

// Inline panels

function PaymentsPanel({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  function handleAuth() {
    if (!user || !pass) return;
    setLoading(true);
    setTimeout(onDone, 2000);
  }
  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-800">
        Authorize TrustLayer
      </p>
      <p className="text-xs text-gray-500">eSewa · Secure OAuth</p>
      <PanelInput
        value={user}
        onChange={setUser}
        placeholder="eSewa ID / Mobile Number"
      />
      <PanelInput
        value={pass}
        onChange={setPass}
        placeholder="Password"
        type="password"
      />
      <p className="text-xs text-gray-400 leading-relaxed">
        TrustLayer will only read your transaction history. We cannot make
        payments.
      </p>
      <PanelBtn
        onClick={handleAuth}
        disabled={!user || !pass}
        loading={loading}
        loadingLabel="Verifying with eSewa…"
        label="Authorize Access"
      />
      <CancelLink onClick={onCancel} />
    </div>
  );
}

function NEAPanel({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const [custNo, setCustNo] = useState("");
  const [loading, setLoading] = useState(false);
  function handleFetch() {
    if (!custNo) return;
    setLoading(true);
    setTimeout(onDone, 1500);
  }
  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-800">Verify NEA Account</p>
      <PanelInput
        value={custNo}
        onChange={setCustNo}
        placeholder="e.g. 12345678"
      />
      <PanelBtn
        onClick={handleFetch}
        disabled={!custNo}
        loading={loading}
        loadingLabel="Fetching from NEA…"
        label="Fetch Records"
      />
      <CancelLink onClick={onCancel} />
    </div>
  );
}

function ISPPanel({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const [isp, setIsp] = useState("");
  const [accId, setAccId] = useState("");
  const [loading, setLoading] = useState(false);
  function handleVerify() {
    if (!isp || !accId) return;
    setLoading(true);
    setTimeout(onDone, 1500);
  }
  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-800">Verify ISP Account</p>
      <select
        value={isp}
        onChange={(e) => setIsp(e.target.value)}
        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-sm text-gray-900 focus:outline-none appearance-none"
      >
        <option value="">Select Provider…</option>
        {["WorldLink", "Subisu", "CG Net", "Vianet", "Other"].map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <PanelInput
        value={accId}
        onChange={setAccId}
        placeholder="Account / Customer ID"
      />
      <PanelBtn
        onClick={handleVerify}
        disabled={!isp || !accId}
        loading={loading}
        loadingLabel="Verifying account…"
        label="Verify Account"
      />
      <CancelLink onClick={onCancel} />
    </div>
  );
}

function MobilePanel({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState(false);
  const [loading, setLoading] = useState(false);
  function handleSendOtp() {
    if (!phone) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setOtpSent(true);
    }, 1000);
  }
  function handleVerifyOtp() {
    if (otp !== "1234") {
      setOtpError(true);
      return;
    }
    setOtpError(false);
    setLoading(true);
    setTimeout(onDone, 1000);
  }
  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-800">
        Verify Mobile Number
      </p>
      {!otpSent ? (
        <>
          <PanelInput
            value={phone}
            onChange={setPhone}
            placeholder="98XXXXXXXX"
          />
          <PanelBtn
            onClick={handleSendOtp}
            disabled={!phone}
            loading={loading}
            loadingLabel="Sending OTP…"
            label="Send OTP"
          />
        </>
      ) : (
        <>
          <p className="text-xs text-gray-500">
            Enter 4-digit code sent to your number
          </p>
          <PanelInput
            value={otp}
            onChange={(v) => {
              setOtp(v);
              setOtpError(false);
            }}
            placeholder="4-digit OTP"
          />
          {otpError && (
            <p className="text-xs text-red-500">Incorrect code. Try again.</p>
          )}
          <p className="text-xs text-gray-400">
            Enter <span className="font-mono">1234</span> for demo
          </p>
          <PanelBtn
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
  );
}

function BankPanel({
  onDone,
  onCancel,
}: {
  onDone: (filename: string) => void;
  onCancel: () => void;
}) {
  const [filename, setFilename] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  function handleFile(file: File | null) {
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) return;
    setFilename(file.name);
    setLoading(true);
    setTimeout(() => onDone(file.name), 2000);
  }
  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-800">
        Upload Bank Statement
      </p>
      {loading ? (
        <div className="flex items-center gap-2 py-3 justify-center">
          <div
            className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: NABIL, borderTopColor: "transparent" }}
          />
          <span className="text-sm text-gray-500">Analysing statement…</span>
        </div>
      ) : (
        <label
          className="flex flex-col items-center justify-center gap-2 py-6 rounded-xl cursor-pointer transition-colors"
          style={{
            border: `1.5px dashed ${dragging ? NABIL : "#d1d5db"}`,
            background: dragging ? "#f0fdf4" : "white",
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files[0] ?? null);
          }}
        >
          <UploadCloud size={20} className="text-gray-400" />
          <span className="text-sm text-gray-500 text-center px-2">
            {filename ? (
              <span className="font-medium text-gray-900">{filename}</span>
            ) : (
              "Drag and drop PDF or click to browse"
            )}
          </span>
          <input
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
        </label>
      )}
      {!loading && (
        <p className="text-xs text-gray-400">
          Accepted: PDF only · Last 6 months
        </p>
      )}
      {!loading && <CancelLink onClick={onCancel} />}
    </div>
  );
}

// ── SourceCard ────────────────────────────────────────────────────────────

function SourceCard({
  src,
  state,
  onConnected,
}: {
  src: SourceConfig;
  state: ConnectState;
  onConnected: (id: SourceId, meta?: { filename?: string }) => void;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState("");
  const connected = state === "connected";

  function handleDone(meta?: { filename?: string }) {
    setPanelOpen(false);
    onConnected(src.id, meta);
    if (meta?.filename) setUploadedFile(meta.filename);
  }

  return (
    <div
      className="rounded-xl border transition-colors"
      style={{
        borderColor: connected ? "#bbf7d0" : "#e5e7eb",
        background: connected ? "#f0fdf4" : "white",
      }}
    >
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: connected ? "#dcfce7" : "#f3f4f6",
                color: connected ? NABIL : "#6b7280",
              }}
            >
              {src.icon}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 leading-tight">
                {src.title}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{src.description}</p>
            </div>
          </div>
          <span
            className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={
              connected
                ? {
                    color: NABIL,
                    background: "#dcfce7",
                    border: `1px solid #bbf7d0`,
                  }
                : {
                    color: "#9ca3af",
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                  }
            }
          >
            {connected ? "✓ Verified" : "Not Connected"}
          </span>
        </div>

        <p className="text-xs text-gray-400 leading-relaxed">{src.checks}</p>

        {connected && (
          <p className="text-xs font-medium" style={{ color: NABIL }}>
            {src.mockResult}
            {uploadedFile && (
              <span className="text-gray-400 ml-1">({uploadedFile})</span>
            )}
          </p>
        )}

        {!connected && !panelOpen && (
          <button
            onClick={() => setPanelOpen(true)}
            className="mt-1 w-full py-2 rounded-full border text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
            style={{ borderColor: "#d1d5db" }}
          >
            {src.uploadMode ? "Upload PDF" : "Connect"}
          </button>
        )}
      </div>

      {panelOpen && !connected && (
        <div className="px-4 pb-4">
          {src.id === "payments" && (
            <PaymentsPanel
              onDone={() => handleDone()}
              onCancel={() => setPanelOpen(false)}
            />
          )}
          {src.id === "nea" && (
            <NEAPanel
              onDone={() => handleDone()}
              onCancel={() => setPanelOpen(false)}
            />
          )}
          {src.id === "isp" && (
            <ISPPanel
              onDone={() => handleDone()}
              onCancel={() => setPanelOpen(false)}
            />
          )}
          {src.id === "mobile" && (
            <MobilePanel
              onDone={() => handleDone()}
              onCancel={() => setPanelOpen(false)}
            />
          )}
          {src.id === "bank" && (
            <BankPanel
              onDone={(filename) => handleDone({ filename })}
              onCancel={() => setPanelOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Step2({
  data,
  setData,
  onNext,
}: {
  data: DataSourcesData;
  setData: React.Dispatch<React.SetStateAction<DataSourcesData>>;
  onNext: () => void;
}) {
  const [states, setStates] = useState<Record<SourceId, ConnectState>>({
    payments: "idle",
    nea: "idle",
    isp: "idle",
    mobile: "idle",
    bank: "idle",
  });

  function handleConnected(id: SourceId, _meta?: { filename?: string }) {
    setStates((s) => ({ ...s, [id]: "connected" }));
    setData((d) => {
      const next = { ...d, connected_sources: [...d.connected_sources, id] };
      if (id === "bank") next.verified_cashflow = 85000;
      if (id === "nea") next.verified_bill_rate = 0.917;
      if (id === "payments") next.verified_qr_consistency = 0.94;
      return next;
    });
  }

  const count = data.connected_sources.length;
  const strength = STRENGTH[Math.min(count, 5)];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-gray-900">
          Verify Your Business Data
        </h2>
        <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">
          Connect your accounts so we can verify your business activity. Your
          data is encrypted.
        </p>
      </div>

      <div className="space-y-3">
        {DATA_SOURCES.map((src) => (
          <SourceCard
            key={src.id}
            src={src}
            state={states[src.id]}
            onConnected={handleConnected}
          />
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Sources connected</span>
          <span className="font-bold text-gray-900">{count} of 5</span>
        </div>
        <div className="space-y-1.5">
          <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(count / 5) * 100}%`,
                background: strength.color,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold" style={{ color: strength.color }}>
              {strength.label}
            </span>
            <span className="text-gray-400">{strength.note}</span>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2">
        <Lock size={11} className="text-gray-400 mt-0.5 shrink-0" />
        <p className="text-xs text-gray-400 leading-relaxed">
          Your data is processed locally and shared only with your chosen
          financial institution.
        </p>
      </div>

      <GreenButton
        onClick={onNext}
        disabled={count === 0}
        label={
          count === 0
            ? "Connect at least one source"
            : `Continue with ${count} verified source${count !== 1 ? "s" : ""}`
        }
      />
    </div>
  );
}

// ── Step 3 ────────────────────────────────────────────────────────────────

function Step3({ onDone }: { onDone: (answers: string[]) => void }) {
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [selectedOpt, setSelectedOpt] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);

  const q = QUIZ[qIndex];
  const isLast = qIndex === QUIZ.length - 1;

  function handleNext() {
    if (!selectedOpt) return;
    const next = [...answers, selectedOpt];
    if (isLast) {
      setAnswers(next);
      setAnalysing(true);
      setTimeout(() => onDone(next), 2000);
    } else {
      setAnswers(next);
      setSelectedOpt(null);
      setQIndex((i) => i + 1);
    }
  }

  if (analysing) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div
          className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: NABIL, borderTopColor: "transparent" }}
        />
        <p className="text-sm font-semibold text-gray-900">
          Analysing your responses…
        </p>
        <p className="text-xs text-gray-400">This takes just a moment</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-gray-900">
          Character Assessment
        </h2>
        <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">
          5 short questions. There are no right or wrong answers.
        </p>
      </div>

      <div className="flex items-center gap-2">
        {QUIZ.map((_, i) => (
          <div
            key={i}
            className="flex-1 h-1.5 rounded-full transition-colors"
            style={{ background: i <= qIndex ? NABIL : "#e5e7eb" }}
          />
        ))}
      </div>
      <p className="text-xs text-gray-400">
        Question {qIndex + 1} of {QUIZ.length}
      </p>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-900 leading-relaxed font-medium">
          {q.question}
        </p>
      </div>

      <div className="space-y-2">
        {q.options.map(([letter, text]) => {
          const active = selectedOpt === letter;
          return (
            <button
              key={letter}
              onClick={() => setSelectedOpt(letter)}
              className="w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors"
              style={{
                background: active ? "#f0fdf4" : "white",
                borderColor: active ? NABIL : "#e5e7eb",
                color: active ? "#111827" : "#6b7280",
              }}
            >
              <span
                className="font-bold mr-3"
                style={{ color: active ? NABIL : "#9ca3af" }}
              >
                {letter}
              </span>
              {text}
            </button>
          );
        })}
      </div>

      <GreenButton
        onClick={handleNext}
        label={isLast ? "Submit Assessment" : "Next Question"}
        disabled={!selectedOpt}
      />
    </div>
  );
}

// ── Step 4 ────────────────────────────────────────────────────────────────

function Step4({
  data,
  setData,
  onSubmit,
  submitting,
}: {
  data: LoanData;
  setData: React.Dispatch<React.SetStateAction<LoanData>>;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const set = (k: keyof LoanData) => (v: string) =>
    setData((d) => ({ ...d, [k]: v }));

  function addVoucher() {
    const identifier = data.voucher_input.trim().toUpperCase();
    if (!identifier || data.vouchers.length >= 5 || data.vouchers.includes(identifier))
      return;
    setData((d) => ({
      ...d,
      vouchers: [...d.vouchers, identifier],
      voucher_input: "",
    }));
  }
  function removeVoucher(identifier: string) {
    setData((d) => ({ ...d, vouchers: d.vouchers.filter((v) => v !== identifier) }));
  }

  const valid = data.loan_amount && data.loan_purpose;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-gray-900">Loan Request</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Tell us about the loan you need.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <NLabel>Loan Amount Requested (NPR)</NLabel>
          <NInput
            value={data.loan_amount}
            onChange={set("loan_amount")}
            type="number"
            placeholder="e.g. 50000"
          />
        </div>
        <div>
          <NLabel>Loan Purpose</NLabel>
          <NSelect
            value={data.loan_purpose}
            onChange={set("loan_purpose")}
            options={LOAN_PURPOSES}
          />
        </div>
      </div>

      <div className="h-px bg-gray-200" />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <NLabel>Community Vouch (Optional)</NLabel>
            <p className="text-xs text-gray-500 mt-0.5">
              Add their Merchant ID, PAN, or phone so they can confirm your request.
            </p>
          </div>
          <span className="text-xs font-mono text-gray-400 shrink-0 ml-3">
            {data.vouchers.length}
            <span className="text-gray-300"> / 5</span>
          </span>
        </div>

        <div className="flex gap-2">
          <input
            value={data.voucher_input}
            onChange={(e) => set("voucher_input")(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addVoucher()}
            placeholder="Merchant ID, PAN, or phone"
            className="flex-1 px-4 py-3 rounded-lg bg-white border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
          />
          <button
            onClick={addVoucher}
            disabled={!data.voucher_input.trim() || data.vouchers.length >= 5}
            className="px-4 py-3 rounded-lg border border-gray-300 hover:border-gray-400 disabled:opacity-40 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <Plus size={15} />
          </button>
        </div>

        <p className="text-xs text-gray-400">
          We will notify them to confirm. You can request up to 5 vouchers.
        </p>

        {data.vouchers.length > 0 && (
          <div className="space-y-1.5">
            {data.vouchers.map((pan) => (
              <div
                key={pan}
                className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200"
              >
                <span className="text-sm font-mono text-gray-700">{pan}</span>
                <button
                  onClick={() => removeVoucher(pan)}
                  className="text-gray-400 hover:text-red-500 transition-colors ml-2"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1.5">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
            Vouch Policy
          </p>
          <p className="text-xs text-amber-600 leading-relaxed">
            You can vouch for up to 5 merchants. Others can vouch for you up to
            10 times.
          </p>
          <p className="text-xs text-amber-600 leading-relaxed">
            ⚠ If a merchant you vouch for defaults, your trust score will be
            reduced proportionally.
          </p>
          <p className="text-xs text-amber-600 leading-relaxed">
            ⚠ Vouching for a fraud ring member will trigger an association
            review of your profile.
          </p>
        </div>
      </div>

      <GreenButton
        onClick={onSubmit}
        label="Submit Application"
        disabled={!valid}
        loading={submitting}
      />
    </div>
  );
}

// ── My Loan Tab ──────────────────────────────────────────────────────────

function MyLoanTab({ name, refId }: { name: string; refId: string }) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
      <div>
        <h2 className="text-base font-bold text-gray-900">
          My Loan Application
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">Submitted to Nabil Bank</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "#dcfce7" }}
          >
            <CheckCircle2 size={18} style={{ color: NABIL }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Application Submitted
            </p>
            <p className="text-xs text-gray-400">Under review by Nabil Bank</p>
          </div>
        </div>
        <div className="h-px bg-gray-100" />
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">Reference ID</p>
          <p className="text-xs font-mono font-bold text-gray-900">{refId}</p>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">Applicant</p>
          <p className="text-xs font-semibold text-gray-900">{name || "—"}</p>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">Status</p>
          <div className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: NABIL }}
            />
            <p className="text-xs font-semibold" style={{ color: NABIL }}>
              Under Review
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">Expected Response</p>
          <p className="text-xs text-gray-600">Within 24 hours</p>
        </div>
      </div>

      <div
        className="rounded-2xl p-4 space-y-2"
        style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
      >
        <p className="text-xs font-semibold" style={{ color: NABIL }}>
          TrustLayer Credit Profile Generated
        </p>
        <p className="text-xs leading-relaxed" style={{ color: "#166534" }}>
          Your alternative credit profile has been shared with Nabil Bank.
          Behavioural signals, community vouches, and psychometric score are
          included in the assessment.
        </p>
      </div>
    </div>
  );
}

// ── Vouch Requests Tab ───────────────────────────────────────────────────

type VouchState = "pending" | "approved" | "declined";

const MOCK_VOUCH_REQUESTS = [
  {
    name: "Bardan Tamang",
    business: "Vegetable Vendor · Lalitpur",
    requesting: "NPR 25,000 loan",
    trustScore: "Silver · 492",
    defaultWarning:
      "Your vouch has been recorded. If Bardan defaults, your trust score will be reduced by 30% of vouch weight.",
  },
  {
    name: "Kamala Neupane",
    business: "Tailor · Bhaktapur",
    requesting: "NPR 15,000 loan",
    trustScore: "Silver · 445",
    defaultWarning:
      "Your vouch has been recorded. If Kamala defaults, your trust score will be reduced by 30% of vouch weight.",
  },
];

function VouchRequestsTab() {
  // ── Outgoing requests state ───────────────────────────────────────────
  const [sendInput, setSendInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sentList, setSentList] = useState<string[]>([]);

  const MAX_OUTGOING = 5;
  const atLimit = sentList.length >= MAX_OUTGOING;

  function handleSend() {
    if (!sendInput.trim() || atLimit) return;
    setSending(true);
    setTimeout(() => {
      setSentList((prev) => [...prev, sendInput.trim()]);
      setSendInput("");
      setSending(false);
    }, 1500);
  }

  // ── Incoming requests state ───────────────────────────────────────────
  const [vouchStates, setVouchStates] = useState<VouchState[]>([
    "pending",
    "pending",
  ]);
  const [showConfirm, setShowConfirm] = useState([false, false]);

  const vouchesGiven =
    1 + vouchStates.filter((s) => s === "approved").length;
  const vouchesRemaining = 5 - vouchesGiven;

  function approve(i: number) {
    setVouchStates((prev) => {
      const n = [...prev];
      n[i] = "approved";
      return n;
    });
    setShowConfirm((prev) => {
      const n = [...prev];
      n[i] = true;
      return n;
    });
  }

  function decline(i: number) {
    setVouchStates((prev) => {
      const n = [...prev];
      n[i] = "declined";
      return n;
    });
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">

      {/* ── Counters ── */}
      <div
        className="rounded-xl px-4 py-3 flex justify-between"
        style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
      >
        <p className="text-xs font-semibold" style={{ color: NABIL }}>
          Vouches requested: {sentList.length} of {MAX_OUTGOING}
        </p>
        <p className="text-xs font-semibold" style={{ color: NABIL }}>
          Vouches received: {vouchesGiven} of 5
        </p>
      </div>

      {/* ── Section 1: Request a Vouch ── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <div>
          <p className="text-sm font-bold text-gray-900">Request a Vouch</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Ask a trusted merchant to vouch for your loan application
          </p>
        </div>

        {atLimit ? (
          <div
            className="rounded-xl px-3 py-3 text-xs"
            style={{ background: "#fef9c3", border: "1px solid #fde68a", color: "#92400e" }}
          >
            You have reached the maximum of {MAX_OUTGOING} vouch requests.
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              value={sendInput}
              onChange={(e) => setSendInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Enter Merchant ID (e.g. M012) or Business PAN"
              disabled={sending}
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 50,
                border: "1.5px solid #d1d5db",
                fontSize: 12,
                outline: "none",
                opacity: sending ? 0.6 : 1,
              }}
              onFocus={(e) => (e.target.style.borderColor = NABIL)}
              onBlur={(e) => (e.target.style.borderColor = "#d1d5db")}
            />
            <button
              onClick={handleSend}
              disabled={sending || !sendInput.trim()}
              style={{
                background: NABIL,
                color: "white",
                border: "none",
                borderRadius: 50,
                padding: "10px 18px",
                fontWeight: 700,
                fontSize: 12,
                cursor: sending || !sendInput.trim() ? "not-allowed" : "pointer",
                opacity: sending || !sendInput.trim() ? 0.6 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {sending ? "Sending..." : "Send Request"}
            </button>
          </div>
        )}

        {sentList.length > 0 && (
          <div className="space-y-2">
            {sentList.map((target, idx) => (
              <div
                key={idx}
                className="rounded-xl px-3 py-2.5 text-xs"
                style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534" }}
              >
                <p className="font-semibold">✓ Vouch request sent to {target}</p>
                <p className="mt-0.5 text-[11px]" style={{ color: "#4b7a5e" }}>
                  They will be notified and can approve from their Nabil Bank app
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 2: Incoming Requests ── */}
      <div>
        <p className="text-sm font-bold text-gray-900 mb-3">
          Incoming Vouch Requests ({MOCK_VOUCH_REQUESTS.length})
        </p>

        <div className="space-y-3">
          {MOCK_VOUCH_REQUESTS.map((req, i) => (
            <div
              key={i}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-gray-900">{req.name}</p>
                  <p className="text-xs text-gray-500">{req.business}</p>
                </div>
                <span
                  className="shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full"
                  style={{ background: "#fef9c3", color: "#92400e" }}
                >
                  ⭐ {req.trustScore}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Requesting</span>
                <span className="font-semibold text-gray-900">{req.requesting}</span>
              </div>

              {vouchStates[i] === "pending" && (
                <>
                  <div className="flex gap-2">
                    <button
                      onClick={() => approve(i)}
                      disabled={vouchesGiven >= 5}
                      className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
                      style={{ background: NABIL }}
                    >
                      Approve Vouch
                    </button>
                    <button
                      onClick={() => decline(i)}
                      className="flex-1 py-2.5 rounded-full text-sm font-semibold border border-gray-300 text-gray-600 hover:border-gray-400 transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">
                    You can vouch for {vouchesRemaining} more merchant
                    {vouchesRemaining !== 1 ? "s" : ""} ({vouchesGiven} of 5 used)
                  </p>
                </>
              )}

              {vouchStates[i] === "approved" && (
                <div className="space-y-2">
                  <button
                    disabled
                    className="w-full py-2.5 rounded-full text-sm font-semibold text-white"
                    style={{ background: NABIL, opacity: 0.85 }}
                  >
                    Vouched ✓
                  </button>
                  {showConfirm[i] && (
                    <div
                      className="rounded-xl px-3 py-3 text-xs leading-relaxed"
                      style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534" }}
                    >
                      <p className="font-semibold mb-1">Vouch submitted ✓</p>
                      <p>{req.defaultWarning}</p>
                    </div>
                  )}
                </div>
              )}

              {vouchStates[i] === "declined" && (
                <button
                  disabled
                  className="w-full py-2.5 rounded-full text-sm font-semibold border border-gray-200 text-gray-400"
                >
                  Declined
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

// ── Merchant Profile (post-submission) ───────────────────────────────────

function MerchantProfileView({
  name,
  refId,
}: {
  name: string;
  refId: string;
}) {
  const [activeTab, setActiveTab] = useState<"home" | "myLoan" | "vouch">(
    "myLoan"
  );

  return (
    <div className="flex flex-col h-full">
      {activeTab !== "home" && (
        <div
          className="shrink-0 px-4 py-3 flex items-center gap-3"
          style={{ background: NABIL }}
        >
          <div className="flex-1">
            <p className="text-white text-sm font-bold leading-none">
              Nabil Bank
            </p>
            <p
              className="text-white text-xs mt-0.5"
              style={{ opacity: 0.75 }}
            >
              My TrustLayer Profile
            </p>
          </div>
          <div
            className="text-white text-base font-black tracking-tight"
            style={{ opacity: 0.9 }}
          >
            NABIL
          </div>
        </div>
      )}

      <div
        className="flex-1 min-h-0 flex flex-col overflow-hidden"
        style={{ background: "#f3f4f6" }}
      >
        {activeTab === "home" && (
          <NabilHome
            onApplyLoan={() => setActiveTab("myLoan")}
            hideBottomNav
          />
        )}
        {activeTab === "myLoan" && <MyLoanTab name={name} refId={refId} />}
        {activeTab === "vouch" && <VouchRequestsTab />}
      </div>

      <div className="shrink-0 bg-white border-t border-gray-100 flex items-center">
        {(
          [
            { tab: "home", icon: <Home size={20} />, label: "Home" },
            {
              tab: "myLoan",
              icon: <Banknote size={20} />,
              label: "My Loan",
            },
            {
              tab: "vouch",
              icon: <Users size={20} />,
              label: "Vouch Requests",
            },
          ] as {
            tab: "home" | "myLoan" | "vouch";
            icon: React.ReactNode;
            label: string;
          }[]
        ).map(({ tab, icon, label }) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors"
          >
            <span style={{ color: activeTab === tab ? NABIL : "#9ca3af" }}>
              {icon}
            </span>
            <span
              className="text-[10px]"
              style={{
                color: activeTab === tab ? NABIL : "#9ca3af",
                fontWeight: activeTab === tab ? 700 : 500,
              }}
            >
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Phone frame wrapper ───────────────────────────────────────────────────

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex-1 flex items-center justify-center overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
      }}
    >
      {/* Subtle glow behind phone */}
      <div
        className="absolute w-80 h-80 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: NABIL }}
      />

      {/* Phone shell */}
      <div
        className="relative flex flex-col overflow-hidden"
        style={{
          width: 375,
          height: "min(812px, calc(100vh - 80px))",
          borderRadius: 44,
          border: "8px solid #2d3748",
          boxShadow:
            "0 0 0 1px #4a5568, 0 32px 64px rgba(0,0,0,0.7), 0 8px 24px rgba(0,0,0,0.5)",
          background: "white",
        }}
      >
        {/* Notch / status bar */}
        <div
          className="shrink-0 flex items-center justify-between px-6 py-2"
          style={{
            background: "transparent",
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
          }}
        >
          <span className="text-[11px] font-semibold text-white drop-shadow">
            9:41
          </span>
          <div
            className="w-24 h-5 rounded-full"
            style={{
              background: "#111",
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
            }}
          />
          <div className="flex items-center gap-1.5">
            <svg width="16" height="12" viewBox="0 0 16 12" fill="white">
              <rect x="0" y="3" width="3" height="9" rx="1" opacity="0.4" />
              <rect x="4.5" y="2" width="3" height="10" rx="1" opacity="0.6" />
              <rect x="9" y="0" width="3" height="12" rx="1" opacity="0.8" />
              <rect x="13.5" y="0" width="2.5" height="12" rx="1" />
            </svg>
            <svg width="15" height="12" viewBox="0 0 15 12" fill="white">
              <path
                d="M7.5 2.5C9.8 2.5 11.9 3.5 13.3 5.1L14.8 3.4C13 1.3 10.4 0 7.5 0S2 1.3.2 3.4L1.7 5.1C3.1 3.5 5.2 2.5 7.5 2.5z"
                opacity="0.5"
              />
              <path
                d="M7.5 5.5C9 5.5 10.3 6.1 11.3 7.1L12.8 5.4C11.4 4 9.5 3 7.5 3S3.6 4 2.2 5.4L3.7 7.1C4.7 6.1 6 5.5 7.5 5.5z"
                opacity="0.75"
              />
              <circle cx="7.5" cy="10" r="2" />
            </svg>
            <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
              <rect
                x="0.5"
                y="0.5"
                width="20"
                height="11"
                rx="3.5"
                stroke="white"
                strokeOpacity="0.4"
              />
              <rect
                x="1.5"
                y="1.5"
                width="15"
                height="9"
                rx="2.5"
                fill="white"
              />
              <path
                d="M22 4.5v3c.8-.4 1.5-1 1.5-1.5S22.8 4.9 22 4.5z"
                fill="white"
                fillOpacity="0.4"
              />
            </svg>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 flex flex-col overflow-hidden pt-8">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Nabil Bank Home landing screen ───────────────────────────────────────

const SERVICE_ITEMS: {
  icon: React.ReactNode;
  label: string;
  color: string;
  highlight?: boolean;
  onClick?: () => void;
}[] = [
  { icon: <Landmark size={18} />, label: "My Accounts", color: "#6366f1" },
  { icon: <CreditCard size={18} />, label: "Cards", color: "#3b82f6" },
  { icon: <Receipt size={18} />, label: "Statement", color: "#8b5cf6" },
  { icon: <Globe size={18} />, label: "Digital Services", color: "#06b6d4" },
  { icon: <Send size={18} />, label: "Payments", color: "#f59e0b" },
  { icon: <Wallet size={18} />, label: "Load Wallet", color: "#10b981" },
  { icon: <Phone size={18} />, label: "Mobile Topup", color: "#6366f1" },
  {
    icon: <Banknote size={18} />,
    label: "Cardless Withdrawal",
    color: "#ef4444",
  },
  {
    icon: <Briefcase size={18} />,
    label: "Merchant Loan",
    color: "#ffffff",
    highlight: true,
  },
  { icon: <PiggyBank size={18} />, label: "Fixed Deposit", color: "#f59e0b" },
  { icon: <ArrowUpRight size={18} />, label: "Send Money", color: "#10b981" },
  { icon: <LayoutGrid size={18} />, label: "More Services", color: "#9ca3af" },
];

const RECENT_TXN = [
  {
    icon: <ShoppingCart size={15} />,
    iconBg: "#fee2e2",
    iconColor: "#ef4444",
    label: "Grocery Purchase",
    sub: "Bhat Bhateni · Today 07:12",
    amount: "-NPR 1,250",
    neg: true,
  },
  {
    icon: <ArrowDownLeft size={15} />,
    iconBg: "#dcfce7",
    iconColor: "#16a34a",
    label: "eSewa Transfer Received",
    sub: "Ram Bahadur · Yesterday",
    amount: "+NPR 5,000",
    neg: false,
  },
  {
    icon: <Zap size={15} />,
    iconBg: "#fef9c3",
    iconColor: "#ca8a04",
    label: "NEA Bill Payment",
    sub: "Electricity · Jun 18",
    amount: "-NPR 830",
    neg: true,
  },
  {
    icon: <Phone size={15} />,
    iconBg: "#ede9fe",
    iconColor: "#7c3aed",
    label: "Mobile Top-up",
    sub: "NTC Prepaid · Jun 17",
    amount: "-NPR 200",
    neg: true,
  },
];

function NabilHome({
  onApplyLoan,
  hideBottomNav = false,
}: {
  onApplyLoan: () => void;
  hideBottomNav?: boolean;
}) {
  return (
    <div className="flex flex-col h-full" style={{ background: "#f3f4f6" }}>
      {/* Green header */}
      <div className="shrink-0 px-5 pt-3 pb-10" style={{ background: NABIL }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white text-xs" style={{ opacity: 0.8 }}>
              Good Morning
            </p>
            <p className="text-white text-xl font-bold leading-snug">Samrat</p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.2)" }}
            >
              <Bell size={16} className="text-white" />
            </button>
            <button
              className="w-8 h-8 rounded-full flex items-center justify-center border-2"
              style={{
                background: "rgba(255,255,255,0.2)",
                borderColor: "rgba(255,255,255,0.3)",
              }}
            >
              <User size={15} className="text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto -mt-5 px-3 pb-4 space-y-3">
        {/* Search — overlaps header */}
        <div className="bg-white rounded-2xl shadow-sm px-4 py-2.5 flex items-center gap-2.5">
          <Search size={15} className="text-gray-400 shrink-0" />
          <span className="text-sm text-gray-400">Search</span>
        </div>

        {/* Account balance card */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-start gap-2">
            <Landmark size={13} className="text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
                Nabil Gen N Account
              </p>
              <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                03410017525136
              </p>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-3 tabular-nums tracking-widest">
            NPR XXXX.XX
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Available Balance</p>
        </div>

        {/* Services grid */}
        <div className="bg-white rounded-2xl shadow-sm p-3">
          <div className="grid grid-cols-4 gap-0.5">
            {SERVICE_ITEMS.map(({ icon, label, color, highlight, onClick }) => (
              <button
                key={label}
                onClick={highlight ? onApplyLoan : onClick}
                className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl active:opacity-70 transition-opacity"
                style={highlight ? { background: "#f0fdf4" } : undefined}
              >
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm"
                  style={
                    highlight
                      ? {
                          background: NABIL,
                          boxShadow: `0 4px 14px ${NABIL}50`,
                        }
                      : {
                          background: `${color}18`,
                          border: `1px solid ${color}28`,
                        }
                  }
                >
                  <span style={{ color: highlight ? "#fff" : color }}>
                    {icon}
                  </span>
                </div>
                <p
                  className="text-[9.5px] text-center leading-tight"
                  style={{
                    color: highlight ? NABIL : "#374151",
                    fontWeight: highlight ? 700 : 500,
                  }}
                >
                  {label}
                </p>
              </button>
            ))}
          </div>
          <button
            className="w-full mt-2 pt-2.5 border-t border-gray-100 text-xs text-center font-semibold flex items-center justify-center gap-1.5"
            style={{ color: NABIL }}
          >
            <PenLine size={11} /> Edit Menu
          </button>
        </div>

        {/* Recent transactions */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-sm font-bold text-gray-900 mb-3">
            Recent Transactions
          </p>
          <div className="space-y-3">
            {RECENT_TXN.map((t, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: t.iconBg, color: t.iconColor }}
                  >
                    {t.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 leading-tight">
                      {t.label}
                    </p>
                    <p className="text-xs text-gray-400">{t.sub}</p>
                  </div>
                </div>
                <p
                  className={`text-sm font-semibold tabular-nums ${t.neg ? "text-gray-900" : "text-green-600"}`}
                >
                  {t.amount}
                </p>
              </div>
            ))}
          </div>
          <button className="w-full mt-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-500">
            View All Transactions
          </button>
        </div>
      </div>

      {/* Bottom navigation */}
      {!hideBottomNav && (
        <div className="shrink-0 bg-white border-t border-gray-100 flex items-center">
          <button className="flex-1 flex flex-col items-center gap-0.5 py-2.5">
            <Home size={20} style={{ color: NABIL }} />
            <span className="text-[10px] font-bold" style={{ color: NABIL }}>
              Home
            </span>
          </button>
          <button className="flex-1 flex flex-col items-center gap-0.5 py-2.5">
            <CreditCard size={20} className="text-gray-400" />
            <span className="text-[10px] text-gray-400 font-medium">
              Payments
            </span>
          </button>
          {/* Centre QR button — raised */}
          <div className="flex-1 flex justify-center">
            <button
              className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg -mt-4"
              style={{ background: NABIL, boxShadow: `0 4px 16px ${NABIL}60` }}
            >
              <LayoutGrid size={20} className="text-white" />
            </button>
          </div>
          <button className="flex-1 flex flex-col items-center gap-0.5 py-2.5">
            <ArrowUpRight size={20} className="text-gray-400" />
            <span className="text-[10px] text-gray-400 font-medium">
              Send Money
            </span>
          </button>
          <button className="flex-1 flex flex-col items-center gap-0.5 py-2.5">
            <MoreHorizontal size={20} className="text-gray-400" />
            <span className="text-[10px] text-gray-400 font-medium">More</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function MerchantOnboarding() {
  const { refreshData } = useAppState();
  const [showLanding, setShowLanding] = useState(true);
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [referenceId, setReferenceId] = useState("");
  const [quizAnswers, setQuizAnswers] = useState<string[]>([]);

  const [profile, setProfile] = useState<ProfileData>({
    name: "",
    phone: "",
    citizenship_no: "",
    business_name: "",
    business_pan: "",
    business_type: "",
    custom_business_type: "",
    location: "",
    months_active: "",
  });
  const [dataSources, setDataSources] = useState<DataSourcesData>({
    connected_sources: [],
    verified_cashflow: 0,
    verified_bill_rate: 0,
    verified_qr_consistency: 0,
  });
  const [loanData, setLoanData] = useState<LoanData>({
    loan_amount: "",
    loan_purpose: "",
    voucher_input: "",
    vouchers: [],
  });

  function handleQuizDone(answers: string[]) {
    setQuizAnswers(answers);
    setStep(3);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const answerScores: Record<string, number> = {
        B: 1.0,
        C: 0.8,
        A: 0.4,
        D: 0.4,
      };
      const psychScore =
        quizAnswers.length === 5
          ? quizAnswers.reduce((sum, a) => sum + (answerScores[a] ?? 0.5), 0) /
            5
          : null;
      const result = await createMerchant({
        name: profile.name,
        phone: profile.phone,
        citizenship_no: profile.citizenship_no,
        business_name: profile.business_name,
        business_pan: profile.business_pan,
        business_type:
          profile.business_type === "Other"
            ? profile.custom_business_type.trim()
            : profile.business_type,
        location: profile.location,
        months_active: Number(profile.months_active),
        cashflow_monthly_npr: dataSources.verified_cashflow || 50000,
        bill_payment_ratio: dataSources.verified_bill_rate || 0.7,
        qr_transaction_consistency: dataSources.verified_qr_consistency || 0.6,
        airtime_topup_frequency: 0.7,
        transaction_volatility: 0.3,
        days_since_last_transaction: 5,
        psychometric_score: psychScore,
        requested_loan_npr: Number(loanData.loan_amount),
        loan_purpose: loanData.loan_purpose,
        voucher_pans: loanData.vouchers,
        connected_sources: dataSources.connected_sources,
      });
      refreshData();
      setReferenceId(result.merchant_id);
    } catch (err) {
      console.error("Submission failed:", err);
      setReferenceId("TL-" + Math.floor(100000 + Math.random() * 900000));
    } finally {
      setSubmitting(false);
      setSubmitted(true);
    }
  }

  // Inner content — shown inside the phone frame
  const phoneContent = submitted ? (
    <MerchantProfileView name={profile.name} refId={referenceId} />
  ) : showLanding ? (
    <NabilHome onApplyLoan={() => setShowLanding(false)} />
  ) : (
    <div className="flex flex-col h-full" style={{ background: "white" }}>
      {/* Nabil Bank form header */}
      <div
        className="shrink-0 px-4 py-3 flex items-center gap-3"
        style={{ background: NABIL }}
      >
        <button
          onClick={() => {
            setShowLanding(true);
            setStep(0);
          }}
          className="text-white opacity-90 hover:opacity-100 transition-opacity"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <p className="text-white text-sm font-bold leading-none">
            Apply for Merchant Loan
          </p>
          <p className="text-white text-xs mt-0.5" style={{ opacity: 0.75 }}>
            Nabil Bank Limited
          </p>
        </div>
        <div
          className="text-white text-base font-black tracking-tight"
          style={{ opacity: 0.9 }}
        >
          NABIL
        </div>
      </div>

      {/* Scrollable form content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pb-8 pt-4">
          <StepDots current={step} />
          <div className="mt-2 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            {step === 0 && (
              <Step1
                data={profile}
                setData={setProfile}
                onNext={() => setStep(1)}
              />
            )}
            {step === 1 && (
              <Step2
                data={dataSources}
                setData={setDataSources}
                onNext={() => setStep(2)}
              />
            )}
            {step === 2 && <Step3 onDone={handleQuizDone} />}
            {step === 3 && (
              <Step4
                data={loanData}
                setData={setLoanData}
                onSubmit={handleSubmit}
                submitting={submitting}
              />
            )}
          </div>
          <p className="text-center text-xs text-gray-300 mt-6">
            Powered by{" "}
            <span className="text-gray-400 font-semibold">TrustLayer</span> ·
            Alternative Credit Infrastructure
          </p>
        </div>
      </div>
    </div>
  );

  return <PhoneFrame>{phoneContent}</PhoneFrame>;
}
