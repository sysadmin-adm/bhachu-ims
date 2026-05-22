import { PrismaClient, Role, Category, Currency } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding Bhachu Industries...')

  // ─── Organisation ──────────────────────────────────────────────────────────
  const org = await prisma.organisation.upsert({
    where:  { slug: 'bhachu-industries' },
    update: {},
    create: { name: 'Bhachu Industries Limited', slug: 'bhachu-industries' },
  })
  console.log(`✅ Org: ${org.name} (${org.slug})`)

  // ─── Demo users ───────────────────────────────────────────────────────────
  const users = [
    { name: 'Avraj Bhachu',   email: 'avraj@bhachu.co.ke',      role: Role.ORG_ADMIN   },
    { name: 'Harpreet Bhachu',email: 'harpreet@bhachu.co.ke',   role: Role.PROCUREMENT },
    { name: 'Jinder Bhachu',  email: 'jinder@bhachu.co.ke',     role: Role.FINANCE     },
    { name: 'Logistics Team', email: 'logistics@bhachu.co.ke',  role: Role.LOGISTICS   },
  ]
  for (const u of users) {
    await prisma.user.upsert({
      where:  { orgId_email: { orgId: org.id, email: u.email } },
      update: {},
      create: { orgId: org.id, ...u },
    })
  }
  console.log(`✅ Users: ${users.length} demo users created`)

  // ─── Sample POs ───────────────────────────────────────────────────────────
  const samplePos = [
    {
      poRef: 'BI-2026-001', supplier: 'Shandong Heavy Industry', countryOfOrigin: 'China',
      description: 'Shacman X3000 Truck Engine Spares — Set A',
      category: Category.SPARES, quantity: 1, unit: 'LOT',
      currency: Currency.USD, poValue: 18500,
      pfiNo: 'PFI-SHI-001', paymentTerms: '30% deposit, 70% before shipment',
      poDate: new Date('2026-01-15'), expectedEtd: new Date('2026-03-10'),
    },
    {
      poRef: 'BI-2026-002', supplier: 'Lubricants Direct UAE', countryOfOrigin: 'UAE',
      description: 'Hydraulic Oil ISO 46 — 200L Drums',
      category: Category.CONSUMABLES, quantity: 50, unit: 'DRUMS',
      currency: Currency.USD, poValue: 6200,
      pfiNo: 'PFI-LDU-002', paymentTerms: 'TT in advance',
      poDate: new Date('2026-02-01'), expectedEtd: new Date('2026-03-20'),
    },
    {
      poRef: 'BI-2026-003', supplier: 'Bosch Industrial DE', countryOfOrigin: 'Germany',
      description: 'Hydraulic Pump Assembly — P/N BH-4422',
      category: Category.SPARES, quantity: 2, unit: 'PCS',
      currency: Currency.EUR, poValue: 9800,
      pfiNo: 'PFI-BSH-003', paymentTerms: 'LC at sight',
      poDate: new Date('2026-02-10'), expectedEtd: new Date('2026-04-01'),
    },
    {
      poRef: 'BI-2026-004', supplier: 'Atlas Copco Kenya', countryOfOrigin: 'Kenya',
      description: 'Air Compressor Filter Kits — Annual Supply',
      category: Category.CONSUMABLES, quantity: 24, unit: 'SETS',
      currency: Currency.KES, poValue: 480000,
      paymentTerms: 'Net 30',
      poDate: new Date('2026-03-01'),
    },
    {
      poRef: 'BI-2026-005', supplier: 'XCMG International', countryOfOrigin: 'China',
      description: 'Crawler Crane Undercarriage Components',
      category: Category.SPARES, quantity: 1, unit: 'SET',
      currency: Currency.USD, poValue: 34000,
      pfiNo: 'PFI-XCM-005', paymentTerms: '30% deposit, 70% BL',
      poDate: new Date('2026-03-05'), expectedEtd: new Date('2026-05-15'),
    },
  ]

  for (const poData of samplePos) {
    const po = await prisma.purchaseOrder.upsert({
      where:  { orgId_poRef: { orgId: org.id, poRef: poData.poRef } },
      update: {},
      create: { orgId: org.id, ...poData },
    })

    // Give some POs downstream stage records to populate the pipeline
    if (poData.poRef === 'BI-2026-001') {
      await prisma.executionRecord.upsert({
        where:  { poId: po.id },
        update: {},
        create: {
          orgId: org.id, poId: po.id,
          productionStatus: 'READY_FOR_SHIPMENT',
          confirmedEtd: new Date('2026-03-10'),
          destinationPort: 'Mombasa',
        },
      })
      await prisma.financeRecord.upsert({
        where:  { poId: po.id },
        update: {},
        create: {
          orgId: org.id, poId: po.id,
          depositAmount: 5550, depositDate: new Date('2026-01-20'),
          balanceDue: 12950, paymentStatus: 'DEPOSIT_PAID',
          freightCostUsd: 1200,
        },
      })
    }

    if (poData.poRef === 'BI-2026-002') {
      await prisma.highSeasRecord.upsert({
        where:  { poId: po.id },
        update: {},
        create: {
          orgId: org.id, poId: po.id,
          blNumber: 'MSKU2026UAE002',
          vesselName: 'MSC LUCIA', portOfLoading: 'Jebel Ali',
          portOfDischarge: 'Mombasa',
          atd: new Date('2026-03-01'),
          eta: new Date('2026-03-14'),
        },
      })
    }

    if (poData.poRef === 'BI-2026-003') {
      await prisma.clearanceRecord.upsert({
        where:  { poId: po.id },
        update: {},
        create: {
          orgId: org.id, poId: po.id,
          blNumber: 'HLCU2026DE003',
          shipmentType: 'LCL', clearingAgent: 'Bollore Logistics',
          arrivalDate: new Date('2026-03-18'),
          docsReceived: true, entryFiled: true, dutiesPaid: false,
          releaseStatus: 'PENDING', clearanceStatus: 'IN_PROGRESS',
        },
      })
    }
  }

  console.log(`✅ POs: ${samplePos.length} sample orders across pipeline stages`)
  console.log('\n🎉 Seed complete. Run: npm run dev\n')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
