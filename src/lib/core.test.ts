import { describe, expect, it } from 'vitest'
import {
  addDaysStr,
  addMonths,
  daysInMonth,
  diffDays,
  formatDateTR,
  isValidDateStr,
  monthLabel,
  ymFromKey,
  ymKey,
} from './dates'
import { fmtTL, kurusToInput, parseAmountToKurus, toKurus } from './money'
import { canAccessPath, homePathFor, isFullAccess } from './roles'

describe('tarih yardımcıları', () => {
  it('daysInMonth artık yılları bilir', () => {
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2026, 6)).toBe(30)
    expect(daysInMonth(2026, 12)).toBe(31)
  })

  it('diffDays / addDaysStr ay sınırlarında doğru çalışır', () => {
    expect(diffDays('2026-01-31', '2026-03-02')).toBe(30)
    expect(addDaysStr('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDaysStr('2024-02-28', 1)).toBe('2024-02-29')
  })

  it('ymKey/ymFromKey/addMonths tutarlıdır', () => {
    const ym = { year: 2026, month: 12 }
    expect(ymFromKey(ymKey(ym))).toEqual(ym)
    expect(addMonths(ym, 1)).toEqual({ year: 2027, month: 1 })
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
  })

  it('Türkçe biçimler', () => {
    expect(formatDateTR('2026-06-10')).toBe('10.06.2026')
    expect(monthLabel({ year: 2026, month: 3 })).toBe('Mart 2026')
  })

  it('isValidDateStr', () => {
    expect(isValidDateStr('2026-02-29')).toBe(false)
    expect(isValidDateStr('2024-02-29')).toBe(true)
    expect(isValidDateStr('abc')).toBe(false)
  })
})

describe('para yardımcıları', () => {
  it('Türkçe ve nokta ondalıklı girişleri kuruşa çevirir', () => {
    expect(parseAmountToKurus('1.234,56')).toBe(123_456)
    expect(parseAmountToKurus('1234.56')).toBe(123_456)
    expect(parseAmountToKurus('750')).toBe(75_000)
    expect(parseAmountToKurus('0,5')).toBe(50)
    expect(parseAmountToKurus(' 1.000 ')).toBe(100_000) // virgülsüz binlik ayraç
    expect(parseAmountToKurus('12.345')).toBe(1_234_500) // 12.345 TL = binlik ayraç
    expect(parseAmountToKurus('1.234.567')).toBe(123_456_700)
  })

  it('geçersiz girişlerde null döner', () => {
    expect(parseAmountToKurus('')).toBeNull()
    expect(parseAmountToKurus('abc')).toBeNull()
    expect(parseAmountToKurus('1,2,3')).toBeNull()
    expect(parseAmountToKurus('10,123')).toBeNull() // en fazla 2 ondalık
  })

  it('gidiş-dönüş tutarlıdır', () => {
    expect(toKurus(123.45)).toBe(12_345)
    expect(kurusToInput(123_456)).toBe('1234,56')
    expect(parseAmountToKurus(kurusToInput(98_765))).toBe(98_765)
  })

  it('fmtTL Türkçe binlik/ondalık kullanır', () => {
    expect(fmtTL(123_456)).toContain('1.234,56')
  })
})

describe('rol erişim matrisi', () => {
  it('Yönetici ve Sayman tüm sayfalara erişir', () => {
    for (const role of ['admin', 'sayman'] as const) {
      for (const path of ['/', '/sakinler', '/aidat', '/masraflar', '/ayarlar', '/kullanicilar']) {
        expect(canAccessPath(role, path)).toBe(true)
      }
    }
  })

  it('Muhasebeci yalnızca /muhasebe sayfasına erişir', () => {
    expect(canAccessPath('muhasebeci', '/muhasebe')).toBe(true)
    for (const path of ['/', '/sakinler', '/aidat', '/masraflar', '/ayarlar', '/kullanicilar']) {
      expect(canAccessPath('muhasebeci', path)).toBe(false)
    }
  })

  it('Onay bekleyen kullanıcı hiçbir sayfaya erişemez', () => {
    for (const path of ['/', '/muhasebe', '/sakinler', '/ayarlar']) {
      expect(canAccessPath('pending', path)).toBe(false)
    }
  })

  it('rol → ana sayfa yönlendirmesi', () => {
    expect(homePathFor('admin')).toBe('/')
    expect(homePathFor('sayman')).toBe('/')
    expect(homePathFor('muhasebeci')).toBe('/muhasebe')
    expect(isFullAccess('sayman')).toBe(true)
    expect(isFullAccess('muhasebeci')).toBe(false)
  })
})
