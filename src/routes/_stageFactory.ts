// Stage route factory
// Each pipeline stage (execution, finance, forwarding, high-seas, clearance, delivered)
// follows the same pattern: find-or-create by poId, update, return with PO autofill data.
// This factory generates the full router for a stage so we don't repeat the boilerplate 5 times.

import { Router, Request, Response } from 'express'
import { z, ZodObject, ZodRawShape } from 'zod'
import { prisma } from '../lib/prisma'
import { auditLog } from '../lib/audit'
import { AuthedRequest, Role } from '../types'
import { requireRole, ALL_ROLES } from '../middleware/context'

type PrismaModelName = 
  | 'executionRecord'
  | 'financeRecord'
  | 'forwardingRecord'
  | 'highSeasRecord'
  | 'clearanceRecord'
  | 'deliveryRecord'

interface StageConfig<T extends ZodRawShape> {
  model:       PrismaModelName
  entityName:  string
  schema:      ZodObject<T>
  writeRoles:  Role[]
}

export function createStageRouter<T extends ZodRawShape>(config: StageConfig<T>) {
  const router = Router()
  const delegate = () => (prisma[config.model] as any)

  // GET /api/<stage> — list all records for org with PO data
  router.get('/', requireRole(...ALL_ROLES), async (req: Request, res: Response) => {
    const { orgId } = (req as AuthedRequest).ctx
    const { search } = req.query

    const records = await delegate().findMany({
      where: { orgId },
      include: {
        po: {
          select: {
            poRef: true, supplier: true, description: true,
            category: true, currency: true, poValue: true,
            pfiNo: true, paymentTerms: true, quantity: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    // Apply search filter in JS (avoids complex cross-relation DB queries for MVP)
    const filtered = search
      ? records.filter((r: any) =>
          r.po.poRef.toLowerCase().includes(String(search).toLowerCase()) ||
          r.po.supplier.toLowerCase().includes(String(search).toLowerCase())
        )
      : records

    res.json(filtered)
  })

  // GET /api/<stage>/:id
  router.get('/:id', requireRole(...ALL_ROLES), async (req: Request, res: Response) => {
    const { orgId } = (req as AuthedRequest).ctx
    const record = await delegate().findFirst({
      where: { id: req.params.id, orgId },
      include: { po: true },
    })
    if (!record) { res.status(404).json({ error: 'Record not found' }); return }
    res.json(record)
  })

  // GET /api/<stage>/by-po/:poId
  router.get('/by-po/:poId', requireRole(...ALL_ROLES), async (req: Request, res: Response) => {
    const { orgId } = (req as AuthedRequest).ctx
    const record = await delegate().findFirst({
      where: { poId: req.params.poId, orgId },
      include: { po: true },
    })
    res.json(record ?? null)
  })

  // POST /api/<stage> — upsert by poId (stages are 1:1 with PO)
  router.post('/', requireRole(...config.writeRoles), async (req: Request, res: Response) => {
    const { orgId, userId, role } = (req as AuthedRequest).ctx
    const parsed = config.schema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

    const { poId, ...fields } = parsed.data as any

    // Verify PO belongs to this org
    const po = await prisma.purchaseOrder.findFirst({ where: { id: poId, orgId } })
    if (!po) { res.status(404).json({ error: 'PO not found or belongs to another org' }); return }

    const record = await delegate().upsert({
      where:  { poId },
      create: { orgId, poId, ...fields },
      update: { ...fields },
      include: { po: true },
    })

    await auditLog({
      orgId, userId, userRole: role,
      action: 'CREATE', entity: config.entityName, entityId: record.id, ip: req.ip,
    })
    res.status(201).json(record)
  })

  // PATCH /api/<stage>/:id
  router.patch('/:id', requireRole(...config.writeRoles), async (req: Request, res: Response) => {
    const { orgId, userId, role } = (req as AuthedRequest).ctx
    const parsed = config.schema.partial().safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

    const existing = await delegate().findFirst({ where: { id: req.params.id, orgId } })
    if (!existing) { res.status(404).json({ error: 'Record not found' }); return }

    const record = await delegate().update({
      where:   { id: req.params.id },
      data:    parsed.data,
      include: { po: true },
    })

    await auditLog({
      orgId, userId, userRole: role,
      action: 'UPDATE', entity: config.entityName, entityId: record.id, ip: req.ip,
    })
    res.json(record)
  })

  return router
}
