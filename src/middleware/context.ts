import { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { AuthedRequest, Role } from '../types'

// MVP: no JWT. Client sends X-Org-Slug and X-User-Role headers.
// These are set by the frontend after the user picks their org + role on first visit.
// Auth layer (WhatsApp OTP + JWT) will replace this middleware post-demo — 
// no route logic needs to change when it does.

export async function contextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const orgSlug = req.headers['x-org-slug'] as string
  const roleHeader = req.headers['x-user-role'] as string
  const userId = req.headers['x-user-id'] as string | undefined

  if (!orgSlug) {
    res.status(401).json({ error: 'Missing X-Org-Slug header' })
    return
  }

  const org = await prisma.organisation.findUnique({ where: { slug: orgSlug } })
  if (!org) {
    res.status(401).json({ error: `Organisation "${orgSlug}" not found` })
    return
  }

  const role = isValidRole(roleHeader) ? roleHeader : Role.VIEWER

  ;(req as AuthedRequest).ctx = {
    orgId: org.id,
    userId: userId || undefined,
    role,
    orgSlug: org.slug,
  }

  next()
}

function isValidRole(r: string): r is Role {
  return Object.values(Role).includes(r as Role)
}

// Role guard factory — use on individual routes that need specific access
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ctx = (req as AuthedRequest).ctx
    if (!roles.includes(ctx.role)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        current: ctx.role,
      })
      return
    }
    next()
  }
}

export const PROCUREMENT_ROLES = [Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.PROCUREMENT]
export const FINANCE_ROLES     = [Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.FINANCE]
export const LOGISTICS_ROLES   = [Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.LOGISTICS]
export const ADMIN_ROLES       = [Role.SUPER_ADMIN, Role.ORG_ADMIN]
export const ALL_ROLES         = Object.values(Role)
