import { useState } from 'react'
import {
  CheckCircle2, XCircle, User, MapPin,
  Briefcase, Clock, DollarSign, Shield,
} from 'lucide-react'
import { getVouchLookup, respondVouchRequest } from '../api'
import type { VouchLookupResponse, VouchRequest } from '../types'

const NABIL = '#00a651'

function fmt(n: number | null) {
  if (n == null) return '—'
  return n.toLocaleString('en-IN')
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex-1 flex items-center justify-center overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}
    >
      <div
        style={{
          width: 375,
          height: 'min(812px, calc(100vh - 80px))',
          borderRadius: 44,
          border: '8px solid #2d3748',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: 'white',
        }}
      >
        {/* Status bar */}
        <div
          style={{
            background: NABIL,
            padding: '12px 20px 6px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ color: 'white', fontSize: 12, fontWeight: 600 }}>9:41</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <svg width="15" height="11" viewBox="0 0 15 11" fill="white">
              <rect x="0" y="4" width="3" height="7" rx="1" />
              <rect x="4" y="2" width="3" height="9" rx="1" />
              <rect x="8" y="0" width="3" height="11" rx="1" />
              <rect x="12" y="0" width="3" height="11" rx="1" opacity="0.4" />
            </svg>
            <svg width="16" height="12" viewBox="0 0 24 12" fill="white">
              <rect x="0" y="3" width="20" height="8" rx="2" stroke="white" strokeWidth="1.5" fill="none" />
              <rect x="1.5" y="4.5" width="13" height="5" rx="1" fill="white" />
              <rect x="21" y="5" width="2" height="4" rx="1" fill="white" />
            </svg>
          </div>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  )
}

