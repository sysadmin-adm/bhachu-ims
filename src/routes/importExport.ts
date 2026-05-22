import { Router } from 'express'
import multer from 'multer'
import * as XLSX from 'xlsx'
import { prisma } from '../lib/prisma'
import { auditLog } from '../lib/audit'
import { AuthedRequest } from '../types'
import { requireRole, ADMIN_ROLES, ALL_ROLES } from '../middleware/context'

type Category = 'CONSUMABLES' | 'SPARES' | 'EQUIPMENT' | 'RAW_MATERIALS' | 'OTHER'
type Currency = 'USD' | 'EUR' | 'GBP' | 'KES' | 'CNY' | 'AED' | 'INR'

const router  = Router()
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

// POST /api/import/excel — upload Avraj's Excel, parse PO Master sheet, bulk-upsert
router.post('/excel', requireRole(...ADMIN_ROLES), upload.single('file'), async (req, res) => {
  const { orgId, userId, role } = (req as AuthedRequest).ctx
  if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return }

  const wb   = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true })
  const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[] }

  // Try to find the PO Master sheet (flexible naming)
  const sheetName = wb.SheetNames.find(n =>
    n.toLowerCase().includes('po master') || n.toLowerCase().includes('po ref')
  ) ?? wb.SheetNames[0]

  const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null })

  for (const row of rows) {
    try {
      // Column name normalisation — handle both Avraj's Excel and our own exports
      const poRef      = String(row['FILE / PO REF NO.'] ?? row['FILE/PO REF NO.'] ?? row['poRef'] ?? '').trim()
      const supplier   = String(row['SUPPLIER'] ?? row['supplier'] ?? '').trim()
      const description = String(row['DESCRIPTION OF GOODS'] ?? row['description'] ?? '').trim()
      const category   = normaliseCategory(row['CATEGORY'] ?? row['category'])
      const currency   = normaliseCurrency(row['CURRENCY'] ?? row['CUR'] ?? row['currency'])
      const poValue    = parseFloat(row['PO VALUE'] ?? row['VALUE'] ?? row['poValue'] ?? '0')
      const quantity   = parseFloat(row['QUANTITY'] ?? row['quantity'] ?? '1')

      if (!poRef || !supplier || !description) {
        results.skipped++
        continue
      }

      await prisma.purchaseOrder.upsert({
        where:  { orgId_poRef: { orgId, poRef } },
        create: {
          orgId, poRef, supplier, description, category, currency, poValue, quantity,
          countryOfOrigin: row['COUNTRY OF ORIGIN'] ?? undefined,
          unit:            row['UNIT'] ?? undefined,
          pfiNo:           row['PFI NO.'] ?? row['PFI NO'] ?? undefined,
          paymentTerms:    row['PAYMENT TERMS'] ?? undefined,
          remarks:         row['REMARKS'] ?? undefined,
          poDate:          row['PO DATE'] instanceof Date ? row['PO DATE'] : undefined,
          expectedEtd:     row['EXPECTED ETD'] instanceof Date ? row['EXPECTED ETD'] : undefined,
        },
        update: {
          supplier, description, category, currency, poValue, quantity,
          pfiNo:        row['PFI NO.'] ?? row['PFI NO'] ?? undefined,
          paymentTerms: row['PAYMENT TERMS'] ?? undefined,
        },
      })
      results.created++
    } catch (e: any) {
      results.errors.push(`Row skipped: ${e.message}`)
      results.skipped++
    }
  }

  await auditLog({
    orgId, userId, userRole: role,
    action: 'IMPORT', entity: 'PurchaseOrder',
    changes: { imported: [null, results.created] } as any,
    ip: req.ip,
  })

  res.json({ message: 'Import complete', ...results })
})

