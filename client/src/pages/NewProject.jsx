import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettingsStore } from '../store/useSettingsStore'
import { generatePresentationStream, sendChat } from '../services/api'
import ChatMessage from '../components/ChatMessage'
import ModelSelector from '../components/ModelSelector'

// ─── GenerationProgress ───────────────────────────────────────────────────────
function GenerationProgress({ plan, slidesStatus, statusMessage }) {
  const total = plan.length
  const done = Object.values(slidesStatus).filter(s => s === 'done' || s === 'error').length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div style={{ background: '#0f0f0f', border: '1px solid #222', borderRadius: 12, padding: '20px 24px', minWidth: 320 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: total > 0 ? 12 : 0 }}>
        <div style={{ width: 12, height: 12, border: '2px solid #222', borderTop: '2px solid #4CAF50', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
        <span style={{ color: '#aaa', fontSize: 13, flex: 1 }}>{statusMessage || 'Iniciando...'}</span>
        {total > 0 && <span style={{ color: '#4CAF50', fontSize: 13, fontWeight: 700 }}>{pct}%</span>}
      </div>
      {total > 0 && (
        <>
          <div style={{ background: '#1a1a1a', borderRadius: 4, height: 6, marginBottom: 14 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(to right,#1B5E20,#4CAF50)', borderRadius: 4, transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {plan.map((content, i) => {
              const status = slidesStatus[i + 1] || 'pending'
              const icon = { pending: '⏳', generating: '🔄', done: '✅', error: '❌' }[status]
              return (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 13 }}>{icon}</span>
                  <span style={{ color: status === 'done' ? '#4CAF50' : status === 'error' ? '#f44336' : '#555', fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Slide {i + 1}: {content?.slice(0, 55)}{content?.length > 55 ? '...' : ''}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── SlideCanvas ─────────────────────────────────────────────────────────────
function SlideCanvas({ previewUrl, statusMessage, isGenerating }) {
  const [view, setView] = useState('preview') // 'preview' | 'code'
  const [codeContent, setCodeContent] = useState('')
  const [copied, setCopied] = useState(false)
  const iframeRef = useRef(null)
  const containerRef = useRef(null)
  const [scale, setScale] = useState(1)

  // Calcular escala al cambiar tamaño del contenedor
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(() => {
      if (containerRef.current) {
        const w = containerRef.current.getBoundingClientRect().width
        if (w > 0) setScale(w / 1280)
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Cargar código fuente cuando se cambia a vista de código
  useEffect(() => {
    if (view === 'code' && previewUrl) {
      fetch(previewUrl)
        .then(r => r.text())
        .then(setCodeContent)
        .catch(() => setCodeContent('Error al cargar el código'))
    }
  }, [view, previewUrl])

  const handleCopy = () => {
    navigator.clipboard.writeText(codeContent).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#050505', overflow: 'hidden' }}>
      {/* Header del canvas */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid #111', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <span style={{ color: '#333', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>
          {previewUrl ? 'Vista previa en vivo' : 'Canvas'}
        </span>
        {previewUrl && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setView('preview')} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: view === 'preview' ? '#1B5E20' : '#111', color: view === 'preview' ? '#4CAF50' : '#555', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              Vista previa
            </button>
            <button onClick={() => setView('code')} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: view === 'code' ? '#1a1a1a' : '#111', color: view === 'code' ? '#aaa' : '#555', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              &lt;/&gt; Código
            </button>
          </div>
        )}
        {view === 'code' && codeContent && (
          <button onClick={handleCopy} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #222', background: 'none', color: copied ? '#4CAF50' : '#555', cursor: 'pointer', fontSize: 12 }}>
            {copied ? '✓ Copiado' : 'Copiar'}
          </button>
        )}
      </div>

      {/* Contenido del canvas */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'hidden' }}>
        {!previewUrl ? (
          <div style={{ textAlign: 'center', color: '#1a1a1a' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎨</div>
            <p style={{ fontSize: 13, color: '#2a2a2a' }}>
              {isGenerating ? 'Los slides aparecerán aquí mientras se generan' : 'El canvas mostrará los slides generados'}
            </p>
          </div>
        ) : view === 'preview' ? (
          <div ref={containerRef} style={{ width: '100%', maxWidth: 900 }}>
            <div style={{
              position: 'relative',
              height: `${720 * scale}px`,
              background: '#111',
              borderRadius: 8,
              overflow: 'hidden',
              border: '1px solid #1a1a1a',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}>
              <iframe
                ref={iframeRef}
                key={previewUrl}
                src={previewUrl}
                sandbox="allow-scripts allow-same-origin"
                style={{
                  position: 'absolute', top: 0, left: 0,
                  width: '1280px', height: '720px',
                  border: 'none', display: 'block',
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  pointerEvents: 'none',
                }}
              />
            </div>
            <p style={{ color: '#222', fontSize: 11, textAlign: 'center', marginTop: 8 }}>Último slide generado</p>
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: 900, height: '100%', maxHeight: 600, overflow: 'auto', background: '#0a0a0a', borderRadius: 8, border: '1px solid #1a1a1a' }}>
            <pre style={{ margin: 0, padding: 20, color: '#6a9955', fontSize: 12, lineHeight: 1.6, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {codeContent || 'Cargando...'}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toSlug = (name) => name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

const SYSTEM_PROMPT = `Eres un asistente experto en la creación de presentaciones llamado OpenSlide. Tu trabajo es conversar de manera natural con el usuario para entender exactamente qué quiere presentar.

Haz preguntas relevantes sobre:
- El tema y objetivo de la presentación
- La audiencia target
- El contenido específico (el usuario puede darte texto, datos, estructura que ya tiene)
- El estilo visual preferido (minimal, dark-tech, corporativo, creativo, o deja que la IA elija)
- La cantidad de diapositivas
- Cualquier detalle o instrucción particular

El usuario puede darte contenido directamente (texto, datos, estructura) y TÚ lo usarás para crear los slides al detalle. No supongas: pregunta lo que necesites saber.

Cuando tengas SUFICIENTE información para crear una presentación completa, O cuando el usuario diga que está listo para generar, responde con un resumen amigable Y LUEGO el siguiente bloque JSON exactamente así (al final de tu mensaje):

<GENERATE>
{
  "projectName": "nombre-del-proyecto-en-minusculas-con-guiones",
  "brief": "descripción completa y detallada incluyendo TODO lo que el usuario especificó",
  "slideCount": 8,
  "theme": "dark-tech",
  "extraInstructions": "instrucciones adicionales específicas del usuario"
}
</GENERATE>

Los temas válidos son: minimal, dark-tech, corporate, creative, ai-generated

Habla en español, sé amigable y profesional.`

// ─── Main Component ───────────────────────────────────────────────────────────
export default function NewProject() {
  const navigate = useNavigate()
  const { model, setModel, setKey, keys } = useSettingsStore()

  // Fases: 'model' → 'key' → 'chat' → 'generating' → 'done'
  const [phase, setPhase] = useState('model')
  const [selectedModel, setSelectedModel] = useState(null)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '¡Hola! Soy OpenSlide. Para comenzar, ¿qué modelo de IA quieres usar?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [keyDraft, setKeyDraft] = useState('')

  // Chat history para el LLM (incluye system prompt)
  const chatHistoryRef = useRef([{ role: 'system', content: SYSTEM_PROMPT }])

  // Estado de generación
  const [genPlan, setGenPlan] = useState([])
  const [slidesStatus, setSlidesStatus] = useState({})
  const [genStatus, setGenStatus] = useState('')
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState(null)
  const [currentSlug, setCurrentSlug] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const abortRef = useRef(null)

  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { return () => { if (abortRef.current) abortRef.current() } }, [])

  const addMsg = (role, content, extra = null) => {
    setMessages(prev => [...prev, { role, content, extra }])
  }

  // ── Selección de modelo ────────────────────────────────────────────────────
  const handleModelSelect = (m) => {
    setSelectedModel(m)
    setModel(m)
    addMsg('user', m === 'openai' ? 'OpenAI GPT-4o' : m === 'claude' ? 'Claude Sonnet' : 'Gemini Flash')

    const keyMap = { openai: keys.openai, claude: keys.anthropic, gemini: keys.gemini }
    if (keyMap[m]) {
      addMsg('assistant', `Perfecto. Tengo la key de ${m === 'openai' ? 'OpenAI' : m === 'claude' ? 'Claude' : 'Gemini'} guardada. ¡Cuéntame sobre tu presentación! ¿De qué trata?`)
      setPhase('chat')
    } else {
      addMsg('assistant', `Para usar ${m === 'openai' ? 'OpenAI' : m === 'claude' ? 'Anthropic Claude' : 'Google Gemini'} necesito tu API key:`)
      setPhase('key')
    }
  }

  // ── Guardar key ────────────────────────────────────────────────────────────
  const handleKeySave = async () => {
    if (!keyDraft.trim()) return
    const providerMap = { openai: 'openai', claude: 'anthropic', gemini: 'gemini' }
    setKey(providerMap[selectedModel], keyDraft.trim())
    addMsg('user', '****' + keyDraft.trim().slice(-4))
    setKeyDraft('')
    addMsg('assistant', `Key guardada. ¡Cuéntame sobre tu presentación! ¿De qué trata?`)
    setPhase('chat')
  }

  // ── Enviar mensaje al LLM ─────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return
    const userText = input.trim()
    setInput('')
    addMsg('user', userText)

    // Agregar a historial — mantener system prompt + últimos 20 mensajes para no sobrepasar límites
    const newHistory = [...chatHistoryRef.current, { role: 'user', content: userText }]
    const systemMsg = newHistory.find(m => m.role === 'system')
    const rest = newHistory.filter(m => m.role !== 'system').slice(-20)
    chatHistoryRef.current = systemMsg ? [systemMsg, ...rest] : rest
    setLoading(true)

    try {
      const keyMap = { openai: keys.openai, claude: keys.anthropic, gemini: keys.gemini }
      const apiKey = keyMap[selectedModel]

      const response = await sendChat(chatHistoryRef.current, selectedModel, apiKey)
      const assistantText = response.message || response.error || 'Sin respuesta'

      // Agregar respuesta al historial
      chatHistoryRef.current = [...chatHistoryRef.current, { role: 'assistant', content: assistantText }]

      // Detectar si el LLM quiere generar
      const generateMatch = assistantText.match(/<GENERATE>([\s\S]*?)<\/GENERATE>/i)
      if (generateMatch) {
        try {
          const genData = JSON.parse(generateMatch[1].trim())
          // Mostrar texto sin el bloque JSON
          const displayText = assistantText.replace(/<GENERATE>[\s\S]*?<\/GENERATE>/i, '').trim()
          if (displayText) addMsg('assistant', displayText)
          
          // Mostrar botón de confirmación
          addMsg('assistant', `¿Empezamos a generar?`, (
            <button
              onClick={() => startGeneration(genData)}
              style={{ marginTop: 10, padding: '10px 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#1B5E20,#4CAF50)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
            >
              🚀 Generar presentación
            </button>
          ))
        } catch {
          addMsg('assistant', assistantText.replace(/<GENERATE>[\s\S]*?<\/GENERATE>/i, '').trim())
        }
      } else {
        addMsg('assistant', assistantText)
      }
    } catch (err) {
      addMsg('assistant', `❌ Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [input, loading, selectedModel, keys])

  // ── Iniciar generación ─────────────────────────────────────────────────────
  const startGeneration = (genData) => {
    const slug = toSlug(genData.projectName || 'presentacion')
    setCurrentSlug(slug)
    setIsGenerating(true)
    setGenPlan([])
    setSlidesStatus({})
    setGenStatus('Iniciando...')
    setCurrentPreviewUrl(null)
    setPhase('generating')

    const keyMap = { openai: keys.openai, claude: keys.anthropic, gemini: keys.gemini }
    const apiKey = keyMap[selectedModel]

    // Agregar mensaje de inicio con progress
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '🚀 Iniciando generación...',
      _isProgress: true
    }])

    abortRef.current = generatePresentationStream({
      slug,
      model: selectedModel,
      projectName: genData.projectName,
      brief: genData.brief,
      slideCount: Math.min(parseInt(genData.slideCount) || 5, 20),
      theme: genData.theme || 'dark-tech',
      extraInstructions: genData.extraInstructions || '',
      apiKey,
      geminiApiKey: keys.gemini || null,
    }, {
      onStatus: (p) => setGenStatus(p.message),
      onPlan: (p) => {
        setGenPlan(p.slides)
        const init = {}
        p.slides.forEach((_, i) => { init[i + 1] = 'pending' })
        setSlidesStatus(init)
        setGenStatus('Plan listo, generando slides...')
      },
      onProgress: (p) => {
        setSlidesStatus(prev => ({ ...prev, [p.slideIndex]: 'generating' }))
        setGenStatus(`Generando slide ${p.slideIndex} de ${p.total}...`)
      },
      onSlide: (p) => {
        setSlidesStatus(prev => ({ ...prev, [p.slideIndex]: 'done' }))
        // Esperar 300ms para que el archivo esté listo en disco
        setTimeout(() => {
          setCurrentPreviewUrl(`/slides/${slug}/${p.filename}?t=${Date.now()}`)
        }, 300)
      },
      onComplete: (p) => {
        setIsGenerating(false)
        setMessages(prev => {
          const filtered = prev.filter(m => !m._isProgress)
          return [...filtered, { role: 'assistant', content: `✅ ¡Listo! Se generaron ${p.slides?.length || 0} slides. Redirigiendo al visor...` }]
        })
        setTimeout(() => navigate(`/viewer/${slug}`), 1500)
      },
      onFatal: (p) => {
        setIsGenerating(false)
        setPhase('chat')
        const msg = p.message?.includes('already exists')
          ? `❌ Ya existe un proyecto con ese nombre. Dime un nombre diferente.`
          : `❌ Error: ${p.message}`
        setMessages(prev => {
          const filtered = prev.filter(m => !m._isProgress)
          return [...filtered, { role: 'assistant', content: msg }]
        })
      }
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const showInput = phase === 'chat' && !isGenerating
  const showKeyInput = phase === 'key'
  const showModelSelector = phase === 'model'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#080808', fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid #1a1a1a', flexShrink: 0 }}>
        <button onClick={() => navigate('/')} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #222', background: '#111', color: '#888', cursor: 'pointer', fontSize: 13 }}>
          ← Volver
        </button>
        <h2 style={{ color: '#f0f0f0', fontSize: 16, fontWeight: 600, margin: 0 }}>Nueva Presentación</h2>
        {selectedModel && (
          <span style={{ marginLeft: 4, fontSize: 12, color: '#333', background: '#111', padding: '3px 10px', borderRadius: 20, border: '1px solid #1e1e1e' }}>
            {selectedModel === 'openai' ? '🤖 GPT-4o' : selectedModel === 'claude' ? '🧠 Claude' : '✨ Gemini'}
          </span>
        )}
        {isGenerating && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4CAF50', animation: 'pulse 1.5s infinite' }} />
            <span style={{ color: '#4CAF50', fontSize: 12, fontWeight: 600 }}>Generando con IA...</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Panel chat */}
        <div style={{
          width: isGenerating ? '38%' : '100%',
          display: 'flex', flexDirection: 'column',
          borderRight: isGenerating ? '1px solid #1a1a1a' : 'none',
          transition: 'width 0.35s ease',
          minWidth: isGenerating ? 300 : 'auto',
        }}>
          {/* Mensajes */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            <div style={{ maxWidth: isGenerating ? '100%' : 700, margin: '0 auto' }}>
              {messages.map((msg, i) => {
                if (msg._isProgress) {
                  return (
                    <div key={i} style={{ marginLeft: isGenerating ? 0 : 42, marginBottom: 16 }}>
                      <GenerationProgress plan={genPlan} slidesStatus={slidesStatus} statusMessage={genStatus} />
                    </div>
                  )
                }
                return <ChatMessage key={i} message={msg} />
              })}

              {showModelSelector && (
                <div style={{ marginLeft: isGenerating ? 0 : 42, marginTop: 4 }}>
                  <ModelSelector onSelect={handleModelSelect} selected={selectedModel} />
                </div>
              )}

              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 42, color: '#333', fontSize: 13 }}>
                  <div style={{ width: 14, height: 14, border: '2px solid #222', borderTop: '2px solid #4CAF50', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Pensando...
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input */}
          {(showInput || showKeyInput) && (
            <div style={{ padding: '14px 20px', borderTop: '1px solid #1a1a1a', background: '#0a0a0a', flexShrink: 0 }}>
              <div style={{ maxWidth: isGenerating ? '100%' : 700, margin: '0 auto', display: 'flex', gap: 10 }}>
                <input
                  autoFocus
                  type={showKeyInput ? 'password' : 'text'}
                  placeholder={showKeyInput ? 'Pega tu API key...' : 'Escribe tu mensaje...'}
                  value={showKeyInput ? keyDraft : input}
                  onChange={e => showKeyInput ? setKeyDraft(e.target.value) : setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); showKeyInput ? handleKeySave() : handleSend() } }}
                  style={{ flex: 1, padding: '12px 16px', borderRadius: 10, border: '1px solid #2a2a2a', background: '#111', color: '#ddd', fontSize: 14, outline: 'none' }}
                />
                <button
                  onClick={showKeyInput ? handleKeySave : handleSend}
                  disabled={loading}
                  style={{ padding: '12px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#1B5E20,#4CAF50)', color: '#fff', cursor: loading ? 'default' : 'pointer', fontSize: 14, fontWeight: 700, opacity: loading ? 0.5 : 1 }}
                >
                  →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Canvas panel */}
        {isGenerating && (
          <SlideCanvas
            previewUrl={currentPreviewUrl}
            statusMessage={genStatus}
            isGenerating={isGenerating}
          />
        )}
      </div>
    </div>
  )
}
