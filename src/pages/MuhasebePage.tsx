import { useMemo, useState } from 'react'
import { useExpenses, useMonthlyIncome } from '../hooks/useData'
import { currentYM, formatDateTR, monthLabel, parseDateStr } from '../lib/dates'
import { fmtTL, toKurus } from '../lib/money'
import {
  EXPENSE_COL_WIDTHS,
  EXPENSE_HEADERS,
  buildSheet,
  downloadXlsx,
  expensesToRows,
} from '../lib/excel'
import PeriodPicker from '../components/PeriodPicker'
import { useToast } from '../components/Toast'

/**
 * Muhasebeci ekranı: yıl/ay seçimi + o ayın toplam aidat geliri + masraf
 * kayıtlarının Excel dışa aktarımı. Muhasebeci rolü başka hiçbir modüle erişemez
 * (menüde görünmez, rotalar kapalı, veritabanı RLS politikaları da engeller).
 */
export default function MuhasebePage() {
  const { toast } = useToast()
  const [period, setPeriod] = useState(currentYM())
  const income = useMonthlyIncome(period.year, period.month)
  const expenses = useExpenses()

  const monthExpenses = useMemo(
    () =>
      (expenses.data ?? [])
        .filter((e) => {
          const d = parseDateStr(e.doc_date)
          return d.y === period.year && d.m === period.month
        })
        .sort((a, b) => (a.doc_date < b.doc_date ? -1 : 1)),
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

  const exportExcel = () => {
    if (monthExpenses.length === 0) {
      toast('info', 'Bu dönemde dışa aktarılacak masraf kaydı yok.')
      return
    }
    const name = `Masraflar_${period.year}-${String(period.month).padStart(2, '0')}.xlsx`
    downloadXlsx(name, 'Masraflar', buildSheet(expensesToRows(monthExpenses), EXPENSE_HEADERS, EXPENSE_COL_WIDTHS))
    toast('success', `${monthExpenses.length} kayıt Excel dosyasına aktarıldı.`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">📑 Muhasebe</h1>
          <p className="text-sm text-slate-500">Dönem seçin, masraf kayıtlarını Excel olarak indirin.</p>
        </div>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card">
          <div className="text-sm font-medium text-slate-500">💰 Toplam Aidat Geliri</div>
          <div className="mt-1.5 text-2xl font-bold text-emerald-600">
            {income.isLoading ? '…' : income.error ? '—' : fmtTL(toKurus(income.data ?? 0))}
          </div>
          <div className="mt-1 text-xs text-slate-500">{monthLabel(period)} dönemi</div>
          {income.error && (
            <div className="mt-1 text-xs text-red-600">{(income.error as Error).message}</div>
          )}
        </div>
        <div className="card">
          <div className="text-sm font-medium text-slate-500">🧾 Masraf Toplamı</div>
          <div className="mt-1.5 text-2xl font-bold">{fmtTL(totals.total)}</div>
          <div className="mt-1 text-xs text-slate-500">KDV dahil, belge tarihine göre</div>
        </div>
        <div className="card">
          <div className="text-sm font-medium text-slate-500">📄 Belge Adedi</div>
          <div className="mt-1.5 text-2xl font-bold">{monthExpenses.length}</div>
          <button type="button" className="btn btn-primary mt-2 w-full" onClick={exportExcel}>
            ⬇️ Excel'e Aktar
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto !p-0">
        <table className="w-full min-w-[900px]">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="th">Belge Türü</th>
              <th className="th">Firma Ünvanı</th>
              <th className="th">Vergi/TC No</th>
              <th className="th">Belge Tarihi</th>
              <th className="th">Belge No</th>
              <th className="th text-right">Matrah</th>
              <th className="th text-right">KDV</th>
              <th className="th text-right">Toplam</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {expenses.isLoading ? (
              <tr>
                <td className="td text-slate-500" colSpan={8}>
                  Yükleniyor…
                </td>
              </tr>
            ) : monthExpenses.length === 0 ? (
              <tr>
                <td className="td text-slate-500" colSpan={8}>
                  Bu dönemde masraf kaydı bulunmuyor.
                </td>
              </tr>
            ) : (
              monthExpenses.map((e) => (
                <tr key={e.id}>
                  <td className="td">{e.doc_type === 'fatura' ? 'Fatura' : 'Fiş'}</td>
                  <td className="td font-medium">{e.vendor_title}</td>
                  <td className="td">{e.tax_number}</td>
                  <td className="td whitespace-nowrap">{formatDateTR(e.doc_date)}</td>
                  <td className="td">{e.doc_no}</td>
                  <td className="td text-right">{fmtTL(toKurus(e.base_amount))}</td>
                  <td className="td text-right">
                    {fmtTL(toKurus(e.vat_amount))}
                    <span className="text-xs text-slate-400"> (%{e.vat_rate})</span>
                  </td>
                  <td className="td text-right font-semibold">{fmtTL(toKurus(e.total_amount))}</td>
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
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
