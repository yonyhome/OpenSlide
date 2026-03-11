import { createProvider } from './ai/provider.js'
import { addSlide, updateMeta, getProject } from './projectManager.js'

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
 * @returns {Promise<{slides: string[], errors: string[]}>}
 */
export async function generatePresentation(params) {
  const { slug, model, apiKey, projectName, brief, slideCount, theme, extraInstructions } = params
  const provider = createProvider(model, apiKey)

  // Primero pedimos al LLM que planifique el contenido de cada slide
  const plan = await planPresentation({ provider, projectName, brief, slideCount, extraInstructions })

  const slides = []
  const errors = []

  for (let i = 0; i < plan.length; i++) {
    try {
      const html = await provider.generateSlide({
        slideNumber: i + 1,
        totalSlides: plan.length,
        content: plan[i],
        theme,
        projectName
      })

      const filename = addSlide(slug, i + 1, html)
      slides.push(filename)
      console.log(`[SlideGenerator] Slide ${i + 1}/${plan.length} generado: ${filename}`)
    } catch (err) {
      console.error(`[SlideGenerator] Error en slide ${i + 1}:`, err.message)
      errors.push(`Slide ${i + 1}: ${err.message}`)
    }
  }

  // Actualizar meta con modelo usado
  updateMeta(slug, { model, theme, generatedAt: new Date().toISOString() })

  return { slides, errors }
}

/**
 * Pide al LLM que planifique el contenido de cada slide
 * Retorna un array de strings, uno por slide
 */
async function planPresentation({ provider, projectName, brief, slideCount, extraInstructions }) {
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
