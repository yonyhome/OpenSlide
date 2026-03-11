/**
 * Temas visuales disponibles
 */
export const THEMES = {
  minimal: {
    name: 'Minimal',
    description: 'Fondo blanco/gris claro, tipografía grande y limpia, mucho espacio en blanco, sin decoraciones',
    css: `
      body { margin:0; background:#fafafa; font-family:'Segoe UI',Arial,sans-serif; color:#1a1a1a; }
      .slide { width:1280px; height:720px; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:80px; box-sizing:border-box; }
      h1 { font-size:64px; font-weight:700; margin:0 0 24px; line-height:1.1; }
      h2 { font-size:48px; font-weight:600; margin:0 0 20px; }
      p, li { font-size:28px; line-height:1.6; margin:8px 0; }
      .accent { color:#2563eb; }
    `
  },
  'dark-tech': {
    name: 'Dark Tech',
    description: 'Fondo negro/gris oscuro, texto blanco, acentos en verde o cyan neón, estilo tecnológico',
    css: `
      body { margin:0; background:#0a0a0a; font-family:'Segoe UI',Arial,sans-serif; color:#e0e0e0; }
      .slide { width:1280px; height:720px; display:flex; flex-direction:column; justify-content:center; align-items:flex-start; padding:80px; box-sizing:border-box; border-left:4px solid #4ade80; }
      h1 { font-size:64px; font-weight:700; margin:0 0 24px; color:#fff; line-height:1.1; }
      h2 { font-size:48px; font-weight:600; margin:0 0 20px; color:#4ade80; }
      p, li { font-size:26px; line-height:1.6; margin:8px 0; color:#ccc; }
      .accent { color:#4ade80; }
      .tag { background:#4ade8022; color:#4ade80; padding:4px 12px; border-radius:20px; font-size:18px; border:1px solid #4ade8044; }
    `
  },
  corporate: {
    name: 'Corporativo',
    description: 'Fondo azul oscuro o blanco, estilo profesional y formal, colores corporativos azul/gris',
    css: `
      body { margin:0; background:#0f2744; font-family:'Segoe UI',Arial,sans-serif; color:#fff; }
      .slide { width:1280px; height:720px; display:flex; flex-direction:column; justify-content:center; padding:80px; box-sizing:border-box; }
      h1 { font-size:60px; font-weight:700; margin:0 0 20px; line-height:1.1; }
      h2 { font-size:44px; font-weight:600; margin:0 0 20px; color:#60a5fa; }
      p, li { font-size:26px; line-height:1.6; margin:8px 0; color:#cbd5e1; }
      .accent { color:#60a5fa; }
      .divider { width:80px; height:4px; background:#60a5fa; margin:16px 0; border-radius:2px; }
    `
  },
  creative: {
    name: 'Creativo',
    description: 'Colores vibrantes, gradientes, layouts asimétricos, tipografía expresiva',
    css: `
      body { margin:0; font-family:'Segoe UI',Arial,sans-serif; }
      .slide { width:1280px; height:720px; display:flex; flex-direction:column; justify-content:center; padding:80px; box-sizing:border-box; background:linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#1e3a5f 100%); color:#fff; position:relative; overflow:hidden; }
      .slide::before { content:''; position:absolute; top:-100px; right:-100px; width:400px; height:400px; background:radial-gradient(circle,#818cf844 0%,transparent 70%); }
      h1 { font-size:64px; font-weight:800; margin:0 0 24px; line-height:1.1; background:linear-gradient(to right,#e0e7ff,#a5b4fc); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
      h2 { font-size:48px; font-weight:700; margin:0 0 20px; color:#a5b4fc; }
      p, li { font-size:26px; line-height:1.6; margin:8px 0; color:#c7d2fe; }
    `
  }
}

/**
 * Construye los mensajes para la generación de un slide
 */
export function buildSlideMessages(context) {
  const { slideNumber, totalSlides, content, theme = 'dark-tech', projectName } = context
  const themeData = THEMES[theme] || THEMES['dark-tech']

  const systemPrompt = `Eres un diseñador experto en presentaciones HTML. Tu tarea es generar el código HTML completo y autocontenido de una diapositiva.

REGLAS ESTRICTAS:
1. Retorna ÚNICAMENTE el código HTML. Sin explicaciones, sin markdown, sin bloques \`\`\`html.
2. El HTML debe ser completamente autocontenido: todo el CSS va en una etiqueta <style> dentro del <head>.
3. Las dimensiones exactas del slide son 1280px × 720px. No uses otras dimensiones.
4. No uses JavaScript (a menos que sea absolutamente necesario para una animación simple).
5. No uses fuentes externas de Google Fonts ni CDNs externos.
6. El contenido debe caber perfectamente en 1280×720px sin scroll.
7. Usa la clase .slide en el elemento principal que contiene el contenido.

TEMA VISUAL: ${themeData.name}
${themeData.description}

CSS BASE DEL TEMA (puedes extenderlo pero no contradecirlo):
<style>
${themeData.css}
</style>

ESTRUCTURA HTML BASE:
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>/* CSS del tema + estilos adicionales */</style>
</head>
<body>
  <div class="slide">
    <!-- Contenido del slide -->
  </div>
</body>
</html>`

  const userPrompt = `Proyecto: "${projectName}"
Slide ${slideNumber} de ${totalSlides}

Contenido de este slide:
${content}

Genera el HTML completo para este slide siguiendo el tema ${themeData.name}.`

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]
}

/**
 * Extrae el HTML de la respuesta del LLM (elimina posibles bloques markdown)
 */
export function extractHTML(response) {
  // Eliminar bloques ```html ... ``` o ``` ... ```
  const match = response.match(/```(?:html)?\s*([\s\S]*?)```/)
  if (match) return match[1].trim()

  // Si empieza con <!DOCTYPE o <html, retornar directo
  if (response.trim().startsWith('<!DOCTYPE') || response.trim().startsWith('<html')) {
    return response.trim()
  }

  return response.trim()
}
