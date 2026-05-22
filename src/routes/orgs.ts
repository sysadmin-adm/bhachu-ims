import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuthedRequest } from '../types'
import { requireRole, ADMIN_ROLES, ALL_ROLES } from '../middleware/context'

const router = Router()

// GET /api/orgs/me — current org info + users
router.get('/me', requireRole(...ALL_ROLES), async (req, res) => {
  const { orgId } = (req as AuthedRequest).ctx
  const org = await prisma.organisation.findUnique({
    where: { id: orgId },
    include: { users: { select: { id: true, name: true, email: true, role: true } } },
  })
  res.json(org)
})

// POST /api/orgs — create organisation (super admin only, used for seeding)
router.post('/', async (req, res) => {
  const parsed = z.object({
    name: z.string().min(1),
    slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  }).safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const org = await prisma.organisation.create({ data: parsed.data })
  res.status(201).json(org)
})

// POST /api/orgs/users — add user to org
router.post('/users', requireRole(...ADMIN_ROLES), async (req, res) => {
  const { orgId } = (req as AuthedRequest).ctx
  const parsed = z.object({
    name:  z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    role:  z.enum(['ORG_ADMIN','PROCUREMENT','FINANCE','LOGISTICS','VIEWER']),
  }).safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const user = await prisma.user.create({ data: { orgId, ...parsed.data } })
  res.status(201).json(user)
})

// PATCH /api/orgs/users/:id
router.patch('/users/:id', requireRole(...ADMIN_ROLES), async (req, res) => {
  const { orgId } = (req as AuthedRequest).ctx
  const existing = await prisma.user.findFirst({ where: { id: req.params.id, orgId } })
  if (!existing) { res.status(404).json({ error: 'User not found' }); return }

  const parsed = z.object({
    name:  z.string().optional(),
    phone: z.string().optional(),
    role:  z.enum(['ORG_ADMIN','PROCUREMENT','FINANCE','LOGISTICS','VIEWER']).optional(),
  }).safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const user = await prisma.user.update({ where: { id: req.params.id }, data: parsed.data })
  res.json(user)
})

export default router
