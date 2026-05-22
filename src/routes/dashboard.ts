import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { AuthedRequest } from '../types'
import { requireRole, ALL_ROLES } from '../middleware/context'

const router = Router()

// GET /api/dashboard — executive summary
router.get('/', requireRole(...ALL_ROLES), async (req, res) => {
  const { orgId } = (req as AuthedRequest).ctx

  const [
    totalPos,
    executionCount,
    financeCount,
    forwardingCount,
    highSeasCount,
    clearanceCount,
    deliveredCount,
    recentLogs,
    overduePayments,
    highSeasList,
  ] = await Promise.all([
    prisma.purchaseOrder.count({ where: { orgId } }),
    prisma.executionRecord.count({ where: { orgId } }),
    prisma.financeRecord.count({ where: { orgId } }),
    prisma.forwardingRecord.count({ where: { orgId } }),
    prisma.highSeasRecord.count({ where: { orgId } }),
    prisma.clearanceRecord.count({ where: { orgId } }),
    prisma.deliveryRecord.count({ where: { orgId } }),

    // Recent activity
    prisma.auditLog.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: { select: { name: true, role: true } } },
    }),

    // Overdue payments alert
    prisma.financeRecord.count({
      where: { orgId, paymentStatus: 'OVERDUE' },
    }),

    // High seas — vessels with ETA in next 14 days
    prisma.highSeasRecord.findMany({
      where: {
        orgId,
        eta: { lte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
      },
      include: { po: { select: { poRef: true, supplier: true, description: true } } },
      orderBy: { eta: 'asc' },
      take: 5,
    }),
  ])

  // Total active value (USD equivalent — non-USD are shown as-is for MVP)
  const activePos = await prisma.purchaseOrder.findMany({
    where: { orgId, deliveryRecord: { is: null } },
    select: { poValue: true, currency: true },
  })
  const totalActiveValue = activePos.reduce(
    (sum: number, po: { poValue: unknown; currency: unknown }) => sum + Number(po.poValue), 0
  )

  res.json({
    summary: {
      totalPos,
      activePos:       activePos.length,
      totalActiveValue,
      byStage: {
        execution:   executionCount,
        finance:     financeCount,
        forwarding:  forwardingCount,
        highSeas:    highSeasCount,
        clearance:   clearanceCount,
        delivered:   deliveredCount,
      },
    },
    alerts: {
      overduePayments,
      arrivingSoon: highSeasList,
    },
    recentActivity: recentLogs.map((log: Record<string, any>) => ({
      action:    log.action,
      entity:    log.entity,
      entityId:  log.entityId,
      user:      log.user?.name ?? 'System',
      role:      log.userRole,
      timestamp: log.createdAt,
    })),
  })
})

export default router
