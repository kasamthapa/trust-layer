// types.ts — TypeScript interfaces mirroring the TrustLayer backend API schemas.
// Keep in sync with engine/api/schemas.py.

export interface ExplanationItem {
  factor: string
  direction: '+' | '-'
  detail: string
}

export interface SHAPItem {
  feature: string
  impact: number
  direction: '+' | '-'
}

export interface LayerBreakdown {
  formula_score: number
  graph_score: number
  ml_score: number        // advisory only — not included in final_fused
  final_fused: number     // 60% formula + 40% graph
  ml_note: string
}

export interface VouchStats {
  vouches_given: number
  vouches_received: number
  vouches_given_remaining: number
  vouches_received_remaining: number
  fraud_association: boolean
}

export interface VouchRequest {
  id: number
  requester_id: string
  requester_name: string
  business_type: string
  location: string
  months_active: number
  cashflow_monthly_npr: number | null
  requested_loan_npr: number | null
  loan_purpose: string | null
  status: string
  created_at: string
}

export interface VouchLimit {
  max_given: number
  max_received: number
  default_impact_rate: number
  policy: string
}

export interface VouchLookupMerchant {
  id: string
  name: string
  business_type: string
  location: string
  business_pan: string | null
  phone: string | null
}

export interface VouchLookupResponse {
  merchant: VouchLookupMerchant | null
  vouch_stats: VouchStats
  max_received: number
  requests_remaining: number
  requests: VouchRequest[]
}

export interface MerchantProfile {
  id: string
  name: string
  phone?: string | null
  citizenship_no?: string | null
  business_name?: string | null
  business_pan?: string | null
  business_type: string
  location: string
  months_active: number
  bill_payment_ratio?: number | null
  qr_transaction_consistency?: number | null
  airtime_topup_frequency?: number | null
  psychometric_score?: number | null
  network_trust_score?: number | null
  transaction_volatility?: number | null
  days_since_last_transaction?: number | null
  cashflow_monthly_npr?: number | null
  requested_loan_npr?: number | null
  loan_purpose?: string | null
  connected_sources?: string | null
  group?: string | null
}

export interface FairnessAudit {
  status: 'passed' | 'corrected' | 'watch'
  title: string
  before_score: number
  adjustment: number
  after_score: number
  policy: string
  summary: string
  reasons: string[]
}

export interface ScoreResponse {
  merchant_id: string
  name: string
  business_type: string
  location: string
  score: number
  band: 'Platinum' | 'Gold' | 'Silver' | 'Refused'
  confidence: number
  loan_ceiling: number
  requested_loan: number
  gate_status: 'CLEAR' | 'FLAGGED'
  gate_reason: string | null
  explanation: ExplanationItem[]
  shap_factors: SHAPItem[]
  layer_breakdown: LayerBreakdown
  ai_summary: string | null
  ml_band: string
  ml_confidence: number
  fraud_flagged: boolean
  fairness_audit: FairnessAudit
  vouch_stats: VouchStats
}

export interface GraphNode {
  id: string
  name: string
  business_type: string
  location: string
  trust: number
  fraud: boolean
  score: number
}

export interface GraphEdge {
  source: string
  target: string
  weight: number
}

export interface GraphStats {
  total_nodes: number
  total_edges: number
  fraud_count: number
  avg_trust: number
}

export interface GraphResponse {
  nodes: GraphNode[]
  edges: GraphEdge[]
  fraud_ring_ids: string[]
  stats: GraphStats
}

export interface FairnessGroup {
  group: string
  avg_score_before: number
  avg_score_after: number
  merchant_count: number
}

export interface FairnessResponse {
  groups: FairnessGroup[]
  max_gap_before: number
  max_gap_after: number
  gap_reduction_pct: number
  note: string
}

export interface MerchantSummary {
  id: string
  name: string
  business_type: string
  location: string
  months_active: number
}

export interface HealthResponse {
  status: 'ok' | 'degraded'
  version: string
  ml_layer: 'loaded' | 'unavailable'
  graph_engine: 'ready' | 'error'
  ai_layer: 'reachable' | 'unreachable'
  database: 'connected' | 'unavailable'
}

// ── Merchant onboarding form data ──────────────────────────────────────────

export interface OnboardingData {
  // Identity
  name: string
  phone: string
  citizenship_no: string

  // Business
  business_name: string
  business_pan: string
  business_type: string
  location: string

  // Behavioural signals
  months_active: number
  cashflow_monthly_npr: number
  bill_payment_ratio: number
  qr_transaction_consistency: number
  airtime_topup_frequency: number
  transaction_volatility: number
  days_since_last_transaction: number

  // Psychometric quiz
  psychometric_answers: Record<string, number>

  // Loan request
  requested_loan_npr: number
  loan_purpose: string

  // Social vouch
  voucher_pan: string
}
