import axios from 'axios'
import type {
  FairnessResponse,
  GraphResponse,
  HealthResponse,
  MerchantSummary,
  ScoreResponse,
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

export async function getHealth(): Promise<HealthResponse> {
  try {
    const res = await client.get<HealthResponse>('/health')
    return res.data
  } catch (err) {
    console.error('getHealth failed:', err)
    throw err
  }
}
