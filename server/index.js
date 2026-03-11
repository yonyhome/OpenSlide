import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import path from 'path'
import { fileURLToPath } from 'url'
import projectsRouter from './routes/projects.js'
import aiRouter from './routes/ai.js'
import settingsRouter from './routes/settings.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001
const SLIDES_DIR = path.resolve(__dirname, '../slides')

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost')
  .split(',')
  .map(o => o.trim())

app.use(cors({
  origin: (origin, cb) => {
    // Permitir requests sin origin (curl, Postman, mismo servidor)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    cb(new Error(`CORS bloqueado para origen: ${origin}`))
  }
}))

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 20,             // máx 20 requests por minuto
  message: { error: 'Demasiadas solicitudes. Espera un momento.' },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use('/slides', express.static(SLIDES_DIR))
app.use('/api/projects', projectsRouter)
app.use('/api/ai', aiLimiter, aiRouter)
app.use('/api/settings', settingsRouter)

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: err.message })
})

app.listen(PORT, () => console.log(`OpenSlide server running on http://localhost:${PORT}`))
