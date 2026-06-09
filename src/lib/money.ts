// Para tutarları hesap katmanında kuruş (tam sayı) olarak taşınır;
// böylece kayan nokta hataları tahsilat/borç hesaplarına sızmaz.

export function toKurus(tl: number): number {
  return Math.round(tl * 100)
}

export function fromKurus(kurus: number): number {
  return kurus / 100
}

const tlFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  minimumFractionDigits: 2,
})

export function fmtTL(kurus: number): string {
  return tlFormatter.format(kurus / 100)
}

/**
 * Kullanıcı girişini kuruşa çevirir. Hem Türkçe ("1.234,56") hem de
 * nokta ondalıklı ("1234.56") biçimleri kabul edilir. Geçersiz giriş → null.
 */
export function parseAmountToKurus(raw: string): number | null {
  let s = raw.trim().replace(/\s|₺|TL/gi, '')
  if (!s) return null
  if (s.includes(',')) {
    // Türkçe biçim: noktalar binlik ayraç, virgül ondalık
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    // Virgül yoksa ve noktalar üçerli gruplara denk geliyorsa binlik ayraçtır
    // ("1.000" → 1000 TL). "1234.56" gibi girişlerde nokta ondalık kalır.
    s = s.replace(/\./g, '')
  }
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null
  const value = Number(s)
  if (!Number.isFinite(value)) return null
  return Math.round(value * 100)
}

/** Kuruşu form girişlerinde gösterilecek "1234,56" biçimine çevirir. */
export function kurusToInput(kurus: number): string {
  return (kurus / 100).toFixed(2).replace('.', ',')
}
