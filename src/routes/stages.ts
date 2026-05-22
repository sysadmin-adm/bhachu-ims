import { z } from 'zod'
import { createStageRouter } from './_stageFactory'
import { PROCUREMENT_ROLES, FINANCE_ROLES, LOGISTICS_ROLES } from '../middleware/context'

// ─── Stage 1: Under Execution (Procurement) ─────────────────────────────────

export const executionRouter = createStageRouter({
  model:      'executionRecord',
  entityName: 'ExecutionRecord',
  writeRoles: PROCUREMENT_ROLES,
  schema: z.object({
    poId:             z.string(),
    quantity:         z.number().positive().optional(),
    productionStatus: z.enum(['PENDING','IN_PRODUCTION','READY_FOR_SHIPMENT','DELAYED','CANCELLED']).optional(),
    inspectionReq:    z.boolean().optional(),
    inspectionDate:   z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
    confirmedEtd:     z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
    destinationPort:  z.string().optional(),
    remarks:          z.string().optional(),
  }),
})

// ─── Stage 2: Finance & Payments (Finance) ──────────────────────────────────

export const financeRouter = createStageRouter({
  model:      'financeRecord',
  entityName: 'FinanceRecord',
  writeRoles: FINANCE_ROLES,
  schema: z.object({
    poId:            z.string(),
    quantity:        z.number().positive().optional(),
    depositAmount:   z.number().optional(),
    depositDate:     z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
    balanceDue:      z.number().optional(),
    balancePaid:     z.number().optional(),
    balancePaidDate: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
    paymentStatus:   z.enum(['UNPAID','DEPOSIT_PAID','PARTIALLY_PAID','FULLY_PAID','OVERDUE']).optional(),
    bankCharges:     z.number().optional(),
    freightCostUsd:  z.number().optional(),
    insuranceUsd:    z.number().optional(),
    customsTaxesUsd: z.number().optional(),
    clearingFeesUsd: z.number().optional(),
    totalLandedCost: z.number().optional(),
    remarks:         z.string().optional(),
  }),
})

// ─── Stage 3: Forwarding (Logistics) ────────────────────────────────────────

export const forwardingRouter = createStageRouter({
  model:      'forwardingRecord',
  entityName: 'ForwardingRecord',
  writeRoles: LOGISTICS_ROLES,
  schema: z.object({
    poId:            z.string(),
    quantity:        z.number().positive().optional(),
    forwardingAgent: z.string().optional(),
    incoterms:       z.string().optional(),
    modeOfTransport: z.string().optional(),
    portOfOrigin:    z.string().optional(),
    departureDate:   z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
    vesselFlightNo:  z.string().optional(),
    deliveryPoint:   z.string().optional(),
    remarks:         z.string().optional(),
  }),
})

// ─── Stage 4: High Seas (Logistics) ─────────────────────────────────────────

export const highSeasRouter = createStageRouter({
  model:      'highSeasRecord',
  entityName: 'HighSeasRecord',
  writeRoles: LOGISTICS_ROLES,
  schema: z.object({
    poId:            z.string(),
    quantity:        z.number().positive().optional(),
    blNumber:        z.string().optional(),
    forwardingAgent: z.string().optional(),
    vesselName:      z.string().optional(),
    portOfLoading:   z.string().optional(),
    portOfDischarge: z.string().optional(),
    atd:             z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
    eta:             z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
    remarks:         z.string().optional(),
  }),
})

// ─── Stage 5: Under Clearance (Logistics) ───────────────────────────────────

export const clearanceRouter = createStageRouter({
  model:      'clearanceRecord',
  entityName: 'ClearanceRecord',
  writeRoles: LOGISTICS_ROLES,
  schema: z.object({
    poId:            z.string(),
    quantity:        z.number().positive().optional(),
    blNumber:        z.string().optional(),
    shipmentType:    z.enum(['FCL','LCL','AIR','ROAD']).optional(),
    clearingAgent:   z.string().optional(),
    arrivalDate:     z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
    docsReceived:    z.boolean().optional(),
    entryFiled:      z.boolean().optional(),
    dutiesPaid:      z.boolean().optional(),
    releaseStatus:   z.enum(['PENDING','RELEASED','ON_HOLD','DETAINED']).optional(),
    clearanceStatus: z.enum(['IN_PROGRESS','CLEARED','QUERY_RAISED','DELAYED']).optional(),
    remarks:         z.string().optional(),
  }),
})

// ─── Stage 6: Delivered (Finance) ───────────────────────────────────────────

export const deliveredRouter = createStageRouter({
  model:      'deliveryRecord',
  entityName: 'DeliveryRecord',
  writeRoles: FINANCE_ROLES,
  schema: z.object({
    poId:            z.string(),
    quantity:        z.number().positive().optional(),
    invoiceNo:       z.string().optional(),
    blNumber:        z.string().optional(),
    clearingAgent:   z.string().optional(),
    taxesPaidUsd:    z.number().optional(),
    totalLandedCost: z.number().optional(),
    arrivalDate:     z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
    deliveryPoint:   z.string().optional(),
    releaseDate:     z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
    grnReceiptNo:    z.string().optional(),
    remarks:         z.string().optional(),
  }),
})
