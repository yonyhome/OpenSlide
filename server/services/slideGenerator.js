import { createProvider } from './ai/provider.js'
import { addSlide, updateMeta, getProject } from './projectManager.js'
import { generateSlideImage, injectBackgroundImage } from './imageGenerator.js'

/**
 * Pide al LLM que genere un CSS único para la presentación
 */
export async function generateCustomTheme({ provider, projectName, brief }) {
  const messages = [
    {
      role: 'system',
      content: `Eres un diseñador experto en CSS. Genera un tema visual único y moderno para una presentación HTML.
REGLAS:
- Retorna ÚNICAMENTE el CSS, sin explicaciones, sin bloques \`\`\`css
- El CSS debe estilizar la clase .slide (1280px × 720px)
- Incluir estilos para: body, .slide, h1, h2, p, li, .accent
- Usa colores y tipografía coherentes con el tema de la presentación
- El resultado debe ser visualmente impresionante y único
- No uses fuentes externas
- Sé creativo: gradientes, bordes, sombras, efectos sutiles`
    },
    {
      role: 'user',
      content: `Presentación: "${projectName}"
Descripción: ${brief}

Genera el CSS personalizado para esta presentación. Solo el CSS, sin nada más.`
    }
  ]

  const css = await provider.chat(messages, { temperature: 0.8 })
  // Limpiar posibles bloques markdown
  return css.replace(/```css\s*/g, '').replace(/```\s*/g, '').trim()
}

/**
 * Genera todos los slides de un proyecto usando el LLM
 * @param {object} params
 * @param {string} params.slug - slug del proyecto
 * @param {string} params.model - 'openai' | 'claude' | 'gemini'
 * @param {string} params.apiKey - API key del proveedor
 * @param {string} params.projectName - nombre del proyecto
 * @param {string} params.brief - descripción del proyecto
 * @param {number} params.slideCount - cantidad de slides
 * @param {string} params.theme - tema visual
 * @param {string} params.extraInstructions - instrucciones adicionales del usuario
 * @param {boolean} params.useImageGeneration - generar imágenes con Gemini
 * @param {string} params.geminiApiKey - Gemini API key para generación de imágenes
 * @returns {Promise<{slides: string[], errors: string[]}>}
 */
export async function generatePresentation(params) {
  const { slug, model, apiKey, projectName, brief, slideCount, theme, extraInstructions, useImageGeneration = false, geminiApiKey = null } = params
  const provider = createProvider(model, apiKey)

  // Generar tema personalizado si se solicitó
  let customThemeCss = null
  if (theme === 'ai-generated') {
    customThemeCss = await generateCustomTheme({ provider, projectName, brief })
  }

  // Primero pedimos al LLM que planifique el contenido de cada slide
  const plan = await planPresentation({ provider, projectName, brief, slideCount, extraInstructions })

  const slides = []
  const errors = []

  for (let i = 0; i < plan.length; i++) {
    try {
      let html = await provider.generateSlide({
        slideNumber: i + 1,
        totalSlides: plan.length,
        content: plan[i],
        theme,
        customThemeCss,
        projectName
      })

      // Enriquecer con imagen generada si se solicitó y hay Gemini key
      if (useImageGeneration && geminiApiKey) {
        const imagePrompt = `${projectName}: ${plan[i].slice(0, 100)}`
        const image = await generateSlideImage(geminiApiKey, imagePrompt)
        if (image) html = injectBackgroundImage(html, image)
      }

      const filename = addSlide(slug, i + 1, html)
      slides.push(filename)
      console.log(`[SlideGenerator] Slide ${i + 1}/${plan.length} generado: ${filename}`)
    } catch (err) {
      console.error(`[SlideGenerator] Error en slide ${i + 1}:`, err.message)
      errors.push(`Slide ${i + 1}: ${err.message}`)
    }
  }

  // Actualizar meta con modelo usado
  updateMeta(slug, { model, theme, customThemeCss, generatedAt: new Date().toISOString() })

  return { slides, errors }
}

