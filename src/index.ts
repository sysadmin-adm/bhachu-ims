import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'

import { contextMiddleware } from './middleware/context'
import poRouter        from './routes/po'
import dashboardRouter from './routes/dashboard'
import importRouter    from './routes/importExport'
import orgsRouter      from './routes/orgs'
import {
  executionRouter,
  financeRouter,
  forwardingRouter,
  highSeasRouter,
  clearanceRouter,
  deliveredRouter,
} from './routes/stages'

const app  = express()
const PORT = process.env.PORT ?? 3000

// ─── Security middleware ─────────────────────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://bhachu-ims-frontend.onrender.com',
  ],
  credentials: true,
}))
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true }))

// ─── Parsing + logging ───────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// ─── Health check (no auth required) ────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }))

// ─── Org creation — no context middleware (bootstrapping) ───────────────────
app.use('/api/orgs', orgsRouter)

// ─── All other routes require org context ───────────────────────────────────
app.use('/api', contextMiddleware)

app.use('/api/dashboard',  dashboardRouter)
app.use('/api/po',         poRouter)
app.use('/api/execution',  executionRouter)
app.use('/api/finance',    financeRouter)
app.use('/api/forwarding', forwardingRouter)
app.use('/api/high-seas',  highSeasRouter)
app.use('/api/clearance',  clearanceRouter)
app.use('/api/delivered',  deliveredRouter)
app.use('/api/import',     importRouter)

// ─── 404 handler ────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }))

// ─── Global error handler ────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err)
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  })
})

app.listen(PORT, () => {
  console.log(`\n🏭  Bhachu IMS API running on http://localhost:${PORT}`)
  console.log(`    Env: ${process.env.NODE_ENV ?? 'development'}`)
  console.log(`    Health: http://localhost:${PORT}/health\n`)
})

export default app