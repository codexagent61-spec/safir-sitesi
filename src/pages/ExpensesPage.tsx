import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useExpenses, useInvalidate } from '../hooks/useData'
import type { Expense } from '../hooks/useData'
import { currentYM, formatDateTR, isValidDateStr, monthLabel, parseDateStr, todayStr } from '../lib/dates'
import { fmtTL, fromKurus, kurusToInput, parseAmountToKurus, toKurus } from '../lib/money'
import { checkTaxNumber, computeVatKurus } from '../lib/validation'
import {
  EXPENSE_COL_WIDTHS,
  EXPENSE_HEADERS,
  buildSheet,
  downloadXlsx,
  expensesToRows,
} from '../lib/excel'
import Modal from '../components/Modal'
import PeriodPicker from '../components/PeriodPicker'
import { useToast } from '../components/Toast'

interface ExpenseForm {
  id: string | null
  doc_type: 'fatura' | 'fis'
  vendor_title: string
  tax_number: string
  doc_date: string
  doc_no: string
  baseStr: string
  rateStr: string
  vatStr: string
  description: string
}

const VAT_PRESETS = [0, 1, 10, 20]

const emptyForm = (): ExpenseForm => ({
  id: null,
  doc_type: 'fatura',
  vendor_title: '',
  tax_number: '',
  doc_date: todayStr(),
  doc_no: '',
  baseStr: '',
  rateStr: '20',
  vatStr: '',
  description: '',
})

const formFromExpense = (e: Expense): ExpenseForm => ({
  id: e.id,
  doc_type: e.doc_type,
  vendor_title: e.vendor_title,
  tax_number: e.tax_number,
  doc_date: e.doc_date,
  doc_no: e.doc_no,
  baseStr: kurusToInput(toKurus(e.base_amount)),
  rateStr: String(e.vat_rate).replace('.', ','),
  vatStr: kurusToInput(toKurus(e.vat_amount)),
  description: e.description,
})

function parseRate(s: string): number | null {
  const n = Number(s.trim().replace(',', '.'))
  if (!Number.isFinite(n) || n < 0 || n > 100) return null
  return Math.round(n * 100) / 100
}

