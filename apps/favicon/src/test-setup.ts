import { JSDOM } from 'jsdom'
const dom = new JSDOM('', { url: 'http://localhost' })
// Expose jsdom globals needed by canvas-based tests
;(globalThis as any).HTMLCanvasElement = dom.window.HTMLCanvasElement
;(globalThis as any).HTMLImageElement = dom.window.HTMLImageElement
;(globalThis as any).Image = dom.window.Image
;(globalThis as any).document = dom.window.document
