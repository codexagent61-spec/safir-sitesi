// Rol tabanlı erişim tanımları. Bu kontroller arayüz içindir;
// asıl güvenlik Supabase RLS politikalarında ikinci kez uygulanır.

export type Role = 'admin' | 'sayman' | 'muhasebeci' | 'pending'

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Yönetici',
  sayman: 'Sayman',
  muhasebeci: 'Muhasebeci',
  pending: 'Onay Bekliyor',
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: 'Tüm modüllere tam erişim (sakinler, aidat, masraf, ayarlar, kullanıcılar).',
  sayman: 'Yönetici ile aynı yetkilere sahiptir.',
  muhasebeci:
    'Sadece dönem seçip masraf kayıtlarını Excel olarak indirir ve o ayın toplam aidat gelirini görür.',
  pending: 'Henüz yetki verilmedi; Yönetici rol atayana kadar hiçbir veriye erişemez.',
}

export function isFullAccess(role: Role | null | undefined): boolean {
  return role === 'admin' || role === 'sayman'
}

const FULL_PATHS = ['/', '/sakinler', '/aidat', '/masraflar', '/ayarlar', '/kullanicilar', '/muhasebe']

export function canAccessPath(role: Role, path: string): boolean {
  if (role === 'pending') return false
  if (isFullAccess(role)) return FULL_PATHS.includes(path)
  if (role === 'muhasebeci') return path === '/muhasebe'
  return false
}

export function homePathFor(role: Role): string {
  return role === 'muhasebeci' ? '/muhasebe' : '/'
}