export default function ExpensesPage() {
  const { toast } = useToast()
  const { session } = useAuth()
  const invalidate = useInvalidate()
  const expenses = useExpenses()
  const [period, setPeriod] = useState(currentYM())
  const [form, setForm] = useState<ExpenseForm | null>(null)
  const [saving, setSaving] = useState(false)

  const monthExpenses = useMemo(
    () =>
      (expenses.data ?? [])
        .filter((e) => {
          const d = parseDateStr(e.doc_date)
          return d.y === period.year && d.m === period.month
        })
        .sort((a, b) => (a.doc_date < b.doc_date ? 1 : -1)),
    [expenses.data, period.year, period.month],
  )

  const totals = useMemo(
    () =>
      monthExpenses.reduce(
        (acc, e) => ({
          base: acc.base + toKurus(e.base_amount),
          vat: acc.vat + toKurus(e.vat_amount),
          total: acc.total + toKurus(e.total_amount),
        }),
        { base: 0, vat: 0, total: 0 },
      ),
    [monthExpenses],
  )

  /** Matrah veya oran değişince KDV tutarını otomatik doldurur (elle düzeltilebilir). */
  const recalcVat = (baseStr: string, rateStr: string, f: ExpenseForm) => {
    const baseKurus = parseAmountToKurus(baseStr)
    const rate = parseRate(rateStr)
    const vatStr =
      baseKurus !== null && baseKurus >= 0 && rate !== null
        ? kurusToInput(computeVatKurus(baseKurus, rate))
        : f.vatStr
    setForm({ ...f, baseStr, rateStr, vatStr })
  }

  const formTotalKurus = useMemo(() => {
    if (!form) return null
    const b = parseAmountToKurus(form.baseStr)
    const v = parseAmountToKurus(form.vatStr)
    if (b === null || v === null) return null
    return b + v
  }, [form])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!form) return
    const vendor = form.vendor_title.replace(/\s+/g, ' ').trim()
    const docNo = form.doc_no.trim()
    const taxNo = form.tax_number.trim()

    if (!vendor) return toast('error', 'Firma ünvanı boş olamaz.')
    const taxCheck = checkTaxNumber(taxNo)
    if (!taxCheck.ok) return toast('error', taxCheck.error ?? 'Vergi/TC numarası geçersiz.')
    if (
      taxCheck.warning &&
      !window.confirm(`${taxCheck.warning}\n\nYine de kaydetmek istiyor musunuz?`)
    )
      return
    if (!isValidDateStr(form.doc_date)) return toast('error', 'Geçerli bir belge tarihi seçin.')
    if (!docNo) return toast('error', 'Belge numarası boş olamaz.')

    const baseKurus = parseAmountToKurus(form.baseStr)
    if (baseKurus === null || baseKurus < 0)
      return toast('error', 'Geçerli bir matrah tutarı girin (örn: 1.250,00).')
    const rate = parseRate(form.rateStr)
    if (rate === null) return toast('error', 'KDV oranı 0 ile 100 arasında olmalıdır.')
    const vatKurus = parseAmountToKurus(form.vatStr)
    if (vatKurus === null || vatKurus < 0) return toast('error', 'Geçerli bir KDV tutarı girin.')

    const payload = {
      doc_type: form.doc_type,
      vendor_title: vendor,
      tax_number: taxNo,
      doc_date: form.doc_date,
      doc_no: docNo,
      base_amount: fromKurus(baseKurus),
      vat_rate: rate,
      vat_amount: fromKurus(vatKurus),
      total_amount: fromKurus(baseKurus + vatKurus),
      description: form.description.trim(),
    }
    setSaving(true)
    const res = form.id
      ? await supabase.from('expenses').update(payload).eq('id', form.id)
      : await supabase
          .from('expenses')
          .insert({ ...payload, created_by: session?.user.id ?? null })
    setSaving(false)
    if (res.error) return toast('error', `Kaydedilemedi: ${res.error.message}`)
    toast('success', form.id ? 'Masraf kaydı güncellendi.' : 'Masraf kaydı eklendi.')
    setForm(null)
    invalidate('expenses')
  }

  const deleteExpense = async (e: Expense) => {
    if (
      !window.confirm(
        `${e.vendor_title} – ${fmtTL(toKurus(e.total_amount))} tutarındaki masraf kaydı silinsin mi?`,
      )
    )
      return
    const { error } = await supabase.from('expenses').delete().eq('id', e.id)
    if (error) return toast('error', `Silinemedi: ${error.message}`)
    toast('success', 'Masraf kaydı silindi.')
    invalidate('expenses')
  }

  const exportExcel = () => {
    if (monthExpenses.length === 0) return toast('info', 'Bu dönemde dışa aktarılacak kayıt yok.')
    const name = `Masraflar_${period.year}-${String(period.month).padStart(2, '0')}.xlsx`
    downloadXlsx(
      name,
      'Masraflar',
      buildSheet(expensesToRows(monthExpenses), EXPENSE_HEADERS, EXPENSE_COL_WIDTHS),
    )
    toast('success', `${monthExpenses.length} kayıt Excel dosyasına aktarıldı.`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">🧾 Masraflar</h1>
          <p className="text-sm text-slate-500">
            {monthLabel(period)}: {monthExpenses.length} belge · {fmtTL(totals.total)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker value={period} onChange={setPeriod} />
          <button type="button" className="btn btn-primary" onClick={() => setForm(emptyForm())}>
            ➕ Masraf Ekle
          </button>
          <button type="button" className="btn btn-secondary" onClick={exportExcel}>
            ⬇️ Excel'e Aktar
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto !p-0">
        <table className="w-full min-w-[960px]">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="th">Belge</th>
              <th className="th">Firma Ünvanı</th>
              <th className="th">Vergi/TC No</th>
              <th className="th">Tarih</th>
              <th className="th">Belge No</th>
              <th className="th text-right">Matrah</th>
              <th className="th text-right">KDV</th>
              <th className="th text-right">Toplam</th>
              <th className="th text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {expenses.isLoading ? (
              <tr>
                <td className="td text-slate-500" colSpan={9}>
                  Yükleniyor…
                </td>
              </tr>
            ) : monthExpenses.length === 0 ? (
              <tr>
                <td className="td text-slate-500" colSpan={9}>
                  Bu dönemde masraf kaydı yok. "Masraf Ekle" ile fatura/fiş girebilirsiniz.
                </td>
              </tr>
            ) : (
              monthExpenses.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="td">
                    <span
                      className={`badge ${
                        e.doc_type === 'fatura'
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-violet-100 text-violet-800'
                      }`}
                    >
                      {e.doc_type === 'fatura' ? 'Fatura' : 'Fiş'}
                    </span>
                  </td>
                  <td className="td font-medium">
                    {e.vendor_title}
                    {e.description && (
                      <div className="max-w-56 truncate text-xs text-slate-500">{e.description}</div>
                    )}
                  </td>
                  <td className="td">{e.tax_number}</td>
                  <td className="td whitespace-nowrap">{formatDateTR(e.doc_date)}</td>
                  <td className="td">{e.doc_no}</td>
                  <td className="td text-right">{fmtTL(toKurus(e.base_amount))}</td>
                  <td className="td text-right">
                    {fmtTL(toKurus(e.vat_amount))}
                    <span className="text-xs text-slate-400"> (%{e.vat_rate})</span>
                  </td>
                  <td className="td text-right font-semibold">{fmtTL(toKurus(e.total_amount))}</td>
                  <td className="td text-right whitespace-nowrap">
                    <button
                      type="button"
                      className="btn btn-secondary !px-3 !py-1.5"
                      onClick={() => setForm(formFromExpense(e))}
                    >
                      ✏️
                    </button>{' '}
                    <button
                      type="button"
                      className="btn btn-danger !px-3 !py-1.5"
                      onClick={() => void deleteExpense(e)}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {monthExpenses.length > 0 && (
            <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold">
              <tr>
                <td className="td" colSpan={5}>
                  TOPLAM
                </td>
                <td className="td text-right">{fmtTL(totals.base)}</td>
                <td className="td text-right">{fmtTL(totals.vat)}</td>
                <td className="td text-right">{fmtTL(totals.total)}</td>
                <td className="td" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {form && (
        <Modal
          title={form.id ? 'Masraf Düzenle' : 'Yeni Masraf (Fatura/Fiş)'}
          onClose={() => setForm(null)}
          wide
        >
          <form onSubmit={(e) => void save(e)} className="space-y-4">
            <div>
              <span className="label">Belge Türü *</span>
              <div className="flex gap-2">
                {(['fatura', 'fis'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, doc_type: t })}
                    className={`btn flex-1 ${form.doc_type === t ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {t === 'fatura' ? '🧾 Fatura' : '🛒 Fiş'}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="vendor">
                  Firma Ünvanı *
                </label>
                <input
                  id="vendor"
                  className="input"
                  placeholder="Örn: ABC Elektrik Ltd. Şti."
                  value={form.vendor_title}
                  onChange={(e) => setForm({ ...form, vendor_title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="taxno">
                  Vergi No (10 hane) / TC Kimlik No (11 hane) *
                </label>
                <input
                  id="taxno"
                  className="input"
                  inputMode="numeric"
                  placeholder="Örn: 1234567890"
                  value={form.tax_number}
                  onChange={(e) =>
                    setForm({ ...form, tax_number: e.target.value.replace(/\D/g, '').slice(0, 11) })
                  }
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="docdate">
                  Belge Tarihi *
                </label>
                <input
                  id="docdate"
                  type="date"
                  className="input"
                  value={form.doc_date}
                  onChange={(e) => setForm({ ...form, doc_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="docno">
                  Belge No *
                </label>
                <input
                  id="docno"
                  className="input"
                  placeholder="Fatura/fiş numarası"
                  value={form.doc_no}
                  onChange={(e) => setForm({ ...form, doc_no: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="base">
                  Matrah (KDV hariç tutar, TL) *
                </label>
                <input
                  id="base"
                  className="input"
                  inputMode="decimal"
                  placeholder="Örn: 1.250,00"
                  value={form.baseStr}
                  onChange={(e) => recalcVat(e.target.value, form.rateStr, form)}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="rate">
                  KDV Oranı (%) *
                </label>
                <div className="flex gap-1.5">
                  <input
                    id="rate"
                    className="input !w-24"
                    inputMode="decimal"
                    value={form.rateStr}
                    onChange={(e) => recalcVat(form.baseStr, e.target.value, form)}
                    required
                  />
                  {VAT_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`btn !px-3 ${
                        parseRate(form.rateStr) === p ? 'btn-primary' : 'btn-secondary'
                      }`}
                      onClick={() => recalcVat(form.baseStr, String(p), form)}
                    >
                      %{p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label" htmlFor="vat">
                  KDV Tutarı (TL) *
                </label>
                <input
                  id="vat"
                  className="input"
                  inputMode="decimal"
                  value={form.vatStr}
                  onChange={(e) => setForm({ ...form, vatStr: e.target.value })}
                  required
                />
                <p className="mt-1 text-xs text-slate-500">
                  Otomatik hesaplanır; belge üzerindeki kuruş farkı varsa elle düzeltin.
                </p>
              </div>
              <div>
                <span className="label">Toplam Tutar</span>
                <div className="input bg-slate-50 font-bold">
                  {formTotalKurus !== null ? fmtTL(formTotalKurus) : '—'}
                </div>
                <p className="mt-1 text-xs text-slate-500">Toplam = Matrah + KDV (otomatik)</p>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="desc">
                Açıklama (isteğe bağlı)
              </label>
              <input
                id="desc"
                className="input"
                placeholder="Örn: Asansör bakımı, Haziran"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
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
    </div>
  )
}
