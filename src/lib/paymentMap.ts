// Ödeme listesini (sakin → dönem → ödemeler) haritasına çevirir;
// faiz motoru her sakin/dönem için bu haritadan beslenir.

import { ymKey } from './dates'
import { toKurus } from './money'
import type { PaymentEntry } from './interest'

export interface PaymentLike {
  resident_id: string
  period_year: number
  period_month: number
  amount: number
  paid_on: string
}

export type PaymentMap = Map<string, Map<number, PaymentEntry[]>>

export function buildPaymentMap(payments: PaymentLike[]): PaymentMap {
  const map: PaymentMap = new Map()
  for (const p of payments) {
    const key = ymKey({ year: p.period_year, month: p.period_month })
    let byPeriod = map.get(p.resident_id)
    if (!byPeriod) {
      byPeriod = new Map()
      map.set(p.resident_id, byPeriod)
    }
    let list = byPeriod.get(key)
    if (!list) {
      list = []
      byPeriod.set(key, list)
    }
    list.push({ amountKurus: toKurus(p.amount), paidOn: p.paid_on })
  }
  return map
}

export function paymentsFor(map: PaymentMap, residentId: string, periodKey: number): PaymentEntry[] {
  return map.get(residentId)?.get(periodKey) ?? []
}
