import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { auditLog } from '../lib/audit'
import { AuthedRequest, PoAutoFill } from '../types'
import { requireRole, PROCUREMENT_ROLES, ALL_ROLES } from '../middleware/context'

const router = Router()

const PoSchema = z.object({
  poRef:           z.string().min(1),
  supplier:        z.string().min(1),
  countryOfOrigin: z.string().optional(),
  description:     z.string().min(1),
  category:        z.enum(['CONSUMABLES', 'SPARES', 'EQUIPMENT', 'RAW_MATERIALS', 'OTHER']),
  quantity:        z.number().positive(),
  unit:            z.string().optional(),
  currency:        z.enum(['USD', 'EUR', 'GBP', 'KES', 'CNY', 'AED', 'INR']),
  poValue:         z.number().positive(),
  pfiNo:           z.string().optional(),
  paymentTerms:    z.string().optional(),
  poDate:          z.string().datetime().optional(),
  expectedEtd:     z.string().datetime().optional(),
  remarks:         z.string().optional(),
})

// GET /api/po — list all POs for org
router.get('/', requireRole(...ALL_ROLES), async (req, res) => {
  const { orgId } = (req as AuthedRequest).ctx
  const { search, category, currency } = req.query

  const pos = await prisma.purchaseOrder.findMany({
    where: {
      orgId,
      ...(search ? {
        OR: [
          { poRef:       { contains: String(search), mode: 'insensitive' } },
          { supplier:    { contains: String(search), mode: 'insensitive' } },
          { description: { contains: String(search), mode: 'insensitive' } },
        ],
      } : {}),
      ...(category ? { category: category as any } : {}),
      ...(currency ? { currency: currency as any } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      executionRecord:  { select: { productionStatus: true } },
      financeRecord:    { select: { paymentStatus: true } },
      highSeasRecord:   { select: { eta: true } },
      clearanceRecord:  { select: { clearanceStatus: true } },
      deliveryRecord:   { select: { releaseDate: true } },
    },
  })

  res.json(pos)
})

// GET /api/po/:ref/autofill — downstream stages call this on PO Ref entry
router.get('/:ref/autofill', requireRole(...ALL_ROLES), async (req, res) => {
  const { orgId } = (req as AuthedRequest).ctx
  const po = await prisma.purchaseOrder.findUnique({
    where: { orgId_poRef: { orgId, poRef: req.params.ref } },
  })

  if (!po) {
    res.status(404).json({ error: `⚠ PO Ref "${req.params.ref}" not found in PO Master` })
    return
  }

  const autofill: PoAutoFill = {
    supplier:     po.supplier,
    description:  po.description,
    category:     po.category,
    currency:     po.currency,
    poValue:      Number(po.poValue),
    pfiNo:        po.pfiNo,
    paymentTerms: po.paymentTerms,
    quantity:     Number(po.quantity),
  }

  res.json(autofill)
})

// GET /api/po/:id — single PO with all stage records
router.get('/:id', requireRole(...ALL_ROLES), async (req, res) => {
  const { orgId } = (req as AuthedRequest).ctx
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: req.params.id, orgId },
    include: {
      executionRecord:  true,
      financeRecord:    true,
      forwardingRecord: true,
      highSeasRecord:   true,
      clearanceRecord:  true,
      deliveryRecord:   true,
    },
  })

  if (!po) { res.status(404).json({ error: 'PO not found' }); return }
  res.json(po)
})

// POST /api/po — create new PO
router.post('/', requireRole(...PROCUREMENT_ROLES), async (req, res) => {
  const { orgId, userId, role } = (req as AuthedRequest).ctx
  const parsed = PoSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const existing = await prisma.purchaseOrder.findUnique({
    where: { orgId_poRef: { orgId, poRef: parsed.data.poRef } },
  })
  if (existing) {
    res.status(409).json({ error: `PO Ref "${parsed.data.poRef}" already exists` })
    return
  }

  const po = await prisma.purchaseOrder.create({
    data: {
      orgId,
      ...parsed.data,
      poDate:      parsed.data.poDate      ? new Date(parsed.data.poDate)      : undefined,
      expectedEtd: parsed.data.expectedEtd ? new Date(parsed.data.expectedEtd) : undefined,
    },
  })

  await auditLog({ orgId, userId, userRole: role, action: 'CREATE', entity: 'PurchaseOrder', entityId: po.id, ip: req.ip })
  res.status(201).json(po)
})

// PATCH /api/po/:id — update PO
router.patch('/:id', requireRole(...PROCUREMENT_ROLES), async (req, res) => {
  const { orgId, userId, role } = (req as AuthedRequest).ctx
  const parsed = PoSchema.partial().safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const existing = await prisma.purchaseOrder.findFirst({ where: { id: req.params.id, orgId } })
  if (!existing) { res.status(404).json({ error: 'PO not found' }); return }

  const po = await prisma.purchaseOrder.update({
    where: { id: req.params.id },
    data: {
      ...parsed.data,
      poDate:      parsed.data.poDate      ? new Date(parsed.data.poDate)      : undefined,
      expectedEtd: parsed.data.expectedEtd ? new Date(parsed.data.expectedEtd) : undefined,
    },
  })

  await auditLog({ orgId, userId, userRole: role, action: 'UPDATE', entity: 'PurchaseOrder', entityId: po.id, ip: req.ip })
  res.json(po)
})

// DELETE /api/po/:id
router.delete('/:id', requireRole(...PROCUREMENT_ROLES), async (req, res) => {
  const { orgId, userId, role } = (req as AuthedRequest).ctx
  const existing = await prisma.purchaseOrder.findFirst({ where: { id: req.params.id, orgId } })
  if (!existing) { res.status(404).json({ error: 'PO not found' }); return }

  await prisma.purchaseOrder.delete({ where: { id: req.params.id } })
  await auditLog({ orgId, userId, userRole: role, action: 'DELETE', entity: 'PurchaseOrder', entityId: req.params.id, ip: req.ip })
  res.status(204).send()
})

export default router
