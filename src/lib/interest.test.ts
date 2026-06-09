import { describe, expect, it } from 'vitest'
import { assessMonth, earliestYM, rateFor, tariffFor } from './interest'
import type { RateEntry, TariffEntry } from './interest'
import { monthsFrom } from './dates'

// Ortak test verisi: Ocak 2026'dan itibaren normal 1.000 TL, giriş kat 800 TL;
// Mart 2025'ten itibaren aylık %3 gecikme faizi. Son ödeme günü: ayın son günü (31).
const TARIFFS: TariffEntry[] = [{ year: 2026, month: 1, normalKurus: 100_000, groundKurus: 80_000 }]
const RATES: RateEntry[] = [{ year: 2025, month: 3, ratePct: 3 }]

const base = {
  period: { year: 2026, month: 1 },
  isGroundFloor: false,
  tariffs: TARIFFS,
  rates: RATES,
  dueDay: 31,
}

describe('tariffFor / rateFor seçimi', () => {
  it('döneme eşit veya önceki en yakın tarifeyi seçer', () => {
    const t2: TariffEntry[] = [...TARIFFS, { year: 2026, month: 3, normalKurus: 120_000, groundKurus: 95_000 }]
    expect(tariffFor(t2, { year: 2026, month: 2 })?.normalKurus).toBe(100_000)
    expect(tariffFor(t2, { year: 2026, month: 3 })?.normalKurus).toBe(120_000)
    expect(tariffFor(t2, { year: 2027, month: 1 })?.normalKurus).toBe(120_000)
    expect(tariffFor(t2, { year: 2025, month: 12 })).toBeNull()
  })

  it('tanımlı oran yoksa 0 döner', () => {
    expect(rateFor([], { year: 2026, month: 5 })).toBe(0)
    expect(rateFor(RATES, { year: 2025, month: 2 })).toBe(0)
    expect(rateFor(RATES, { year: 2026, month: 1 })).toBe(3)
  })
})

describe('assessMonth – temel durumlar', () => {
  it('tarife tanımlı değilse null döner', () => {
    expect(assessMonth({ ...base, period: { year: 2025, month: 12 }, payments: [], today: '2026-01-01' })).toBeNull()
  })

  it('giriş kat dairede giriş kat tarifesi uygulanır', () => {
    const a = assessMonth({ ...base, isGroundFloor: true, payments: [], today: '2026-01-10' })
    expect(a?.principalKurus).toBe(80_000)
  })

  it('vade gününde tam ödeme → faiz yok, Ödendi', () => {
    const a = assessMonth({
      ...base,
      payments: [{ amountKurus: 100_000, paidOn: '2026-01-31' }],
      today: '2026-03-10',
    })!
    expect(a.interestAccruedKurus).toBe(0)
    expect(a.remainingKurus).toBe(0)
    expect(a.status).toBe('odendi')
  })

  it('vadeden önce ödeme → faiz işlemez', () => {
    const a = assessMonth({
      ...base,
      payments: [{ amountKurus: 100_000, paidOn: '2026-01-05' }],
      today: '2026-04-01',
    })!
    expect(a.interestAccruedKurus).toBe(0)
    expect(a.status).toBe('odendi')
  })

  it('vade gelmemiş ve ödeme yok → Bekliyor', () => {
    const a = assessMonth({ ...base, payments: [], today: '2026-01-15' })!
    expect(a.status).toBe('bekliyor')
    expect(a.remainingKurus).toBe(100_000)
  })

  it('vade gelmemiş kısmi ödeme → Kısmi', () => {
    const a = assessMonth({
      ...base,
      payments: [{ amountKurus: 40_000, paidOn: '2026-01-05' }],
      today: '2026-01-20',
    })!
    expect(a.status).toBe('kismi')
    expect(a.outstandingPrincipalKurus).toBe(60_000)
  })

  it('fazla ödeme ayrı izlenir, borç eksiye düşmez', () => {
    const a = assessMonth({
      ...base,
      payments: [{ amountKurus: 110_000, paidOn: '2026-01-31' }],
      today: '2026-02-15',
    })!
    expect(a.overpaidKurus).toBe(10_000)
    expect(a.remainingKurus).toBe(0)
    expect(a.status).toBe('odendi')
  })
})

