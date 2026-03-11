import puppeteer from 'puppeteer-core'
import pptxgen from 'pptxgenjs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getProject } from './projectManager.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Buscar Chrome instalado en el sistema
function getChromePath() {
  return process.env.CHROME_PATH || '/usr/bin/google-chrome'
}

/**
 * Toma screenshot de un slide HTML usando puppeteer-core
 */
async function screenshotSlide(browser, slideUrl) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 })
  await page.goto(slideUrl, { waitUntil: 'networkidle0', timeout: 30000 })
  const screenshot = await page.screenshot({ type: 'png', encoding: 'base64' })
  await page.close()
  return screenshot
}

/**
 * Exporta el proyecto como PDF
 */
export async function exportToPDF(slug, baseUrl = 'http://localhost:3001') {
  const project = getProject(slug)
  if (!project) throw new Error('Proyecto no encontrado')

  const chromePath = getChromePath()
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  })

  try {
    const pdfBuffers = []

    for (const slide of project.slides) {
      const page = await browser.newPage()
      await page.setViewport({ width: 1280, height: 720 })
      await page.goto(`${baseUrl}/slides/${slug}/${slide}`, { waitUntil: 'networkidle0', timeout: 30000 })

      const pdf = await page.pdf({
        width: '1280px',
        height: '720px',
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 }
      })

      pdfBuffers.push(pdf)
      await page.close()
    }

    // Si solo hay un slide, retornar directamente
    if (pdfBuffers.length === 1) return pdfBuffers[0]

    // Combinar PDFs usando pdf-lib
    const { PDFDocument } = await import('pdf-lib')
    const mergedPdf = await PDFDocument.create()

    for (const pdfBytes of pdfBuffers) {
      const doc = await PDFDocument.load(pdfBytes)
      const pages = await mergedPdf.copyPages(doc, doc.getPageIndices())
      pages.forEach(p => mergedPdf.addPage(p))
    }

    return Buffer.from(await mergedPdf.save())
  } finally {
    await browser.close()
  }
}

/**
 * Exporta el proyecto como PPTX
 */
export async function exportToPPTX(slug, baseUrl = 'http://localhost:3001') {
  const project = getProject(slug)
  if (!project) throw new Error('Proyecto no encontrado')

  const chromePath = getChromePath()
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  })

  try {
    const prs = new pptxgen()
    prs.layout = 'LAYOUT_WIDE' // 16:9

    for (const slide of project.slides) {
      const screenshot = await screenshotSlide(browser, `${baseUrl}/slides/${slug}/${slide}`)
      const pptxSlide = prs.addSlide()
      pptxSlide.addImage({
        data: `image/png;base64,${screenshot}`,
        x: 0, y: 0, w: '100%', h: '100%'
      })
    }

    // Generar como buffer
    const pptxData = await prs.write({ outputType: 'arraybuffer' })
    return Buffer.from(pptxData)
  } finally {
    await browser.close()
  }
}
