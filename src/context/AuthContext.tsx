import React, { createContext, useContext, useEffect, useState } from 'react'
import { store, type AppUser } from '../lib/store'
import { USE_SUPABASE, auth as sbAuth } from '../lib/supabaseService'
import { dataSource } from '../lib/dataSource'
import { supabase as sbAuthClient } from '../lib/supabase'

interface AuthContextType {
  user: AppUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<AppUser>
  logout: () => void
  resetPassword: (email: string) => Promise<void>
  isAuthenticated: boolean
  mode: 'supabase' | 'demo'
}

const AuthContext = createContext<AuthContextType>(null!)

export const useAuth = () => useContext(AuthContext)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function boot() {
      if (USE_SUPABASE) {
        // ── LIVE MODE: Supabase Auth owns the session ──────────────────────
        try {
          const profile = await sbAuth.session()
          if (cancelled) return
          if (profile) {
            setUser({
              id: profile.id,
              email: profile.email,
              password: '',
              role: profile.role,
              full_name: profile.full_name,
              avatar: profile.avatar_url ?? `https://i.pravatar.cc/150?u=${profile.id}`,
            })
          }
        } catch (err) {
          console.error('[SmartSchool] session restore failed:', err)
        }

        // Keep the role in sync with auth state changes (login/logout/refresh).
        const { data: sub } = sbAuthClient.auth.onAuthStateChange((_event, session) => {
          if (!session?.user) { setUser(null); return }
          // Profile (and therefore role) is re-read so a client can never
          // hold a stale, self-asserted role.
          sbAuth.session().then(p => {
            if (p && !cancelled) {
              setUser({
                id: p.id, email: p.email, password: '',
                role: p.role, full_name: p.full_name,
                avatar: p.avatar_url ?? `https://i.pravatar.cc/150?u=${p.id}`,
              })
            }
          })
        })
        if (cancelled) sub.subscription.unsubscribe()

        // Populate the read cache from the real database.
        await dataSource.hydrate()
        if (cancelled) return
        setLoading(false)
        return
      }

      // ── DEMO MODE: restore the last demo session from localStorage ───────
      const saved = localStorage.getItem('smartschool_session')
      if (saved && !cancelled) {
        try {
          const parsed = JSON.parse(saved)
          const found = store.get().users.find(u => u.id === parsed.id)
          if (found) setUser(found)
          else localStorage.removeItem('smartschool_session')
        } catch {
          localStorage.removeItem('smartschool_session')
        }
      }
      if (!cancelled) setLoading(false)
    }

    boot()
    return () => { cancelled = true }
  }, [])

  const login = async (email: string, password: string): Promise<AppUser> => {
    if (USE_SUPABASE) {
      const profile = await sbAuth.signIn(email, password)
      const appUser: AppUser = {
        id: profile.id,
        email: profile.email,
        password: '',
        role: profile.role,
        full_name: profile.full_name,
        avatar: profile.avatar_url ?? `https://i.pravatar.cc/150?u=${profile.id}`,
      }
      setUser(appUser)
      // Re-hydrate: RLS now scopes every query to this user's role.
      await dataSource.refresh()
      return appUser
    }

    await new Promise(r => setTimeout(r, 500))
    const found = store.get().users.find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    )
    if (!found) {
      throw new Error('Invalid email or password. Please check your credentials and try again.')
    }
    setUser(found)
    localStorage.setItem('smartschool_session', JSON.stringify(found))
    return found
  }

  const logout = async () => {
    if (USE_SUPABASE) {
      try { await sbAuth.signOut() } catch (err) { console.error('sign out failed:', err) }
      setUser(null)
      return
    }
    setUser(null)
    localStorage.removeItem('smartschool_session')
  }

  const resetPassword = async (email: string) => {
    if (USE_SUPABASE) {
      await sbAuth.resetPassword(email)
      return
    }
    throw new Error(
      'Password reset needs a live Supabase connection. ' +
      'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file, ' +
      'then restart the dev server.'
    )
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout: () => { void logout() },
        resetPassword,
        isAuthenticated: !!user,
        mode: USE_SUPABASE ? 'supabase' : 'demo',
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
