import { Request } from 'express'

export const Role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ORG_ADMIN:   'ORG_ADMIN',
  PROCUREMENT: 'PROCUREMENT',
  FINANCE:     'FINANCE',
  LOGISTICS:   'LOGISTICS',
  VIEWER:      'VIEWER',
} as const

export type Role = typeof Role[keyof typeof Role]

export interface RequestContext {
  orgId: string
  userId?: string
  role: Role
  orgSlug: string
}

export interface AuthedRequest extends Request {
  ctx: RequestContext
}

// Pipeline stage names — used for audit logs and routing
export type PipelineStage =
  | 'po-master'
  | 'execution'
  | 'finance'
  | 'forwarding'
  | 'high-seas'
  | 'clearance'
  | 'delivered'

// Auto-fill response shape — returned when a PO Ref is entered downstream
export interface PoAutoFill {
  supplier: string
  description: string
  category: string
  currency: string
  poValue: number
  pfiNo: string | null
  paymentTerms: string | null
  quantity: number
}

// Dashboard summary shape
export interface PipelineSummary {
  totalActive: number
  totalValueUsd: number
  byStage: {
    poMaster: number
    execution: number
    finance: number
    forwarding: number
    highSeas: number
    clearance: number
    delivered: number
  }
  recentActivity: ActivityItem[]
}

export interface ActivityItem {
  poRef: string
  supplier: string
  action: string
  stage: PipelineStage
  timestamp: Date
}
