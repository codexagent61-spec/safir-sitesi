import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  useInvalidate,
  usePayments,
  useRates,
  useResidents,
  useSettings,
  useTariffs,
} from '../hooks/useData'
import type { Payment, Resident } from '../hooks/useData'
import {
  addMonths,
  currentYM,
  formatDateTR,
  monthLabel,
  monthsFrom,
  todayStr,
  ymKey,
} from '../lib/dates'
import type { YM } from '../lib/dates'
import { fmtTL, kurusToInput, parseAmountToKurus, toKurus, fromKurus } from '../lib/money'
import {
  assessMonth,
  earliestYM,
  rateEntriesFromRows,
  tariffEntriesFromRows,
} from '../lib/interest'
import type { MonthStatus, RateEntry, TariffEntry } from '../lib/interest'
import { buildPaymentMap, paymentsFor } from '../lib/paymentMap'
import type { PaymentMap } from '../lib/paymentMap'
import Modal from '../components/Modal'
import PeriodPicker from '../components/PeriodPicker'
import { useToast } from '../components/Toast'

function StatusBadge({ status }: { status: MonthStatus }) {
  const map: Record<MonthStatus, { cls: string; text: string }> = {
    odendi: { cls: 'bg-emerald-100 text-emerald-800', text: 'Ödendi' },
    kismi: { cls: 'bg-amber-100 text-amber-800', text: 'Kısmi Ödeme' },
    bekliyor: { cls: 'bg-slate-100 text-slate-600', text: 'Bekliyor' },
    gecikmis: { cls: 'bg-red-100 text-red-700', text: 'Gecikmiş' },
  }
  const { cls, text } = map[status]
  return <span className={`badge ${cls}`}>{text}</span>
}

interface PayTarget {
  resident: Resident
  period: YM
  defaultAmountKurus: number
}

