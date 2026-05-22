# Bhachu IMS — Backend API

Integrated Management System for Bhachu Industries Limited.  
Import pipeline tracker + QMS framework. Node.js / TypeScript / Prisma / PostgreSQL.

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env — add your Neon DATABASE_URL

# 3. Push schema to database
npm run db:push

# 4. Seed demo data (Bhachu Industries org + sample POs)
npm run db:seed

# 5. Start development server
npm run dev
```

Server runs on http://localhost:3000

---

## API overview

All routes (except `/health` and `/api/orgs`) require two headers:

| Header | Example | Notes |
|--------|---------|-------|
| `X-Org-Slug` | `bhachu-industries` | Organisation identifier |
| `X-User-Role` | `PROCUREMENT` | Role for this session |
| `X-User-Id` | `<user-id>` | Optional — for audit log attribution |

### Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/health` | Health check |
| GET | `/api/dashboard` | Executive summary + alerts |
| GET | `/api/po` | List all POs (with stage status) |
| GET | `/api/po/:ref/autofill` | Auto-fill data for a PO Ref |
| GET | `/api/po/:id` | Single PO with all stage records |
| POST | `/api/po` | Create PO (Procurement+) |
| PATCH | `/api/po/:id` | Update PO (Procurement+) |
| DELETE | `/api/po/:id` | Delete PO (Procurement+) |
| GET/POST/PATCH | `/api/execution` | Under Execution stage |
| GET/POST/PATCH | `/api/finance` | Finance & Payments stage |
| GET/POST/PATCH | `/api/forwarding` | Forwarding stage |
| GET/POST/PATCH | `/api/high-seas` | High Seas stage |
| GET/POST/PATCH | `/api/clearance` | Under Clearance stage |
| GET/POST/PATCH | `/api/delivered` | Delivered stage |
| POST | `/api/import/excel` | Upload Excel to import POs |
| GET | `/api/import/export` | Export all data as Excel |
| GET | `/api/orgs/me` | Current org + users |
| POST | `/api/orgs/users` | Add user (Admin+) |

### Role permissions

| Role | PO Master | Execution | Finance | Forwarding | High Seas | Clearance | Delivered |
|------|-----------|-----------|---------|------------|-----------|-----------|-----------|
| ORG_ADMIN | ✏️ | ✏️ | ✏️ | ✏️ | ✏️ | ✏️ | ✏️ |
| PROCUREMENT | ✏️ | ✏️ | 👁️ | 👁️ | 👁️ | 👁️ | 👁️ |
| FINANCE | 👁️ | 👁️ | ✏️ | 👁️ | 👁️ | 👁️ | ✏️ |
| LOGISTICS | 👁️ | 👁️ | 👁️ | ✏️ | ✏️ | ✏️ | 👁️ |
| VIEWER | 👁️ | 👁️ | 👁️ | 👁️ | 👁️ | 👁️ | 👁️ |

---

## Importing Avraj's Excel

```bash
curl -X POST http://localhost:3000/api/import/excel \
  -H "X-Org-Slug: bhachu-industries" \
  -H "X-User-Role: ORG_ADMIN" \
  -F "file=@STEEL_IMPORT_MASTER_TRACKER_v3.xlsx"
```

The importer handles both the original Excel column names and our own export format.  
Existing POs are updated (upsert), not duplicated.

---

## Deploy to Render

1. Create a new Web Service pointing to this repo
2. Set environment variables: `DATABASE_URL`, `FRONTEND_URL`, `NODE_ENV=production`
3. Set `NPM_CONFIG_PRODUCTION=false` (needed for devDependencies like tsx)
4. Build command: `npm run build`
5. Start command: `node dist/index.js`

---

## Phase 2 additions (post-demo)

- WhatsApp OTP auth — drop-in replacement for the header-based context middleware
- QMS document control module
- Audit + NCR + CAPA workflow  
- Risk register
- Multi-subsidiary dashboard
