import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  useExpenses,
  usePayments,
  useRates,
  useResidents,
  useSettings,
  useTariffs,
} from '../hooks/useData'
import {
  TR_MONTHS,
  addMonths,
  currentYM,
  monthLabel,
  monthsFrom,
  parseDateStr,
  todayStr,
  ymKey,
} from '../lib/dates'
import { fmtTL, toKurus } from '../lib/money'
import {
  assessMonth,
  earliestYM,
  rateEntriesFromRows,
  tariffEntriesFromRows,
} from '../lib/interest'
import { buildPaymentMap, paymentsFor } from '../lib/paymentMap'
import BarChart from '../components/BarChart'
import type { BarChartItem } from '../components/BarChart'

function StatCard({
  emoji,
  label,
  value,
  sub,
  tone = 'default',
}: {
  emoji: string
  label: string
  value: string
  sub?: string
  tone?: 'default' | 'danger' | 'success'
}) {
  const valueColor =
    tone === 'danger' ? 'text-red-600' : tone === 'success' ? 'text-emerald-600' : 'text-slate-900'
  return (
    <div className="card">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
        <span aria-hidden>{emoji}</span>
        {label}
      </div>
      <div className={`mt-1.5 text-xl font-bold sm:text-2xl ${valueColor}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const residents = useResidents()
  const payments = usePayments()
  const expenses = useExpenses()
  const tariffs = useTariffs()
  const rates = useRates()
  const settings = useSettings()

  const cur = currentYM()
  const today = todayStr()

  const payMap = useMemo(() => buildPaymentMap(payments.data ?? []), [payments.data])
  const tariffEntries = useMemo(() => tariffEntriesFromRows(tariffs.data ?? []), [tariffs.data])
  const rateEntries = useMemo(() => rateEntriesFromRows(rates.data ?? []), [rates.data])

  const monthIncome = useMemo(
    () =>
      (payments.data ?? [])
        .filter((p) => p.period_year === cur.year && p.period_month === cur.month)
        .reduce((acc, p) => acc + toKurus(p.amount), 0),
    [payments.data, cur.year, cur.month],
  )

  const yearIncome = useMemo(
    () =>
      (payments.data ?? [])
        .filter((p) => p.period_year === cur.year)
        .reduce((acc, p) => acc + toKurus(p.amount), 0),
    [payments.data, cur.year],
  )

  const monthExpense = useMemo(
    () =>
      (expenses.data ?? [])
        .filter((e) => {
          const d = parseDateStr(e.doc_date)
          return d.y === cur.year && d.m === cur.month
        })
        .reduce((acc, e) => acc + toKurus(e.total_amount), 0),
    [expenses.data, cur.year, cur.month],
  )

  // Tüm dönemler için geciken borç (anapara + işlemiş gecikme faizi)
  const debtors = useMemo(() => {
    if (!residents.data || !settings.data || tariffEntries.length === 0) return null
    const start = earliestYM(tariffEntries)
    if (!start) return null
    const months = monthsFrom(start, cur)
    return residents.data
      .map((r) => {
        let debt = 0
        for (const ym of months) {
          const a = assessMonth({
            period: ym,
            isGroundFloor: r.is_ground_floor,
            tariffs: tariffEntries,
            rates: rateEntries,
            dueDay: settings.data.due_day,
            payments: paymentsFor(payMap, r.id, ymKey(ym)),
            today,
          })
          if (a && a.status === 'gecikmis') debt += a.remainingKurus
        }
        return { resident: r, debtKurus: debt }
      })
      .filter((d) => d.debtKurus > 0)
      .sort((a, b) => b.debtKurus - a.debtKurus)
  }, [residents.data, settings.data, tariffEntries, rateEntries, payMap, cur, today])

  const totalDebt = (debtors ?? []).reduce((acc, d) => acc + d.debtKurus, 0)

  const chartItems: BarChartItem[] = useMemo(() => {
    const items: BarChartItem[] = []
    for (let i = 5; i >= 0; i--) {
      const ym = addMonths(cur, -i)
      const income = (payments.data ?? [])
        .filter((p) => p.period_year === ym.year && p.period_month === ym.month)
        .reduce((acc, p) => acc + toKurus(p.amount), 0)
      const expense = (expenses.data ?? [])
        .filter((e) => {
          const d = parseDateStr(e.doc_date)
          return d.y === ym.year && d.m === ym.month
        })
        .reduce((acc, e) => acc + toKurus(e.total_amount), 0)
      items.push({
        label: `${TR_MONTHS[ym.month - 1].slice(0, 3)} ${String(ym.year).slice(2)}`,
        incomeKurus: income,
        expenseKurus: expense,
      })
    }
    return items
  }, [payments.data, expenses.data, cur])

  const anyError =
    residents.error || payments.error || expenses.error || tariffs.error || rates.error

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">📊 Özet</h1>
        <p className="text-sm text-slate-500">Aktif dönem: {monthLabel(cur)}</p>
      </div>

      {anyError && (
        <div className="card border-red-200 bg-red-50 text-sm text-red-800">
          Veriler yüklenirken hata oluştu: {(anyError as Error).message}
        </div>
      )}

      {tariffs.isSuccess && tariffEntries.length === 0 && (
        <div className="card border-amber-300 bg-amber-50 text-sm text-amber-900">
          ⚠️ Henüz <strong>aidat tarifesi</strong> tanımlanmamış; aidat takibi bu yüzden boş görünür.{' '}
          <Link to="/ayarlar" className="font-semibold underline">
            Ayarlar
          </Link>{' '}
          ekranından aylık aidat tutarlarını tanımlayın.
        </div>
      )}
      {rates.isSuccess && rateEntries.length === 0 && tariffEntries.length > 0 && (
        <div className="card border-sky-200 bg-sky-50 text-sm text-sky-900">
          ℹ️ Gecikme faizi oranı tanımlı değil; gecikmiş aidatlara faiz <strong>işletilmez</strong>.{' '}
          <Link to="/ayarlar" className="font-semibold underline">
            Ayarlar
          </Link>{' '}
          ekranından aylık faiz oranı ekleyebilirsiniz.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          emoji="💰"
          label="Bu Ay Toplanan Aidat"
          value={fmtTL(monthIncome)}
          sub={`${monthLabel(cur)} dönemine sayılan tahsilatlar`}
          tone="success"
        />
        <StatCard
          emoji="📅"
          label="Bu Yıl Toplanan Aidat"
          value={fmtTL(yearIncome)}
          sub={`${cur.year} yılına ait tüm dönemler`}
        />
        <StatCard
          emoji="⏰"
          label="Toplam Geciken Borç"
          value={fmtTL(totalDebt)}
          sub={
            debtors === null
              ? 'Tarife tanımlanınca hesaplanır'
              : `${debtors.length} sakin gecikmede (faiz dahil)`
          }
          tone={totalDebt > 0 ? 'danger' : 'default'}
        />
        <StatCard
          emoji="🧾"
          label="Bu Ay Masraf"
          value={fmtTL(monthExpense)}
          sub="Belge tarihi bu ay olan giderler"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="mb-3 font-bold">Son 6 Ay: Aidat Geliri / Masraf</h2>
          <BarChart items={chartItems} />
        </div>

        <div className="card">
          <h2 className="mb-3 font-bold">En Borçlu Sakinler</h2>
          {debtors === null ? (
            <p className="text-sm text-slate-500">Aidat tarifesi tanımlanınca listelenir.</p>
          ) : debtors.length === 0 ? (
            <p className="text-sm text-emerald-700">🎉 Geciken borcu olan sakin yok.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {debtors.slice(0, 8).map((d) => (
                <li key={d.resident.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{d.resident.unit_no}</div>
                    <div className="truncate text-xs text-slate-500">
                      {d.resident.first_name} {d.resident.last_name}
                    </div>
                  </div>
                  <span className="text-sm font-bold text-red-600">{fmtTL(d.debtKurus)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/aidat" className="btn btn-secondary mt-3 w-full">
            Aidat Takibine Git →
          </Link>
        </div>
      </div>
    </div>
  )
}
