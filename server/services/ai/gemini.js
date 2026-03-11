import { GoogleGenerativeAI } from '@google/generative-ai'
import { AIProvider } from './provider.js'
import { buildSlideMessages, extractHTML } from './slidePrompts.js'

export class GeminiProvider extends AIProvider {
  constructor(apiKey) {
    super(apiKey)
    this.genAI = new GoogleGenerativeAI(apiKey)
    this.modelName = 'gemini-1.5-pro'
  }

  async chat(messages, options = {}) {
    const model = this.genAI.getGenerativeModel({ model: this.modelName })

    // Gemini usa un formato diferente: parts en lugar de content
    const systemMsg = messages.find(m => m.role === 'system')
    const history = messages
      .filter(m => m.role !== 'system')
      .slice(0, -1) // todos menos el último
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))

    const lastMessage = messages.filter(m => m.role !== 'system').at(-1)

    const chat = model.startChat({
      history,
      systemInstruction: systemMsg?.content,
      generationConfig: {
        maxOutputTokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.7,
      },
    })

    const result = await chat.sendMessage(lastMessage.content)
    return result.response.text()
  }

  async generateSlide(context) {
    const messages = buildSlideMessages(context)
    const html = await this.chat(messages, { temperature: 0.4, maxTokens: 8192 })
    return extractHTML(html)
  }

  async validateKey() {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.modelName })
      await model.generateContent('Hi')
      return true
    } catch {
      return false
    }
  }
}
