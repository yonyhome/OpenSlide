import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettingsStore } from '../store/useSettingsStore'
import { generatePresentationStream } from '../services/api'
import ChatMessage from '../components/ChatMessage'
import ModelSelector from '../components/ModelSelector'

const STYLES = ['Minimal', 'Dark Tech', 'Corporativo', 'Creativo', '🤖 IA elige el estilo']

function GenerationProgress({ plan, slidesStatus, statusMessage }) {
  const total = plan.length
  const done = Object.values(slidesStatus).filter(s => s === 'done' || s === 'error').length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div style={{ background: '#0f0f0f', border: '1px solid #222', borderRadius: 12, padding: '20px 24px', minWidth: 360 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: total > 0 ? 10 : 0 }}>
        <div style={{ width: 14, height: 14, border: '2px solid #222', borderTop: '2px solid #4CAF50', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
        <span style={{ color: '#aaa', fontSize: 13, flex: 1 }}>{statusMessage || 'Iniciando...'}</span>
        {total > 0 && <span style={{ color: '#4CAF50', fontSize: 13, fontWeight: 700 }}>{pct}%</span>}
      </div>

      {total > 0 && (
        <>
          <div style={{ background: '#1a1a1a', borderRadius: 4, height: 6, marginBottom: 16 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(to right, #1B5E20, #4CAF50)', borderRadius: 4, transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {plan.map((content, i) => {
              const status = slidesStatus[i + 1] || 'pending'
              const icon = { pending: '⏳', generating: '🔄', done: '✅', error: '❌' }[status]
              return (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 14 }}>{icon}</span>
                  <span style={{ color: status === 'done' ? '#4CAF50' : status === 'error' ? '#f44336' : '#555', fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Slide {i + 1}: {content?.slice(0, 60)}{content?.length > 60 ? '...' : ''}
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

export default function NewProject() {
  const navigate = useNavigate()
  const { model, setModel, hasKey, setKey, keys } = useSettingsStore()

  const [step, setStep] = useState(0)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '¡Hola! Soy OpenSlide. Vamos a crear tu presentación con IA. Primero, elige el modelo que quieres usar:' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [data, setData] = useState({ model: null, name: '', topic: '', slides: '', style: '' })
  const bottomRef = useRef(null)
  const abortRef = useRef(null)

  // SSE state
  const [generationPlan, setGenerationPlan] = useState([])
  const [slidesStatus, setSlidesStatus] = useState({})
  const [genStatusMessage, setGenStatusMessage] = useState('')

  // Canvas split view state
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState(null)
  const [generationSlug, setGenerationSlug] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current()
    }
  }, [])

  const addMessage = (role, content, extra) => {
    setMessages((m) => [...m, { role, content, extra }])
  }

  const handleModelSelect = (m) => {
    setModel(m)
    setData((d) => ({ ...d, model: m }))
    addMessage('user', `Usar ${m}`)

    // Verificar si ya tiene key configurada
    const keyMap = { openai: keys.openai, claude: keys.anthropic, gemini: keys.gemini }
    if (keyMap[m]) {
      // Ya tiene key, saltar directamente al nombre del proyecto
      addMessage('assistant', `Perfecto, usaré ${m === 'openai' ? 'OpenAI GPT-4o' : m === 'claude' ? 'Claude Sonnet' : 'Gemini Pro'}. ¿Cómo se llama tu proyecto?`)
      setStep(2)
    } else {
      addMessage('assistant', `Para usar ${m === 'openai' ? 'OpenAI' : m === 'claude' ? 'Claude' : 'Gemini'} necesito tu API key. Ingrésala a continuación:`)
      setStep(1)
    }
  }

  const handleKeySubmit = () => {
    if (!input.trim()) return
    setKey(data.model === 'claude' ? 'anthropic' : data.model, input.trim())
    addMessage('user', '****' + input.trim().slice(-4))
    addMessage('assistant', '¿Cómo se llama tu proyecto?')
    setInput('')
    setStep(2)
  }

  const handleSend = () => {
    if (!input.trim()) return
    const val = input.trim()
    setInput('')

    if (step === 2) {
      addMessage('user', val)
      setData((d) => ({ ...d, name: val }))
      addMessage('assistant', '¿De qué trata tu presentación? Cuéntame el tema principal.')
      setStep(3)
    } else if (step === 3) {
      addMessage('user', val)
      setData((d) => ({ ...d, topic: val }))
      addMessage('assistant', '¿Cuántas diapositivas necesitas aproximadamente?')
      setStep(4)
    } else if (step === 4) {
      addMessage('user', val)
      setData((d) => ({ ...d, slides: val }))
      addMessage('assistant', '¿Qué estilo visual prefieres?', (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {STYLES.map((s) => (
            <button
              key={s}
              onClick={() => handleStyleSelect(s)}
              style={{
                padding: '8px 16px', borderRadius: 8,
                border: '1px solid #2a2a2a', background: '#111',
                color: '#ccc', cursor: 'pointer', fontSize: 13,
              }}
            >
              {s}
            </button>
          ))}
        </div>
      ))
      setStep(5)
    }
  }

  const handleStyleSelect = (style) => {
    const withStyle = { ...data, style }
    setData(withStyle)
    addMessage('user', style)

    // Verificar si tiene Gemini key para ofrecer generación de imágenes
    if (keys.gemini) {
      addMessage('assistant', '¿Quieres enriquecer tus slides con imágenes generadas por Gemini AI?', (
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button
            onClick={() => handleImageChoice(true, withStyle)}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #4CAF5060', background: '#1B5E2022', color: '#4CAF50', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >✨ Sí, usar Gemini Imagen</button>
          <button
            onClick={() => handleImageChoice(false, withStyle)}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #2a2a2a', background: '#111', color: '#888', cursor: 'pointer', fontSize: 13 }}
          >No, solo texto</button>
        </div>
      ))
      setStep(5.5)
    } else {
      showSummary(withStyle, false)
      setStep(6)
    }
  }

  const handleImageChoice = (useImages, finalData) => {
    const withImages = { ...finalData, useImages }
    setData(withImages)
    addMessage('user', useImages ? '✨ Usar imágenes IA' : 'Solo texto')
    showSummary(withImages, useImages)
    setStep(6)
  }

  const showSummary = (finalData, useImages) => {
    addMessage('assistant',
      `¡Perfecto! Aquí está el resumen de tu presentación:\n\n` +
      `📁 Nombre: ${finalData.name}\n` +
      `📝 Tema: ${finalData.topic}\n` +
      `🎞️ Slides: ${finalData.slides}\n` +
      `🎨 Estilo: ${finalData.style}\n` +
      `🤖 Modelo: ${finalData.model}` +
      (useImages ? '\n✨ Con imágenes generadas por Gemini' : ''),
      <button
        onClick={() => handleGenerate({ ...finalData, useImages })}
        style={{
          marginTop: 12, padding: '10px 20px', borderRadius: 10, border: 'none',
          background: 'linear-gradient(135deg, #1B5E20, #4CAF50)',
          color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700,
        }}
      >
        🚀 Generar presentación
      </button>
    )
  }

  const toSlug = (name) => name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  const styleToTheme = (style) => {
    const map = {
      'Minimal': 'minimal',
      'Dark Tech': 'dark-tech',
      'Corporativo': 'corporate',
      'Creativo': 'creative',
      '🤖 IA elige el estilo': 'ai-generated'
    }
    return map[style] || 'dark-tech'
  }

  const handleGenerate = (finalData) => {
    setGenerating(true)
    setGenerationPlan([])
    setSlidesStatus({})
    setGenStatusMessage('Iniciando...')

    const apiKey = finalData.model === 'openai'
      ? keys.openai
      : finalData.model === 'claude'
        ? keys.anthropic
        : keys.gemini

    const slug = toSlug(finalData.name)

    setGenerationSlug(slug)
    setIsGenerating(true)

    // Add initial message
    addMessage('assistant', '🚀 Comenzando generación...')
    // We'll insert a progress message next
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '',
      extra: null,
      _isProgress: true
    }])

    abortRef.current = generatePresentationStream({
      slug,
      model: finalData.model,
      projectName: finalData.name,
      brief: finalData.topic,
      slideCount: parseInt(finalData.slides) || 5,
      theme: styleToTheme(finalData.style),
      apiKey,
      useImageGeneration: finalData.useImages || false,
      geminiApiKey: keys.gemini || null,
    }, {
      onStatus: (payload) => {
        setGenStatusMessage(payload.message)
      },
      onPlan: (payload) => {
        setGenerationPlan(payload.slides)
        // Mark all as pending
        const initialStatus = {}
        payload.slides.forEach((_, i) => { initialStatus[i + 1] = 'pending' })
        setSlidesStatus(initialStatus)
        setGenStatusMessage('Plan listo, generando slides...')
      },
      onProgress: (payload) => {
        setSlidesStatus(prev => ({ ...prev, [payload.slideIndex]: 'generating' }))
        setGenStatusMessage(`Generando slide ${payload.slideIndex} de ${payload.total}...`)
      },
      onSlide: (payload) => {
        setSlidesStatus(prev => ({ ...prev, [payload.slideIndex]: 'done' }))
        setCurrentPreviewUrl(`/slides/${slug}/${payload.filename}?t=${Date.now()}`)
      },
      onComplete: (payload) => {
        setGenerating(false)
        setIsGenerating(false)
        setMessages(prev => {
          const filtered = prev.filter(m => !m._isProgress)
          return [...filtered, {
            role: 'assistant',
            content: `✅ Presentación generada con ${payload.slides?.length || 0} slides. Redirigiendo...`
          }]
        })
        setTimeout(() => navigate(`/viewer/${slug}`), 1500)
      },
      onFatal: (payload) => {
        setGenerating(false)
        setIsGenerating(false)
        const msg = payload.message?.includes('already exists')
          ? `❌ Ya existe un proyecto con ese nombre. Vuelve al paso anterior y usa un nombre diferente.`
          : `❌ Error: ${payload.message}`
        setMessages(prev => {
          const filtered = prev.filter(m => !m._isProgress)
          return [...filtered, { role: 'assistant', content: msg }]
        })
        // Permitir reintentar desde el paso de nombre
        setStep(2)
      }
    })
  }

  const showInput = step >= 2 && step <= 4
  const showKeyInput = step === 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#080808', fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      {/* Header - siempre visible */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid #1a1a1a', flexShrink: 0 }}>
        <button onClick={() => navigate('/')} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #222', background: '#111', color: '#888', cursor: 'pointer', fontSize: 13 }}>← Volver</button>
        <h2 style={{ color: '#f0f0f0', fontSize: 16, fontWeight: 600, margin: 0 }}>Nueva Presentación</h2>
        {isGenerating && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4CAF50', animation: 'pulse 1.5s infinite' }} />
            <span style={{ color: '#4CAF50', fontSize: 12, fontWeight: 600 }}>Generando con IA...</span>
          </div>
        )}
      </div>

      {/* Body: split cuando generando, chat solo cuando no */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Chat panel */}
        <div style={{
          width: isGenerating ? '40%' : '100%',
          display: 'flex', flexDirection: 'column',
          borderRight: isGenerating ? '1px solid #1a1a1a' : 'none',
          transition: 'width 0.3s ease',
          minWidth: isGenerating ? 320 : 'auto',
        }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
            <div style={{ maxWidth: isGenerating ? '100%' : 720, margin: '0 auto' }}>
              {messages.map((msg, i) => {
                if (msg._isProgress) {
                  return (
                    <div key={i} style={{ marginLeft: isGenerating ? 0 : 42, marginBottom: 16 }}>
                      <GenerationProgress plan={generationPlan} slidesStatus={slidesStatus} statusMessage={genStatusMessage} />
                    </div>
                  )
                }
                return <ChatMessage key={i} message={msg} />
              })}
              {step === 0 && (
                <div style={{ marginLeft: isGenerating ? 0 : 42 }}>
                  <ModelSelector onSelect={handleModelSelect} selected={model} />
                </div>
              )}
              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#555', fontSize: 14 }}>
                  <div style={{ width: 16, height: 16, border: '2px solid #222', borderTop: '2px solid #4CAF50', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Creando proyecto...
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {(showInput || showKeyInput) && (
            <div style={{ padding: '16px 20px', borderTop: '1px solid #1a1a1a', background: '#0a0a0a', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  autoFocus
                  type={showKeyInput ? 'password' : 'text'}
                  placeholder={showKeyInput ? 'Pega tu API key...' : 'Escribe tu respuesta...'}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (showKeyInput ? handleKeySubmit() : handleSend())}
                  style={{ flex: 1, padding: '12px 16px', borderRadius: 10, border: '1px solid #2a2a2a', background: '#111', color: '#ddd', fontSize: 14, outline: 'none' }}
                />
                <button onClick={showKeyInput ? handleKeySubmit : handleSend} style={{ padding: '12px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#1B5E20,#4CAF50)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>→</button>
              </div>
            </div>
          )}
        </div>

        {/* Canvas preview panel - solo durante generación */}
        {isGenerating && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            background: '#050505', overflow: 'hidden',
          }}>
            {/* Header del canvas */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #111', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: '#444', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Vista previa en vivo</span>
              {currentPreviewUrl && (
                <span style={{ color: '#1a1a1a', fontSize: 11, marginLeft: 'auto' }}>
                  Se actualiza con cada slide
                </span>
              )}
            </div>

            {/* Iframe preview */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              {currentPreviewUrl ? (
                <div style={{ position: 'relative', width: '100%', maxWidth: 960 }}>
                  <div style={{
                    position: 'relative',
                    paddingBottom: '56.25%',
                    background: '#111',
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: '1px solid #222',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
                  }}>
                    <iframe
                      key={currentPreviewUrl}
                      src={currentPreviewUrl}
                      sandbox="allow-scripts allow-same-origin"
                      style={{
                        position: 'absolute', top: 0, left: 0,
                        width: '1280px', height: '720px',
                        border: 'none',
                        transformOrigin: 'top left',
                      }}
                      ref={el => {
                        if (el) {
                          const parent = el.parentElement
                          if (parent) {
                            const scale = parent.getBoundingClientRect().width / 1280
                            el.style.transform = `scale(${scale})`
                            parent.style.height = `${720 * scale}px`
                            parent.style.paddingBottom = '0'
                          }
                        }
                      }}
                    />
                  </div>
                  <p style={{ color: '#333', fontSize: 11, textAlign: 'center', marginTop: 10 }}>
                    Último slide generado
                  </p>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#2a2a2a' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🎨</div>
                  <p style={{ fontSize: 14 }}>Los slides aparecerán aquí<br />mientras se generan</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
