import { describe, expect, it } from 'vitest'
import { checkTaxNumber, computeVatKurus, tcknValid, vknValid } from './validation'

describe('TC Kimlik No doğrulama', () => {
  it('geçerli numarayı kabul eder', () => {
    // 10000000146: bilinen geçerli test numarası
    // d10 = ((1+0+0+0+1)*7 - (0+0+0+0)) mod 10 = 4 ✓, d11 = (ilk 10 toplamı) mod 10 = 6 ✓
    expect(tcknValid('10000000146')).toBe(true)
  })

  it('kontrol basamağı tutmayanı reddeder', () => {
    expect(tcknValid('10000000147')).toBe(false)
    expect(tcknValid('12345678901')).toBe(false)
  })

  it('0 ile başlayan veya kısa/uzun girişleri reddeder', () => {
    expect(tcknValid('01000000146')).toBe(false)
    expect(tcknValid('1234567890')).toBe(false)
    expect(tcknValid('123456789012')).toBe(false)
  })
})

describe('Vergi Kimlik No doğrulama', () => {
  it('algoritmaya uyan numarayı kabul eder', () => {
    // 1234567890: v_i değerlerinin tümü 0 → toplam 0 → kontrol basamağı 0 ✓
    expect(vknValid('1234567890')).toBe(true)
  })

  it('kontrol basamağı tutmayanı reddeder', () => {
    expect(vknValid('1234567891')).toBe(false)
    expect(vknValid('1234567899')).toBe(false)
  })

  it('rakam dışı / yanlış uzunluk reddedilir', () => {
    expect(vknValid('12345abc90')).toBe(false)
    expect(vknValid('123456789')).toBe(false)
  })
})

describe('checkTaxNumber (form kuralları)', () => {
  it('10-11 hane dışını hata ile reddeder', () => {
    expect(checkTaxNumber('123').ok).toBe(false)
    expect(checkTaxNumber('123456789012').ok).toBe(false)
    expect(checkTaxNumber('12a4567890').ok).toBe(false)
  })

  it('geçersiz TCKN kesin engellenir', () => {
    const r = checkTaxNumber('12345678901')
    expect(r.ok).toBe(false)
    expect(r.error).toBeTruthy()
  })

  it('geçerli TCKN sorunsuz geçer', () => {
    expect(checkTaxNumber('10000000146')).toEqual({ ok: true })
  })

  it('VKN kontrol basamağı tutmazsa uyarı verir ama engellemez', () => {
    const r = checkTaxNumber('1234567891')
    expect(r.ok).toBe(true)
    expect(r.warning).toBeTruthy()
  })
})

describe('KDV hesabı', () => {
  it('matrah × oran, kuruşa yuvarlanır', () => {
    expect(computeVatKurus(100_000, 20)).toBe(20_000)
    expect(computeVatKurus(100_000, 1)).toBe(1_000)
    expect(computeVatKurus(33_333, 18)).toBe(6_000) // 5999,94 → 6000
    expect(computeVatKurus(0, 20)).toBe(0)
  })
})