// GET /api/import/export — export all PO Master data as Excel
router.get('/export', requireRole(...ALL_ROLES), async (req, res) => {
  const { orgId, userId, role } = (req as AuthedRequest).ctx

  const pos = await prisma.purchaseOrder.findMany({
    where: { orgId },
    orderBy: { createdAt: 'asc' },
    include: {
      executionRecord:  true,
      financeRecord:    true,
      forwardingRecord: true,
      highSeasRecord:   true,
      clearanceRecord:  true,
      deliveryRecord:   true,
    },
  })

  const wb  = XLSX.utils.book_new()

  // Sheet 1: PO Master
  const poRows = pos.map((po: Record<string, any>) => ({
    'FILE / PO REF NO.':    po.poRef,
    'SUPPLIER':              po.supplier,
    'COUNTRY OF ORIGIN':     po.countryOfOrigin ?? '',
    'DESCRIPTION OF GOODS':  po.description,
    'CATEGORY':              po.category,
    'QUANTITY':              Number(po.quantity),
    'UNIT':                  po.unit ?? '',
    'CURRENCY':              po.currency,
    'PO VALUE':              Number(po.poValue),
    'PFI NO.':               po.pfiNo ?? '',
    'PAYMENT TERMS':         po.paymentTerms ?? '',
    'PO DATE':               po.poDate?.toISOString().split('T')[0] ?? '',
    'EXPECTED ETD':          po.expectedEtd?.toISOString().split('T')[0] ?? '',
    'REMARKS':               po.remarks ?? '',
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(poRows), '1. PO MASTER')

  // Sheet 2: Under Execution
  const execRows = pos
    .filter((po: Record<string, any>) => po.executionRecord)
    .map((po: Record<string, any>) => ({
      'FILE / PO REF NO.': po.poRef,
      'SUPPLIER':           po.supplier,
      'DESCRIPTION':        po.description,
      'CATEGORY':           po.category,
      'PRODUCTION STATUS':  po.executionRecord!.productionStatus,
      'INSPECTION REQ':     po.executionRecord!.inspectionReq ? 'YES' : 'NO',
      'CONFIRMED ETD':      po.executionRecord!.confirmedEtd?.toISOString().split('T')[0] ?? '',
      'DESTINATION PORT':   po.executionRecord!.destinationPort ?? '',
      'REMARKS':            po.executionRecord!.remarks ?? '',
    }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(execRows), '2. UNDER EXECUTION')

  // Sheet 7: Delivered
  const delivRows = pos
    .filter((po: Record<string, any>) => po.deliveryRecord)
    .map((po: Record<string, any>) => ({
      'FILE / PO REF NO.': po.poRef,
      'SUPPLIER':           po.supplier,
      'DESCRIPTION':        po.description,
      'INVOICE NO.':        po.deliveryRecord!.invoiceNo ?? '',
      'B/L NUMBER':         po.deliveryRecord!.blNumber ?? '',
      'CLEARING AGENT':     po.deliveryRecord!.clearingAgent ?? '',
      'TAXES PAID (USD)':   Number(po.deliveryRecord!.taxesPaidUsd ?? 0),
      'TOTAL LANDED COST':  Number(po.deliveryRecord!.totalLandedCost ?? 0),
      'RELEASE DATE':       po.deliveryRecord!.releaseDate?.toISOString().split('T')[0] ?? '',
      'GRN NO.':            po.deliveryRecord!.grnReceiptNo ?? '',
    }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(delivRows), '7. DELIVERED')

  await auditLog({ orgId, userId, userRole: role, action: 'EXPORT', entity: 'PurchaseOrder', ip: req.ip })

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Disposition', 'attachment; filename="bhachu-ims-export.xlsx"')
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buffer)
})

// ─── Helpers ────────────────────────────────────────────────────────────────

function normaliseCategory(raw: any): Category {
  const s = String(raw ?? '').toUpperCase().trim()
  if (s.includes('SPARE'))   return 'SPARES'
  if (s.includes('EQUIP'))   return 'EQUIPMENT'
  if (s.includes('RAW'))     return 'RAW_MATERIALS'
  if (s.includes('CONSUM'))  return 'CONSUMABLES'
  return 'OTHER'
}

function normaliseCurrency(raw: any): Currency {
  const s = String(raw ?? 'USD').toUpperCase().trim()
  const valid: Currency[] = ['USD','EUR','GBP','KES','CNY','AED','INR']
  return valid.includes(s as Currency) ? (s as Currency) : 'USD'
}

export default router
