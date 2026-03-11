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
export const sendChat = (messages, model, apiKey) => fetch(`${BASE}/ai/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages, model, apiKey })
}).then(r => r.json())
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
