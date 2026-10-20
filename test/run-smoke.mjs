import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:5173/' })
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.localStorage = dom.window.localStorage
globalThis.CustomEvent = dom.window.CustomEvent
await import('./smoke.mjs')
