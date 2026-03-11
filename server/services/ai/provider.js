import { OpenAIProvider } from './openai.js'
import { AnthropicProvider } from './anthropic.js'
import { GeminiProvider } from './gemini.js'

export class AIProvider {
  constructor(apiKey) {
    if (!apiKey) throw new Error('API key requerida')
    this.apiKey = apiKey
  }

  /**
   * Envía mensajes al LLM y retorna respuesta completa como string
   * @param {Array<{role: 'system'|'user'|'assistant', content: string}>} messages
   * @param {object} options
   * @returns {Promise<string>}
   */
  async chat(messages, options = {}) {
    throw new Error('Not implemented')
  }

  /**
   * Genera el HTML completo de un slide
   * @param {object} context - { slideNumber, totalSlides, content, theme, projectName }
   * @returns {Promise<string>} HTML string
   */
  async generateSlide(context) {
    throw new Error('Not implemented')
  }

  /**
   * Verifica que la API key sea válida haciendo una llamada mínima
   * @returns {Promise<boolean>}
   */
  async validateKey() {
    throw new Error('Not implemented')
  }
}

/**
 * Factory — retorna el provider correcto según el modelo
 * @param {'openai'|'claude'|'gemini'} model
 * @param {string} apiKey
 * @returns {AIProvider}
 */
export function createProvider(model, apiKey) {
  const map = { openai: OpenAIProvider, claude: AnthropicProvider, gemini: GeminiProvider }
  const Provider = map[model]
  if (!Provider) throw new Error(`Modelo no soportado: ${model}`)
  return new Provider(apiKey)
}
