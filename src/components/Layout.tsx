import { useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLE_LABELS, isFullAccess } from '../lib/roles'

interface NavItem {
  to: string
  label: string
  emoji: string
}

const NAV_FULL: NavItem[] = [
  { to: '/', label: 'Özet', emoji: '📊' },
  { to: '/sakinler', label: 'Sakinler', emoji: '🏠' },
  { to: '/aidat', label: 'Aidat Takibi', emoji: '💰' },
  { to: '/masraflar', label: 'Masraflar', emoji: '🧾' },
  { to: '/ayarlar', label: 'Ayarlar', emoji: '⚙️' },
  { to: '/kullanicilar', label: 'Kullanıcılar', emoji: '👥' },
]

const NAV_MUHASEBECI: NavItem[] = [{ to: '/muhasebe', label: 'Muhasebe', emoji: '📑' }]

export default function Layout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const items = isFullAccess(profile?.role) ? NAV_FULL : NAV_MUHASEBECI

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              isActive ? 'bg-sky-700 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`
          }
        >
          <span aria-hidden>{item.emoji}</span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  )

  const userBox = (
    <div className="border-t border-slate-800 p-3">
      <div className="mb-2 px-1">
        <div className="truncate text-sm font-semibold text-white">
          {profile?.full_name || profile?.email}
        </div>
        <div className="text-xs text-slate-400">{profile ? ROLE_LABELS[profile.role] : ''}</div>
      </div>
      <button
        type="button"
        onClick={() => void signOut()}
        className="btn w-full border border-slate-700 text-slate-300 hover:bg-slate-800"
      >
        🚪 Çıkış Yap
      </button>
    </div>
  )

  return (
    <div className="min-h-screen">
      {/* Mobil üst çubuk */}
      <header className="sticky top-0 z-40 flex items-center justify-between bg-slate-900 px-4 py-3 text-white shadow md:hidden">
        <div className="flex items-center gap-2 font-bold">
          <span aria-hidden>🏢</span> Safir Sitesi
        </div>
        <button
          type="button"
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm"
          onClick={() => setOpen(!open)}
          aria-label="Menüyü aç/kapat"
        >
          ☰ Menü
        </button>
      </header>

      {/* Mobil çekmece */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/60" />
          <aside
            className="absolute top-0 left-0 flex h-full w-72 flex-col bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 text-white">
              <span className="flex items-center gap-2 font-bold">
                <span aria-hidden>🏢</span> Safir Sitesi
              </span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Kapat">
                ✕
              </button>
            </div>
            {nav}
            {userBox}
          </aside>
        </div>
      )}

      {/* Masaüstü kenar çubuğu */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-slate-900 md:flex">
        <div className="flex items-center gap-2 p-5 text-lg font-bold text-white">
          <span aria-hidden>🏢</span> Safir Sitesi
        </div>
        {nav}
        {userBox}
      </aside>

      <main className="p-4 sm:p-6 md:ml-64">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  )
}
