import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'

function trAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-posta veya şifre hatalı.'
  if (m.includes('email not confirmed'))
    return 'E-posta adresiniz henüz doğrulanmamış. Gelen kutunuzdaki bağlantıya tıklayın.'
  if (m.includes('user already registered')) return 'Bu e-posta ile zaten bir hesap var.'
  if (m.includes('password should be at least')) return 'Şifre en az 6 karakter olmalıdır.'
  if (m.includes('rate limit')) return 'Çok fazla deneme yapıldı, lütfen biraz bekleyin.'
  return `İşlem başarısız: ${message}`
}

export default function LoginPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState<'giris' | 'kayit'>('giris')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [fullName, setFullName] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState<string | null>(null)

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) toast('error', trAuthError(error.message))
  }

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) return toast('error', 'Lütfen ad soyad girin.')
    if (password.length < 6) return toast('error', 'Şifre en az 6 karakter olmalıdır.')
    if (password !== password2) return toast('error', 'Şifreler birbiriyle aynı değil.')
    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    })
    setBusy(false)
    if (error) return toast('error', trAuthError(error.message))
    if (!data.session) {
      setInfo(
        'Kayıt alındı! E-posta adresinize doğrulama bağlantısı gönderildi. Bağlantıya tıkladıktan sonra giriş yapabilirsiniz.',
      )
      setTab('giris')
    }
  }

  const handleForgot = async () => {
    if (!email.trim()) return toast('error', 'Önce e-posta adresinizi yazın.')
    setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + window.location.pathname,
    })
    setBusy(false)
    if (error) return toast('error', trAuthError(error.message))
    toast('success', 'Şifre sıfırlama bağlantısı e-postanıza gönderildi.')
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-5xl" aria-hidden>
            🏢
          </div>
          <h1 className="mt-2 text-2xl font-bold">Safir Sitesi</h1>
          <p className="text-sm text-slate-500">Aidat ve Masraf Takip Paneli</p>
        </div>

        <div className="card">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            {(['giris', 'kayit'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-md py-2 text-sm font-semibold transition ${
                  tab === t ? 'bg-white shadow' : 'text-slate-500'
                }`}
              >
                {t === 'giris' ? 'Giriş Yap' : 'Kayıt Ol'}
              </button>
            ))}
          </div>

          {info && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              {info}
            </div>
          )}

          {tab === 'giris' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="label" htmlFor="email">
                  E-posta
                </label>
                <input
                  id="email"
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="label" htmlFor="password">
                  Şifre
                </label>
                <input
                  id="password"
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <button type="submit" className="btn btn-primary w-full" disabled={busy}>
                {busy ? 'Giriş yapılıyor…' : 'Giriş Yap'}
              </button>
              <button
                type="button"
                onClick={() => void handleForgot()}
                className="block w-full text-center text-sm text-sky-700 hover:underline"
                disabled={busy}
              >
                Şifremi unuttum
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="label" htmlFor="fullName">
                  Ad Soyad
                </label>
                <input
                  id="fullName"
                  className="input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="remail">
                  E-posta
                </label>
                <input
                  id="remail"
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="label" htmlFor="rpassword">
                  Şifre (en az 6 karakter)
                </label>
                <input
                  id="rpassword"
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="label" htmlFor="rpassword2">
                  Şifre (tekrar)
                </label>
                <input
                  id="rpassword2"
                  type="password"
                  className="input"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <button type="submit" className="btn btn-primary w-full" disabled={busy}>
                {busy ? 'Kayıt yapılıyor…' : 'Kayıt Ol'}
              </button>
              <p className="text-xs text-slate-500">
                Kayıt olduktan sonra hesabınız, Yönetici tarafından rol atanana kadar onay bekler.
                Sisteme ilk kayıt olan kullanıcı otomatik olarak Yönetici olur.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
