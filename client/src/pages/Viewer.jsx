import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getProject, regenerateSlide, exportProject, exportProjectPDF, exportProjectPPTX } from '../services/api'

export default function Viewer() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    getProject(slug)
      .then(setProject)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [slug])

  const refreshProject = async () => {
    try {
      const updated = await getProject(slug)
      setProject(updated)
    } catch {}
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#080808' }}>
      <span style={{ color: '#555' }}>Cargando…</span>
    </div>
  )

  if (error || !project) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#080808' }}>
      <p style={{ color: '#ccc' }}>Proyecto no encontrado</p>
      <button onClick={() => navigate('/')} style={{ marginTop: 16, padding: '8px 16px', borderRadius: 8, border: '1px solid #222', background: '#111', color: '#aaa', cursor: 'pointer' }}>
        ← Volver
      </button>
    </div>
  )

  return <PresentationViewer project={project} onBack={() => navigate('/')} onProjectRefresh={refreshProject} />
}

function PresentationViewer({ project, onBack, onProjectRefresh }) {
  const navigate = useNavigate()
  const [current, setCurrent] = useState(1)
  const [hint, setHint] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fsSize, setFsSize] = useState(null)
  const [scale, setScale] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [regenerating, setRegenerating] = useState(false)

  // Modal de regeneración
  const [regenModal, setRegenModal] = useState(false)
  const [regenInstructions, setRegenInstructions] = useState('')
  const [regenLoading, setRegenLoading] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)

  const wrapperRef  = useRef(null)
  const rootRef     = useRef(null)
  const controlsRef = useRef(null)
  const hideTimerRef = useRef(null)
  const touchStartX = useRef(null)

  const totalSlides = project.slides.length
  const slideSrc = `/slides/${project.slug}/${project.slides[current - 1]}`

  const handleRegen = async () => {
    setRegenLoading(true)
    try {
      const result = await regenerateSlide({ slug: project.slug, slideIndex: current, instructions: regenInstructions })
      if (result.ok) {
        setReloadKey((k) => k + 1)
        if (onProjectRefresh) await onProjectRefresh()
        setRegenModal(false)
        setRegenInstructions('')
      } else {
        alert(`Error al regenerar: ${result.error || 'desconocido'}`)
      }
    } catch (err) {
      alert(`Error al regenerar: ${err.message}`)
    } finally {
      setRegenLoading(false)
    }
  }

  const handleRegenerateSlide = () => {
    setRegenInstructions('')
    setRegenModal(true)
  }
  const progress = ((current - 1) / Math.max(totalSlides - 1, 1)) * 100

  const prev = useCallback(() => setCurrent((n) => Math.max(1, n - 1)), [])
  const next = useCallback(() => setCurrent((n) => Math.min(totalSlides, n + 1)), [totalSlides])

  const enterFullscreen = useCallback(() => rootRef.current?.requestFullscreen?.(), [])
  const exitFullscreen  = useCallback(() => document.exitFullscreen?.(), [])
  const toggleFullscreen = useCallback(
    () => (document.fullscreenElement ? exitFullscreen() : enterFullscreen()),
    [enterFullscreen, exitFullscreen]
  )

  const handleBack = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    onBack()
  }, [onBack])

  const revealControls = useCallback(() => {
    const el = controlsRef.current
    if (!el) return
    el.style.opacity = '1'
    el.style.pointerEvents = 'auto'
    clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      if (!controlsRef.current) return
      controlsRef.current.style.opacity = '0'
      controlsRef.current.style.pointerEvents = 'none'
    }, 3000)
  }, [])

  useEffect(() => {
    if (isFullscreen) {
      const t = setTimeout(revealControls, 80)
      return () => clearTimeout(t)
    }
    clearTimeout(hideTimerRef.current)
  }, [isFullscreen, revealControls])

  useEffect(() => {
    const update = () => {
      if (document.fullscreenElement) {
        const sc = Math.min(window.innerWidth / 1280, window.innerHeight / 720)
        setScale(sc)
        setFsSize({ w: Math.round(1280 * sc), h: Math.round(720 * sc) })
      } else {
        setFsSize(null)
        const el = wrapperRef.current
        if (!el) return
        const w = el.getBoundingClientRect().width
        if (w > 0) setScale(w / 1280)
      }
    }
    const raf = requestAnimationFrame(update)
    window.addEventListener('resize', update)
    document.addEventListener('fullscreenchange', update)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', update)
      document.removeEventListener('fullscreenchange', update)
    }
  }, [])

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next()
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   prev()
      if (e.key === 'f' || e.key === 'F') toggleFullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, toggleFullscreen])

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchEnd   = (e) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 50) (dx > 0 ? prev : next)()
    touchStartX.current = null
  }

  const handleSlideClick = (e) => {
    if (!wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const zone = rect.width * 0.2
    if (x < zone) prev()
    else if (x > rect.width - zone) next()
  }

  const handleMouseMove = (e) => {
    if (isFullscreen) revealControls()
    if (!wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const zone = rect.width * 0.2
    if (x < zone && current > 1)                             setHint('prev')
    else if (x > rect.width - zone && current < totalSlides) setHint('next')
    else                                                      setHint(null)
  }

  const wrapperStyle = fsSize
    ? {
        position: 'relative', overflow: 'hidden', background: '#fff',
        userSelect: 'none', width: `${fsSize.w}px`, height: `${fsSize.h}px`,
        maxWidth: 'none', borderRadius: 0, boxShadow: 'none', cursor: 'default',
      }
    : {
        position: 'relative', overflow: 'hidden', background: '#fff',
        userSelect: 'none', maxWidth: '1280px', width: '100%',
        height: `${720 * scale}px`,
        cursor: hint === 'prev' ? 'w-resize' : hint === 'next' ? 'e-resize' : 'default',
        borderRadius: 12, boxShadow: '0 16px 60px rgba(0,0,0,0.8)',
      }

  const btnStyle = {
    padding: '10px 22px', background: '#151515', color: '#ccc',
    border: '1px solid #222', borderRadius: 8, cursor: 'pointer',
    fontSize: 14, fontWeight: 600,
  }

  return (
    <div
      ref={rootRef}
      onMouseMove={handleMouseMove}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100vh',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        padding: isFullscreen ? 0 : '20px 16px',
        background: isFullscreen ? '#000' : '#0a0a0a',
        boxSizing: 'border-box',
      }}
    >
      {/* Progress bar */}
      {!isFullscreen && (
        <div style={{ width: '100%', maxWidth: 1280, height: 3, background: '#151515', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(to right, #1B5E20, #4CAF50)', borderRadius: 2, transition: 'width 0.35s ease' }} />
        </div>
      )}

      {/* Top bar */}
      {!isFullscreen && (
        <div style={{ width: '100%', maxWidth: 1280, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0 12px', boxSizing: 'border-box' }}>
          <button onClick={handleBack} style={{ ...btnStyle, padding: '7px 16px', fontSize: 13, color: '#aaa' }}>
            ← Proyectos
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
            <span style={{ color: '#555', fontSize: 13, textTransform: 'capitalize' }}>{project.name.replace(/-/g, ' ')}</span>
            <span style={{ color: '#333', fontSize: 13 }}>›</span>
            <span style={{ color: '#888', fontSize: 13 }}>Slide {current}</span>
          </div>
          <button
            onClick={() => navigate(`/edit/${project.slug}`)}
            style={{ ...btnStyle, padding: '7px 14px', fontSize: 13, color: '#2196F3', borderColor: '#0D47A1' }}
          >
            ✏️ Editar con IA
          </button>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              style={{ ...btnStyle, padding: '7px 14px', fontSize: 13, color: '#888', borderColor: '#333' }}
            >
              ⬇ Exportar ▾
            </button>
            {exportMenuOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                background: '#111', border: '1px solid #222', borderRadius: 10,
                padding: 6, zIndex: 100, minWidth: 200,
              }}>
                {[
                  { label: '📄 PDF', action: () => { exportProjectPDF(project.slug); setExportMenuOpen(false) } },
                  { label: '📊 PowerPoint (.pptx)', action: () => { exportProjectPPTX(project.slug); setExportMenuOpen(false) } },
                  { label: '📦 ZIP (HTMLs)', action: () => { exportProject(project.slug); setExportMenuOpen(false) } },
                ].map(item => (
                  <button key={item.label} onClick={item.action} style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 12px', borderRadius: 7, border: 'none',
                    background: 'none', color: '#ccc', cursor: 'pointer', fontSize: 13,
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleRegenerateSlide}
            disabled={regenerating}
            style={{ ...btnStyle, padding: '7px 14px', fontSize: 13, color: '#4CAF50', borderColor: '#1B5E20', opacity: regenerating ? 0.6 : 1 }}
          >
            {regenerating ? '⏳ Regenerando...' : '↺ Regenerar slide'}
          </button>
          <span style={{ color: '#666', fontSize: 13, fontWeight: 600 }}>
            {current} <span style={{ color: '#444' }}>/</span> {totalSlides}
          </span>
        </div>
      )}

      {/* Slide wrapper */}
      <div
        ref={wrapperRef}
        onClick={handleSlideClick}
        onMouseLeave={() => setHint(null)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={wrapperStyle}
      >
        {/* Zone left */}
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '20%', height: '100%', zIndex: 10,
          display: 'flex', alignItems: 'center', pointerEvents: 'none',
          opacity: hint === 'prev' ? 1 : 0, transition: 'opacity 0.2s ease',
          background: 'linear-gradient(to right, rgba(0,0,0,0.4), transparent)',
        }}>
          <span style={{ position: 'absolute', left: 16, color: '#fff', fontSize: 60, fontWeight: 'bold', lineHeight: 1, textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>‹</span>
        </div>

        {/* Zone right */}
        <div style={{
          position: 'absolute', top: 0, right: 0, width: '20%', height: '100%', zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', pointerEvents: 'none',
          opacity: hint === 'next' ? 1 : 0, transition: 'opacity 0.2s ease',
          background: 'linear-gradient(to left, rgba(0,0,0,0.4), transparent)',
        }}>
          <span style={{ position: 'absolute', right: 16, color: '#fff', fontSize: 60, fontWeight: 'bold', lineHeight: 1, textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>›</span>
        </div>

        {/* FS button */}
        {!isFullscreen && (
          <button
            onClick={(e) => { e.stopPropagation(); toggleFullscreen() }}
            title="Pantalla completa (F)"
            style={{
              position: 'absolute', top: 10, right: 10, zIndex: 20,
              background: 'rgba(0,0,0,0.5)', color: '#fff',
              border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8,
              padding: '5px 10px', cursor: 'pointer', fontSize: 18,
              backdropFilter: 'blur(6px)', lineHeight: 1,
            }}
          >⛶</button>
        )}

        {/* Slide number overlay */}
        {!isFullscreen && (
          <div style={{
            position: 'absolute', bottom: 10, right: 12, zIndex: 20,
            color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600,
            pointerEvents: 'none', textShadow: '0 1px 4px rgba(0,0,0,0.8)',
          }}>
            {current}/{totalSlides}
          </div>
        )}

        <iframe
          key={`${current}-${reloadKey}`}
          src={slideSrc}
          title={`Slide ${current}`}
          style={{
            width: '1280px', height: '720px', border: 'none', display: 'block',
            transformOrigin: 'top left', pointerEvents: 'none',
            transform: `scale(${scale})`,
          }}
          sandbox="allow-scripts allow-same-origin"
        />
      </div>

      {/* Normal controls */}
      {!isFullscreen && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={prev} disabled={current === 1} style={{ ...btnStyle, opacity: current === 1 ? 0.3 : 1 }}>
              ← Anterior
            </button>

            <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
              {Array.from({ length: totalSlides }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i + 1)}
                  style={{
                    width: 10, height: 10, borderRadius: '50%', border: 'none',
                    cursor: 'pointer', padding: 0, flexShrink: 0,
                    background: current === i + 1 ? '#4CAF50' : '#333',
                    transform: current === i + 1 ? 'scale(1.5)' : 'scale(1)',
                    boxShadow: current === i + 1 ? '0 0 8px #4CAF5088' : 'none',
                    transition: 'transform 0.2s, background 0.2s, box-shadow 0.2s',
                  }}
                />
              ))}
            </div>

            <button onClick={next} disabled={current === totalSlides} style={{ ...btnStyle, opacity: current === totalSlides ? 0.3 : 1 }}>
              Siguiente →
            </button>

            <button onClick={toggleFullscreen} style={{ ...btnStyle, color: '#666', fontSize: 13 }}>
              ⛶ Pantalla completa
            </button>
          </div>

          <p style={{ marginTop: 10, color: '#333', fontSize: 12 }}>
            Clic en los bordes · Flechas ⬅ ➡ · Deslizar · <kbd style={{ background: '#1a1a1a', color: '#666', padding: '1px 6px', borderRadius: 4, fontSize: 11, border: '1px solid #333' }}>F</kbd> fullscreen
          </p>
        </>
      )}

      {/* Modal de regeneración */}
      {regenModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#111', border: '1px solid #222', borderRadius: 16, padding: 28, width: 480 }}>
            <h3 style={{ color: '#eee', margin: '0 0 16px', fontSize: 18 }}>Regenerar Slide {current}</h3>
            <textarea
              value={regenInstructions}
              onChange={e => setRegenInstructions(e.target.value)}
              placeholder="Describe cómo quieres este slide..."
              rows={4}
              style={{ width: '100%', background: '#0a0a0a', border: '1px solid #222', borderRadius: 10, padding: '10px 14px', color: '#eee', fontSize: 14, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setRegenModal(false)} style={{ background: 'none', border: '1px solid #333', color: '#888', padding: '8px 18px', borderRadius: 8, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleRegen} disabled={regenLoading} style={{ background: 'linear-gradient(135deg,#1B5E20,#4CAF50)', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, opacity: regenLoading ? 0.5 : 1 }}>
                {regenLoading ? 'Regenerando...' : '↺ Regenerar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating fullscreen controls */}
      {isFullscreen && (
        <div ref={controlsRef} style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(16px)',
          padding: '10px 20px', borderRadius: 50, border: '1px solid rgba(255,255,255,0.1)',
          zIndex: 200, opacity: 0, pointerEvents: 'none', transition: 'opacity 0.4s ease',
        }}>
          <button onClick={handleBack} style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '5px 11px', cursor: 'pointer', fontSize: 12 }}>
            ☰
          </button>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)' }} />
          <button onClick={prev} disabled={current === 1} style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 13px', cursor: 'pointer', fontSize: 15, fontWeight: 600, opacity: current === 1 ? 0.25 : 1 }}>←</button>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            {Array.from({ length: totalSlides }, (_, i) => (
              <button key={i} onClick={() => setCurrent(i + 1)} style={{ width: 10, height: 10, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0, background: current === i + 1 ? '#fff' : 'rgba(255,255,255,0.25)', transform: current === i + 1 ? 'scale(1.5)' : 'scale(1)', transition: 'transform 0.2s' }} />
            ))}
          </div>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 600, minWidth: 40, textAlign: 'center' }}>
            {current}<span style={{ opacity: 0.4 }}>/</span>{totalSlides}
          </span>
          <button onClick={next} disabled={current === totalSlides} style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 13px', cursor: 'pointer', fontSize: 15, fontWeight: 600, opacity: current === totalSlides ? 0.25 : 1 }}>→</button>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)' }} />
          <button onClick={exitFullscreen} style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '5px 11px', cursor: 'pointer', fontSize: 12 }}>✕ Salir</button>
        </div>
      )}
    </div>
  )
}
