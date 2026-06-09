import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'

export default function ResetPasswordPage() {
  const { clearRecovery } = useAuth()
  const { toast } = useToast()
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 6) return toast('error', 'Şifre en az 6 karakter olmalıdır.')
    if (password !== password2) return toast('error', 'Şifreler birbiriyle aynı değil.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return toast('error', `Şifre güncellenemedi: ${error.message}`)
    toast('success', 'Şifreniz güncellendi.')
    clearRecovery()
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <h1 className="mb-4 text-xl font-bold">🔑 Yeni Şifre Belirle</h1>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="np1">
              Yeni şifre
            </label>
            <input
              id="np1"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="np2">
              Yeni şifre (tekrar)
            </label>
            <input
              id="np2"
              type="password"
              className="input"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? 'Kaydediliyor…' : 'Şifreyi Kaydet'}
          </button>
        </form>
      </div>
    </div>
  )
}
