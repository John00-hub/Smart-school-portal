// Measures real horizontal overflow at phone width across every role's views.
// Run: node test/mobile.mjs   (dev server must be listening on :5173)
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:5173'
const W = 360, H = 740

const ROLES = [
  { role: 'admin',   email: 'admin@greenfield.example',   pass: 'Admin123!'   },
  { role: 'teacher', email: 'teacher@greenfield.example', pass: 'Teacher123!' },
  { role: 'parent',  email: 'parent@greenfield.example',  pass: 'Parent123!'  },
  { role: 'student', email: 'student@greenfield.example', pass: 'Student123!' },
]

// Finds elements whose right edge escapes the viewport.
const probe = () => {
  const out = []
  const vw = document.documentElement.clientWidth
  const de = document.documentElement
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    // Skip anything inside a deliberately scrollable container.
    let anc = el.parentElement, scrollable = false
    while (anc) {
      const cs = getComputedStyle(anc)
      if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') { scrollable = true; break }
      anc = anc.parentElement
    }
    if (scrollable) continue
    if (r.right > vw + 1) {
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className || '').toString().slice(0, 70),
        right: Math.round(r.right),
        overflowBy: Math.round(r.right - vw),
      })
    }
  }
  return { vw, scrollWidth: de.scrollWidth, offenders: out.slice(0, 6) }
}

async function login(page, r) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', r.email)
  await page.fill('input[type="password"]', r.pass)
  await page.click('button[type="submit"]')
  await page.waitForTimeout(1200)
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true })
const page = await ctx.newPage()

const rows = []
let worst = 0

async function check(label, path) {
  if (path) await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const m = await page.evaluate(probe)
  const bad = m.offenders.length
  worst = Math.max(worst, m.scrollWidth - m.vw)
  rows.push({ label, url: page.url().replace(BASE, ''), vw: m.vw, sw: m.scrollWidth, bad })
  if (bad) for (const o of m.offenders) console.log(`      ! <${o.tag}> +${o.overflowBy}px  ${o.cls}`)
}

console.log(`viewport ${W}x${H}\n`)

console.log('PUBLIC')
await check('landing', '/')
await check('login', '/login')

for (const r of ROLES) {
  console.log(`\n${r.role.toUpperCase()}`)
  await login(page, r)
  const landed = page.url().replace(BASE, '')
  rows.push({ label: `${r.role} (after login)`, url: landed, vw: W, sw: await page.evaluate(() => document.documentElement.scrollWidth), bad: (await page.evaluate(probe)).offenders.length })
  await check(`${r.role} sidebar/home`, null)

  // Walk every nav link the role can see.
  const links = await page.$$eval('a[href^="/"]', as =>
    [...new Set(as.map(a => a.getAttribute('href')))].filter(h => h && h.length > 1))
  for (const h of links.slice(0, 14)) {
    await page.goto(`${BASE}${h}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    const m = await page.evaluate(probe)
    worst = Math.max(worst, m.scrollWidth - m.vw)
    rows.push({ label: `${r.role} ${h}`, url: h, vw: m.vw, sw: m.scrollWidth, bad: m.offenders.length })
    if (m.offenders.length) for (const o of m.offenders) console.log(`      ! ${h} <${o.tag}> +${o.overflowBy}px  ${o.cls}`)
  }
}

await browser.close()

const fails = rows.filter(r => r.bad > 0 || r.sw > r.vw + 1)
console.log('\n────────────────────────────────────────────')
console.log(`pages checked: ${rows.length}`)
console.log(`pages with overflow: ${fails.length}`)
console.log(`worst horizontal overflow: ${worst}px`)
if (fails.length) { console.log('\nOVERFLOWING:'); for (const f of fails) console.log(`  ${f.label.padEnd(30)} scrollWidth ${f.sw} vs vw ${f.vw}  (${f.bad} elements)`) }
else console.log('\nNo horizontal overflow on any page.')
process.exit(fails.length ? 1 : 0)
