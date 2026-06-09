// Tarih yardımcıları: tüm tarihler 'YYYY-MM-DD' biçiminde string olarak taşınır,
// gün farkları UTC üzerinden hesaplanır (yaz saati kaymalarından etkilenmez).

export interface YM {
  year: number
  month: number // 1-12
}

export const TR_MONTHS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
]

const pad = (n: number) => String(n).padStart(2, '0')

export function ymKey(ym: { year: number; month: number }): number {
  return ym.year * 12 + (ym.month - 1)
}

export function ymFromKey(key: number): YM {
  return { year: Math.floor(key / 12), month: (key % 12) + 1 }
}

export function cmpYM(a: YM, b: YM): number {
  return ymKey(a) - ymKey(b)
}

export function addMonths(ym: YM, n: number): YM {
  return ymFromKey(ymKey(ym) + n)
}

export function currentYM(now = new Date()): YM {
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function dateStr(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`
}

export function todayStr(now = new Date()): string {
  return dateStr(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

export function parseDateStr(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number)
  return { y, m, d }
}

export function isValidDateStr(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const { y, m, d } = parseDateStr(s)
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m)
}

function toUTCms(s: string): number {
  const { y, m, d } = parseDateStr(s)
  return Date.UTC(y, m - 1, d)
}

/** b - a gün cinsinden (a'dan b'ye kaç gün). */
export function diffDays(a: string, b: string): number {
  return Math.round((toUTCms(b) - toUTCms(a)) / 86_400_000)
}

export function addDaysStr(s: string, days: number): string {
  const t = new Date(toUTCms(s) + days * 86_400_000)
  return dateStr(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}

export function formatDateTR(s: string): string {
  const { y, m, d } = parseDateStr(s)
  return `${pad(d)}.${pad(m)}.${y}`
}

export function monthLabel(ym: YM): string {
  return `${TR_MONTHS[ym.month - 1]} ${ym.year}`
}

/** start..end (her ikisi dahil) aralığındaki ayları döndürür. */
export function monthsFrom(start: YM, end: YM, cap = 240): YM[] {
  const out: YM[] = []
  const startKey = ymKey(start)
  const endKey = ymKey(end)
  for (let k = startKey; k <= endKey && out.length < cap; k++) {
    out.push(ymFromKey(k))
  }
  return out
}
