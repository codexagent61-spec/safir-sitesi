import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useInvalidate, useResidents } from '../hooks/useData'
import type { Resident } from '../hooks/useData'
import {
  RESIDENT_COL_WIDTHS,
  RESIDENT_HEADERS,
  RESIDENT_TEMPLATE_ROWS,
  buildSheet,
  downloadXlsx,
  parseResidentsWorkbook,
  residentsToRows,
} from '../lib/excel'
import type { ResidentImportRow } from '../lib/excel'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'

interface ResidentForm {
  id: string | null
  unit_no: string
  is_ground_floor: boolean
  first_name: string
  last_name: string
}

const emptyForm: ResidentForm = {
  id: null,
  unit_no: '',
  is_ground_floor: false, // Giriş Kat varsayılanı: Hayır
  first_name: '',
  last_name: '',
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()

export default function ResidentsPage() {
  const { toast } = useToast()
  const invalidate = useInvalidate()
  const residents = useResidents()
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<ResidentForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [importRows, setImportRows] = useState<ResidentImportRow[] | null>(null)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const list = residents.data ?? []
    const q = search.trim().toLocaleLowerCase('tr-TR')
    if (!q) return list
    return list.filter((r) =>
      `${r.unit_no} ${r.first_name} ${r.last_name}`.toLocaleLowerCase('tr-TR').includes(q),
    )
  }, [residents.data, search])

  const existingUnits = useMemo(
    () => new Set((residents.data ?? []).map((r) => r.unit_no)),
    [residents.data],
  )

  const saveForm = async (e: FormEvent) => {
    e.preventDefault()
    if (!form) return
    const payload = {
      unit_no: clean(form.unit_no),
      is_ground_floor: form.is_ground_floor,
      first_name: clean(form.first_name),
      last_name: clean(form.last_name),
    }
    if (!payload.unit_no) return toast('error', 'Blok-Daire No boş olamaz.')
    if (!payload.first_name) return toast('error', 'İsim boş olamaz.')
    setSaving(true)
    const res = form.id
      ? await supabase.from('residents').update(payload).eq('id', form.id)
      : await supabase.from('residents').insert(payload)
    setSaving(false)
    if (res.error) {
      if (res.error.code === '23505') toast('error', 'Bu Blok-Daire No zaten kayıtlı.')
      else toast('error', `Kaydedilemedi: ${res.error.message}`)
      return
    }
    toast('success', form.id ? 'Sakin bilgileri güncellendi.' : 'Yeni sakin eklendi.')
    setForm(null)
    invalidate('residents')
  }

  const deleteResident = async (r: Resident) => {
    if (!window.confirm(`${r.unit_no} – ${r.first_name} ${r.last_name} kaydı silinsin mi?`)) return
    const { error } = await supabase.from('residents').delete().eq('id', r.id)
    if (error) {
      if (error.code === '23503')
        toast(
          'error',
          'Bu sakine ait ödeme kayıtları olduğu için silinemez. Önce Aidat Takibi > Ödemeler sekmesinden ödemelerini silmelisiniz.',
        )
      else toast('error', `Silinemedi: ${error.message}`)
      return
    }
    toast('success', 'Sakin silindi.')
    invalidate('residents')
  }

  const onFileChosen = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // aynı dosya tekrar seçilebilsin
    if (!file) return
    try {
      const buf = await file.arrayBuffer()
      const { rows, headerError } = parseResidentsWorkbook(buf)
      if (headerError) return toast('error', headerError)
      if (rows.length === 0) return toast('error', 'Dosyada aktarılacak satır bulunamadı.')
      setImportRows(rows)
    } catch {
      toast('error', 'Dosya okunamadı. Geçerli bir Excel (.xlsx) dosyası seçin.')
    }
  }

  const doImport = async () => {
    const valid = (importRows ?? []).filter((r) => !r.error)
    if (valid.length === 0) return toast('error', 'İçe aktarılacak geçerli satır yok.')
    // Aynı daire numarası dosyada birden fazla geçiyorsa son satır geçerli olur
    // (tek upsert komutunda aynı anahtar iki kez yer alamaz).
    const byUnit = new Map<string, ResidentImportRow>()
    for (const row of valid) byUnit.set(row.unit_no, row)
    const rows = [...byUnit.values()].map((r) => ({
      unit_no: r.unit_no,
      is_ground_floor: r.is_ground_floor,
      first_name: r.first_name,
      last_name: r.last_name,
    }))
    setImporting(true)
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500)
      const { error } = await supabase.from('residents').upsert(chunk, { onConflict: 'unit_no' })
      if (error) {
        setImporting(false)
        return toast('error', `İçe aktarım hatası: ${error.message}`)
      }
    }
    setImporting(false)
    setImportRows(null)
    invalidate('residents')
    const skipped = valid.length - byUnit.size
    toast(
      'success',
      `${byUnit.size} sakin içe aktarıldı.${skipped > 0 ? ` (${skipped} tekrar eden satır birleştirildi.)` : ''}`,
    )
  }

  const exportExcel = () => {
    const list = residents.data ?? []
    if (list.length === 0) return toast('info', 'Dışa aktarılacak sakin kaydı yok.')
    downloadXlsx(
      'Sakinler.xlsx',
      'Sakinler',
      buildSheet(residentsToRows(list), RESIDENT_HEADERS, RESIDENT_COL_WIDTHS),
    )
    toast('success', `${list.length} sakin Excel dosyasına aktarıldı.`)
  }

  const downloadTemplate = () => {
    downloadXlsx(
      'Sakin-Sablonu.xlsx',
      'Sakinler',
      buildSheet(RESIDENT_TEMPLATE_ROWS, RESIDENT_HEADERS, RESIDENT_COL_WIDTHS),
    )
  }

  const validImportCount = (importRows ?? []).filter((r) => !r.error).length
  const errorImportCount = (importRows ?? []).filter((r) => r.error).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">🏠 Sakinler</h1>
          <p className="text-sm text-slate-500">
            {residents.data ? `${residents.data.length} kayıtlı daire` : 'Yükleniyor…'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={() => setForm(emptyForm)}>
            ➕ Yeni Sakin
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
            ⬆️ Excel'den Aktar
          </button>
          <button type="button" className="btn btn-secondary" onClick={exportExcel}>
            ⬇️ Excel'e Aktar
          </button>
          <button type="button" className="btn btn-secondary" onClick={downloadTemplate}>
            📄 Şablon İndir
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => void onFileChosen(e)}
          />
        </div>
      </div>

      <input
        className="input max-w-md"
        placeholder="🔍 Daire no veya isim ara…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="card overflow-x-auto !p-0">
        <table className="w-full min-w-[640px]">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="th">Blok-Daire No</th>
              <th className="th">Giriş Kat</th>
              <th className="th">İsim</th>
              <th className="th">Soyisim</th>
              <th className="th text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {residents.isLoading ? (
              <tr>
                <td className="td text-slate-500" colSpan={5}>
                  Yükleniyor…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="td text-slate-500" colSpan={5}>
                  {search
                    ? 'Aramanızla eşleşen sakin bulunamadı.'
                    : 'Henüz sakin eklenmemiş. "Yeni Sakin" ile ekleyebilir veya Excel\'den toplu aktarabilirsiniz.'}
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="td font-semibold">{r.unit_no}</td>
                  <td className="td">
                    {r.is_ground_floor ? (
                      <span className="badge bg-amber-100 text-amber-800">Evet</span>
                    ) : (
                      <span className="badge bg-slate-100 text-slate-600">Hayır</span>
                    )}
                  </td>
                  <td className="td">{r.first_name}</td>
                  <td className="td">{r.last_name}</td>
                  <td className="td text-right whitespace-nowrap">
                    <button
                      type="button"
                      className="btn btn-secondary !px-3 !py-1.5"
                      onClick={() => setForm({ ...r })}
                    >
                      ✏️ Düzenle
                    </button>{' '}
                    <button
                      type="button"
                      className="btn btn-danger !px-3 !py-1.5"
                      onClick={() => void deleteResident(r)}
                    >
                      🗑️ Sil
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal title={form.id ? 'Sakin Düzenle' : 'Yeni Sakin Ekle'} onClose={() => setForm(null)}>
          <form onSubmit={(e) => void saveForm(e)} className="space-y-4">
            <div>
              <label className="label" htmlFor="unit">
                Blok-Daire No *
              </label>
              <input
                id="unit"
                className="input"
                placeholder="Örn: A Blok - 5"
                value={form.unit_no}
                onChange={(e) => setForm({ ...form, unit_no: e.target.value })}
                required
              />
            </div>
            <div>
              <span className="label">Giriş Kat mı?</span>
              <div className="flex gap-2">
                {([false, true] as const).map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => setForm({ ...form, is_ground_floor: v })}
                    className={`btn flex-1 ${
                      form.is_ground_floor === v ? 'btn-primary' : 'btn-secondary'
                    }`}
                  >
                    {v ? 'Evet' : 'Hayır'}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Giriş kat daireler için Ayarlar'da ayrı aidat tutarı tanımlanır.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="fname">
                  İsim *
                </label>
                <input
                  id="fname"
                  className="input"
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="lname">
                  Soyisim
                </label>
                <input
                  id="lname"
                  className="input"
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>
                Vazgeç
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {importRows && (
        <Modal title="Excel İçe Aktarım Önizleme" onClose={() => setImportRows(null)} wide>
          <div className="mb-3 rounded-lg bg-slate-50 p-3 text-sm">
            ✅ <strong>{validImportCount}</strong> satır içe aktarılacak
            {errorImportCount > 0 && (
              <>
                {' · '}❌ <strong className="text-red-600">{errorImportCount}</strong> hatalı satır
                atlanacak
              </>
            )}
            . Mevcut daire numaraları <span className="badge bg-sky-100 text-sky-800">güncellenir</span>,
            yeniler eklenir.
          </div>
          <div className="max-h-80 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[560px]">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className="th">Satır</th>
                  <th className="th">Blok-Daire</th>
                  <th className="th">Giriş Kat</th>
                  <th className="th">İsim Soyisim</th>
                  <th className="th">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {importRows.map((r) => (
                  <tr key={r.line} className={r.error ? 'bg-red-50' : ''}>
                    <td className="td">{r.line}</td>
                    <td className="td font-medium">{r.unit_no || '—'}</td>
                    <td className="td">{r.is_ground_floor ? 'Evet' : 'Hayır'}</td>
                    <td className="td">
                      {r.first_name} {r.last_name}
                    </td>
                    <td className="td">
                      {r.error ? (
                        <span className="text-xs font-medium text-red-600">{r.error}</span>
                      ) : existingUnits.has(r.unit_no) ? (
                        <span className="badge bg-sky-100 text-sky-800">Güncellenecek</span>
                      ) : (
                        <span className="badge bg-emerald-100 text-emerald-800">Yeni</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setImportRows(null)}>
              Vazgeç
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void doImport()}
              disabled={importing || validImportCount === 0}
            >
              {importing ? 'Aktarılıyor…' : `${validImportCount} Satırı İçe Aktar`}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
