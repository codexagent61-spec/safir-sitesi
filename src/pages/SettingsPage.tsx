import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useInvalidate, useRates, useSettings, useTariffs } from '../hooks/useData'
import type { RateRow, TariffRow } from '../hooks/useData'
import { TR_MONTHS, currentYM, monthLabel } from '../lib/dates'
import { fmtTL, fromKurus, parseAmountToKurus, toKurus } from '../lib/money'
import { rateFor, rateEntriesFromRows, tariffFor, tariffEntriesFromRows } from '../lib/interest'
import { useToast } from '../components/Toast'

function YearSelect({
  id,
  value,
  onChange,
}: {
  id?: string
  value: number
  onChange: (y: number) => void
}) {
  const cur = currentYM().year
  const years: number[] = []
  for (let y = 2023; y <= cur + 2; y++) years.push(y)
  if (!years.includes(value)) years.push(value)
  years.sort((a, b) => a - b)
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {years.map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  )
}

function MonthSelect({
  id,
  value,
  onChange,
}: {
  id?: string
  value: number
  onChange: (m: number) => void
}) {
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {TR_MONTHS.map((name, i) => (
        <option key={name} value={i + 1}>
          {name}
        </option>
      ))}
    </select>
  )
}

export default function SettingsPage() {
  const { toast } = useToast()
  const invalidate = useInvalidate()
  const tariffs = useTariffs()
  const rates = useRates()
  const settings = useSettings()

  const cur = currentYM()

  const [tForm, setTForm] = useState({
    year: cur.year,
    month: cur.month,
    normalStr: '',
    groundStr: '',
  })
  // Faiz oranları yılda bir Mart'ta değiştiği için ay alanı Mart seçili gelir.
  const [rForm, setRForm] = useState({ year: cur.year, month: 3, rateStr: '' })
  const [dueDayStr, setDueDayStr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const sortedTariffs = useMemo(
    () =>
      [...(tariffs.data ?? [])].sort(
        (a, b) =>
          b.effective_year * 12 + b.effective_month - (a.effective_year * 12 + a.effective_month),
      ),
    [tariffs.data],
  )
  const sortedRates = useMemo(
    () =>
      [...(rates.data ?? [])].sort(
        (a, b) =>
          b.effective_year * 12 + b.effective_month - (a.effective_year * 12 + a.effective_month),
      ),
    [rates.data],
  )

  const activeTariff = useMemo(
    () => tariffFor(tariffEntriesFromRows(tariffs.data ?? []), cur),
    [tariffs.data, cur],
  )
  const activeRate = useMemo(
    () => rateFor(rateEntriesFromRows(rates.data ?? []), cur),
    [rates.data, cur],
  )

  const addTariff = async (e: FormEvent) => {
    e.preventDefault()
    const normal = parseAmountToKurus(tForm.normalStr)
    const ground = parseAmountToKurus(tForm.groundStr)
    if (normal === null || normal < 0)
      return toast('error', 'Normal daire aidatı için geçerli bir tutar girin.')
    if (ground === null || ground < 0)
      return toast('error', 'Giriş kat aidatı için geçerli bir tutar girin.')
    setBusy(true)
    const { error } = await supabase.from('dues_tariffs').insert({
      effective_year: tForm.year,
      effective_month: tForm.month,
      normal_amount: fromKurus(normal),
      ground_floor_amount: fromKurus(ground),
    })
    setBusy(false)
    if (error) {
      if (error.code === '23505')
        return toast('error', 'Bu dönem için tarife zaten tanımlı. Önce eskisini silin.')
      return toast('error', `Kaydedilemedi: ${error.message}`)
    }
    toast('success', `${monthLabel({ year: tForm.year, month: tForm.month })} itibarıyla aidat tarifesi eklendi.`)
    setTForm({ ...tForm, normalStr: '', groundStr: '' })
    invalidate('tariffs')
  }

  const deleteTariff = async (t: TariffRow) => {
    if (
      !window.confirm(
        `${monthLabel({ year: t.effective_year, month: t.effective_month })} tarihli tarife silinsin mi?\n\nDikkat: Bu tarife ile hesaplanan dönemlerin aidat tutarları değişebilir.`,
      )
    )
      return
    const { error } = await supabase.from('dues_tariffs').delete().eq('id', t.id)
    if (error) return toast('error', `Silinemedi: ${error.message}`)
    toast('success', 'Tarife silindi.')
    invalidate('tariffs')
  }

  const addRate = async (e: FormEvent) => {
    e.preventDefault()
    const rate = Number(rForm.rateStr.trim().replace(',', '.'))
    if (!Number.isFinite(rate) || rate < 0 || rate > 100)
      return toast('error', 'Aylık faiz oranı 0 ile 100 arasında olmalıdır (örn: 5 veya 3,5).')
    setBusy(true)
    const { error } = await supabase.from('interest_rates').insert({
      effective_year: rForm.year,
      effective_month: rForm.month,
      monthly_rate_pct: Math.round(rate * 1000) / 1000,
    })
    setBusy(false)
    if (error) {
      if (error.code === '23505')
        return toast('error', 'Bu dönem için faiz oranı zaten tanımlı. Önce eskisini silin.')
      return toast('error', `Kaydedilemedi: ${error.message}`)
    }
    toast('success', `${monthLabel({ year: rForm.year, month: rForm.month })} itibarıyla aylık %${rate} faiz tanımlandı.`)
    setRForm({ ...rForm, rateStr: '' })
    invalidate('rates')
  }

  const deleteRate = async (r: RateRow) => {
    if (
      !window.confirm(
        `${monthLabel({ year: r.effective_year, month: r.effective_month })} tarihli faiz oranı silinsin mi?\n\nDikkat: Gecikme faizi hesapları değişebilir.`,
      )
    )
      return
    const { error } = await supabase.from('interest_rates').delete().eq('id', r.id)
    if (error) return toast('error', `Silinemedi: ${error.message}`)
    toast('success', 'Faiz oranı silindi.')
    invalidate('rates')
  }

  const saveDueDay = async (e: FormEvent) => {
    e.preventDefault()
    const n = Number(dueDayStr ?? settings.data?.due_day ?? 31)
    if (!Number.isInteger(n) || n < 1 || n > 31)
      return toast('error', 'Son ödeme günü 1 ile 31 arasında bir sayı olmalıdır.')
    setBusy(true)
    const { error } = await supabase.from('app_settings').upsert({ id: 1, due_day: n })
    setBusy(false)
    if (error) return toast('error', `Kaydedilemedi: ${error.message}`)
    toast('success', `Son ödeme günü ayın ${n}. günü olarak kaydedildi.`)
    setDueDayStr(null)
    invalidate('settings')
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">⚙️ Ayarlar</h1>
        <p className="text-sm text-slate-500">
          Bu ekrana yalnızca Yönetici ve Sayman erişebilir.
        </p>
      </div>

      <div className="card border-sky-200 bg-sky-50 text-sm text-sky-900">
        <strong>Şu an geçerli:</strong>{' '}
        {activeTariff
          ? `Normal daire ${fmtTL(activeTariff.normalKurus)} · Giriş kat ${fmtTL(activeTariff.groundKurus)}`
          : 'aidat tarifesi tanımlı değil'}
        {' · '}Gecikme faizi: aylık %{activeRate}
        {' · '}Son ödeme: ayın {settings.data?.due_day ?? 31}. günü
      </div>

      {/* ---------------- Aidat tarifeleri ---------------- */}
      <div className="card">
        <h2 className="font-bold">💰 Kat Bazlı Aidat Tutarları</h2>
        <p className="mt-1 text-sm text-slate-500">
          Seçtiğiniz aydan itibaren geçerli olur; yeni bir tarife ekleyene kadar sonraki aylarda da
          aynı tutar uygulanır. İlk tarifenin başlangıç ayı, aidat takibinin de başlangıcıdır.
        </p>
        <form onSubmit={(e) => void addTariff(e)} className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div>
            <label className="label">Yıl</label>
            <YearSelect value={tForm.year} onChange={(year) => setTForm({ ...tForm, year })} />
          </div>
          <div>
            <label className="label">Ay (başlangıç)</label>
            <MonthSelect value={tForm.month} onChange={(month) => setTForm({ ...tForm, month })} />
          </div>
          <div>
            <label className="label">Normal Daire (TL)</label>
            <input
              className="input"
              inputMode="decimal"
              placeholder="Örn: 750"
              value={tForm.normalStr}
              onChange={(e) => setTForm({ ...tForm, normalStr: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Giriş Kat Daire (TL)</label>
            <input
              className="input"
              inputMode="decimal"
              placeholder="Örn: 600"
              value={tForm.groundStr}
              onChange={(e) => setTForm({ ...tForm, groundStr: e.target.value })}
              required
            />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn btn-primary w-full" disabled={busy}>
              ➕ Ekle
            </button>
          </div>
        </form>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Geçerlilik Başlangıcı</th>
                <th className="th text-right">Normal Daire</th>
                <th className="th text-right">Giriş Kat</th>
                <th className="th text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedTariffs.length === 0 ? (
                <tr>
                  <td className="td text-slate-500" colSpan={4}>
                    Henüz tarife tanımlanmadı.
                  </td>
                </tr>
              ) : (
                sortedTariffs.map((t) => (
                  <tr key={t.id}>
                    <td className="td font-medium">
                      {monthLabel({ year: t.effective_year, month: t.effective_month })}
                    </td>
                    <td className="td text-right">{fmtTL(toKurus(t.normal_amount))}</td>
                    <td className="td text-right">{fmtTL(toKurus(t.ground_floor_amount))}</td>
                    <td className="td text-right">
                      <button
                        type="button"
                        className="btn btn-danger !px-3 !py-1.5"
                        onClick={() => void deleteTariff(t)}
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
      </div>

      {/* ---------------- Faiz oranları ---------------- */}
      <div className="card">
        <h2 className="font-bold">📈 Aylık Gecikme Faizi Oranları</h2>
        <p className="mt-1 text-sm text-slate-500">
          Oranlar genellikle her yıl Mart ayında güncellenir; bu yüzden ay alanı Mart seçili gelir.
          Seçtiğiniz aydan itibaren, yeni bir oran tanımlanana kadar geçerlidir. Günlük faiz, aylık
          oranın 30'a bölünmesiyle (kıst esası) hesaplanır.
        </p>
        <form onSubmit={(e) => void addRate(e)} className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div>
            <label className="label">Yıl</label>
            <YearSelect value={rForm.year} onChange={(year) => setRForm({ ...rForm, year })} />
          </div>
          <div>
            <label className="label">Ay (başlangıç)</label>
            <MonthSelect value={rForm.month} onChange={(month) => setRForm({ ...rForm, month })} />
          </div>
          <div>
            <label className="label">Aylık Oran (%)</label>
            <input
              className="input"
              inputMode="decimal"
              placeholder="Örn: 5"
              value={rForm.rateStr}
              onChange={(e) => setRForm({ ...rForm, rateStr: e.target.value })}
              required
            />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn btn-primary w-full" disabled={busy}>
              ➕ Ekle
            </button>
          </div>
        </form>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[400px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Geçerlilik Başlangıcı</th>
                <th className="th text-right">Aylık Oran</th>
                <th className="th text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedRates.length === 0 ? (
                <tr>
                  <td className="td text-slate-500" colSpan={3}>
                    Henüz faiz oranı tanımlanmadı (gecikmelere faiz işletilmez).
                  </td>
                </tr>
              ) : (
                sortedRates.map((r) => (
                  <tr key={r.id}>
                    <td className="td font-medium">
                      {monthLabel({ year: r.effective_year, month: r.effective_month })}
                    </td>
                    <td className="td text-right">%{r.monthly_rate_pct}</td>
                    <td className="td text-right">
                      <button
                        type="button"
                        className="btn btn-danger !px-3 !py-1.5"
                        onClick={() => void deleteRate(r)}
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
      </div>

      {/* ---------------- Genel ---------------- */}
      <div className="card">
        <h2 className="font-bold">📅 Son Ödeme Günü</h2>
        <p className="mt-1 text-sm text-slate-500">
          Aidatın her ay en geç hangi güne kadar ödenmesi gerektiğini belirler. Bu günden sonra
          kalan borca gecikme faizi işlemeye başlar. 29-31 girilirse kısa aylarda ayın son günü
          kabul edilir (31 = "ayın son günü").
        </p>
        <form onSubmit={(e) => void saveDueDay(e)} className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="dueDay">
              Ayın günü (1-31)
            </label>
            <input
              id="dueDay"
              className="input !w-28"
              type="number"
              min={1}
              max={31}
              value={dueDayStr ?? String(settings.data?.due_day ?? 31)}
              onChange={(e) => setDueDayStr(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            💾 Kaydet
          </button>
        </form>
      </div>
    </div>
  )
}
