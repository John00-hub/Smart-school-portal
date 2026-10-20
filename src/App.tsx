import { useState, useEffect, useMemo } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Link, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { store, gradeFromTotal, calculateGPA, timetableData, type AppUser, type StudentRecord, type ClassRecord, type AnnouncementRecord, type AttendanceStatus } from './lib/store'
import { writes, USE_SUPABASE } from './lib/dataSource'
import { ReportCard } from './components/ReportCard'
import { PRODUCT, activeSchool, copyrightLine, isSupplied } from './lib/branding'
import {
  GraduationCap, LogOut, Menu, X, Users, BookOpen, School, Megaphone,
  LayoutDashboard, ClipboardList, CalendarDays, Award, UserCheck,
  Search, Plus, Edit3, Trash2, Eye, ChevronDown, ChevronRight, Sparkles, Printer,
  ShieldCheck, BarChart3, Clock, Mail, Phone, MapPin, ArrowRight, CheckCircle2,
  AlertCircle, TrendingUp, BookMarked, UserCog, Filter, Save
} from 'lucide-react'

// ─── TOAST ───
function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'success' | 'error' | 'info' }[]>([])
  const show = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
  }
  const ToastContainer = () => (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
      {toasts.map(t => (
        <div key={t.id} className={`px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-slideIn ${t.type === 'success' ? 'bg-emerald-600 text-white' : t.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 text-white'}`}>
          {t.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {t.msg}
        </div>
      ))}
    </div>
  )
  return { show, ToastContainer }
}