describe('assessMonth – gecikme faizi (günlük = aylık oran / 30)', () => {
  it('30 gün gecikme, tek oran: 1.000 TL × %3 → 30 TL faiz', () => {
    // Vade 31 Oca; bugün 2 Mar = Şubat'ta 28 + Mart'ta 2 = 30 gün gecikme
    const a = assessMonth({ ...base, payments: [], today: '2026-03-02' })!
    expect(a.interestAccruedKurus).toBe(3_000)
    expect(a.remainingKurus).toBe(103_000)
    expect(a.status).toBe('gecikmis')
  })

  it('ay ortasında oran değişirse her takvim ayında kendi oranı uygulanır', () => {
    const rates: RateEntry[] = [
      { year: 2025, month: 3, ratePct: 3 },
      { year: 2026, month: 3, ratePct: 5 },
    ]
    // Şubat: 28 gün × %3/30 × 1000 TL = 28,00 TL; Mart: 2 gün × %5/30 × 1000 TL = 3,3333 TL
    const a = assessMonth({ ...base, rates, payments: [], today: '2026-03-02' })!
    expect(a.interestAccruedKurus).toBe(Math.round(2_800 + 333.333))
  })

  it('ödeme önce faize, sonra anaparaya sayılır (kısmi ödeme)', () => {
    // 10 Şub'da 500 TL ödeme: o ana kadar faiz 10 gün × 1 TL = 10 TL
    // → 10 TL faize, 490 TL anaparaya; kalan anapara 510 TL
    // 20 Şub'a kadar 10 gün daha: 510 × %3/30 × 10 = 5,10 TL yeni faiz
    const a = assessMonth({
      ...base,
      payments: [{ amountKurus: 50_000, paidOn: '2026-02-10' }],
      today: '2026-02-20',
    })!
    expect(a.interestPaidKurus).toBe(1_000)
    expect(a.outstandingPrincipalKurus).toBe(51_000)
    expect(a.interestAccruedKurus).toBe(510)
    expect(a.remainingKurus).toBe(51_510)
    expect(a.status).toBe('gecikmis')
  })

  it('gecikmiş borç faiziyle birlikte kapatılınca Ödendi olur', () => {
    // Son ödeme günü 15 → vade 15 Oca; 20 Oca'da ödeme: 5 gün × 1 TL = 5 TL faiz
    const a = assessMonth({
      ...base,
      dueDay: 15,
      payments: [{ amountKurus: 100_500, paidOn: '2026-01-20' }],
      today: '2026-02-01',
    })!
    expect(a.interestPaidKurus).toBe(500)
    expect(a.remainingKurus).toBe(0)
    expect(a.status).toBe('odendi')
  })

  it('faiz oranı tanımlı değilse gecikmede faiz 0 olur', () => {
    const a = assessMonth({ ...base, rates: [], payments: [], today: '2026-03-01' })!
    expect(a.interestAccruedKurus).toBe(0)
    expect(a.remainingKurus).toBe(100_000)
    expect(a.status).toBe('gecikmis')
  })

  it('kısa aylarda son ödeme günü ayın son gününe kıstırılır (31 → 28 Şubat)', () => {
    const a = assessMonth({
      ...base,
      period: { year: 2026, month: 2 },
      payments: [],
      today: '2026-02-28',
    })!
    expect(a.dueDate).toBe('2026-02-28')
    expect(a.status).toBe('bekliyor') // vade günü henüz geçmedi
  })

  it('artık yılda Şubat 29 çeker', () => {
    const tariffs: TariffEntry[] = [{ year: 2024, month: 1, normalKurus: 100_000, groundKurus: 80_000 }]
    const a = assessMonth({
      ...base,
      tariffs,
      period: { year: 2024, month: 2 },
      payments: [],
      today: '2024-03-01',
    })!
    expect(a.dueDate).toBe('2024-02-29')
  })
})

describe('yardımcılar', () => {
  it('monthsFrom dahil aralık üretir', () => {
    const months = monthsFrom({ year: 2025, month: 11 }, { year: 2026, month: 2 })
    expect(months).toHaveLength(4)
    expect(months[0]).toEqual({ year: 2025, month: 11 })
    expect(months[3]).toEqual({ year: 2026, month: 2 })
  })

  it('earliestYM en eski dönemi bulur', () => {
    expect(
      earliestYM([
        { year: 2026, month: 3 },
        { year: 2025, month: 7 },
        { year: 2026, month: 1 },
      ]),
    ).toEqual({ year: 2025, month: 7 })
    expect(earliestYM([])).toBeNull()
  })
})
