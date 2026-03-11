import Anthropic from '@anthropic-ai/sdk'
import { AIProvider } from './provider.js'
import { buildSlideMessages, extractHTML } from './slidePrompts.js'

export class AnthropicProvider extends AIProvider {
  constructor(apiKey) {
    super(apiKey)
    this.client = new Anthropic({ apiKey })
    this.model = 'claude-sonnet-4-5'
  }

  async chat(messages, options = {}) {
    // Anthropic separa el system message del resto
    const system = messages.find(m => m.role === 'system')?.content
    const userMessages = messages.filter(m => m.role !== 'system')

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: options.maxTokens || 4096,
      ...(system && { system }),
      messages: userMessages,
    })
    return response.content[0].text
  }

  async generateSlide(context) {
    const messages = buildSlideMessages(context)
    const html = await this.chat(messages, { temperature: 0.4, maxTokens: 8192 })
    return extractHTML(html)
  }

  async validateKey() {
    try {
      await this.client.messages.create({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }]
      })
      return true
    } catch {
      return false
    }
  }
}
