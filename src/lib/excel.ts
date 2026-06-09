// Excel içe/dışa aktarım yardımcıları (SheetJS).
// Vergi/TC numaraları string olarak yazılır ki baştaki sıfırlar kaybolmasın.

import * as XLSX from 'xlsx'
import { formatDateTR } from './dates'

export type SheetRow = Record<string, string | number>

export function buildSheet(rows: SheetRow[], headers: string[], widths?: number[]): XLSX.WorkSheet {
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers })
  if (widths) ws['!cols'] = widths.map((wch) => ({ wch }))
  return ws
}

export function downloadXlsx(filename: string, sheetName: string, ws: XLSX.WorkSheet): void {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename)
}

// ---------------------------------------------------------------- Sakinler

export const RESIDENT_HEADERS = ['Blok-Daire No', 'Giriş Kat (Evet/Hayır)', 'İsim', 'Soyisim']
export const RESIDENT_COL_WIDTHS = [18, 22, 18, 18]

export interface ResidentImportRow {
  line: number
  unit_no: string
  is_ground_floor: boolean
  first_name: string
  last_name: string
  error: string | null
}

export interface ResidentParseResult {
  rows: ResidentImportRow[]
  headerError: string | null
}

const cleanText = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim()

const normHeader = (v: unknown) =>
  cleanText(v)
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-zçğıöşü0-9]/g, '')

function parseGroundFloor(v: unknown): boolean | null {
  const s = cleanText(v).toLocaleLowerCase('tr-TR')
  if (['evet', 'e', 'var', 'true', '1'].includes(s)) return true
  if (['', 'hayır', 'hayir', 'h', 'yok', 'false', '0'].includes(s)) return false
  return null
}

/**
 * Excel dosyasından sakin listesi okur. İlk sayfanın ilk satırı başlık kabul edilir.
 * Başlıklar esnek eşleştirilir ("Blok-Daire No", "İsim"/"Ad", "Soyisim"/"Soyad" vb.).
 */
export function parseResidentsWorkbook(data: ArrayBuffer): ResidentParseResult {
  const wb = XLSX.read(data, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return { rows: [], headerError: 'Dosyada sayfa bulunamadı.' }
  const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1,
    raw: false,
    defval: '',
  }) as unknown[][]
  if (aoa.length === 0) return { rows: [], headerError: 'Dosya boş görünüyor.' }

  const headers = (aoa[0] ?? []).map(normHeader)
  const findCol = (matcher: (h: string) => boolean) => headers.findIndex(matcher)

  const unitCol = findCol((h) => h.includes('daire') || h.includes('blok'))
  const groundCol = findCol((h) => h.startsWith('girişkat') || h.startsWith('giriskat'))
  const lastCol = findCol((h) => ['soyisim', 'soyad', 'soyadı'].includes(h))
  const firstCol = findCol((h) => ['isim', 'ad', 'adı'].includes(h))

  if (unitCol === -1 || firstCol === -1) {
    return {
      rows: [],
      headerError: `Başlık satırı tanınamadı. Beklenen sütunlar: ${RESIDENT_HEADERS.join(', ')}. Şablonu indirip kullanabilirsiniz.`,
    }
  }

  const rows: ResidentImportRow[] = []
  for (let i = 1; i < aoa.length; i++) {
    const raw = aoa[i] ?? []
    const unit = cleanText(raw[unitCol])
    const first = cleanText(raw[firstCol])
    const last = lastCol === -1 ? '' : cleanText(raw[lastCol])
    const groundRaw = groundCol === -1 ? '' : raw[groundCol]
    const isEmpty = !unit && !first && !last && !cleanText(groundRaw)
    if (isEmpty) continue

    const ground = parseGroundFloor(groundRaw)
    let error: string | null = null
    if (!unit) error = 'Blok-Daire No boş olamaz.'
    else if (!first) error = 'İsim boş olamaz.'
    else if (ground === null) error = 'Giriş Kat sütunu "Evet" veya "Hayır" olmalıdır.'

    rows.push({
      line: i + 1,
      unit_no: unit,
      is_ground_floor: ground === true,
      first_name: first,
      last_name: last,
      error,
    })
  }
  return { rows, headerError: null }
}

export function residentsToRows(
  residents: { unit_no: string; is_ground_floor: boolean; first_name: string; last_name: string }[],
): SheetRow[] {
  return residents.map((r) => ({
    'Blok-Daire No': r.unit_no,
    'Giriş Kat (Evet/Hayır)': r.is_ground_floor ? 'Evet' : 'Hayır',
    'İsim': r.first_name,
    'Soyisim': r.last_name,
  }))
}

export const RESIDENT_TEMPLATE_ROWS: SheetRow[] = [
  { 'Blok-Daire No': 'A Blok - 1', 'Giriş Kat (Evet/Hayır)': 'Hayır', 'İsim': 'Ahmet', 'Soyisim': 'Yılmaz' },
  { 'Blok-Daire No': 'A Blok - 2', 'Giriş Kat (Evet/Hayır)': 'Evet', 'İsim': 'Ayşe', 'Soyisim': 'Demir' },
]

// ---------------------------------------------------------------- Masraflar

export const EXPENSE_HEADERS = [
  'Belge Türü',
  'Firma Ünvanı',
  'Vergi/TC Kimlik No',
  'Belge Tarihi',
  'Belge No',
  'Matrah (TL)',
  'KDV Oranı (%)',
  'KDV Tutarı (TL)',
  'Toplam Tutar (TL)',
  'Açıklama',
]
export const EXPENSE_COL_WIDTHS = [10, 32, 16, 12, 14, 12, 12, 14, 14, 30]

export interface ExpenseExportInput {
  doc_type: 'fatura' | 'fis'
  vendor_title: string
  tax_number: string
  doc_date: string
  doc_no: string
  base_amount: number
  vat_rate: number
  vat_amount: number
  total_amount: number
  description: string
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** VUK alanlarının tamamını içeren satırlar + sondan toplama satırı üretir. */
export function expensesToRows(expenses: ExpenseExportInput[]): SheetRow[] {
  const rows: SheetRow[] = expenses.map((e) => ({
    'Belge Türü': e.doc_type === 'fatura' ? 'Fatura' : 'Fiş',
    'Firma Ünvanı': e.vendor_title,
    'Vergi/TC Kimlik No': e.tax_number,
    'Belge Tarihi': formatDateTR(e.doc_date),
    'Belge No': e.doc_no,
    'Matrah (TL)': e.base_amount,
    'KDV Oranı (%)': e.vat_rate,
    'KDV Tutarı (TL)': e.vat_amount,
    'Toplam Tutar (TL)': e.total_amount,
    'Açıklama': e.description,
  }))
  if (expenses.length > 0) {
    rows.push({
      'Belge Türü': 'TOPLAM',
      'Firma Ünvanı': '',
      'Vergi/TC Kimlik No': '',
      'Belge Tarihi': '',
      'Belge No': '',
      'Matrah (TL)': round2(expenses.reduce((a, e) => a + e.base_amount, 0)),
      'KDV Oranı (%)': '',
      'KDV Tutarı (TL)': round2(expenses.reduce((a, e) => a + e.vat_amount, 0)),
      'Toplam Tutar (TL)': round2(expenses.reduce((a, e) => a + e.total_amount, 0)),
      'Açıklama': '',
    })
  }
  return rows
}
