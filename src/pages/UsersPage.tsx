import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useInvalidate, useProfiles } from '../hooks/useData'
import type { ProfileRow } from '../hooks/useData'
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '../lib/roles'
import type { Role } from '../lib/roles'
import { formatDateTR } from '../lib/dates'
import { useToast } from '../components/Toast'

const ASSIGNABLE_ROLES: Role[] = ['admin', 'sayman', 'muhasebeci', 'pending']

export default function UsersPage() {
  const { toast } = useToast()
  const invalidate = useInvalidate()
  const profiles = useProfiles()
  const { profile: me } = useAuth()

  const changeRole = async (p: ProfileRow, role: Role) => {
    if (role === p.role) return
    const name = p.full_name || p.email
    if (
      !window.confirm(
        `${name} kullanıcısının rolü "${ROLE_LABELS[role]}" olarak değiştirilsin mi?`,
      )
    ) {
      invalidate('profiles') // select eski değerine dönsün
      return
    }
    const { error } = await supabase.from('profiles').update({ role }).eq('id', p.id)
    if (error) {
      toast('error', error.message)
      invalidate('profiles')
      return
    }
    toast('success', `${name} artık "${ROLE_LABELS[role]}".`)
    invalidate('profiles')
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">👥 Kullanıcılar</h1>
        <p className="text-sm text-slate-500">
          Yeni kayıt olan kullanıcılar "Onay Bekliyor" durumundadır; rol atandığında panele erişir.
        </p>
      </div>

      <div className="card overflow-x-auto !p-0">
        <table className="w-full min-w-[640px]">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="th">Ad Soyad</th>
              <th className="th">E-posta</th>
              <th className="th">Kayıt Tarihi</th>
              <th className="th">Rol</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {profiles.isLoading ? (
              <tr>
                <td className="td text-slate-500" colSpan={4}>
                  Yükleniyor…
                </td>
              </tr>
            ) : (profiles.data ?? []).length === 0 ? (
              <tr>
                <td className="td text-slate-500" colSpan={4}>
                  Kayıtlı kullanıcı yok.
                </td>
              </tr>
            ) : (
              (profiles.data ?? []).map((p) => (
                <tr key={p.id} className={p.role === 'pending' ? 'bg-amber-50' : ''}>
                  <td className="td font-medium">
                    {p.full_name || '—'}
                    {p.id === me?.id && (
                      <span className="badge ml-2 bg-sky-100 text-sky-800">Siz</span>
                    )}
                  </td>
                  <td className="td">{p.email}</td>
                  <td className="td whitespace-nowrap">{formatDateTR(p.created_at.slice(0, 10))}</td>
                  <td className="td">
                    <select
                      className="input !w-44"
                      value={p.role}
                      disabled={p.id === me?.id}
                      onChange={(e) => void changeRole(p, e.target.value as Role)}
                      aria-label={`${p.email} rolü`}
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                    {p.id === me?.id && (
                      <div className="mt-1 text-xs text-slate-500">Kendi rolünüzü değiştiremezsiniz.</div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 className="mb-2 font-bold">Rol Yetkileri</h2>
        <ul className="space-y-2 text-sm">
          {ASSIGNABLE_ROLES.map((r) => (
            <li key={r} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <span className="badge w-fit bg-slate-200 text-slate-800">{ROLE_LABELS[r]}</span>
              <span className="text-slate-600">{ROLE_DESCRIPTIONS[r]}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          Not: Sistem, son Yöneticinin rolünün düşürülmesini veya silinmesini engeller. Bir
          kullanıcıyı tamamen silmek için Supabase Dashboard → Authentication → Users kullanılır.
        </p>
      </div>
    </div>
  )
}
