// VUK uyumlu masraf girişi için doğrulamalar (TCKN / VKN kontrol basamakları, KDV).

export function tcknValid(s: string): boolean {
  if (!/^[1-9]\d{10}$/.test(s)) return false
  const d = s.split('').map(Number)
  const sumOdd = d[0] + d[2] + d[4] + d[6] + d[8]
  const sumEven = d[1] + d[3] + d[5] + d[7]
  const d10 = (((sumOdd * 7 - sumEven) % 10) + 10) % 10
  if (d[9] !== d10) return false
  const d11 = (d.slice(0, 10).reduce((a, b) => a + b, 0)) % 10
  return d[10] === d11
}

export function vknValid(s: string): boolean {
  if (!/^\d{10}$/.test(s)) return false
  const d = s.split('').map(Number)
  let sum = 0
  for (let i = 0; i < 9; i++) {
    const v = (d[i] + 10 - (i + 1)) % 10
    let w = (v * Math.pow(2, 10 - (i + 1))) % 9
    if (v !== 0 && w === 0) w = 9
    sum += w
  }
  return d[9] === (10 - (sum % 10)) % 10
}

export interface TaxNumberCheck {
  ok: boolean
  error?: string
  warning?: string
}

/**
 * 10 hane → Vergi Kimlik No (kontrol basamağı uyarı verir ama engellemez),
 * 11 hane → TC Kimlik No (kontrol basamağı zorunlu).
 */
export function checkTaxNumber(raw: string): TaxNumberCheck {
  const s = raw.trim()
  if (!/^\d{10}$/.test(s) && !/^\d{11}$/.test(s)) {
    return {
      ok: false,
      error: 'Vergi numarası 10, TC kimlik numarası 11 haneli olmalı ve sadece rakam içermelidir.',
    }
  }
  if (s.length === 11) {
    return tcknValid(s)
      ? { ok: true }
      : { ok: false, error: 'Geçersiz TC Kimlik Numarası (kontrol basamağı tutmuyor).' }
  }
  return vknValid(s)
    ? { ok: true }
    : {
        ok: true,
        warning:
          'Vergi numarasının kontrol basamağı doğrulanamadı. Numarayı kontrol etmeniz önerilir.',
      }
}

/** KDV tutarı = matrah × oran, kuruşa yuvarlanır. */
export function computeVatKurus(baseKurus: number, ratePct: number): number {
  return Math.round((baseKurus * ratePct) / 100)
}
