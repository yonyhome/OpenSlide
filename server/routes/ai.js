import { Router } from 'express'
import { createProvider } from '../services/ai/provider.js'
import { generatePresentation } from '../services/slideGenerator.js'
import { createProject, getProject, addSlide } from '../services/projectManager.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = path.resolve(__dirname, '../../config/settings.json')
const router = Router()

function getApiKey(model) {
  if (!fs.existsSync(CONFIG_PATH)) return null
  try {
    const settings = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
    const map = { openai: 'openai', claude: 'anthropic', gemini: 'gemini' }
    return settings.keys?.[map[model]] || null
  } catch {
    return null
  }
}

// Chat con el LLM (para el asistente conversacional)
router.post('/chat', async (req, res) => {
  try {
    const { messages, model, apiKey: clientKey } = req.body
    if (!messages || !model) return res.status(400).json({ error: 'messages y model son requeridos' })

    const apiKey = clientKey || getApiKey(model)
    if (!apiKey) return res.status(400).json({ error: 'API key no configurada para este modelo' })

    const provider = createProvider(model, apiKey)
    const message = await provider.chat(messages)
    res.json({ message, role: 'assistant' })
  } catch (err) {
    console.error('[AI /chat]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Validar API key
router.post('/validate-key', async (req, res) => {
  try {
    const { model, apiKey } = req.body
    if (!model || !apiKey) return res.status(400).json({ error: 'model y apiKey requeridos' })

    const provider = createProvider(model, apiKey)
    const valid = await provider.validateKey()
    res.json({ valid })
  } catch (err) {
    res.json({ valid: false, error: err.message })
  }
})

// Generar presentación completa
router.post('/generate', async (req, res) => {
  try {
    const { slug, model, projectName, brief, slideCount, theme, extraInstructions, apiKey: clientKey } = req.body

    if (!slug || !model || !projectName || !brief) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos: slug, model, projectName, brief' })
    }

    const apiKey = clientKey || getApiKey(model)
    if (!apiKey) return res.status(400).json({ error: 'API key no configurada' })

    // Crear el proyecto si no existe
    let project = getProject(slug)
    if (!project) {
      project = createProject({ slug, name: projectName, model })
    }

    const result = await generatePresentation({
      slug,
      model,
      apiKey,
      projectName,
      brief,
      slideCount: parseInt(slideCount) || 5,
      theme: theme || 'dark-tech',
      extraInstructions
    })

    res.json({ ok: true, ...result })
  } catch (err) {
    console.error('[AI /generate]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Regenerar un slide específico
router.post('/regenerate-slide', async (req, res) => {
  try {
    const { slug, slideIndex, instructions, apiKey: clientKey } = req.body
    if (!slug || !slideIndex) return res.status(400).json({ error: 'slug y slideIndex requeridos' })

    const project = getProject(slug)
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' })

    const apiKey = clientKey || getApiKey(project.model)
    if (!apiKey) return res.status(400).json({ error: 'API key no configurada' })

    const provider = createProvider(project.model, apiKey)
    const html = await provider.generateSlide({
      slideNumber: slideIndex,
      totalSlides: project.slideCount,
      content: instructions || `Regenerar slide ${slideIndex}`,
      theme: project.theme || 'dark-tech',
      projectName: project.name
    })

    const filename = addSlide(slug, slideIndex, html)
    res.json({ ok: true, filename })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
