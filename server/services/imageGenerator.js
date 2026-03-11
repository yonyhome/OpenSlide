import { GoogleGenerativeAI } from '@google/generative-ai'

// Modelos disponibles para generación de imágenes con esta API key
const IMAGE_MODELS = [
  'nano-banana-pro-preview',
  'gemini-3-pro-image-preview', 
  'gemini-3.1-flash-image-preview',
  'gemini-2.5-flash-image',
]

/**
 * Genera una imagen usando Gemini para enriquecer un slide
 * @param {string} apiKey - Gemini API key
 * @param {string} prompt - Descripción de la imagen
 * @returns {Promise<string|null>} - Data URL base64 o null si falla
 */
export async function generateSlideImage(apiKey, prompt) {
  const genAI = new GoogleGenerativeAI(apiKey)
  
  for (const modelName of IMAGE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName })
      const result = await model.generateContent({
        contents: [{ 
          role: 'user', 
          parts: [{ text: `Create a high-quality, professional, artistic background image for a presentation slide about: ${prompt}. Widescreen 16:9 format. Subtle and elegant, suitable as a slide background.` }]
        }],
        generationConfig: { responseModalities: ['IMAGE'] }
      })
      
      const imagePart = result.response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)
      if (imagePart?.inlineData) {
        console.log(`[ImageGenerator] Imagen generada con ${modelName}`)
        return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`
      }
    } catch (err) {
      console.log(`[ImageGenerator] ${modelName} falló: ${err.message.slice(0, 60)}`)
      continue
    }
  }
  
  console.log('[ImageGenerator] Todos los modelos fallaron, continuando sin imagen')
  return null
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
        border-radius: inherit;
      }
      .slide { position: relative; z-index: 1; }
    </style>`
  const bgDiv = `<div class="slide-bg-image"></div>`
  
  return html
    .replace('</head>', `${bgStyle}\n</head>`)
    .replace(/(<div[^>]*class="[^"]*\bslide\b[^"]*"[^>]*>)/i, `$1\n${bgDiv}`)
}
