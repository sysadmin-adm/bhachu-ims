import { prisma } from './prisma'
import { Role } from '../types'

interface LogParams {
  orgId: string
  userId?: string
  userRole?: Role
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'IMPORT'
  entity: string
  entityId?: string
  changes?: Record<string, [unknown, unknown]>
  ip?: string
}

export async function auditLog(params: LogParams) {
  try {
    await prisma.auditLog.create({
      data: {
        orgId:    params.orgId,
        userId:   params.userId,
        userRole: params.userRole,
        action:   params.action,
        entity:   params.entity,
        entityId: params.entityId,
        changes:  params.changes ?? undefined,
        ip:       params.ip,
      },
    })
  } catch {
    // Audit failure must never break the main request
    console.error('[audit] Failed to write audit log', params)
  }
}