import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Role } from '../lib/roles'

export interface Resident {
  id: string
  unit_no: string
  is_ground_floor: boolean
  first_name: string
  last_name: string
  created_at: string
}

export interface Payment {
  id: string
  resident_id: string
  period_year: number
  period_month: number
  amount: number
  paid_on: string
  method: 'banka' | 'elden'
  note: string
  created_at: string
}

export interface Expense {
  id: string
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
  created_at: string
}

export interface TariffRow {
  id: string
  effective_year: number
  effective_month: number
  normal_amount: number
  ground_floor_amount: number
}

export interface RateRow {
  id: string
  effective_year: number
  effective_month: number
  monthly_rate_pct: number
}

export interface AppSettings {
  id: number
  due_day: number
}

export interface ProfileRow {
  id: string
  email: string
  full_name: string
  role: Role
  created_at: string
}

/**
 * PostgREST tek istekte en fazla 1000 satır döndürür; bu yardımcı tüm
 * sayfaları dolaşarak eksiksiz liste getirir (veri bütünlüğü için önemli).
 */
async function fetchAll<T>(table: string, orderBy: string): Promise<T[]> {
  const pageSize = 1000
  const out: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(orderBy, { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const chunk = (data ?? []) as T[]
    out.push(...chunk)
    if (chunk.length < pageSize) return out
  }
}

export const useResidents = () =>
  useQuery({ queryKey: ['residents'], queryFn: () => fetchAll<Resident>('residents', 'unit_no') })

export const usePayments = () =>
  useQuery({ queryKey: ['payments'], queryFn: () => fetchAll<Payment>('payments', 'paid_on') })

export const useExpenses = () =>
  useQuery({ queryKey: ['expenses'], queryFn: () => fetchAll<Expense>('expenses', 'doc_date') })

export const useTariffs = () =>
  useQuery({
    queryKey: ['tariffs'],
    queryFn: () => fetchAll<TariffRow>('dues_tariffs', 'effective_year'),
  })

export const useRates = () =>
  useQuery({
    queryKey: ['rates'],
    queryFn: () => fetchAll<RateRow>('interest_rates', 'effective_year'),
  })

export const useSettings = () =>
  useQuery({
    queryKey: ['settings'],
    queryFn: async (): Promise<AppSettings> => {
      const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle()
      if (error) throw new Error(error.message)
      return (data ?? { id: 1, due_day: 31 }) as AppSettings
    },
  })

export const useProfiles = () =>
  useQuery({ queryKey: ['profiles'], queryFn: () => fetchAll<ProfileRow>('profiles', 'created_at') })

export const useMonthlyIncome = (year: number, month: number) =>
  useQuery({
    queryKey: ['monthly-income', year, month],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('monthly_income', { p_year: year, p_month: month })
      if (error) throw new Error(error.message)
      return Number(data ?? 0)
    },
  })

/** Mutasyon sonrası ilgili önbellekleri tazelemek için kısayol. */
export function useInvalidate() {
  const qc = useQueryClient()
  return (...keys: string[]) => {
    for (const key of keys) void qc.invalidateQueries({ queryKey: [key] })
  }
}
