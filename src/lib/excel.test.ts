import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { expensesToRows, parseResidentsWorkbook } from './excel'

function makeWorkbook(aoa: (string | number)[][]): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Sayfa1')
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

describe('sakin Excel içe aktarımı', () => {
  it('standart şablonu okur', () => {
    const buf = makeWorkbook([
      ['Blok-Daire No', 'Giriş Kat (Evet/Hayır)', 'İsim', 'Soyisim'],
      ['A Blok - 1', 'Hayır', 'Ahmet', 'Yılmaz'],
      ['A Blok - 2', 'Evet', 'Ayşe', 'Demir'],
    ])
    const { rows, headerError } = parseResidentsWorkbook(buf)
    expect(headerError).toBeNull()
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      unit_no: 'A Blok - 1',
      is_ground_floor: false,
      first_name: 'Ahmet',
      last_name: 'Yılmaz',
      error: null,
    })
    expect(rows[1].is_ground_floor).toBe(true)
  })

  it('başlık varyasyonlarını kabul eder (Ad/Soyad, boş giriş kat = Hayır)', () => {
    const buf = makeWorkbook([
      ['Blok Daire', 'Ad', 'Soyad'],
      ['B-4', 'Mehmet', 'Kaya'],
    ])
    const { rows, headerError } = parseResidentsWorkbook(buf)
    expect(headerError).toBeNull()
    expect(rows[0]).toMatchObject({
      unit_no: 'B-4',
      is_ground_floor: false,
      first_name: 'Mehmet',
      last_name: 'Kaya',
      error: null,
    })
  })

  it('hatalı satırları satır numarasıyla işaretler', () => {
    const buf = makeWorkbook([
      ['Blok-Daire No', 'Giriş Kat (Evet/Hayır)', 'İsim', 'Soyisim'],
      ['', 'Hayır', 'Adsız', 'Daire'],     // daire no yok
      ['C-1', 'belki', 'Ali', 'Veli'],      // geçersiz giriş kat
      ['C-2', 'Evet', '', 'İsimsiz'],       // isim yok
      ['', '', '', ''],                       // tamamen boş → atlanır
      ['C-3', 'evet', 'Zeynep', 'Ak'],     // küçük harf evet kabul edilir
    ])
    const { rows } = parseResidentsWorkbook(buf)
    expect(rows).toHaveLength(4)
    expect(rows[0].error).toContain('Blok-Daire')
    expect(rows[1].error).toContain('Giriş Kat')
    expect(rows[2].error).toContain('İsim')
    expect(rows[3]).toMatchObject({ is_ground_floor: true, error: null, line: 6 })
  })

  it('tanınmayan başlıkta açıklayıcı hata döner', () => {
    const buf = makeWorkbook([
      ['Kolon1', 'Kolon2'],
      ['x', 'y'],
    ])
    const { headerError } = parseResidentsWorkbook(buf)
    expect(headerError).toContain('Başlık')
  })
})

describe('masraf Excel dışa aktarımı', () => {
  it('tüm VUK alanlarını ve toplam satırını üretir', () => {
    const rows = expensesToRows([
      {
        doc_type: 'fatura',
        vendor_title: 'ABC Ltd.',
        tax_number: '0123456789',
        doc_date: '2026-06-05',
        doc_no: 'FT-001',
        base_amount: 1000,
        vat_rate: 20,
        vat_amount: 200,
        total_amount: 1200,
        description: 'Asansör bakımı',
      },
      {
        doc_type: 'fis',
        vendor_title: 'Market',
        tax_number: '10000000146',
        doc_date: '2026-06-07',
        doc_no: 'FS-77',
        base_amount: 100.5,
        vat_rate: 10,
        vat_amount: 10.05,
        total_amount: 110.55,
        description: '',
      },
    ])
    expect(rows).toHaveLength(3)
    expect(rows[0]['Belge Türü']).toBe('Fatura')
    expect(rows[0]['Vergi/TC Kimlik No']).toBe('0123456789') // baştaki sıfır korunur
    expect(rows[0]['Belge Tarihi']).toBe('05.06.2026')
    expect(rows[1]['Belge Türü']).toBe('Fiş')
    const total = rows[2]
    expect(total['Belge Türü']).toBe('TOPLAM')
    expect(total['Matrah (TL)']).toBe(1100.5)
    expect(total['KDV Tutarı (TL)']).toBe(210.05)
    expect(total['Toplam Tutar (TL)']).toBe(1310.55)
  })

  it('boş listede toplam satırı eklemez', () => {
    expect(expensesToRows([])).toHaveLength(0)
  })
})
