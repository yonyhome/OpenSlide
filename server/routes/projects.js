import { Router } from 'express'
import { getProjects, getProject, createProject, deleteProject } from '../services/projectManager.js'
import { exportToPDF, exportToPPTX } from '../services/exporter.js'
import archiver from 'archiver'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SLIDES_DIR = path.resolve(__dirname, '../../slides')

const router = Router()

router.get('/', (_req, res) => res.json(getProjects()))

router.get('/:slug', (req, res) => {
  const p = getProject(req.params.slug)
  if (!p) return res.status(404).json({ error: 'Not found' })
  res.json(p)
})

router.post('/', (req, res) => {
  try {
    const { name, model } = req.body
    let { slug } = req.body
    if (!slug || !name) return res.status(400).json({ error: 'slug y name son requeridos' })
    res.json(createProject({ slug, name, model }))
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

router.delete('/:slug', (req, res) => {
  try {
    deleteProject(req.params.slug)
    res.json({ ok: true })
  } catch (e) {
    res.status(404).json({ error: e.message })
  }
})

// GET /api/projects/:slug/export/pdf
router.get('/:slug/export/pdf', async (req, res) => {
  try {
    const { slug } = req.params
    const baseUrl = `${req.protocol}://${req.get('host')}`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${slug}.pdf"`)
    const pdf = await exportToPDF(slug, baseUrl)
    res.send(pdf)
  } catch (err) {
    console.error('[Export PDF]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/projects/:slug/export/pptx
router.get('/:slug/export/pptx', async (req, res) => {
  try {
    const { slug } = req.params
    const baseUrl = `${req.protocol}://${req.get('host')}`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
    res.setHeader('Content-Disposition', `attachment; filename="${slug}.pptx"`)
    const pptx = await exportToPPTX(slug, baseUrl)
    res.send(pptx)
  } catch (err) {
    console.error('[Export PPTX]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/projects/:slug/export — descarga ZIP del proyecto
router.get('/:slug/export', (req, res) => {
  const { slug } = req.params
  const projectDir = path.join(SLIDES_DIR, slug)
  if (!fs.existsSync(projectDir)) return res.status(404).json({ error: 'Proyecto no encontrado' })

  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="${slug}.zip"`)

  const archive = archiver('zip', { zlib: { level: 9 } })
  archive.on('error', err => { if (!res.headersSent) res.status(500).json({ error: err.message }) })
  archive.pipe(res)
  archive.directory(projectDir, slug)
  archive.finalize()
})

export default router
