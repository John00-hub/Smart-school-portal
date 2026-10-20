import { chromium } from 'playwright'
const BASE='http://localhost:5173'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport:{width:360,height:740}, isMobile:true, hasTouch:true })
const page = await ctx.newPage()

// touch targets: WCAG 2.5.8 asks for >=24px; 44px is the comfortable iOS/Android target
const probe = () => {
  const small=[]
  for (const el of document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')) {
    const r = el.getBoundingClientRect()
    if (r.width===0||r.height===0) continue
    const cs = getComputedStyle(el)
    if (cs.visibility==='hidden'||cs.display==='none') continue
    if (r.width < 24 || r.height < 24)
      small.push({ tag: el.tagName.toLowerCase(), txt:(el.innerText||el.getAttribute('aria-label')||el.getAttribute('placeholder')||'').trim().slice(0,28), w:Math.round(r.width), h:Math.round(r.height) })
  }
  return small.slice(0,8)
}

const login = async (e,p) => { await page.goto(`${BASE}/login`,{waitUntil:'networkidle'}); await page.fill('input[type="email"]',e); await page.fill('input[type="password"]',p); await page.click('button[type="submit"]'); await page.waitForTimeout(1000) }

let total=0, offenders=0
for (const [label,route,cred] of [['landing','/',null],['login','/login',null]]) {
  await page.goto(`${BASE}${route}`,{waitUntil:'networkidle'}); await page.waitForTimeout(500)
  const s = await page.evaluate(probe); total++; if(s.length){offenders++; console.log(`  ${route}: ${s.length} small ->`, s.map(x=>`${x.tag}:"${x.txt}" ${x.w}x${x.h}`).join(' | '))}
}
for (const [role,e,p] of [['admin','admin@greenfield.example','Admin123!'],['teacher','teacher@greenfield.example','Teacher123!'],['parent','parent@greenfield.example','Parent123!'],['student','student@greenfield.example','Student123!']]) {
  await login(e,p)
  const links = await page.$$eval('a[href^="/"]', as=>[...new Set(as.map(a=>a.getAttribute('href')))].filter(h=>h&&h.length>1))
  for (const h of links.slice(0,10)) {
    await page.goto(`${BASE}${h}`,{waitUntil:'networkidle'}); await page.waitForTimeout(400)
    const s = await page.evaluate(probe); total++
    if(s.length){offenders++; console.log(`  ${role} ${h}: ${s.length} small ->`, s.map(x=>`${x.tag}:"${x.txt}" ${x.w}x${x.h}`).join(' | '))}
  }
}

// print check: report card must still lay out for A4
await login('student@greenfield.example','Student123!')
await page.goto(`${BASE}/student/report`,{waitUntil:'networkidle'}); await page.waitForTimeout(700)
const pdf = await page.pdf({ format:'A4', printBackground:true })
console.log(`\n  report card PDF bytes: ${pdf.length}  (${pdf.length>5000?'content rendered':'SUSPICIOUSLY EMPTY'})`)

await browser.close()
console.log(`\npages checked: ${total} | pages with sub-24px targets: ${offenders}`)