function RequestCard({
  req,
  onAction,
  loading,
}: {
  req: VouchRequest
  onAction: (id: number, action: 'accept' | 'decline') => void
  loading: boolean
}) {
  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 12,
      }}
    >
      {/* Header */}
      <div style={{ background: '#f9fafb', padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 40, height: 40, borderRadius: 20,
              background: `${NABIL}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <User size={20} color={NABIL} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{req.requester_name}</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>ID: {req.requester_id}</div>
          </div>
          <div
            style={{
              marginLeft: 'auto', fontSize: 10, fontWeight: 600,
              background: '#fef9c3', color: '#92400e', borderRadius: 20,
              padding: '2px 10px', border: '1px solid #fde68a',
            }}
          >
            Pending
          </div>
        </div>
      </div>

      {/* Details */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Briefcase size={13} color={NABIL} />
          <span style={{ fontSize: 12, color: '#374151' }}>{req.business_type}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <MapPin size={13} color={NABIL} />
          <span style={{ fontSize: 12, color: '#374151' }}>{req.location}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Clock size={13} color={NABIL} />
          <span style={{ fontSize: 12, color: '#374151' }}>{req.months_active} months in business</span>
        </div>
        {req.cashflow_monthly_npr != null && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <DollarSign size={13} color={NABIL} />
            <span style={{ fontSize: 12, color: '#374151' }}>
              Monthly cashflow: NPR {fmt(req.cashflow_monthly_npr)}
            </span>
          </div>
        )}
        {req.requested_loan_npr != null && (
          <div
            style={{
              background: '#f0fdf4', borderRadius: 10, padding: '8px 12px',
              border: `1px solid ${NABIL}30`, marginTop: 4,
            }}
          >
            <div style={{ fontSize: 11, color: '#6b7280' }}>Loan requested</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: NABIL }}>
              NPR {fmt(req.requested_loan_npr)}
            </div>
          </div>
        )}
      </div>

      {/* Notice */}
      <div style={{ padding: '0 16px 10px' }}>
        <div
          style={{
            background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
            padding: '8px 12px', fontSize: 11, color: '#92400e',
          }}
        >
          <Shield size={11} style={{ display: 'inline', marginRight: 4 }} />
          Vouching links your reputation to this merchant. If they default, your TrustLayer score may be affected.
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, padding: '0 16px 16px' }}>
        <button
          disabled={loading}
          onClick={() => onAction(req.id, 'decline')}
          style={{
            flex: 1, padding: '10px 0', borderRadius: 50, border: '1.5px solid #ef4444',
            background: 'white', color: '#ef4444', fontWeight: 700, fontSize: 13,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <XCircle size={15} /> Decline
        </button>
        <button
          disabled={loading}
          onClick={() => onAction(req.id, 'accept')}
          style={{
            flex: 1, padding: '10px 0', borderRadius: 50, background: NABIL,
            border: 'none', color: 'white', fontWeight: 700, fontSize: 13,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <CheckCircle2 size={15} /> Vouch
        </button>
      </div>
    </div>
  )
}

export default function VouchReview() {
  const [lookupKey, setLookupKey] = useState('')
  const [inputPan, setInputPan] = useState('')
  const [lookup, setLookup] = useState<VouchLookupResponse | null>(null)
  const [requests, setRequests] = useState<VouchRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleLookup() {
    if (!inputPan.trim()) return
    setLoading(true)
    setError(null)
    try {
      const data = await getVouchLookup(inputPan.trim())
      setLookup(data)
      setRequests(data.requests)
      setLookupKey(data.merchant?.business_pan || data.merchant?.id || inputPan.trim())
    } catch {
      setLookup(null)
      setRequests([])
      setError('Could not find this merchant or load requests. Try a Merchant ID like M003 or a PAN number.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(id: number, action: 'accept' | 'decline') {
    setActionLoading(true)
    try {
      await respondVouchRequest(id, action, lookupKey)
      setRequests(prev => prev.filter(r => r.id !== id))
      showToast(action === 'accept' ? 'Vouch confirmed!' : 'Request declined.')
    } catch {
      showToast('Action failed. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'white' }}>
      {/* App header */}
      <div style={{ background: NABIL, padding: '14px 20px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Shield size={22} color="white" />
          <div>
            <div style={{ color: 'white', fontWeight: 800, fontSize: 16 }}>Vouch Requests</div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>TrustLayer · Peer Vouching</div>
          </div>
        </div>
      </div>

      {/* PAN lookup */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
          Enter your Business PAN to see requests
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={inputPan}
            onChange={e => setInputPan(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLookup()}
            placeholder="e.g. M003 or 123456789"
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 10,
              border: '1.5px solid #d1d5db', fontSize: 13, outline: 'none',
              color: '#111827', background: 'white', caretColor: '#111827',
            }}
            onFocus={e => (e.target.style.borderColor = NABIL)}
            onBlur={e => (e.target.style.borderColor = '#d1d5db')}
          />
          <button
            onClick={handleLookup}
            disabled={loading}
            style={{
              background: NABIL, color: 'white', border: 'none',
              borderRadius: 10, padding: '10px 18px', fontWeight: 700,
              fontSize: 13, cursor: 'pointer',
            }}
          >
            {loading ? '…' : 'Check'}
          </button>
        </div>
        {error && (
          <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{error}</div>
        )}
        {lookup && (
          <div
            style={{
              marginTop: 12, border: '1px solid #e5e7eb', borderRadius: 14,
              padding: 12, background: '#f9fafb',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Lookup result</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>
                  {lookup.merchant ? `${lookup.merchant.name} · ${lookup.merchant.id}` : lookupKey}
                </div>
                {lookup.merchant && (
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                    {lookup.merchant.business_type} · {lookup.merchant.location}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: lookup.requests_remaining === 0 ? '#ef4444' : NABIL }}>
                  {lookup.requests_remaining}
                </div>
                <div style={{ fontSize: 10, color: '#6b7280' }}>requests left</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
              <div style={{ borderRadius: 10, background: 'white', border: '1px solid #e5e7eb', padding: '8px 10px' }}>
                <div style={{ fontSize: 10, color: '#6b7280' }}>Vouchers received</div>
                <div style={{ color: '#111827', fontWeight: 800 }}>
                  {lookup.vouch_stats.vouches_received} / {lookup.max_received}
                </div>
              </div>
              <div style={{ borderRadius: 10, background: 'white', border: '1px solid #e5e7eb', padding: '8px 10px' }}>
                <div style={{ fontSize: 10, color: '#6b7280' }}>Pending requests</div>
                <div style={{ color: '#111827', fontWeight: 800 }}>{requests.length}</div>
              </div>
            </div>
            {lookup.requests_remaining === 0 && (
              <div style={{ marginTop: 8, color: '#b91c1c', fontSize: 11, fontWeight: 600 }}>
                This merchant has reached the maximum 10 received vouchers.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Requests list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 0' }}>
        {lookupKey && !loading && (
          requests.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, marginTop: 40 }}>
              <CheckCircle2 size={32} color="#d1d5db" style={{ margin: '0 auto 8px' }} />
              No pending vouch requests for this Merchant ID or PAN.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                {requests.length} pending request{requests.length > 1 ? 's' : ''}
              </div>
              {requests.map(r => (
                <RequestCard
                  key={r.id}
                  req={r}
                  onAction={handleAction}
                  loading={actionLoading}
                />
              ))}
            </>
          )
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            background: '#1f2937', color: 'white', borderRadius: 20,
            padding: '8px 20px', fontSize: 13, fontWeight: 600,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )

  return <PhoneFrame>{content}</PhoneFrame>
}
