import axios from 'axios'
import type {
  FairnessResponse,
  GraphResponse,
  HealthResponse,
  MerchantSummary,
  ScoreResponse,
  MerchantProfile,
  VouchLimit,
  VouchLookupResponse,
  VouchRequest,
} from './types'

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 90_000, // generous timeout — Ollama can take up to 60s
  headers: { 'Content-Type': 'application/json' },
})

export async function getMerchants(): Promise<MerchantSummary[]> {
  try {
    const res = await client.get<MerchantSummary[]>('/api/v1/merchants')
    return res.data
  } catch (err) {
    console.error('getMerchants failed:', err)
    throw err
  }
}

export async function getMerchantProfile(merchantId: string): Promise<MerchantProfile> {
  try {
    const res = await client.get<MerchantProfile>(`/api/v1/merchants/${merchantId}`)
    return res.data
  } catch (err) {
    console.error(`getMerchantProfile(${merchantId}) failed:`, err)
    throw err
  }
}

export async function getMerchantScore(merchantId: string): Promise<ScoreResponse> {
  try {
    const res = await client.post<ScoreResponse>('/api/v1/score', {
      merchant_id: merchantId,
    })
    return res.data
  } catch (err) {
    console.error(`getMerchantScore(${merchantId}) failed:`, err)
    throw err
  }
}

export async function getGraph(): Promise<GraphResponse> {
  try {
    const res = await client.get<GraphResponse>('/api/v1/graph')
    return res.data
  } catch (err) {
    console.error('getGraph failed:', err)
    throw err
  }
}

export async function getFairness(): Promise<FairnessResponse> {
  try {
    const res = await client.get<FairnessResponse>('/api/v1/fairness')
    return res.data
  } catch (err) {
    console.error('getFairness failed:', err)
    throw err
  }
}

export interface CreateMerchantPayload {
  name: string
  phone: string
  citizenship_no: string
  business_name: string
  business_pan: string
  business_type: string
  location: string
  months_active: number
  cashflow_monthly_npr: number
  bill_payment_ratio: number
  qr_transaction_consistency: number
  airtime_topup_frequency: number
  transaction_volatility: number
  days_since_last_transaction: number
  psychometric_score: number | null
  requested_loan_npr: number
  loan_purpose: string
  voucher_pans: string[]
  connected_sources: string[]
}

export async function createMerchant(
  data: CreateMerchantPayload
): Promise<{ merchant_id: string; message: string }> {
  try {
    const res = await client.post<{ merchant_id: string; message: string }>(
      '/api/v1/merchants',
      data
    )
    return res.data
  } catch (err) {
    console.error('createMerchant failed:', err)
    throw err
  }
}

export async function getVouchPolicy(): Promise<VouchLimit> {
  try {
    const res = await client.get<VouchLimit>('/api/v1/vouch-policy')
    return res.data
  } catch (err) {
    console.error('getVouchPolicy failed:', err)
    throw err
  }
}

export async function getVouchRequests(pan: string): Promise<VouchRequest[]> {
  const res = await client.get<VouchRequest[]>('/api/v1/vouch-requests', { params: { pan } })
  return res.data
}

export async function getVouchLookup(query: string): Promise<VouchLookupResponse> {
  const res = await client.get<VouchLookupResponse>('/api/v1/vouch-lookup', { params: { query } })
  return res.data
}

export async function respondVouchRequest(requestId: number, action: 'accept' | 'decline', voucher_pan: string): Promise<void> {
  await client.post(`/api/v1/vouch-requests/${requestId}/respond`, { action, voucher_pan })
}

export async function getHealth(): Promise<HealthResponse> {
  try {
    const res = await client.get<HealthResponse>('/health')
    return res.data
  } catch (err) {
    console.error('getHealth failed:', err)
    throw err
  }
}
