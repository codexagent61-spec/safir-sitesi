// Aidat tahakkuku ve gecikme faizi motoru.
//
// Kurallar:
//  - Her dönemin (yıl/ay) aidat tutarı, o döneme "yürürlük tarihi" en yakın ve
//    ondan büyük olmayan tarifeden alınır (giriş kat / normal ayrımıyla).
//  - Son ödeme günü ayarlardan gelir; kısa aylarda ayın son gününe kıstırılır
//    (örn. 31 → 28 Şubat).
//  - Gecikme faizi, son ödeme gününden SONRAKİ günden itibaren, kalan anapara
//    üzerinden günlük işler. Günlük oran = aylık oran / 30 (kıst esası).
//    Takvim ayı değiştiğinde o ay için geçerli oran kullanılır.
//  - Ödemeler önce birikmiş faize, sonra anaparaya sayılır (TBK m.100 düzeni).
//  - Faiz, faiz üzerine işletilmez (basit faiz).

import { YM, ymKey, daysInMonth, dateStr, parseDateStr, diffDays, addDaysStr } from './dates'
import { toKurus } from './money'

export interface RateEntry {
  year: number
  month: number
  ratePct: number // aylık %
}

export interface TariffEntry {
  year: number
  month: number
  normalKurus: number
  groundKurus: number
}

export interface PaymentEntry {
  amountKurus: number
  paidOn: string // YYYY-MM-DD
}

export type MonthStatus = 'odendi' | 'kismi' | 'bekliyor' | 'gecikmis'

export interface MonthAssessment {
  period: YM
  dueDate: string
  principalKurus: number
  paidKurus: number
  outstandingPrincipalKurus: number
  interestAccruedKurus: number
  interestPaidKurus: number
  /** Kalan toplam borç = kalan anapara + ödenmemiş birikmiş faiz */
  remainingKurus: number
  overpaidKurus: number
  status: MonthStatus
}

export function tariffFor(tariffs: TariffEntry[], ym: YM): TariffEntry | null {
  const target = ymKey(ym)
  let best: TariffEntry | null = null
  for (const t of tariffs) {
    const k = ymKey(t)
    if (k <= target && (best === null || k > ymKey(best))) best = t
  }
  return best
}

export function rateFor(rates: RateEntry[], ym: YM): number {
  const target = ymKey(ym)
  let best: RateEntry | null = null
  for (const r of rates) {
    const k = ymKey(r)
    if (k <= target && (best === null || k > ymKey(best))) best = r
  }
  return best ? best.ratePct : 0
}

export function earliestYM(entries: { year: number; month: number }[]): YM | null {
  let best: YM | null = null
  for (const e of entries) {
    if (best === null || ymKey(e) < ymKey(best)) best = { year: e.year, month: e.month }
  }
  return best
}

/**
 * fromExcl (hariç) → toIncl (dahil) aralığında, kalan anapara üzerinden
 * işleyen faizi kuruş cinsinden (ondalıklı) döndürür.
 */
function accrueInterest(
  fromExcl: string,
  toIncl: string,
  outstandingKurus: number,
  rates: RateEntry[],
): number {
  if (outstandingKurus <= 0 || toIncl <= fromExcl) return 0
  let total = 0
  let cursor = fromExcl
  while (cursor < toIncl) {
    const firstDay = addDaysStr(cursor, 1)
    const f = parseDateStr(firstDay)
    const endOfMonth = dateStr(f.y, f.m, daysInMonth(f.y, f.m))
    const segEnd = endOfMonth < toIncl ? endOfMonth : toIncl
    const days = diffDays(firstDay, segEnd) + 1
    const pct = rateFor(rates, { year: f.y, month: f.m })
    total += outstandingKurus * (pct / 100 / 30) * days
    cursor = segEnd
  }
  return total
}

export interface AssessInput {
  period: YM
  isGroundFloor: boolean
  tariffs: TariffEntry[]
  rates: RateEntry[]
  dueDay: number
  /** Bu döneme sayılan ödemeler (tarih sırasına dizilmiş olması gerekmez). */
  payments: PaymentEntry[]
  today: string
}

/** Bir sakinin tek bir dönemine ait borç durumunu hesaplar. Tarife yoksa null. */
export function assessMonth(inp: AssessInput): MonthAssessment | null {
  const tariff = tariffFor(inp.tariffs, inp.period)
  if (!tariff) return null

  const principal = inp.isGroundFloor ? tariff.groundKurus : tariff.normalKurus
  const { year, month } = inp.period
  const rawDay = Number.isFinite(inp.dueDay) ? Math.floor(inp.dueDay) : 31
  const day = Math.min(Math.max(1, rawDay), daysInMonth(year, month))
  const dueDate = dateStr(year, month, day)

  const pays = [...inp.payments].sort((a, b) =>
    a.paidOn < b.paidOn ? -1 : a.paidOn > b.paidOn ? 1 : 0,
  )

  let outstanding = principal
  let interest = 0 // float kuruş
  let interestPaid = 0
  let paidTotal = 0
  let overpaid = 0
  let cursor = dueDate

  for (const p of pays) {
    paidTotal += p.amountKurus
    const effective = p.paidOn > dueDate ? p.paidOn : dueDate
    if (effective > cursor) {
      interest += accrueInterest(cursor, effective, outstanding, inp.rates)
      cursor = effective
    }
    let amount = p.amountKurus
    const toInterest = Math.min(amount, interest)
    interest -= toInterest
    interestPaid += toInterest
    amount -= toInterest
    const toPrincipal = Math.min(amount, outstanding)
    outstanding -= toPrincipal
    amount -= toPrincipal
    overpaid += amount
  }

  if (inp.today > cursor && outstanding > 0) {
    interest += accrueInterest(cursor, inp.today, outstanding, inp.rates)
  }

  const interestAccrued = Math.round(interest)
  const remaining = outstanding + interestAccrued

  let status: MonthStatus
  if (inp.today <= dueDate) {
    status = outstanding <= 0 ? 'odendi' : paidTotal > 0 ? 'kismi' : 'bekliyor'
  } else {
    status = remaining <= 0 ? 'odendi' : 'gecikmis'
  }

  return {
    period: inp.period,
    dueDate,
    principalKurus: principal,
    paidKurus: paidTotal,
    outstandingPrincipalKurus: outstanding,
    interestAccruedKurus: interestAccrued,
    interestPaidKurus: Math.round(interestPaid),
    remainingKurus: remaining,
    overpaidKurus: overpaid,
    status,
  }
}

// Veritabanı satırlarını motor girdilerine çeviren yardımcılar
export function tariffEntriesFromRows(
  rows: {
    effective_year: number
    effective_month: number
    normal_amount: number
    ground_floor_amount: number
  }[],
): TariffEntry[] {
  return rows.map((r) => ({
    year: r.effective_year,
    month: r.effective_month,
    normalKurus: toKurus(r.normal_amount),
    groundKurus: toKurus(r.ground_floor_amount),
  }))
}

export function rateEntriesFromRows(
  rows: { effective_year: number; effective_month: number; monthly_rate_pct: number }[],
): RateEntry[] {
  return rows.map((r) => ({
    year: r.effective_year,
    month: r.effective_month,
    ratePct: r.monthly_rate_pct,
  }))
}
