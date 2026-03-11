const BASE = '/api'

export const getProjects = () => fetch(`${BASE}/projects`).then(r => r.json())
export const getProject = (slug) => fetch(`${BASE}/projects/${slug}`).then(r => r.json())
export const createProject = (data) => fetch(`${BASE}/projects`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
}).then(r => r.json())
export const deleteProject = (slug) => fetch(`${BASE}/projects/${slug}`, {
  method: 'DELETE'
}).then(r => r.json())
export const getSettings = () => fetch(`${BASE}/settings`).then(r => r.json())
export const saveSettings = (data) => fetch(`${BASE}/settings`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
}).then(r => r.json())
export const sendChat = async (messages, model, apiKey, slug = null) => {
  const res = await fetch(`${BASE}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model, apiKey, slug })
  })
  if (!res.ok) {
    const text = await res.text()
    let errMsg
    try { errMsg = JSON.parse(text).error } catch { errMsg = text || `HTTP ${res.status}` }
    throw new Error(errMsg)
  }
  return res.json()
}
export const generateSlide = (context) => fetch(`${BASE}/ai/generate-slide`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(context)
}).then(r => r.json())

export const validateKey = (model, apiKey) =>
  fetch(`${BASE}/ai/validate-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, apiKey })
  }).then(r => r.json())

export const generatePresentation = (data) =>
  fetch(`${BASE}/ai/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json())

export const regenerateSlide = (data) =>
  fetch(`${BASE}/ai/regenerate-slide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json())

export function generatePresentationStream(data, callbacks) {
  const { onStatus, onPlan, onProgress, onSlide, onComplete, onFatal } = callbacks
  const controller = new AbortController()

  fetch(`${BASE}/ai/generate-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    signal: controller.signal
  }).then(res => {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    const processChunk = ({ done, value }) => {
      if (done) return
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()

      let currentEvent = null
      for (const line of lines) {
        if (line.startsWith('event: ')) currentEvent = line.slice(7).trim()
        if (line.startsWith('data: ') && currentEvent) {
          try {
            const payload = JSON.parse(line.slice(6))
            if (currentEvent === 'status' && onStatus) onStatus(payload)
            if (currentEvent === 'plan' && onPlan) onPlan(payload)
            if (currentEvent === 'progress' && onProgress) onProgress(payload)
            if (currentEvent === 'slide' && onSlide) onSlide(payload)
            if (currentEvent === 'complete' && onComplete) onComplete(payload)
            if (currentEvent === 'fatal' && onFatal) onFatal(payload)
          } catch {}
          currentEvent = null
        }
      }
      return reader.read().then(processChunk)
    }

    reader.read().then(processChunk)
  }).catch(err => {
    if (err.name === 'AbortError') return // Ignorar abortos intencionales
    if (onFatal) onFatal({ message: err.message })
  })

  return () => controller.abort()
}

export const exportProject = (slug) => {
  const a = document.createElement('a')
  a.href = `${BASE}/projects/${slug}/export`
  a.download = `${slug}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export const exportProjectPDF = (slug) => {
  const a = document.createElement('a')
  a.href = `${BASE}/projects/${slug}/export/pdf`
  a.download = `${slug}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export const exportProjectPPTX = (slug) => {
  const a = document.createElement('a')
  a.href = `${BASE}/projects/${slug}/export/pptx`
  a.download = `${slug}.pptx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
