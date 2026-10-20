import { chromium } from 'playwright'
const BASE = process.env.BASE_URL || 'http://localhost:5173'
const b = await chromium.launch()
const p = await (await b.newContext({ viewport:{width:360,height:740}, isMobile:true })).newPage()
for (const route of ['/','/login']) {
  await p.goto(`${BASE}${route}`, { waitUntil:'networkidle' })
  await p.waitForTimeout(600)
  const txt = await p.evaluate(() => document.body.innerText)
  const bad = ['Not supplied','not supplied','000 000 0000']
  console.log(`${route.padEnd(8)} placeholder leaked: ${bad.filter(x=>txt.includes(x)).join(', ') || 'NONE'}`)
  if (route==='/') {
    const f = await p.evaluate(() => { const el=[...document.querySelectorAll('footer')].pop(); return el? el.innerText.replace(/\n+/g,' | ').slice(0,220):'no footer' })
    console.log(`  footer renders: ${f}`)
  }
}
await b.close()