function PaymentModal({
  target,
  onClose,
  onSaved,
}: {
  target: PayTarget
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const { session } = useAuth()
  const [period, setPeriod] = useState<YM>(target.period)
  const [amountStr, setAmountStr] = useState(
    target.defaultAmountKurus > 0 ? kurusToInput(target.defaultAmountKurus) : '',
  )
  const [paidOn, setPaidOn] = useState(todayStr())
  const [method, setMethod] = useState<'banka' | 'elden'>('banka')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async (advance: boolean) => {
    const amountKurus = parseAmountToKurus(amountStr)
    if (amountKurus === null || amountKurus <= 0)
      return toast('error', 'Geçerli bir tutar girin (örn: 750 veya 750,50).')
    if (!paidOn) return toast('error', 'Ödeme tarihi seçin.')
    setSaving(true)
    const { error } = await supabase.from('payments').insert({
      resident_id: target.resident.id,
      period_year: period.year,
      period_month: period.month,
      amount: fromKurus(amountKurus),
      paid_on: paidOn,
      method,
      note: note.trim(),
      created_by: session?.user.id ?? null,
    })
    setSaving(false)
    if (error) return toast('error', `Ödeme kaydedilemedi: ${error.message}`)
    toast('success', `${monthLabel(period)} için ${fmtTL(amountKurus)} ödeme kaydedildi.`)
    onSaved()
    if (advance) {
      setPeriod(addMonths(period, 1))
      setNote('')
    } else {
      onClose()
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void save(false)
  }

  return (
    <Modal
      title={`Ödeme Al – ${target.resident.unit_no} (${target.resident.first_name} ${target.resident.last_name})`}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <span className="label">Hangi ayın aidatı?</span>
          <PeriodPicker value={period} onChange={setPeriod} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="amount">
              Tutar (TL) *
            </label>
            <input
              id="amount"
              className="input"
              inputMode="decimal"
              placeholder="Örn: 750,00"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="paidOn">
              Ödeme Tarihi *
            </label>
            <input
              id="paidOn"
              type="date"
              className="input"
              value={paidOn}
              onChange={(e) => setPaidOn(e.target.value)}
              required
            />
          </div>
        </div>
        <div>
          <span className="label">Ödeme Yöntemi</span>
          <div className="flex gap-2">
            {(['banka', 'elden'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`btn flex-1 ${method === m ? 'btn-primary' : 'btn-secondary'}`}
              >
                {m === 'banka' ? '🏦 Banka' : '🤝 Elden (Nakit)'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="note">
            Not (isteğe bağlı)
          </label>
          <input
            id="note"
            className="input"
            placeholder="Örn: Dekont no, açıklama…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Vazgeç
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={saving}
            onClick={() => void save(true)}
          >
            Kaydet ve Sonraki Ay →
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function StatementModal({
  resident,
  tariffs,
  rates,
  dueDay,
  payMap,
  onClose,
}: {
  resident: Resident
  tariffs: TariffEntry[]
  rates: RateEntry[]
  dueDay: number
  payMap: PaymentMap
  onClose: () => void
}) {
  const today = todayStr()
  const start = earliestYM(tariffs)
  const rows = useMemo(() => {
    if (!start) return []
    return monthsFrom(start, currentYM())
      .map((ym) =>
        assessMonth({
          period: ym,
          isGroundFloor: resident.is_ground_floor,
          tariffs,
          rates,
          dueDay,
          payments: paymentsFor(payMap, resident.id, ymKey(ym)),
          today,
        }),
      )
      .filter((a): a is NonNullable<typeof a> => a !== null)
  }, [start, resident, tariffs, rates, dueDay, payMap, today])

  const totalDebt = rows
    .filter((r) => r.status === 'gecikmis')
    .reduce((acc, r) => acc + r.remainingKurus, 0)

  return (
    <Modal
      title={`Hesap Ekstresi – ${resident.unit_no} (${resident.first_name} ${resident.last_name})`}
      onClose={onClose}
      wide
    >
      <div className="mb-3 rounded-lg bg-slate-50 p-3 text-sm">
        Toplam geciken borç (faiz dahil):{' '}
        <strong className={totalDebt > 0 ? 'text-red-600' : 'text-emerald-600'}>
          {fmtTL(totalDebt)}
        </strong>
      </div>
      <div className="max-h-96 overflow-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[640px]">
          <thead className="sticky top-0 bg-slate-50">
            <tr>
              <th className="th">Dönem</th>
              <th className="th">Son Ödeme</th>
              <th className="th text-right">Aidat</th>
              <th className="th text-right">Ödenen</th>
              <th className="th text-right">Gecikme Faizi</th>
              <th className="th text-right">Kalan</th>
              <th className="th">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((a) => (
              <tr key={ymKey(a.period)}>
                <td className="td font-medium whitespace-nowrap">{monthLabel(a.period)}</td>
                <td className="td whitespace-nowrap">{formatDateTR(a.dueDate)}</td>
                <td className="td text-right">{fmtTL(a.principalKurus)}</td>
                <td className="td text-right">{fmtTL(a.paidKurus)}</td>
                <td className="td text-right">
                  {a.interestAccruedKurus > 0 ? fmtTL(a.interestAccruedKurus) : '—'}
                </td>
                <td className="td text-right font-semibold">
                  {a.remainingKurus > 0 ? fmtTL(a.remainingKurus) : '—'}
                </td>
                <td className="td">
                  <StatusBadge status={a.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}

export default function DuesPage() {
  const { toast } = useToast()
  const invalidate = useInvalidate()
  const residents = useResidents()
  const payments = usePayments()
  const tariffs = useTariffs()
  const rates = useRates()
  const settings = useSettings()

  const [tab, setTab] = useState<'durum' | 'odemeler'>('durum')
  const [period, setPeriod] = useState<YM>(currentYM())
  const [search, setSearch] = useState('')
  const [payTarget, setPayTarget] = useState<PayTarget | null>(null)
  const [statementFor, setStatementFor] = useState<Resident | null>(null)

  const today = todayStr()
  const dueDay = settings.data?.due_day ?? 31
  const tariffEntries = useMemo(() => tariffEntriesFromRows(tariffs.data ?? []), [tariffs.data])
  const rateEntries = useMemo(() => rateEntriesFromRows(rates.data ?? []), [rates.data])
  const payMap = useMemo(() => buildPaymentMap(payments.data ?? []), [payments.data])

  const rows = useMemo(() => {
    const list = residents.data ?? []
    const q = search.trim().toLocaleLowerCase('tr-TR')
    const key = ymKey(period)
    return list
      .filter(
        (r) =>
          !q || `${r.unit_no} ${r.first_name} ${r.last_name}`.toLocaleLowerCase('tr-TR').includes(q),
      )
      .map((resident) => ({
        resident,
        assessment: assessMonth({
          period,
          isGroundFloor: resident.is_ground_floor,
          tariffs: tariffEntries,
          rates: rateEntries,
          dueDay,
          payments: paymentsFor(payMap, resident.id, key),
          today,
        }),
      }))
  }, [residents.data, search, period, tariffEntries, rateEntries, dueDay, payMap, today])

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, { assessment: a }) => {
          if (!a) return acc
          return {
            principal: acc.principal + a.principalKurus,
            paid: acc.paid + a.paidKurus,
            interest: acc.interest + a.interestAccruedKurus,
            remaining: acc.remaining + a.remainingKurus,
          }
        },
        { principal: 0, paid: 0, interest: 0, remaining: 0 },
      ),
    [rows],
  )

  const periodPayments = useMemo(
    () =>
      (payments.data ?? [])
        .filter((p) => p.period_year === period.year && p.period_month === period.month)
        .sort((a, b) => (a.paid_on > b.paid_on ? -1 : 1)),
    [payments.data, period.year, period.month],
  )

  const residentById = useMemo(() => {
    const m = new Map<string, Resident>()
    for (const r of residents.data ?? []) m.set(r.id, r)
    return m
  }, [residents.data])

  const deletePayment = async (p: Payment) => {
    const r = residentById.get(p.resident_id)
    if (
      !window.confirm(
        `${r ? r.unit_no + ' – ' : ''}${fmtTL(toKurus(p.amount))} tutarındaki ödeme kaydı silinsin mi?`,
      )
    )
      return
    const { error } = await supabase.from('payments').delete().eq('id', p.id)
    if (error) return toast('error', `Silinemedi: ${error.message}`)
    toast('success', 'Ödeme kaydı silindi.')
    invalidate('payments')
  }

  const noTariff = tariffs.isSuccess && tariffEntries.length === 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">💰 Aidat Takibi</h1>
          <p className="text-sm text-slate-500">
            Son ödeme günü: ayın {dueDay}. günü{dueDay >= 29 ? ' (kısa aylarda ayın son günü)' : ''}
          </p>
        </div>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>

      {noTariff ? (
        <div className="card border-amber-300 bg-amber-50 text-sm text-amber-900">
          ⚠️ Aidat takibi için önce{' '}
          <Link to="/ayarlar" className="font-semibold underline">
            Ayarlar
          </Link>{' '}
          ekranından aylık aidat tutarlarını (normal ve giriş kat) tanımlamalısınız. Tarifenin
          başlangıç ayından itibaren tüm sakinler için aidat tahakkuk eder.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="card !p-3">
              <div className="text-xs font-medium text-slate-500">Dönem Tahakkuku</div>
              <div className="text-lg font-bold">{fmtTL(totals.principal)}</div>
            </div>
            <div className="card !p-3">
              <div className="text-xs font-medium text-slate-500">Ödenen</div>
              <div className="text-lg font-bold text-emerald-600">{fmtTL(totals.paid)}</div>
            </div>
            <div className="card !p-3">
              <div className="text-xs font-medium text-slate-500">Gecikme Faizi</div>
              <div className="text-lg font-bold text-amber-600">{fmtTL(totals.interest)}</div>
            </div>
            <div className="card !p-3">
              <div className="text-xs font-medium text-slate-500">Kalan</div>
              <div className="text-lg font-bold text-red-600">{fmtTL(totals.remaining)}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-200/70 p-1">
              {(['durum', 'odemeler'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                    tab === t ? 'bg-white shadow' : 'text-slate-600'
                  }`}
                >
                  {t === 'durum' ? 'Aylık Durum' : `Ödemeler (${periodPayments.length})`}
                </button>
              ))}
            </div>
            {tab === 'durum' && (
              <input
                className="input max-w-xs"
                placeholder="🔍 Daire veya isim ara…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            )}
          </div>

          {tab === 'durum' ? (
            <div className="card overflow-x-auto !p-0">
              <table className="w-full min-w-[800px]">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="th">Daire / Sakin</th>
                    <th className="th text-right">Aidat</th>
                    <th className="th text-right">Ödenen</th>
                    <th className="th text-right">Faiz</th>
                    <th className="th text-right">Kalan</th>
                    <th className="th">Durum</th>
                    <th className="th text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {residents.isLoading ? (
                    <tr>
                      <td className="td text-slate-500" colSpan={7}>
                        Yükleniyor…
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td className="td text-slate-500" colSpan={7}>
                        Sakin bulunamadı. Önce Sakinler ekranından sakin ekleyin.
                      </td>
                    </tr>
                  ) : (
                    rows.map(({ resident, assessment: a }) => (
                      <tr key={resident.id} className="hover:bg-slate-50">
                        <td className="td">
                          <div className="font-semibold">{resident.unit_no}</div>
                          <div className="text-xs text-slate-500">
                            {resident.first_name} {resident.last_name}
                            {resident.is_ground_floor && ' · Giriş kat'}
                          </div>
                        </td>
                        {a ? (
                          <>
                            <td className="td text-right">{fmtTL(a.principalKurus)}</td>
                            <td className="td text-right text-emerald-700">
                              {a.paidKurus > 0 ? fmtTL(a.paidKurus) : '—'}
                            </td>
                            <td className="td text-right text-amber-700">
                              {a.interestAccruedKurus > 0 ? fmtTL(a.interestAccruedKurus) : '—'}
                            </td>
                            <td className="td text-right font-semibold">
                              {a.remainingKurus > 0 ? (
                                <span className="text-red-600">{fmtTL(a.remainingKurus)}</span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="td">
                              <StatusBadge status={a.status} />
                              {a.overpaidKurus > 0 && (
                                <div className="mt-1 text-xs text-sky-700">
                                  +{fmtTL(a.overpaidKurus)} fazla ödeme
                                </div>
                              )}
                            </td>
                          </>
                        ) : (
                          <td className="td text-slate-400 italic" colSpan={5}>
                            Bu dönem için tarife yok
                          </td>
                        )}
                        <td className="td text-right whitespace-nowrap">
                          <button
                            type="button"
                            className="btn btn-primary !px-3 !py-1.5"
                            onClick={() =>
                              setPayTarget({
                                resident,
                                period,
                                defaultAmountKurus: a && a.remainingKurus > 0 ? a.remainingKurus : 0,
                              })
                            }
                          >
                            💳 Ödeme Al
                          </button>{' '}
                          <button
                            type="button"
                            className="btn btn-secondary !px-3 !py-1.5"
                            onClick={() => setStatementFor(resident)}
                          >
                            📋 Ekstre
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card overflow-x-auto !p-0">
              <table className="w-full min-w-[720px]">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="th">Ödeme Tarihi</th>
                    <th className="th">Daire / Sakin</th>
                    <th className="th text-right">Tutar</th>
                    <th className="th">Yöntem</th>
                    <th className="th">Not</th>
                    <th className="th text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {periodPayments.length === 0 ? (
                    <tr>
                      <td className="td text-slate-500" colSpan={6}>
                        {monthLabel(period)} dönemine kayıtlı ödeme yok.
                      </td>
                    </tr>
                  ) : (
                    periodPayments.map((p) => {
                      const r = residentById.get(p.resident_id)
                      return (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="td whitespace-nowrap">{formatDateTR(p.paid_on)}</td>
                          <td className="td">
                            <span className="font-semibold">{r?.unit_no ?? '?'}</span>{' '}
                            <span className="text-xs text-slate-500">
                              {r ? `${r.first_name} ${r.last_name}` : ''}
                            </span>
                          </td>
                          <td className="td text-right font-semibold">{fmtTL(toKurus(p.amount))}</td>
                          <td className="td">{p.method === 'banka' ? '🏦 Banka' : '🤝 Elden'}</td>
                          <td className="td max-w-48 truncate text-slate-500">{p.note || '—'}</td>
                          <td className="td text-right">
                            <button
                              type="button"
                              className="btn btn-danger !px-3 !py-1.5"
                              onClick={() => void deletePayment(p)}
                            >
                              🗑️ Sil
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {payTarget && (
        <PaymentModal
          target={payTarget}
          onClose={() => setPayTarget(null)}
          onSaved={() => invalidate('payments')}
        />
      )}
      {statementFor && (
        <StatementModal
          resident={statementFor}
          tariffs={tariffEntries}
          rates={rateEntries}
          dueDay={dueDay}
          payMap={payMap}
          onClose={() => setStatementFor(null)}
        />
      )}
    </div>
  )
}