// ─── LANDING PAGE ───
function Landing() {
  const navigate = useNavigate()
  const [mobileMenu, setMobileMenu] = useState(false)
  return (
    <div className="min-h-screen bg-brand-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-[68px]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center">
                <GraduationCap className="text-white" size={22} />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-brand" style={{ fontFamily: 'Plus Jakarta Sans' }}>{PRODUCT.productName}</span>
              <span className="hidden sm:inline text-xs font-semibold px-2 py-1 rounded-full bg-brand-light text-brand border border-brand-light">Portal v2.0</span>
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
              <a href="#features" className="hover:text-brand">Features</a>
              <a href="#roles" className="hover:text-brand">Roles</a>
              <a href="#contact" className="hover:text-brand">Contact</a>
            </div>
            <div className="hidden md:flex items-center gap-3">
              <button onClick={() => navigate('/login')} className="px-6 py-2.5 rounded-full font-semibold text-white bg-brand hover:bg-brand-dark transition flex items-center gap-2 text-sm">
                Portal Login <ArrowRight size={16} />
              </button>
            </div>
            <button className="md:hidden p-2" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X /> : <Menu />}</button>
          </div>
        </div>
        {mobileMenu && (
          <div className="md:hidden border-t bg-white px-4 py-4 flex flex-col gap-3">
            <button onClick={() => navigate('/login')} className="w-full py-3 rounded-xl bg-brand text-white font-semibold">Portal Login</button>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand via-brand to-brand-accent opacity-[0.06]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase px-3 py-1.5 rounded-full bg-brand-light text-brand border border-brand-light">
                <Sparkles size={12} /> Trusted by 500+ Schools Nationwide
              </div>
              <h1 className="mt-6 text-4xl sm:text-5xl lg:text-[52px] font-extrabold leading-[1.05] tracking-tight text-slate-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                The Modern <span className="text-brand">School Management</span> Portal for the Digital Age
              </h1>
              <p className="mt-5 text-[15px] leading-7 text-slate-600 max-w-xl">
                {PRODUCT.productName} unifies administrators, teachers, parents and students in one secure, responsive platform. Manage classes, results, attendance and communications — all in real time.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button onClick={() => navigate('/login')} className="px-8 py-3.5 rounded-full bg-brand text-white font-semibold shadow-lg shadow-brand hover:bg-brand-dark transition flex items-center gap-2">
                  Access Portal <ArrowRight size={18} />
                </button>
                <a href="#features" className="px-8 py-3.5 rounded-full bg-white border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 transition">Explore Features</a>
              </div>
              <div className="mt-6 flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-500" /> Supabase Secured</span>
                <span className="flex items-center gap-1.5"><Clock size={14} className="text-brand-accent" /> 99.9% Uptime</span>
              </div>
            </div>
            {/* Hero card */}
            <div className="relative lg:pl-8">
              <div className="bg-white rounded-[24px] shadow-[0_20px_60px_rgba(22,101,52,0.12)] border border-slate-100 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src="https://i.pravatar.cc/150?img=5" className="w-10 h-10 rounded-full" alt="admin" />
                    <div>
                      <div className="text-sm font-bold text-slate-900">Admin Dashboard</div>
                      <div className="text-xs text-slate-500">Live overview • Today</div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">● Live</span>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-6">
                  {[
                    { label: 'Students', value: '1,248', sub: '+12 this week', color: 'bg-brand' },
                    { label: 'Teachers', value: '64', sub: 'All active', color: 'bg-brand-accent' },
                    { label: 'Classes', value: '24', sub: '6 levels', color: 'bg-indigo-500' },
                  ].map(c => (
                    <div key={c.label} className="rounded-2xl bg-brand-background border border-slate-100 p-3">
                      <div className={`w-7 h-7 rounded-lg ${c.color} flex items-center justify-center text-white text-xs`}>◼</div>
                      <div className="mt-2 text-[11px] font-semibold tracking-wide uppercase text-slate-500">{c.label}</div>
                      <div className="text-lg font-extrabold text-slate-900">{c.value}</div>
                      <div className="text-[11px] text-slate-500">{c.sub}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-xl bg-gradient-to-r from-brand to-brand-accent p-4 text-white flex items-center justify-between">
                  <div>
                    <div className="text-xs opacity-80">Attendance Today</div>
                    <div className="text-xl font-bold">94.2% Present</div>
                  </div>
                  <BarChart3 />
                </div>
              </div>
              {/* floating */}
              <div className="absolute -bottom-4 -left-2 hidden lg:flex bg-white rounded-2xl shadow-xl border border-slate-100 px-4 py-3 items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><CheckCircle2 size={16} /></div>
                <div><div className="text-xs font-bold text-slate-900">Results Published</div><div className="text-xs text-slate-500">First Term • JSS 1A</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full bg-brand text-white">Why {PRODUCT.productName}</div>
          <h2 className="mt-3 text-3xl font-extrabold text-slate-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Everything your school needs — in one place</h2>
          <p className="mt-2 text-sm text-slate-600">Purpose-built for African schools. Secure, fast, and delightfully simple.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 mt-10">
          {[
            { icon: School, title: 'Administration Made Easy', desc: 'Manage students, teachers, classes and announcements with role-based access and audit trails.', color: 'bg-brand' },
            { icon: ClipboardList, title: 'Academic Excellence', desc: 'Teachers upload results, mark attendance and track performance. Parents and students view instantly.', color: 'bg-brand-accent' },
            { icon: ShieldCheck, title: 'Secure & Compliant', desc: 'Supabase RLS, encrypted sessions, and strict role isolation keep every record private.', color: 'bg-indigo-600' },
          ].map(f => (
            <div key={f.title} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition">
              <div className={`w-10 h-10 rounded-xl ${f.color} flex items-center justify-center text-white`}><f.icon size={18} /></div>
              <h3 className="mt-4 font-bold text-slate-900">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-600 leading-6">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="bg-white border-y border-slate-100 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-4 gap-6">
            {[
              { role: 'Administrator', desc: 'Full control over students, teachers, classes & announcements. Real-time analytics and activity logs.', gradient: 'from-brand to-brand-accent' },
              { role: 'Teacher', desc: 'Manage assigned classes, enter scores, mark attendance and publish classroom updates.', gradient: 'from-brand-accent to-cyan-400' },
              { role: 'Parent', desc: 'Monitor your children’s results, attendance and school announcements — all in one dashboard.', gradient: 'from-emerald-500 to-teal-400' },
              { role: 'Student', desc: 'View personal results, attendance, timetable and announcements. Track your academic growth.', gradient: 'from-violet-600 to-indigo-500' },
            ].map(r => (
              <div key={r.role} className="rounded-2xl border border-slate-100 overflow-hidden bg-brand-background">
                <div className={`h-1.5 bg-gradient-to-r ${r.gradient}`} />
                <div className="p-5">
                  <div className="text-sm font-extrabold text-slate-900">{r.role} Portal</div>
                  <p className="text-sm text-slate-600 mt-1 leading-6">{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo credentials */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-gradient-to-br from-slate-900 to-brand rounded-[24px] p-6 lg:p-8 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans' }}>Try the Live Demo</h3>
              <p className="text-sm text-green-100 mt-1">Use any of these demo accounts — no registration required.</p>
            </div>
            <button onClick={() => navigate('/login')} className="px-6 py-3 rounded-full bg-white text-brand font-bold text-sm">Open Login →</button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            {[
              { role: 'Admin', email: 'admin@greenfield.example', pass: 'Admin123!' },
              { role: 'Teacher', email: 'teacher@greenfield.example', pass: 'Teacher123!' },
              { role: 'Parent', email: 'parent@greenfield.example', pass: 'Parent123!' },
              { role: 'Student', email: 'student@greenfield.example', pass: 'Student123!' },
            ].map(c => (
              <div key={c.role} className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 border border-white/15">
                <div className="text-xs font-bold tracking-widest uppercase opacity-80">{c.role}</div>
                <div className="text-sm font-mono mt-1">{c.email}</div>
                <div className="text-sm font-mono text-green-100">{c.pass}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center text-white"><GraduationCap size={18} /></div>
                <span className="font-extrabold text-brand" style={{ fontFamily: 'Plus Jakarta Sans' }}>{PRODUCT.productName}</span>
              </div>
              <p className="text-sm text-slate-600 mt-3 leading-6">Empowering education through technology. Built for schools that aspire to more.</p>
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm">Contact</div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div className="flex items-center gap-2"><Mail size={14} /> <span className="break-all">{activeSchool.email}</span></div>
                {isSupplied(activeSchool.phone) && (
                  <div className="flex items-center gap-2"><Phone size={14} /> <span className="break-all">{activeSchool.phone}</span></div>
                )}
                {isSupplied(activeSchool.address) && (
                  <div className="flex items-center gap-2"><MapPin size={14} /> <span className="break-all">{activeSchool.address}</span></div>
                )}
              </div>
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm">Portal Access</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to="/login" className="px-4 py-2 rounded-full bg-brand text-white text-sm font-semibold">Login</Link>
                <span className="px-4 py-2 rounded-full bg-slate-100 text-slate-600 text-sm">Supabase + RLS Secured</span>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-100 text-xs text-slate-500 flex flex-wrap justify-between gap-2">
            <span>{copyrightLine}</span>
            <span>{PRODUCT.productName} • {PRODUCT.developerAttribution} • Support: {PRODUCT.supportEmail}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ─── LOGIN PAGE ───
function LoginPage() {
  const { login, resetPassword, mode } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(email, password)
      const dest: Record<string, string> = { admin: '/admin', teacher: '/teacher', parent: '/parent', student: '/student' }
      navigate(dest[user.role] || '/')
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally { setLoading(false) }
  }

  const quickLogin = (em: string, pw: string) => { setEmail(em); setPassword(pw) }

  const handleReset = async () => {
    setError('')
    setNotice('')
    if (!email) { setError('Enter your email address above first, then click “Forgot password?”.'); return }
    try {
      await resetPassword(email)
      setNotice(`Password reset link sent to ${email}. Check your inbox.`)
    } catch (err: any) {
      setError(err.message || 'Could not start password reset.')
    }
  }

  return (
    <div className="min-h-screen bg-brand-background flex">
      {/* Left - form */}
      <div className="flex-1 flex flex-col">
        <div className="px-6 lg:px-10 py-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center text-white"><GraduationCap size={18} /></div>
            <span className="font-extrabold text-brand" style={{ fontFamily: 'Plus Jakarta Sans' }}>{PRODUCT.productName}</span>
          </Link>
          <Link to="/" className="inline-flex items-center py-2.5 -my-2.5 text-sm font-medium text-slate-600 hover:text-slate-900">← Back to Home</Link>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-[420px]">
            <div className="bg-white rounded-[20px] border border-slate-200 shadow-sm p-6 sm:p-8">
              <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase px-3 py-1.5 rounded-full bg-brand-light text-brand">
                {mode === 'supabase' ? 'Connected to Supabase' : 'Demo Mode — Local Data'}
              </div>
              {mode === 'demo' && (
                <div className="mt-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-5">
                  <strong className="text-slate-800">No Supabase credentials detected.</strong> The portal is running
                  on local demo data so you can explore every screen. Add <code className="px-1 py-0.5 bg-white border border-slate-200 rounded">VITE_SUPABASE_URL</code> and{' '}
                  <code className="px-1 py-0.5 bg-white border border-slate-200 rounded">VITE_SUPABASE_ANON_KEY</code> to{' '}
                  <code className="px-1 py-0.5 bg-white border border-slate-200 rounded">.env</code>, restart, and the same
                  screens read and write your real database. See <strong>SETUP.md</strong>.
                </div>
              )}
              <h1 className="mt-3 text-[22px] font-extrabold text-slate-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Welcome back</h1>
              <p className="text-sm text-slate-600 mt-1">Sign in to your role-based dashboard. Your session is protected by Supabase Auth.</p>

              {error && <div className="mt-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex gap-2"><AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}</div>}
              {notice && <div className="mt-4 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {notice}</div>}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700">Email address</label>
                  <input value={email} onChange={e => setEmail(e.target.value)} required type="email" placeholder="you@greenfield.example" className="mt-1.5 w-full px-4 py-3 rounded-xl border border-slate-200 bg-brand-background focus:bg-white focus:border-brand focus:ring-4 focus:ring-green-50 outline-none text-sm" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Password</label>
                  <div className="relative mt-1.5">
                    <input value={password} onChange={e => setPassword(e.target.value)} required type={showPass ? 'text' : 'password'} placeholder="Enter your password" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-brand-background focus:bg-white focus:border-brand focus:ring-4 focus:ring-green-50 outline-none text-sm pr-16" />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold px-3 py-1.5 rounded-full bg-white border border-slate-200">{showPass ? 'Hide' : 'Show'}</button>
                  </div>
                  <div className="mt-2 flex justify-between text-xs">
                    <span className="text-slate-500">Demo passwords pre-filled below</span>
                    <button type="button" className="text-brand font-semibold" onClick={handleReset}>Forgot password?</button>
                  </div>
                </div>
                <button disabled={loading} type="submit" className="w-full py-3.5 rounded-xl bg-brand text-white font-bold hover:bg-brand-dark transition disabled:opacity-60 flex items-center justify-center gap-2">
                  {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                  {loading ? 'Signing in...' : 'Sign In →'}
                </button>
              </form>

              <div className="mt-6">
                <div className="text-xs font-bold tracking-widest uppercase text-slate-500">Quick Demo Access — Tap to Fill</div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {[
                    { label: 'Administrator', email: 'admin@greenfield.example', pass: 'Admin123!' },
                    { label: 'Teacher', email: 'teacher@greenfield.example', pass: 'Teacher123!' },
                    { label: 'Parent', email: 'parent@greenfield.example', pass: 'Parent123!' },
                    { label: 'Student', email: 'student@greenfield.example', pass: 'Student123!' },
                  ].map(c => (
                    <button key={c.label} onClick={() => quickLogin(c.email, c.pass)} className="text-left px-3 py-2.5 rounded-xl border border-slate-200 bg-brand-background hover:bg-white hover:border-brand/40 transition">
                      <div className="text-xs font-bold text-brand">{c.label}</div>
                      <div className="text-[11px] text-slate-600 truncate">{c.email}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                <strong>Security note:</strong> Role assignment is enforced server-side via Supabase RLS. Users cannot self-elevate privileges.
              </div>
            </div>
            <div className="text-center text-xs text-slate-500 mt-4">
              {copyrightLine}
            </div>
          </div>
        </div>
      </div>
      {/* Right - showcase */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-brand via-brand to-brand-accent relative overflow-hidden p-10 flex-col justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase px-3 py-1.5 rounded-full bg-white/15 text-white border border-white/20">Role-Based Access Control</div>
          <h2 className="mt-6 text-4xl font-extrabold text-white leading-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>One portal.<br />Four experiences.</h2>
          <p className="text-green-100 mt-3 max-w-md leading-6">Each role sees only what they’re authorized to see — powered by Supabase Row Level Security.</p>
        </div>
        <div className="relative bg-white rounded-2xl p-5 shadow-2xl">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">🔒 How authentication works</div>
          <ol className="mt-3 space-y-2 text-sm text-slate-600">
            <li className="flex gap-2"><span className="w-6 h-6 rounded-full bg-brand-light text-brand flex items-center justify-center text-xs font-bold shrink-0">1</span> User signs in with email & password via Supabase Auth</li>
            <li className="flex gap-2"><span className="w-6 h-6 rounded-full bg-brand-light text-brand flex items-center justify-center text-xs font-bold shrink-0">2</span> Server checks <code className="px-1 py-0.5 bg-slate-100 rounded text-xs">profiles.role</code> — never trust client</li>
            <li className="flex gap-2"><span className="w-6 h-6 rounded-full bg-brand-light text-brand flex items-center justify-center text-xs font-bold shrink-0">3</span> RLS policies filter every query by role</li>
            <li className="flex gap-2"><span className="w-6 h-6 rounded-full bg-brand-light text-brand flex items-center justify-center text-xs font-bold shrink-0">4</span> Automatic redirect to your dashboard</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

// ─── SHARED DASHBOARD SHELL ───
function DashboardShell({ role, children, title, subtitle }: { role: string; children: React.ReactNode; title: string; subtitle?: string }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileMenu, setProfileMenu] = useState(false)

  const navItems: Record<string, { label: string; icon: any; path: string }[]> = {
    admin: [
      { label: 'Overview', icon: LayoutDashboard, path: '/admin' },
      { label: 'Students', icon: Users, path: '/admin/students' },
      { label: 'Teachers', icon: UserCog, path: '/admin/teachers' },
      { label: 'Classes', icon: School, path: '/admin/classes' },
      { label: 'Announcements', icon: Megaphone, path: '/admin/announcements' },
    ],
    teacher: [
      { label: 'Overview', icon: LayoutDashboard, path: '/teacher' },
      { label: 'My Classes', icon: BookOpen, path: '/teacher/classes' },
      { label: 'Results', icon: Award, path: '/teacher/results' },
      { label: 'Attendance', icon: UserCheck, path: '/teacher/attendance' },
      { label: 'Announcements', icon: Megaphone, path: '/teacher/announcements' },
    ],
    parent: [
      { label: 'Overview', icon: LayoutDashboard, path: '/parent' },
      { label: 'Academic Results', icon: Award, path: '/parent/results' },
      { label: 'Attendance', icon: CalendarDays, path: '/parent/attendance' },
      { label: 'Announcements', icon: Megaphone, path: '/parent/announcements' },
    ],
    student: [
      { label: 'Overview', icon: LayoutDashboard, path: '/student' },
      { label: 'My Results', icon: Award, path: '/student/results' },
      { label: 'Attendance', icon: CalendarDays, path: '/student/attendance' },
      { label: 'Timetable', icon: Clock, path: '/student/timetable' },
      { label: 'Report Card', icon: Printer, path: '/student/report' },
      { label: 'Announcements', icon: Megaphone, path: '/student/announcements' },
    ],
  }

  const items = navItems[role] || []
  const roleColor: Record<string, string> = { admin: 'bg-brand', teacher: 'bg-emerald-600', parent: 'bg-teal-600', student: 'bg-violet-600' }
  const roleLabel: Record<string, string> = { admin: 'Administrator', teacher: 'Teacher', parent: 'Parent', student: 'Student' }

  return (
    <div className="min-h-screen bg-brand-background flex">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex w-[268px] shrink-0 flex-col bg-white border-r border-slate-200 sticky top-0 h-screen">
        <div className="h-[64px] px-5 flex items-center gap-3 border-b border-slate-100">
          <div className={`w-9 h-9 rounded-xl ${roleColor[role]} flex items-center justify-center text-white`}><GraduationCap size={18} /></div>
          <div>
            <div className="font-extrabold text-slate-900 leading-none" style={{ fontFamily: 'Plus Jakarta Sans' }}>{PRODUCT.productName}</div>
            <div className="text-[11px] font-semibold tracking-widest uppercase text-slate-500">{roleLabel[role]} Portal</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
          {items.map(it => {
            const active = location.pathname === it.path
            return (
              <Link key={it.path} to={it.path} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${active ? 'bg-brand text-white shadow-md' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                <it.icon size={18} /> {it.label}
                {active && <ChevronRight size={14} className="ml-auto opacity-70" />}
              </Link>
            )
          })}
        </nav>
        <div className="p-3 border-t border-slate-100">
          <div className="rounded-xl bg-brand-background border border-slate-200 p-3 flex items-center gap-3">
            <img src={user?.avatar || `https://i.pravatar.cc/150?u=${user?.id}`} className="w-9 h-9 rounded-full" alt="avatar" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-slate-900 truncate">{user?.full_name}</div>
              <div className="text-xs text-slate-500 truncate">{user?.email}</div>
            </div>
          </div>
          <button onClick={() => { logout(); navigate('/login') }} className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-white shadow-2xl flex flex-col">
            <div className="h-[64px] px-5 flex items-center justify-between border-b">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl ${roleColor[role]} flex items-center justify-center text-white`}><GraduationCap size={18} /></div>
                <div className="font-extrabold text-slate-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>{PRODUCT.productName}</div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-2"><X size={20} /></button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {items.map(it => {
                const active = location.pathname === it.path
                return (
                  <Link key={it.path} to={it.path} onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium ${active ? 'bg-brand text-white' : 'text-slate-600'}`}>
                    <it.icon size={18} /> {it.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="h-[64px] bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-xl border border-slate-200"><Menu size={18} /></button>
            <div>
              <h1 className="text-[18px] font-extrabold text-slate-900 leading-none" style={{ fontFamily: 'Plus Jakarta Sans' }}>{title}</h1>
              {subtitle && <div className="text-xs text-slate-500 hidden sm:block">{subtitle}</div>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live • {new Date().toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
            <div className="relative">
              <button onClick={() => setProfileMenu(!profileMenu)} className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full border border-slate-200 bg-white">
                <img src={user?.avatar} className="w-7 h-7 rounded-full" alt="avatar" />
                <span className="hidden sm:inline text-sm font-semibold text-slate-700 max-w-[120px] truncate">{user?.full_name}</span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>
              {profileMenu && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50">
                  <div className="px-3 py-2">
                    <div className="text-sm font-bold text-slate-900">{user?.full_name}</div>
                    <div className="text-xs text-slate-500">{user?.email} • {roleLabel[role]}</div>
                  </div>
                  <div className="border-t border-slate-100 mt-2 pt-2">
                    <button onClick={() => { logout(); navigate('/login') }} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-50 text-sm font-medium text-slate-700"><LogOut size={16} /> Sign out</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

// ─── REUSABLE COMPONENTS ───
function StatCard({ label, value, sub, icon: Icon, color }: any) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-bold tracking-widest uppercase text-slate-500">{label}</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{value}</div>
          <div className="text-xs text-slate-500 mt-1">{sub}</div>
        </div>
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center text-white`}><Icon size={18} /></div>
      </div>
    </div>
  )
}

/**
 * Resolve the signed-in student's own record.
 *
 * Matches on profile_id first (authoritative), then falls back to email for
 * the demo dataset. NEVER falls back to another student's row — doing so
 * would render someone else's grades and attendance as the user's own.
 */
function useMyStudentRecord(): StudentRecord | null {
  const { user } = useAuth()
  const data = store.get()
  if (!user) return null
  const byProfile = data.students.find(s => (s as any).profile_id === user.id)
  if (byProfile) return byProfile
  const email = user.email?.toLowerCase()
  return data.students.find(s => s.email?.toLowerCase() === email) ?? null
}

/** Shown instead of another user's data when a record cannot be resolved. */
function NoLinkedRecord({ kind = 'student' }: { kind?: string }) {
  return (
    <EmptyState
      icon={AlertCircle}
      title="No linked record found"
      desc={`Your account is not linked to a ${kind} record yet. An administrator must link your profile before this page can show anything. No other student's data is displayed.`}
    />
  )
}

function EmptyState({ icon: Icon, title, desc, action }: any) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400"><Icon size={20} /></div>
      <div className="mt-3 font-bold text-slate-900">{title}</div>
      <div className="text-sm text-slate-600 mt-1 max-w-sm mx-auto">{desc}</div>
      {action}
    </div>
  )
}

// ─── ADMIN PAGES ───
function AdminOverview() {
  const data = store.get()
  const navigate = useNavigate()
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Students" value={data.students.length} sub="Across all classes" icon={Users} color="bg-brand" />
        <StatCard label="Total Teachers" value={data.teachers.length} sub="Active staff" icon={UserCog} color="bg-brand-accent" />
        <StatCard label="Classes" value={data.classes.length} sub="6 academic levels" icon={School} color="bg-indigo-500" />
        <StatCard label="Announcements" value={data.announcements.length} sub="Published this term" icon={Megaphone} color="bg-amber-500" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Class Enrolment</h3>
            <button onClick={() => navigate('/admin/classes')} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200">View All</button>
          </div>
          <div className="p-5 space-y-3">
            {data.classes.map(c => (
              <div key={c.id} className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-900">{c.name} {c.section}</span>
                    <span className="text-xs text-slate-500">{c.enrolled}/{c.capacity}</span>
                  </div>
                  <div className="mt-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand rounded-full" style={{ width: `${Math.round(c.enrolled / c.capacity * 100)}%` }} />
                  </div>
                </div>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200">{c.teacher_name.split(' ').slice(-1)[0]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-900">Recent Activity</h3>
          <div className="mt-4 space-y-3">
            {[
              { text: 'New student admitted — Chiamaka Okafor (JSS 1A)', time: '2 hours ago', dot: 'bg-emerald-500' },
              { text: 'Results published for JSS 2A — Mathematics', time: '5 hours ago', dot: 'bg-brand-accent' },
              { text: 'Attendance marked for SSS 1A — 94% present', time: 'Yesterday', dot: 'bg-brand-accent' },
              { text: 'Announcement: Mid-term break schedule', time: '2 days ago', dot: 'bg-amber-500' },
            ].map((a, i) => (
              <div key={i} className="flex gap-3">
                <div className={`w-2 h-2 rounded-full ${a.dot} mt-2 shrink-0`} />
                <div><div className="text-sm text-slate-700 leading-5">{a.text}</div><div className="text-xs text-slate-500">{a.time}</div></div>
              </div>
            ))}
          </div>
          <div className="mt-5 p-3 rounded-xl bg-brand-light border border-brand-light text-xs text-brand">
            <strong>Supabase Realtime</strong> — In production, this feed is powered by Postgres changes & RLS-filtered subscriptions.
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Latest Students</h3>
          <button onClick={() => navigate('/admin/students')} className="inline-flex items-center py-2.5 -my-2.5 text-sm font-semibold text-brand">Manage →</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-background text-xs font-bold tracking-widest uppercase text-slate-500">
              <tr><th className="text-left px-5 py-3">Student</th><th className="text-left px-5 py-3">Admission No</th><th className="text-left px-5 py-3">Class</th><th className="text-left px-5 py-3">Parent</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.students.slice(0, 5).map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 flex items-center gap-3"><img src={s.avatar} className="w-8 h-8 rounded-full" alt="" /><span className="font-semibold text-slate-900">{s.full_name}</span></td>
                  <td className="px-5 py-3 font-mono text-xs">{s.admission_no}</td>
                  <td className="px-5 py-3"><span className="px-2.5 py-1 rounded-full bg-brand-light text-brand text-xs font-semibold border border-brand-light">{s.class_name}</span></td>
                  <td className="px-5 py-3 text-slate-600">{data.users.find(u => u.id === s.parent_id)?.full_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function AdminStudents() {
  const [data, setData] = useState(store.get())
  const [q, setQ] = useState('')
  const [filterClass, setFilterClass] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<StudentRecord | null>(null)
  const { show, ToastContainer } = useToast()

  useEffect(() => {
    const handler = () => setData(store.get())
    window.addEventListener('smartschool:update', handler as any)
    return () => window.removeEventListener('smartschool:update', handler as any)
  }, [])

  const filtered = useMemo(() => {
    return data.students.filter(s => {
      const matchesQ = !q || s.full_name.toLowerCase().includes(q.toLowerCase()) || s.admission_no.toLowerCase().includes(q.toLowerCase())
      const matchesClass = filterClass === 'all' || s.class_id === filterClass
      return matchesQ && matchesClass
    })
  }, [data.students, q, filterClass])

  const remove = async (id: string) => {
    if (!confirm('Delete this student record? This cannot be undone.')) return
    try {
      await writes.deleteStudent(id)
      show('Student deleted', 'success')
    } catch (err: any) {
      show(err.message || 'Could not delete student', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or admission no..." className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-brand-background focus:bg-white focus:border-brand outline-none text-sm" />
          </div>
          <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm">
            <option value="all">All Classes</option>
            {data.classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
          </select>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-5 py-2.5 rounded-xl bg-brand text-white font-semibold text-sm flex items-center gap-2"><Plus size={16} /> Register Student</button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-background text-xs font-bold tracking-widest uppercase text-slate-500">
              <tr><th className="text-left px-4 py-3">Student</th><th className="text-left px-4 py-3">Admission</th><th className="text-left px-4 py-3">Class</th><th className="text-left px-4 py-3">Contact</th><th className="text-right px-4 py-3">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 flex items-center gap-3">
                    <img src={s.avatar} className="w-9 h-9 rounded-full" alt="" />
                    <div><div className="font-semibold text-slate-900">{s.full_name}</div><div className="text-xs text-slate-500">{s.gender} • {s.dob}</div></div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{s.admission_no}</td>
                  <td className="px-4 py-3"><span className="px-2.5 py-1 rounded-full bg-brand-light text-brand text-xs font-semibold border border-brand-light">{s.class_name}</span></td>
                  <td className="px-4 py-3 text-xs text-slate-600">{s.phone}<div className="text-slate-400 truncate max-w-[160px]">{s.address}</div></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setEditing(s)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"><Eye size={16} /></button>
                      <button onClick={() => setEditing(s)} className="p-2 rounded-lg hover:bg-brand-light text-brand"><Edit3 size={16} /></button>
                      <button onClick={() => remove(s.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-600"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="p-10 text-center text-sm text-slate-500">No students match your search.</div>}
      </div>

      {(showAdd || editing) && (
        <StudentForm
          initial={editing}
          classes={data.classes}
          users={data.users}
          onClose={() => { setShowAdd(false); setEditing(null) }}
          onSave={() => { setShowAdd(false); setEditing(null); show(editing ? 'Student updated' : 'Student registered successfully', 'success') }}
        />
      )}
      <ToastContainer />
    </div>
  )
}

function StudentForm({ initial, classes, users, onClose, onSave }: any) {
  const [form, setForm] = useState<Partial<StudentRecord>>(initial || {
    full_name: '', admission_no: `SS/2024/${String(Math.floor(Math.random() * 900) + 100)}`, email: '', class_id: classes[0]?.id || '', gender: 'Female', dob: '', phone: '', address: '', parent_id: users.filter((u: AppUser) => u.role === 'parent')[0]?.id || ''
  })
  const [error, setError] = useState('')
  const parents = users.filter((u: AppUser) => u.role === 'parent')

  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.full_name || !form.admission_no || !form.class_id) { setError('Please fill all required fields.'); return }
    const cls = classes.find((c: ClassRecord) => c.id === form.class_id)
    const className = cls ? `${cls.name} ${cls.section}` : ''
    setSubmitting(true)
    setError('')
    try {
      if (initial) {
        await writes.updateStudent(initial.id, {
          full_name: form.full_name,
          admission_no: form.admission_no,
          gender: form.gender || '',
          dob: form.dob || '',
          address: form.address || '',
          phone: form.phone || '',
          // Only re-enrol when the class actually changed.
          ...(initial.class_id !== form.class_id ? { classId: form.class_id, className } : {}),
        })
      } else {
        await writes.createStudent({
          admissionNo: form.admission_no,
          fullName: form.full_name,
          gender: form.gender || 'Female',
          dob: form.dob || '',
          address: form.address || '',
          phone: form.phone || '',
          classId: form.class_id,
          className,
          parentId: form.parent_id || parents[0]?.id || '',
        })
      }
      onSave()
    } catch (err: any) {
      setError(err.message || 'Could not save this student.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={submit} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between">
          <h3 className="font-bold text-slate-900">{initial ? 'Edit Student' : 'Register New Student'}</h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="text-sm font-semibold text-slate-700">Full Name *</label><input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-brand-background focus:bg-white focus:border-brand outline-none text-sm" placeholder="e.g. Adaeze Okoro" /></div>
            <div><label className="text-sm font-semibold text-slate-700">Admission No *</label><input value={form.admission_no} onChange={e => setForm({ ...form, admission_no: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-brand-background outline-none text-sm font-mono" /></div>
            <div><label className="text-sm font-semibold text-slate-700">Class *</label>
              <select value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm">
                {classes.map((c: ClassRecord) => <option key={c.id} value={c.id}>{c.name} {c.section} — {c.teacher_name}</option>)}
              </select>
            </div>
            <div><label className="text-sm font-semibold text-slate-700">Parent/Guardian</label>
              <select value={form.parent_id} onChange={e => setForm({ ...form, parent_id: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm">
                {parents.map((p: AppUser) => <option key={p.id} value={p.id}>{p.full_name} ({p.email})</option>)}
              </select>
            </div>
            <div><label className="text-sm font-semibold text-slate-700">Gender</label>
              <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm"><option>Female</option><option>Male</option></select>
            </div>
            <div><label className="text-sm font-semibold text-slate-700">Date of Birth</label><input type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm" /></div>
            <div><label className="text-sm font-semibold text-slate-700">Phone</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-brand-background text-sm" placeholder="0803..." /></div>
            <div className="sm:col-span-2"><label className="text-sm font-semibold text-slate-700">Address</label><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-brand-background text-sm" placeholder="Residential address" /></div>
          </div>
        </div>
        <div className="sticky bottom-0 bg-white px-6 py-4 border-t flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-200 font-semibold text-sm">Cancel</button>
          <button type="submit" disabled={submitting} className="px-6 py-2.5 rounded-xl bg-brand text-white font-semibold text-sm flex items-center gap-2 disabled:opacity-60">
            {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
            {submitting ? 'Saving…' : (initial ? 'Save Changes' : 'Register Student')}
          </button>
        </div>
      </form>
    </div>
  )
}

function AdminTeachers() {
  const [data, setData] = useState(store.get())
  const [showAdd, setShowAdd] = useState(false)
  const { show, ToastContainer } = useToast()
  useEffect(() => {
    const h = () => setData(store.get())
    window.addEventListener('smartschool:update', h as any)
    return () => window.removeEventListener('smartschool:update', h as any)
  }, [])
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowAdd(true)} className="px-5 py-2.5 rounded-xl bg-brand text-white font-semibold text-sm flex items-center gap-2"><Plus size={16} /> Add Teacher</button>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.teachers.map(t => (
          <div key={t.id} className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex gap-4">
              <img src={t.avatar} className="w-14 h-14 rounded-2xl object-cover" alt="" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-900">{t.full_name}</div>
                <div className="text-xs text-slate-500">{t.employee_no} • {t.department}</div>
                <div className="text-xs text-slate-600 mt-1">{t.qualification}</div>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-xs text-slate-600">
              <div className="flex items-center gap-2"><Mail size={12} /> {t.email}</div>
              <div className="flex items-center gap-2"><Phone size={12} /> {t.phone}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {t.class_ids.map(cid => {
                const c = data.classes.find(x => x.id === cid)
                return <span key={cid} className="px-2 py-1 rounded-full bg-brand-light text-brand text-[11px] font-semibold border border-brand-light">{c ? `${c.name} ${c.section}` : cid}</span>
              })}
            </div>
          </div>
        ))}
      </div>
      {showAdd && (
        <TeacherForm
          classes={data.classes}
          onClose={() => setShowAdd(false)}
          onSave={() => { setShowAdd(false); show('Teacher added successfully', 'success') }}
        />
      )}
      <ToastContainer />
    </div>
  )
}

function TeacherForm({ classes, onClose, onSave }: any) {
  const [form, setForm] = useState({
    full_name: '', employee_no: `TCH/2024/${String(Math.floor(Math.random() * 900) + 100)}`,
    email: '', phone: '', qualification: '', department: 'Sciences',
    password: '', class_ids: [] as string[],
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.full_name || !form.email) { setError('Name and email are required.'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setSubmitting(true)
    try {
      await writes.createTeacher({
        fullName: form.full_name,
        email: form.email,
        phone: form.phone,
        qualification: form.qualification,
        department: form.department,
        employeeNo: form.employee_no,
        password: form.password,
        classIds: form.class_ids,
      })
      onSave()
    } catch (err: any) {
      setError(err.message || 'Could not create this teacher account.')
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <form onSubmit={submit} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white"><h3 className="font-bold">Add Teacher</h3><button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X size={18} /></button></div>
        <div className="p-6 space-y-3">
          {error && <div role="alert" className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Full name *</span>
            <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-brand-background text-sm" required />
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Employee no.</span>
              <input value={form.employee_no} onChange={e => setForm({ ...form, employee_no: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 font-mono text-sm" />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Phone</span>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm" />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Email *</span>
            <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email" autoComplete="off" className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm" required />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Initial password *</span>
            <input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} type="password" autoComplete="new-password" minLength={8} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-brand-background text-sm" required />
            <span className="text-xs text-slate-500">Minimum 8 characters. Share it with the teacher over a secure channel — they should reset it on first login.</span>
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Qualification</span>
              <input value={form.qualification} onChange={e => setForm({ ...form, qualification: e.target.value })} placeholder="e.g. M.Ed Mathematics" className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm" />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Department</span>
              <select value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm"><option>Sciences</option><option>Languages</option><option>Arts</option><option>Commercial</option></select>
            </label>
          </div>
          <fieldset>
            <legend className="text-sm font-semibold text-slate-700 mb-1">Assign classes</legend>
            <div className="grid grid-cols-2 gap-2">{classes.map((c: ClassRecord) => <label key={c.id} className="flex items-center gap-2 text-sm p-2 rounded-xl border border-slate-200 bg-brand-background"><input type="checkbox" checked={form.class_ids.includes(c.id)} onChange={e => setForm({ ...form, class_ids: e.target.checked ? [...form.class_ids, c.id] : form.class_ids.filter(id => id !== c.id) })} /> {c.name} {c.section}</label>)}</div>
          </fieldset>
          <div className="p-3 rounded-xl bg-brand-light border border-brand-light text-xs text-brand">
            {USE_SUPABASE
              ? 'Creates a real Supabase login via the admin_create_account RPC. Only administrators can call it.'
              : 'Demo mode: the account is created locally so you can sign in as this teacher immediately.'}
          </div>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-200 font-semibold text-sm">Cancel</button>
          <button type="submit" disabled={submitting} className="px-6 py-2.5 rounded-xl bg-brand text-white font-semibold text-sm disabled:opacity-60 flex items-center gap-2">
            {submitting && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {submitting ? 'Creating…' : 'Add Teacher'}
          </button>
        </div>
      </form>
    </div>
  )
}

function AdminClasses() {
  const [data, setData] = useState(store.get())
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<ClassRecord | null>(null)
  const { show, ToastContainer } = useToast()
  useEffect(() => {
    const h = () => setData(store.get())
    window.addEventListener('smartschool:update', h as any)
    return () => window.removeEventListener('smartschool:update', h as any)
  }, [])
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-slate-600">{data.classes.length} classes • {data.students.length} students enrolled</div>
        <button onClick={() => setShowAdd(true)} className="px-5 py-2.5 rounded-xl bg-brand text-white font-semibold text-sm flex items-center gap-2"><Plus size={16} /> Create Class</button>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.classes.map(c => (
          <div key={c.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-brand to-brand-accent" />
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div><div className="text-lg font-extrabold text-slate-900">{c.name} <span className="text-brand">{c.section}</span></div><div className="text-xs text-slate-500">{c.level} • {c.session}</div></div>
                <span className="px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-semibold">{c.enrolled}/{c.capacity}</span>
              </div>
              <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-brand rounded-full" style={{ width: `${(c.enrolled / c.capacity) * 100}%` }} /></div>
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-600"><img src={data.teachers.find(t => t.full_name === c.teacher_name)?.avatar || 'https://i.pravatar.cc/150?img=12'} className="w-7 h-7 rounded-full" alt="" />{c.teacher_name}</div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => setEditing(c)} className="flex-1 py-2 rounded-xl border border-slate-200 text-sm font-semibold flex items-center justify-center gap-1"><Edit3 size={14} /> Edit</button>
                <button aria-label={`Delete class ${c.name} ${c.section}`} onClick={async () => {
                  if (!confirm(`Delete ${c.name} ${c.section}? Enrolled students will lose this class assignment.`)) return
                  try { await writes.deleteClass(c.id); show('Class deleted', 'success') }
                  catch (err: any) { show(err.message || 'Could not delete class', 'error') }
                }} className="px-3 py-2 rounded-xl border border-red-200 text-red-600 text-sm"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {(showAdd || editing) && <ClassForm initial={editing} teachers={data.teachers} onClose={() => { setShowAdd(false); setEditing(null) }} onSave={() => { setShowAdd(false); setEditing(null); show(editing ? 'Class updated' : 'Class created', 'success') }} />}
      <ToastContainer />
    </div>
  )
}

function ClassForm({ initial, teachers, onClose, onSave }: any) {
  const [form, setForm] = useState(initial || { name: 'JSS 1', section: 'C', level: 'Junior Secondary', teacher_id: teachers[0]?.id || '', teacher_name: teachers[0]?.full_name || '', capacity: 40, enrolled: 0, session: '2024/2025' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.section?.trim()) { setError('Section is required (e.g. A).'); return }
    const teacher = teachers.find((t: any) => t.id === form.teacher_id)
    setSubmitting(true)
    try {
      if (initial) {
        await writes.updateClass(initial.id, {
          name: form.name, section: form.section, level: form.level,
          capacity: Number(form.capacity) || 1,
          teacherId: form.teacher_id, teacherName: teacher?.full_name,
        })
      } else {
        await writes.createClass({
          name: form.name, section: form.section, level: form.level,
          capacity: Number(form.capacity) || 1,
          teacherId: form.teacher_id, teacherName: teacher?.full_name || '',
          session: form.session,
        })
      }
      onSave()
    } catch (err: any) {
      setError(err.message || 'Could not save this class.')
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <form onSubmit={submit} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b flex items-center justify-between"><h3 className="font-bold">{initial ? 'Edit Class' : 'Create Class'}</h3><button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X size={18} /></button></div>
        <div className="p-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-semibold">Class Name</label><select value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm"><option>JSS 1</option><option>JSS 2</option><option>JSS 3</option><option>SSS 1</option><option>SSS 2</option><option>SSS 3</option></select></div>
            <div><label className="text-sm font-semibold">Section</label><input value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm" placeholder="A" /></div>
          </div>
          <div><label className="text-sm font-semibold">Level</label><select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm"><option>Junior Secondary</option><option>Senior Secondary</option><option>Primary</option></select></div>
          <div><label className="text-sm font-semibold">Class Teacher</label><select value={form.teacher_id} onChange={e => { const t = teachers.find((x: any) => x.id === e.target.value); setForm({ ...form, teacher_id: e.target.value, teacher_name: t?.full_name || '' }) }} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm">{teachers.map((t: any) => <option key={t.id} value={t.id}>{t.full_name} — {t.department}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-semibold">Capacity</label><input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: parseInt(e.target.value) || 0 })} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm" /></div>
            <div><label className="text-sm font-semibold">Session</label><input value={form.session} onChange={e => setForm({ ...form, session: e.target.value })} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm" /></div>
          </div>
        </div>
        {error && <div role="alert" className="px-6 pb-2 text-sm text-red-700">{error}</div>}
        <div className="px-6 py-4 border-t flex justify-end gap-3"><button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold">Cancel</button><button type="submit" disabled={submitting} className="px-6 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold disabled:opacity-60">{submitting ? 'Saving…' : (initial ? 'Save' : 'Create Class')}</button></div>
      </form>
    </div>
  )
}

function AnnouncementsManager({ role }: { role: string }) {
  const [data, setData] = useState(store.get())
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<AnnouncementRecord | null>(null)
  const { user } = useAuth()
  const { show, ToastContainer } = useToast()
  useEffect(() => {
    const h = () => setData(store.get())
    window.addEventListener('smartschool:update', h as any)
    return () => window.removeEventListener('smartschool:update', h as any)
  }, [])
  const canManage = role === 'admin'
  const filtered = data.announcements.filter(a => role === 'admin' || a.target === 'all' || a.target === role)
  return (
    <div className="space-y-4">
      {canManage && <div className="flex justify-end"><button onClick={() => setShowAdd(true)} className="px-5 py-2.5 rounded-xl bg-brand text-white font-semibold text-sm flex items-center gap-2"><Plus size={16} /> New Announcement</button></div>}
      <div className="grid gap-4">
        {filtered.map(a => (
          <div key={a.id} className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900">{a.title}</h3>
                  {a.pinned && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">📌 Pinned</span>}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${a.target === 'all' ? 'bg-brand-light text-brand border-brand-light' : a.target === 'teacher' ? 'bg-brand-light text-brand border-brand-light' : a.target === 'parent' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-violet-50 text-violet-700 border-violet-100'}`}>{a.target}</span>
                </div>
                <p className="text-sm text-slate-600 mt-2 leading-6">{a.content}</p>
                <div className="text-xs text-slate-500 mt-3 flex items-center gap-2"><Clock size={12} /> {a.date} • by {a.author}</div>
              </div>
              {canManage && (
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setEditing(a)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-600"><Edit3 size={16} /></button>
                  <button aria-label="Delete announcement" onClick={async () => {
                    if (!confirm('Delete this announcement?')) return
                    try { await writes.deleteAnnouncement(a.id); show('Announcement deleted', 'success') }
                    catch (err: any) { show(err.message || 'Could not delete announcement', 'error') }
                  }} className="p-2 hover:bg-red-50 rounded-xl text-red-600"><Trash2 size={16} /></button>
                </div>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <EmptyState icon={Megaphone} title="No announcements" desc="Announcements for your role will appear here." />}
      </div>
      {(showAdd || editing) && <AnnouncementForm initial={editing} author={user?.full_name || 'Admin'} onClose={() => { setShowAdd(false); setEditing(null) }} onSave={() => { setShowAdd(false); setEditing(null); show(editing ? 'Announcement updated' : 'Announcement published', 'success') }} />}
      <ToastContainer />
    </div>
  )
}

function AnnouncementForm({ initial, author, onClose, onSave }: any) {
  const [form, setForm] = useState(initial || { title: '', content: '', target: 'all', pinned: false })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.title?.trim() || !form.content?.trim()) { setError('Title and content are both required.'); return }
    setSubmitting(true)
    try {
      if (initial) {
        await writes.updateAnnouncement(initial.id, {
          title: form.title, content: form.content, target: form.target, pinned: form.pinned,
        })
      } else {
        await writes.publishAnnouncement({
          title: form.title, content: form.content, author,
          target: form.target, pinned: form.pinned,
        })
      }
      onSave()
    } catch (err: any) {
      setError(err.message || 'Could not save this announcement.')
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <form onSubmit={submit} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b flex items-center justify-between"><h3 className="font-bold">{initial ? 'Edit Announcement' : 'New Announcement'}</h3><button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X size={18} /></button></div>
        <div className="p-6 space-y-3">
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Title" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-brand-background text-sm" required />
          <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Write announcement content..." rows={4} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-brand-background text-sm" required />
          <select value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm"><option value="all">All Roles</option><option value="teacher">Teachers Only</option><option value="parent">Parents Only</option><option value="student">Students Only</option></select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.pinned} onChange={e => setForm({ ...form, pinned: e.target.checked })} /> Pin this announcement</label>
        </div>
        {error && <div role="alert" className="px-6 pb-2 text-sm text-red-700">{error}</div>}
        <div className="px-6 py-4 border-t flex justify-end gap-3"><button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold">Cancel</button><button type="submit" disabled={submitting} className="px-6 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold disabled:opacity-60">{submitting ? 'Saving…' : (initial ? 'Save' : 'Publish')}</button></div>
      </form>
    </div>
  )
}

// ─── TEACHER PAGES ───
function TeacherOverview() {
  const { user } = useAuth()
  const data = store.get()
  const teacher = data.teachers.find(t => t.email === user?.email)
  const myClassIds = teacher?.class_ids || []
  const myClasses = data.classes.filter(c => myClassIds.includes(c.id))
  const myStudents = data.students.filter(s => myClassIds.includes(s.class_id))
  const myResults = data.results.filter(r => myStudents.some(s => s.id === r.student_id))
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard label="My Classes" value={myClasses.length} sub="Assigned" icon={School} color="bg-brand" />
        <StatCard label="My Students" value={myStudents.length} sub="Total across classes" icon={Users} color="bg-brand-accent" />
        <StatCard label="Results Entered" value={myResults.length} sub="This session" icon={Award} color="bg-emerald-500" />
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-900">My Assigned Classes</h3>
          <div className="mt-4 space-y-3">
            {myClasses.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-brand-background border border-slate-100">
                <div><div className="font-bold text-slate-900">{c.name} {c.section}</div><div className="text-xs text-slate-500">{c.enrolled} students • {c.session}</div></div>
                <span className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-xs font-semibold">{c.level}</span>
              </div>
            ))}
            {myClasses.length === 0 && <div className="text-sm text-slate-500">No classes assigned.</div>}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-900">Recent Results</h3>
          <div className="mt-4 space-y-2">
            {myResults.slice(0, 5).map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm p-2 rounded-xl hover:bg-slate-50">
                <div><span className="font-semibold text-slate-900">{r.student_name}</span> <span className="text-slate-500">• {r.subject}</span></div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${r.grade === 'A' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : r.grade === 'F' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-brand-light text-brand border-brand-light'}`}>{r.total} • {r.grade}</span>
              </div>
            ))}
            {myResults.length === 0 && <div className="text-sm text-slate-500">No results yet. Start entering scores.</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

function TeacherClasses() {
  const { user } = useAuth()
  const data = store.get()
  const teacher = data.teachers.find(t => t.email === user?.email)
  const myClassIds = teacher?.class_ids || []
  const myClasses = data.classes.filter(c => myClassIds.includes(c.id))
  const [selected, setSelected] = useState<string>(myClasses[0]?.id || '')
  const students = data.students.filter(s => s.class_id === selected)
  const selectedClass = data.classes.find(c => c.id === selected)
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-2">
        {myClasses.map(c => (
          <button key={c.id} onClick={() => setSelected(c.id)} className={`px-4 py-2 rounded-full text-sm font-semibold border ${selected === c.id ? 'bg-brand text-white border-brand' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>{c.name} {c.section}</button>
        ))}
        {myClasses.length === 0 && <span className="text-sm text-slate-500">No classes assigned.</span>}
      </div>
      {selectedClass && (
        <>
          <div className="bg-gradient-to-r from-brand to-brand-accent rounded-2xl p-5 text-white flex flex-wrap justify-between gap-4">
            <div><div className="text-lg font-bold">{selectedClass.name} {selectedClass.section}</div><div className="text-sm text-green-100">{selectedClass.level} • {selectedClass.session} • {students.length} students</div></div>
            <div className="text-right"><div className="text-2xl font-extrabold">{students.length}</div><div className="text-xs text-green-100">Enrolled</div></div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-brand-background text-xs font-bold tracking-widest uppercase text-slate-500"><tr><th className="text-left px-4 py-3">Student</th><th className="text-left px-4 py-3">Admission No</th><th className="text-left px-4 py-3">Gender</th><th className="text-left px-4 py-3">Contact</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50"><td className="px-4 py-3 flex items-center gap-3"><img src={s.avatar} className="w-8 h-8 rounded-full" alt="" /><span className="font-semibold text-slate-900">{s.full_name}</span></td><td className="px-4 py-3 font-mono text-xs">{s.admission_no}</td><td className="px-4 py-3">{s.gender}</td><td className="px-4 py-3 text-xs text-slate-600">{s.phone}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            {students.length === 0 && <div className="p-8 text-center text-sm text-slate-500">No students in this class.</div>}
          </div>
        </>
      )}
    </div>
  )
}

function TeacherResults() {
  const { user } = useAuth()
  const [data, setData] = useState(store.get())
  const [showAdd, setShowAdd] = useState(false)
  const [filterSubject, setFilterSubject] = useState('all')
  const { show, ToastContainer } = useToast()
  const teacher = data.teachers.find(t => t.email === user?.email)
  const myClassIds = teacher?.class_ids || []
  const myStudents = data.students.filter(s => myClassIds.includes(s.class_id))
  const myResults = data.results.filter(r => myStudents.some(s => s.id === r.student_id))

  useEffect(() => {
    const h = () => setData(store.get())
    window.addEventListener('smartschool:update', h as any)
    return () => window.removeEventListener('smartschool:update', h as any)
  }, [])

  const filtered = filterSubject === 'all' ? myResults : myResults.filter(r => r.subject === filterSubject)
  const subjects = [...new Set(myResults.map(r => r.subject))]

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 items-center">
          <Filter size={16} className="text-slate-400" />
          <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm">
            <option value="all">All Subjects</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className="text-xs text-slate-500">{filtered.length} records</span>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-5 py-2.5 rounded-xl bg-brand text-white font-semibold text-sm flex items-center gap-2"><Plus size={16} /> Enter Result</button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-background text-xs font-bold tracking-widest uppercase text-slate-500"><tr><th className="text-left px-4 py-3">Student</th><th className="text-left px-4 py-3">Subject</th><th className="text-left px-4 py-3">Term / Session</th><th className="text-center px-4 py-3">CA (30)</th><th className="text-center px-4 py-3">Exam (70)</th><th className="text-center px-4 py-3">Total</th><th className="text-center px-4 py-3">Grade</th><th className="text-right px-4 py-3">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">{r.student_name}</td>
                  <td className="px-4 py-3">{r.subject}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{r.term}<br /><span className="text-slate-400">{r.session}</span></td>
                  <td className="px-4 py-3 text-center">{r.ca_score}</td>
                  <td className="px-4 py-3 text-center">{r.exam_score}</td>
                  <td className="px-4 py-3 text-center font-bold">{r.total}</td>
                  <td className="px-4 py-3 text-center"><span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${r.grade === 'A' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : r.grade === 'F' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>{r.grade}</span></td>
                  <td className="px-4 py-3 text-right"><button aria-label={`Delete ${r.student_name}'s ${r.subject} result`} onClick={async () => {
                    if (!confirm(`Delete ${r.student_name}'s ${r.subject} result?`)) return
                    try { await writes.deleteResult(r.id); show('Result deleted', 'success') }
                    catch (err: any) { show(err.message || 'Could not delete result', 'error') }
                  }} className="p-1.5 hover:bg-red-50 rounded-lg text-red-600"><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="p-8 text-center text-sm text-slate-500">No results found. Click “Enter Result” to add.</div>}
      </div>

      {showAdd && <ResultForm myStudents={myStudents} onClose={() => setShowAdd(false)} onSave={() => { setShowAdd(false); show('Result saved successfully', 'success') }} />}
      <ToastContainer />
    </div>
  )
}

function ResultForm({ myStudents, onClose, onSave }: any) {
  const [form, setForm] = useState({ student_id: myStudents[0]?.id || '', subject: 'Mathematics', term: 'First Term', session: '2024/2025', ca_score: 0, exam_score: 0 })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const student = myStudents.find((s: any) => s.id === form.student_id)
  const total = Number(form.ca_score) + Number(form.exam_score)
  const grade = gradeFromTotal(total)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.student_id) { setError('Select a student'); return }
    if (form.ca_score < 0 || form.ca_score > 30) { setError('CA score must be 0-30'); return }
    if (form.exam_score < 0 || form.exam_score > 70) { setError('Exam score must be 0-70'); return }
    setSubmitting(true)
    try {
      await writes.saveResult({
        studentId: form.student_id,
        studentName: student?.full_name || '',
        subject: form.subject,
        term: form.term,
        session: form.session,
        ca: Number(form.ca_score),
        exam: Number(form.exam_score),
        total,
        grade,
      })
      onSave()
    } catch (err: any) {
      setError(err.message || 'Could not save this result.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <form onSubmit={submit} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b flex items-center justify-between"><h3 className="font-bold">Enter Student Result</h3><button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X size={18} /></button></div>
        <div className="p-6 space-y-3">
          {error && <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
          <div><label className="text-sm font-semibold">Student *</label><select value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm">{myStudents.map((s: StudentRecord) => <option key={s.id} value={s.id}>{s.full_name} — {s.class_name}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-semibold">Subject</label><select value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm"><option>Mathematics</option><option>English Language</option><option>Basic Science</option><option>Social Studies</option><option>Computer Studies</option><option>French</option><option>Creative Arts</option><option>Business Studies</option></select></div>
            <div><label className="text-sm font-semibold">Term</label><select value={form.term} onChange={e => setForm({ ...form, term: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm"><option>First Term</option><option>Second Term</option><option>Third Term</option></select></div>
          </div>
          <div><label className="text-sm font-semibold">Session</label><input value={form.session} onChange={e => setForm({ ...form, session: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-semibold">CA Score (0-30)</label><input type="number" value={form.ca_score} onChange={e => setForm({ ...form, ca_score: parseInt(e.target.value) || 0 })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm" min={0} max={30} /></div>
            <div><label className="text-sm font-semibold">Exam Score (0-70)</label><input type="number" value={form.exam_score} onChange={e => setForm({ ...form, exam_score: parseInt(e.target.value) || 0 })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm" min={0} max={70} /></div>
          </div>
          <div className="p-4 rounded-xl bg-brand-background border border-slate-200 flex items-center justify-between">
            <div><div className="text-xs font-bold tracking-widest uppercase text-slate-500">Total & Grade Preview</div><div className="text-sm text-slate-700 mt-1">CA {form.ca_score} + Exam {form.exam_score} = <strong>{total}</strong></div></div>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-extrabold text-lg ${grade === 'A' ? 'bg-emerald-500' : grade === 'F' ? 'bg-red-500' : 'bg-amber-500'}`}>{grade}</div>
          </div>
          <div className="text-xs text-slate-500">Duplicate prevention: same student + subject + term + session cannot be entered twice.</div>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3"><button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold">Cancel</button><button type="submit" disabled={submitting} className="px-6 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold disabled:opacity-60">{submitting ? 'Saving…' : 'Save Result'}</button></div>
      </form>
    </div>
  )
}

function TeacherAttendance() {
  const { user } = useAuth()
  const [data, setData] = useState(store.get())
  const [selectedClass, setSelectedClass] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [records, setRecords] = useState<Record<string, 'present' | 'absent' | 'late'>>({})
  const { show, ToastContainer } = useToast()

  const teacher = data.teachers.find(t => t.email === user?.email)
  const myClassIds = teacher?.class_ids || []
  const myClasses = data.classes.filter(c => myClassIds.includes(c.id))

  useEffect(() => { if (myClasses.length && !selectedClass) setSelectedClass(myClasses[0].id) }, [myClasses, selectedClass])
  useEffect(() => {
    const h = () => setData(store.get())
    window.addEventListener('smartschool:update', h as any)
    return () => window.removeEventListener('smartschool:update', h as any)
  }, [])

  const students = data.students.filter(s => s.class_id === selectedClass)
  const history = data.attendance.filter(a => a.class_id === selectedClass).slice(0, 10)

  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!students.length) return
    if (!selectedClass) { show('Select a class first', 'error'); return }
    setSubmitting(true)
    try {
      await writes.saveAttendance(selectedClass, date, students.map(s => ({
        studentId: s.id,
        studentName: s.full_name,
        status: (records[s.id] || 'present') as AttendanceStatus,
      })))
      show(`Attendance saved for ${date} — ${students.length} students`, 'success')
    } catch (err: any) {
      show(err.message || 'Could not save attendance', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
        <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold">
          {myClasses.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
        </select>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm" />
        <span className="text-xs text-slate-500">Mark each student, then Save</span>
        <button onClick={submit} disabled={submitting || !students.length} className="ml-auto px-6 py-2.5 rounded-xl bg-brand text-white font-semibold text-sm flex items-center gap-2 disabled:opacity-60">
          {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
          {submitting ? 'Saving…' : 'Save Attendance'}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b bg-brand-background text-sm font-bold text-slate-700 flex justify-between">
          <span>Students — {students.length}</span>
          <span className="text-xs font-normal text-slate-500">Present checks default to Present</span>
        </div>
        <div className="divide-y divide-slate-100">
          {students.map(s => (
            <div key={s.id} className="flex items-center justify-between px-5 py-3 gap-4">
              <div className="flex items-center gap-3"><img src={s.avatar} className="w-8 h-8 rounded-full" alt="" /><span className="font-semibold text-slate-900 text-sm">{s.full_name}</span><span className="text-xs text-slate-500 hidden sm:inline">{s.admission_no}</span></div>
              <div className="flex gap-1">
                {(['present', 'absent', 'late'] as const).map(status => (
                  <button key={status} onClick={() => setRecords({ ...records, [s.id]: status })} className={`px-3 py-1.5 rounded-full text-xs font-bold border capitalize ${(records[s.id] || 'present') === status ? (status === 'present' ? 'bg-emerald-500 text-white border-emerald-500' : status === 'absent' ? 'bg-red-500 text-white border-red-500' : 'bg-amber-500 text-white border-amber-500') : 'bg-white text-slate-600 border-slate-200'}`}>{status}</button>
                ))}
              </div>
            </div>
          ))}
          {students.length === 0 && <div className="p-8 text-center text-sm text-slate-500">No students in this class or no class selected.</div>}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-900">Recent Attendance Records</h3>
        <div className="mt-3 space-y-2">
          {history.map(h => (
            <div key={h.id} className="flex items-center justify-between text-sm p-2 rounded-xl hover:bg-slate-50">
              <span><strong>{h.student_name}</strong> • {h.date}</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${h.status === 'present' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : h.status === 'absent' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>{h.status}</span>
            </div>
          ))}
          {history.length === 0 && <div className="text-sm text-slate-500">No attendance yet for this class.</div>}
        </div>
      </div>
      <ToastContainer />
    </div>
  )
}

// ─── PARENT PAGES ───
function ParentOverview() {
  const { user } = useAuth()
  const data = store.get()
  const [selectedChildId, setSelectedChildId] = useState('')
  const myChildren = data.students.filter(s => s.parent_id === user?.id)
  const selectedChild = myChildren.find(c => c.id === selectedChildId) || myChildren[0]
  useEffect(() => { if (myChildren.length && !selectedChildId) setSelectedChildId(myChildren[0].id) }, [myChildren, selectedChildId])

  const results = selectedChild ? data.results.filter(r => r.student_id === selectedChild.id) : []
  const attendance = selectedChild ? data.attendance.filter(a => a.student_id === selectedChild.id) : []
  const avgTotal = results.length ? Math.round(results.reduce((a, b) => a + b.total, 0) / results.length) : 0
  const presentCount = attendance.filter(a => a.status === 'present').length
  const attendanceRate = attendance.length ? Math.round(presentCount / attendance.length * 100) : 0

  if (myChildren.length === 0) {
    return <EmptyState icon={Users} title="No linked children" desc="No students are linked to this parent account. Contact the administrator to link your children." />
  }

  return (
    <div className="space-y-6">
      {/* Child switcher */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="text-xs font-bold tracking-widest uppercase text-slate-500">My Children — Tap to Switch</div>
        <div className="flex gap-3 mt-3 overflow-x-auto pb-1">
          {myChildren.map(child => (
            <button key={child.id} onClick={() => setSelectedChildId(child.id)} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-left shrink-0 transition ${selectedChild?.id === child.id ? 'bg-brand text-white border-brand shadow-md' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
              <img src={child.avatar} className="w-10 h-10 rounded-full" alt="" />
              <div>
                <div className={`text-sm font-bold ${selectedChild?.id === child.id ? 'text-white' : 'text-slate-900'}`}>{child.full_name}</div>
                <div className={`text-xs ${selectedChild?.id === child.id ? 'text-green-100' : 'text-slate-500'}`}>{child.class_name} • {child.admission_no}</div>
              </div>
              {selectedChild?.id === child.id && <CheckCircle2 size={16} className="text-white ml-2" />}
            </button>
          ))}
        </div>
      </div>

      {selectedChild && (
        <>
          <div className="bg-gradient-to-r from-emerald-600 to-teal-500 rounded-2xl p-6 text-white flex flex-wrap gap-6 items-center">
            <img src={selectedChild.avatar} className="w-16 h-16 rounded-2xl border-2 border-white/30" alt="" />
            <div className="flex-1">
              <h2 className="text-xl font-extrabold">{selectedChild.full_name}</h2>
              <div className="text-sm text-emerald-50">{selectedChild.class_name} • {selectedChild.admission_no} • {selectedChild.gender}</div>
            </div>
            <div className="flex gap-3">
              <div className="bg-white/15 backdrop-blur rounded-xl px-4 py-3 text-center"><div className="text-2xl font-extrabold">{avgTotal || '—'}</div><div className="text-xs opacity-80">Avg Score</div></div>
              <div className="bg-white/15 backdrop-blur rounded-xl px-4 py-3 text-center"><div className="text-2xl font-extrabold">{attendanceRate}%</div><div className="text-xs opacity-80">Attendance</div></div>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <StatCard label="Subjects Recorded" value={results.length} sub={`${results.filter(r => r.grade === 'A').length} A's • GPA ${calculateGPA(results)}`} icon={BookMarked} color="bg-brand" />
            <StatCard label="Attendance Rate" value={`${attendanceRate}%`} sub={`${presentCount} of ${attendance.length} days present`} icon={UserCheck} color="bg-emerald-500" />
            <StatCard label="Overall Grade" value={avgTotal >= 75 ? 'Excellent' : avgTotal >= 65 ? 'Very Good' : avgTotal >= 50 ? 'Good' : avgTotal ? 'Pass' : '—'} sub={avgTotal ? `${avgTotal}/100 average` : 'No results yet'} icon={Award} color="bg-violet-500" />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="font-bold text-slate-900">Academic Results — {selectedChild.full_name}</h3>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs font-bold tracking-widest uppercase text-slate-500"><tr><th className="text-left py-2">Subject</th><th className="text-center py-2">CA</th><th className="text-center py-2">Exam</th><th className="text-center py-2">Total</th><th className="text-center py-2">Grade</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {results.map(r => (
                      <tr key={r.id}><td className="py-2 font-medium text-slate-900">{r.subject}</td><td className="py-2 text-center">{r.ca_score}</td><td className="py-2 text-center">{r.exam_score}</td><td className="py-2 text-center font-bold">{r.total}</td><td className="py-2 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.grade === 'A' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{r.grade}</span></td></tr>
                    ))}
                  </tbody>
                </table>
                {results.length === 0 && <div className="text-sm text-slate-500 py-6 text-center">No results published yet.</div>}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="font-bold text-slate-900">Attendance History</h3>
              <div className="mt-4 space-y-2 max-h-[260px] overflow-y-auto scrollbar-thin pr-1">
                {attendance.map(a => (
                  <div key={a.id} className="flex items-center justify-between text-sm p-2 rounded-xl hover:bg-slate-50">
                    <span className="text-slate-700">{a.date}</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${a.status === 'present' ? 'bg-emerald-50 text-emerald-700' : a.status === 'absent' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{a.status}</span>
                  </div>
                ))}
                {attendance.length === 0 && <div className="text-sm text-slate-500 py-6 text-center">No attendance records yet.</div>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function ParentResults() {
  const { user } = useAuth()
  const data = store.get()
  const myChildren = data.students.filter(s => s.parent_id === user?.id)
  const [childId, setChildId] = useState(myChildren[0]?.id || '')
  const results = data.results.filter(r => r.student_id === childId)
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
        <span className="text-sm font-semibold text-slate-700">Viewing results for:</span>
        <select value={childId} onChange={e => setChildId(e.target.value)} className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold">
          {myChildren.map(c => <option key={c.id} value={c.id}>{c.full_name} — {c.class_name}</option>)}
        </select>
        <span className="ml-auto text-xs text-slate-500">GPA: <strong className="text-slate-900">{calculateGPA(results)}</strong> • Avg: {results.length ? Math.round(results.reduce((a, b) => a + b.total, 0) / results.length) : '—'}</span>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-background text-xs font-bold tracking-widest uppercase text-slate-500"><tr><th className="text-left px-4 py-3">Subject</th><th className="text-left px-4 py-3">Term</th><th className="text-center px-4 py-3">CA</th><th className="text-center px-4 py-3">Exam</th><th className="text-center px-4 py-3">Total</th><th className="text-center px-4 py-3">Grade</th><th className="text-center px-4 py-3">Remark</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {results.map(r => (
                <tr key={r.id}><td className="px-4 py-3 font-semibold text-slate-900">{r.subject}</td><td className="px-4 py-3 text-xs">{r.term} • {r.session}</td><td className="px-4 py-3 text-center">{r.ca_score}</td><td className="px-4 py-3 text-center">{r.exam_score}</td><td className="px-4 py-3 text-center font-bold">{r.total}</td><td className="px-4 py-3 text-center"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${r.grade === 'A' ? 'bg-emerald-50 text-emerald-700' : r.grade === 'F' ? 'bg-red-50 text-red-700' : 'bg-brand-light text-brand'}`}>{r.grade}</span></td><td className="px-4 py-3 text-center text-xs text-slate-600">{r.grade === 'A' ? 'Excellent' : r.grade === 'B' ? 'Very Good' : r.grade === 'C' ? 'Good' : r.grade === 'D' ? 'Pass' : 'Fail'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {results.length === 0 && <div className="p-8 text-center text-sm text-slate-500">No results for this child yet.</div>}
      </div>
    </div>
  )
}

function ParentAttendance() {
  const { user } = useAuth()
  const data = store.get()
  const myChildren = data.students.filter(s => s.parent_id === user?.id)
  const [childId, setChildId] = useState(myChildren[0]?.id || '')
  const records = data.attendance.filter(a => a.student_id === childId)
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex gap-3 items-center flex-wrap">
        <select value={childId} onChange={e => setChildId(e.target.value)} className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold">{myChildren.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}</select>
        <span className="text-sm text-slate-600">{records.filter(r => r.status === 'present').length} present of {records.length} days</span>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="grid gap-2">
          {records.map(r => (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-brand-background">
              <div className="flex items-center gap-3"><CalendarDays size={16} className="text-slate-400" /><span className="text-sm font-medium text-slate-900">{r.date}</span></div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${r.status === 'present' ? 'bg-emerald-500 text-white' : r.status === 'absent' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'}`}>{r.status}</span>
            </div>
          ))}
          {records.length === 0 && <div className="p-8 text-center text-sm text-slate-500">No attendance records.</div>}
        </div>
      </div>
    </div>
  )
}

// ─── STUDENT PAGES ───
function StudentOverview() {
  const data = store.get()
  const me = useMyStudentRecord()
  if (!me) return <NoLinkedRecord />
  const results = data.results.filter(r => r.student_id === me.id)
  const attendance = data.attendance.filter(a => a.student_id === me.id)
  const avg = results.length ? Math.round(results.reduce((a, b) => a + b.total, 0) / results.length) : 0
  const gpa = calculateGPA(results)
  const presentRate = attendance.length ? Math.round(attendance.filter(a => a.status === 'present').length / attendance.length * 100) : 0

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-6 text-white flex flex-wrap gap-6 items-center">
        <img src={me.avatar} className="w-16 h-16 rounded-2xl border-2 border-white/20" alt="" />
        <div><h2 className="text-xl font-extrabold">{me.full_name}</h2><div className="text-violet-100 text-sm">{me.class_name} • {me.admission_no}</div></div>
        <div className="ml-auto flex gap-3">
          <div className="bg-white/15 rounded-xl px-4 py-2 text-center"><div className="text-xl font-extrabold">{avg || '—'}</div><div className="text-xs opacity-80">Average</div></div>
          <div className="bg-white/15 rounded-xl px-4 py-2 text-center"><div className="text-xl font-extrabold">{gpa || '—'}</div><div className="text-xs opacity-80">GPA</div></div>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard label="My GPA" value={gpa || '—'} sub={`${results.length} subjects recorded`} icon={TrendingUp} color="bg-violet-600" />
        <StatCard label="Attendance" value={`${presentRate}%`} sub={`${attendance.filter(a => a.status === 'present').length}/${attendance.length} days present`} icon={CalendarDays} color="bg-emerald-500" />
        <StatCard label="Class" value={me.class_name} sub={`${data.classes.find(c => c.id === me.class_id)?.teacher_name || ''}`} icon={School} color="bg-brand" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-900 flex items-center gap-2"><Award size={16} className="text-violet-600" /> My Results</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs font-bold tracking-widest uppercase text-slate-500"><tr><th className="text-left py-2">Subject</th><th className="text-center py-2">Total</th><th className="text-center py-2">Grade</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {results.map(r => (
                  <tr key={r.id}><td className="py-2 font-medium text-slate-900">{r.subject}</td><td className="py-2 text-center font-bold">{r.total}</td><td className="py-2 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.grade === 'A' ? 'bg-emerald-50 text-emerald-700' : r.grade === 'F' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{r.grade}</span></td></tr>
                ))}
              </tbody>
            </table>
            {results.length === 0 && <div className="text-sm text-slate-500 text-center py-6">Results will appear here once published by your teacher.</div>}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-900">My Profile</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-100"><span className="text-slate-500">Admission No</span><span className="font-mono font-semibold">{me.admission_no}</span></div>
            <div className="flex justify-between py-2 border-b border-slate-100"><span className="text-slate-500">Class</span><span className="font-semibold">{me.class_name}</span></div>
            <div className="flex justify-between py-2 border-b border-slate-100"><span className="text-slate-500">Gender</span><span>{me.gender}</span></div>
            <div className="flex justify-between py-2 border-b border-slate-100"><span className="text-slate-500">DOB</span><span>{me.dob}</span></div>
            <div className="flex justify-between py-2"><span className="text-slate-500">Address</span><span className="text-right max-w-[180px]">{me.address}</span></div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-900">Announcements for Students</h3>
        <div className="mt-3 space-y-3">
          {store.get().announcements.filter(a => a.target === 'all' || a.target === 'student').slice(0, 3).map(a => (
            <div key={a.id} className="p-4 rounded-xl bg-brand-background border border-slate-100">
              <div className="font-bold text-slate-900 text-sm">{a.title}</div>
              <div className="text-sm text-slate-600 mt-1">{a.content.slice(0, 140)}...</div>
              <div className="text-xs text-slate-500 mt-2">{a.date} • {a.author}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StudentResults() {
  const data = store.get()
  const me = useMyStudentRecord()
  if (!me) return <NoLinkedRecord />
  const results = data.results.filter(r => r.student_id === me.id)
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center justify-between">
        <div><div className="font-bold text-slate-900">Academic Report — {me.full_name}</div><div className="text-xs text-slate-500">{me.class_name} • {me.admission_no} • Session 2024/2025</div></div>
        <div className="text-right"><div className="text-sm font-bold text-slate-900">GPA: {calculateGPA(results)} • Avg: {results.length ? Math.round(results.reduce((a, b) => a + b.total, 0) / results.length) : '—'}/100</div><div className="text-xs text-slate-500">{results.filter(r => r.grade === 'A').length} distinctions</div></div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-background text-xs font-bold tracking-widest uppercase text-slate-500"><tr><th className="text-left px-4 py-3">Subject</th><th className="text-center px-4 py-3">CA (30)</th><th className="text-center px-4 py-3">Exam (70)</th><th className="text-center px-4 py-3">Total</th><th className="text-center px-4 py-3">Grade</th><th className="text-center px-4 py-3">Remark</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {results.map(r => (
                <tr key={r.id}><td className="px-4 py-3 font-semibold text-slate-900">{r.subject}</td><td className="px-4 py-3 text-center">{r.ca_score}</td><td className="px-4 py-3 text-center">{r.exam_score}</td><td className="px-4 py-3 text-center font-bold">{r.total}</td><td className="px-4 py-3 text-center"><span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${r.grade === 'A' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : r.grade === 'F' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>{r.grade}</span></td><td className="px-4 py-3 text-center text-xs">{r.grade === 'A' ? 'Excellent' : r.grade === 'B' ? 'Very Good' : r.grade === 'C' ? 'Good' : 'Pass'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {results.length === 0 && <div className="p-10 text-center text-sm text-slate-500">No results published yet. Check back after your teacher uploads scores.</div>}
      </div>
    </div>
  )
}

function StudentAttendance() {
  const data = store.get()
  const me = useMyStudentRecord()
  if (!me) return <NoLinkedRecord />
  const records = data.attendance.filter(a => a.student_id === me.id)
  const rate = records.length ? Math.round(records.filter(r => r.status === 'present').length / records.length * 100) : 0
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard label="Present" value={records.filter(r => r.status === 'present').length} sub={`${rate}% attendance rate`} icon={UserCheck} color="bg-emerald-500" />
        <StatCard label="Absent" value={records.filter(r => r.status === 'absent').length} sub="Unexcused" icon={X} color="bg-red-500" />
        <StatCard label="Late" value={records.filter(r => r.status === 'late').length} sub="Late arrivals" icon={Clock} color="bg-amber-500" />
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="grid gap-2">
          {records.map(r => (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-brand-background">
              <span className="text-sm font-medium text-slate-900">{r.date}</span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${r.status === 'present' ? 'bg-emerald-500 text-white' : r.status === 'absent' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'}`}>{r.status}</span>
            </div>
          ))}
          {records.length === 0 && <div className="p-8 text-center text-sm text-slate-500">No attendance records yet.</div>}
        </div>
      </div>
    </div>
  )
}

function StudentTimetable() {
  const me = useMyStudentRecord()
  if (!me) return <NoLinkedRecord />
  // Only this student's own class timetable — never another class's.
  const entries = timetableData[me.class_id] ?? []
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-5 text-white flex flex-wrap justify-between gap-4">
        <div><div className="font-bold">Weekly Timetable</div><div className="text-sm text-violet-100">{me.class_name} • Academic Session 2024/2025</div></div>
        <div className="px-3 py-1.5 rounded-full bg-white/15 text-sm font-semibold">Mon – Fri • 8:00 AM – 2:00 PM</div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-background text-xs font-bold tracking-widest uppercase text-slate-500"><tr><th className="text-left px-4 py-3">Day</th><th className="text-left px-4 py-3">Time</th><th className="text-left px-4 py-3">Subject</th><th className="text-left px-4 py-3">Teacher</th><th className="text-left px-4 py-3">Room</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((e, i) => (
                <tr key={i} className="hover:bg-slate-50"><td className="px-4 py-3 font-semibold text-slate-900">{e.day}</td><td className="px-4 py-3 font-mono text-xs">{e.time}</td><td className="px-4 py-3"><span className="px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 text-xs font-semibold border border-violet-100">{e.subject}</span></td><td className="px-4 py-3 text-xs text-slate-600">{e.teacher}</td><td className="px-4 py-3 text-xs">{e.room}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h4 className="font-bold text-slate-900">By Day</h4>
        <div className="grid md:grid-cols-5 gap-3 mt-3">
          {days.map(day => (
            <div key={day} className="rounded-xl bg-brand-background border border-slate-100 p-3">
              <div className="text-xs font-bold tracking-widest uppercase text-brand">{day}</div>
              <div className="mt-2 space-y-1">
                {entries.filter(e => e.day === day).map((e, i) => (
                  <div key={i} className="text-xs"><span className="font-semibold text-slate-900">{e.subject}</span> <span className="text-slate-500">• {e.time}</span></div>
                ))}
                {entries.filter(e => e.day === day).length === 0 && <div className="text-xs text-slate-400">No classes</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StudentReportCard() {
  const me = useMyStudentRecord()
  if (!me) return <NoLinkedRecord />
  const data = store.get()
  const results = data.results.filter(r => r.student_id === me.id)
  const attendance = data.attendance.filter(a => a.student_id === me.id)
  const cls = data.classes.find(c => c.id === me.class_id)
  const [term, setTerm] = useState('First Term')

  return (
    <div className="space-y-4">
      <div className="no-print bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          Term
          <select value={term} onChange={e => setTerm(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm">
            <option>First Term</option><option>Second Term</option><option>Third Term</option><option>All Terms</option>
          </select>
        </label>
        <span className="text-xs text-slate-500">{results.filter(r => term === 'All Terms' || r.term === term).length} subjects on this report</span>
      </div>
      <ReportCard
        student={me}
        results={results}
        attendance={attendance}
        term={term}
        session="2024/2025"
        teacherName={cls?.teacher_name}
      />
    </div>
  )
}

// ─── AUTH GUARD ───
function RequireAuth({ allowed, children }: { allowed: string[]; children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-brand-background"><div className="w-10 h-10 border-3 border-slate-200 border-t-brand rounded-full animate-spin" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (!allowed.includes(user.role)) {
    const dest: Record<string, string> = { admin: '/admin', teacher: '/teacher', parent: '/parent', student: '/student' }
    return <Navigate to={dest[user.role] || '/login'} replace />
  }
  return <>{children}</>
}

function RoleRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-slate-200 border-t-brand rounded-full animate-spin" /></div>
  if (!user) return <Navigate to="/login" replace />
  const dest: Record<string, string> = { admin: '/admin', teacher: '/teacher', parent: '/parent', student: '/student' }
  return <Navigate to={dest[user.role] || '/login'} replace />
}

// ─── APP ROUTER ───
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<RoleRedirect />} />

          {/* Admin */}
          <Route path="/admin" element={<RequireAuth allowed={['admin']}><DashboardShell role="admin" title="Admin Dashboard" subtitle="Complete school overview and management"><AdminOverview /></DashboardShell></RequireAuth>} />
          <Route path="/admin/students" element={<RequireAuth allowed={['admin']}><DashboardShell role="admin" title="Student Management" subtitle="Register, search and manage student records"><AdminStudents /></DashboardShell></RequireAuth>} />
          <Route path="/admin/teachers" element={<RequireAuth allowed={['admin']}><DashboardShell role="admin" title="Teacher Management" subtitle="Staff directory and class assignments"><AdminTeachers /></DashboardShell></RequireAuth>} />
          <Route path="/admin/classes" element={<RequireAuth allowed={['admin']}><DashboardShell role="admin" title="Class Management" subtitle="Create and organize classes"><AdminClasses /></DashboardShell></RequireAuth>} />
          <Route path="/admin/announcements" element={<RequireAuth allowed={['admin']}><DashboardShell role="admin" title="Announcements" subtitle="Publish school-wide updates"><AnnouncementsManager role="admin" /></DashboardShell></RequireAuth>} />

          {/* Teacher */}
          <Route path="/teacher" element={<RequireAuth allowed={['teacher']}><DashboardShell role="teacher" title="Teacher Dashboard" subtitle="Your classes and academic tools"><TeacherOverview /></DashboardShell></RequireAuth>} />
          <Route path="/teacher/classes" element={<RequireAuth allowed={['teacher']}><DashboardShell role="teacher" title="My Classes" subtitle="Students in your assigned classes"><TeacherClasses /></DashboardShell></RequireAuth>} />
          <Route path="/teacher/results" element={<RequireAuth allowed={['teacher']}><DashboardShell role="teacher" title="Results Management" subtitle="Enter and manage student scores"><TeacherResults /></DashboardShell></RequireAuth>} />
          <Route path="/teacher/attendance" element={<RequireAuth allowed={['teacher']}><DashboardShell role="teacher" title="Attendance" subtitle="Mark daily attendance"><TeacherAttendance /></DashboardShell></RequireAuth>} />
          <Route path="/teacher/announcements" element={<RequireAuth allowed={['teacher']}><DashboardShell role="teacher" title="Announcements" subtitle="School announcements for teachers"><AnnouncementsManager role="teacher" /></DashboardShell></RequireAuth>} />

          {/* Parent */}
          <Route path="/parent" element={<RequireAuth allowed={['parent']}><DashboardShell role="parent" title="Parent Dashboard" subtitle="Your children's academic overview"><ParentOverview /></DashboardShell></RequireAuth>} />
          <Route path="/parent/results" element={<RequireAuth allowed={['parent']}><DashboardShell role="parent" title="Academic Results" subtitle="Detailed report cards"><ParentResults /></DashboardShell></RequireAuth>} />
          <Route path="/parent/attendance" element={<RequireAuth allowed={['parent']}><DashboardShell role="parent" title="Attendance Records" subtitle="Daily presence history"><ParentAttendance /></DashboardShell></RequireAuth>} />
          <Route path="/parent/announcements" element={<RequireAuth allowed={['parent']}><DashboardShell role="parent" title="School Announcements" subtitle="Updates from administration"><AnnouncementsManager role="parent" /></DashboardShell></RequireAuth>} />

          {/* Student */}
          <Route path="/student" element={<RequireAuth allowed={['student']}><DashboardShell role="student" title="Student Dashboard" subtitle="Your academic journey"><StudentOverview /></DashboardShell></RequireAuth>} />
          <Route path="/student/results" element={<RequireAuth allowed={['student']}><DashboardShell role="student" title="My Results" subtitle="Academic performance history"><StudentResults /></DashboardShell></RequireAuth>} />
          <Route path="/student/attendance" element={<RequireAuth allowed={['student']}><DashboardShell role="student" title="My Attendance" subtitle="Your presence record"><StudentAttendance /></DashboardShell></RequireAuth>} />
          <Route path="/student/timetable" element={<RequireAuth allowed={['student']}><DashboardShell role="student" title="Weekly Timetable" subtitle="Your class schedule"><StudentTimetable /></DashboardShell></RequireAuth>} />
          <Route path="/student/announcements" element={<RequireAuth allowed={['student']}><DashboardShell role="student" title="Announcements" subtitle="School news and updates"><AnnouncementsManager role="student" /></DashboardShell></RequireAuth>} />
          <Route path="/student/report" element={<RequireAuth allowed={['student']}><DashboardShell role="student" title="Report Card" subtitle="Printable terminal report"><StudentReportCard /></DashboardShell></RequireAuth>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
