import OpenAI from 'openai'
import { AIProvider } from './provider.js'
import { buildSlideMessages, extractHTML } from './slidePrompts.js'

export class OpenAIProvider extends AIProvider {
  constructor(apiKey) {
    super(apiKey)
    this.client = new OpenAI({ apiKey })
    this.model = 'gpt-4o'
  }

  async chat(messages, options = {}) {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
    })
    return response.choices[0].message.content
  }

  async generateSlide(context) {
    const messages = buildSlideMessages(context)
    const html = await this.chat(messages, { temperature: 0.4, maxTokens: 8192 })
    return extractHTML(html)
  }

  async validateKey() {
    try {
      await this.client.models.list()
      return true
    } catch {
      return false
    }
  }
}
