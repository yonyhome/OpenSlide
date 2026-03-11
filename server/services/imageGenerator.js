import { GoogleGenerativeAI } from '@google/generative-ai'

/**
 * Genera una imagen usando Gemini para enriquecer un slide
 * @param {string} apiKey - Gemini API key
 * @param {string} prompt - Descripción de la imagen a generar
 * @returns {Promise<string|null>} - Base64 de la imagen o null si falla
 */
export async function generateSlideImage(apiKey, prompt) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    // Usar gemini-2.0-flash-exp que soporta generación de imágenes
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp-image-generation' })

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: `Create a high-quality, professional background image for a presentation slide about: ${prompt}. The image should be subtle, artistic, and suitable as a slide background. Widescreen 16:9 format.` }]
      }],
      generationConfig: { responseModalities: ['IMAGE'] }
    })

    const imagePart = result.response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)
    if (!imagePart?.inlineData) return null

    return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`
  } catch (err) {
    console.error('[ImageGenerator] Error:', err.message)
    return null
  }
}

/**
 * Inyecta una imagen de fondo en el HTML del slide
 */
export function injectBackgroundImage(html, imageBase64) {
  if (!imageBase64) return html
  const bgStyle = `
    <style>
      .slide-bg-image {
        position: absolute;
        inset: 0;
        background-image: url('${imageBase64}');
        background-size: cover;
        background-position: center;
        opacity: 0.15;
        z-index: 0;
        pointer-events: none;
      }
      .slide { position: relative; z-index: 1; }
    </style>`
  const bgDiv = `<div class="slide-bg-image"></div>`

  // Inyectar el estilo en el head y el div antes del contenido del .slide
  return html
    .replace('</head>', `${bgStyle}</head>`)
    .replace(/(<div[^>]*class="[^"]*slide[^"]*"[^>]*>)/, `$1${bgDiv}`)
}