/**
 * Genera presentación con Server-Sent Events para progreso en tiempo real
 * @param {object} params - mismos que generatePresentation
 * @param {object} res - Express response object
 */
export async function generatePresentationStream(params, res) {
  const { slug, model, apiKey, projectName, brief, slideCount, theme, extraInstructions, useImageGeneration = false, geminiApiKey = null } = params

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  try {
    const provider = createProvider(model, apiKey)

    // Generar tema personalizado si se solicitó
    let customThemeCss = null
    if (theme === 'ai-generated') {
      send('status', { message: 'Generando tema visual personalizado con IA...', phase: 'theme' })
      customThemeCss = await generateCustomTheme({ provider, projectName, brief })
      send('theme', { css: customThemeCss })
    }

    send('status', { message: 'Planificando estructura de la presentación...', phase: 'planning' })

    const plan = await planPresentation({ provider, projectName, brief, slideCount, extraInstructions })

    send('plan', { slides: plan, total: plan.length })

    const slides = []
    const errors = []

    for (let i = 0; i < plan.length; i++) {
      send('progress', { slideIndex: i + 1, total: plan.length, status: 'generating', content: plan[i] })

      try {
        let html = await provider.generateSlide({
          slideNumber: i + 1,
          totalSlides: plan.length,
          content: plan[i],
          theme,
          customThemeCss,
          projectName
        })

        // Enriquecer con imagen generada si se solicitó y hay Gemini key
        if (useImageGeneration && geminiApiKey) {
          const imagePrompt = `${projectName}: ${plan[i].slice(0, 100)}`
          const image = await generateSlideImage(geminiApiKey, imagePrompt)
          if (image) html = injectBackgroundImage(html, image)
        }

        const filename = addSlide(slug, i + 1, html)
        slides.push(filename)

        send('slide', { slideIndex: i + 1, filename, total: plan.length })
      } catch (err) {
        errors.push(`Slide ${i + 1}: ${err.message}`)
        send('error', { slideIndex: i + 1, message: err.message })
      }
    }

    updateMeta(slug, { model, theme, customThemeCss, generatedAt: new Date().toISOString() })
    send('complete', { slides, errors, slug })

  } catch (err) {
    send('fatal', { message: err.message })
  } finally {
    res.end()
  }
}

/**
 * Pide al LLM que planifique el contenido de cada slide
 * Retorna un array de strings, uno por slide
 */
export async function planPresentation({ provider, projectName, brief, slideCount, extraInstructions }) {
  const messages = [
    {
      role: 'system',
      content: `Eres un experto en comunicación y diseño de presentaciones. 
Tu tarea es planificar el contenido de una presentación de ${slideCount} diapositivas.
Debes retornar ÚNICAMENTE un array JSON con ${slideCount} elementos.
Cada elemento es un string describiendo el contenido de ese slide.
Sin explicaciones adicionales. Solo el JSON.

Ejemplo de formato esperado:
["Slide de portada: Título 'X', subtítulo 'Y', autor 'Z'", "Slide 2: Introducción al tema. Puntos: A, B, C", ...]`
    },
    {
      role: 'user',
      content: `Proyecto: "${projectName}"
Descripción: ${brief}
Cantidad de slides: ${slideCount}
${extraInstructions ? `Instrucciones adicionales: ${extraInstructions}` : ''}

Planifica el contenido de cada slide. Recuerda: solo el JSON array.`
    }
  ]

  const response = await provider.chat(messages, { temperature: 0.5 })

  // Parsear el JSON
  try {
    const match = response.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('No se encontró array JSON en la respuesta')
    const plan = JSON.parse(match[0])
    if (!Array.isArray(plan)) throw new Error('La respuesta no es un array')
    return plan
  } catch (err) {
    console.error('[SlideGenerator] Error parseando plan:', response)
    throw new Error(`Error al planificar presentación: ${err.message}`)
  }
}
