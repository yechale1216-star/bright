"use client"

import React, { createContext, useContext } from "react"

export interface SubscriptionData {
  id: string
  schoolId: string
  tier: string
  billingPeriod: string
  studentCount: number
  status: string
  billingStart: string
  billingEnd: string
  renewalDate: string
  [key: string]: any
}

interface SubscriptionContextValue {
  subscription: SubscriptionData | null
  loading: boolean
  error: string | null
  refresh: () => void
}

const activeSubscription: SubscriptionData = {
  id: "single-school",
  schoolId: "single-school",
  tier: "enterprise",
  billingPeriod: "yearly",
  studentCount: 10000,
  status: "ACTIVE",
  billingStart: new Date().toISOString(),
  billingEnd: new Date(Date.now() + 365*24*60*60*1000).toISOString(),
  renewalDate: new Date(Date.now() + 365*24*60*60*1000).toISOString(),
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  subscription: activeSubscription,
  loading: false,
  error: null,
  refresh: () => {},
})

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  return (
    <SubscriptionContext.Provider
      value={{ subscription: activeSubscription, loading: false, error: null, refresh: () => {} }}
    >
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription(): SubscriptionContextValue {
  return useContext(SubscriptionContext)
}
