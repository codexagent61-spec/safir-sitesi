import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Role } from '../lib/roles'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: Role
}

export type AuthStatus = 'loading' | 'ready' | 'schema-missing' | 'profile-missing'

interface AuthState {
  session: Session | null
  profile: Profile | null
  status: AuthStatus
  recovery: boolean
  clearRecovery: () => void
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

function isSchemaMissing(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    (error.message ?? '').includes('schema cache')
  )
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [recovery, setRecovery] = useState(false)

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null)
      setStatus('ready')
      return
    }
    setStatus('loading')
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', s.user.id)
      .maybeSingle()
    if (error) {
      setProfile(null)
      setStatus(isSchemaMissing(error) ? 'schema-missing' : 'profile-missing')
      return
    }
    if (!data) {
      setProfile(null)
      setStatus('profile-missing')
      return
    }
    setProfile(data as Profile)
    setStatus('ready')
  }, [])

  useEffect(() => {
    let active = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      void loadProfile(data.session)
    })

    // Not: onAuthStateChange callback'i içinde doğrudan await kullanmak
    // supabase-js kilidini bekletebilir; bu yüzden setTimeout ile erteliyoruz.
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(s)
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        setTimeout(() => {
          if (active) void loadProfile(s)
        }, 0)
      }
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    await loadProfile(data.session)
  }, [loadProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const clearRecovery = useCallback(() => setRecovery(false), [])

  return (
    <AuthContext.Provider
      value={{ session, profile, status, recovery, clearRecovery, refreshProfile, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalıdır')
  return ctx
}
