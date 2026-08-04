'use client'

import React, { createContext, useContext } from 'react'

export interface SuspensionState {
  isSuspended: boolean
  suspendedAt: string | null
  suspendReason: string | null
  isLoading: boolean
  refetch: () => void
}

const SuspensionContext = createContext<SuspensionState>({
  isSuspended: false,
  suspendedAt: null,
  suspendReason: null,
  isLoading: false,
  refetch: () => {},
})

export function SuspensionProvider({ children }: { children: React.ReactNode }) {
  return (
    <SuspensionContext.Provider value={{ isSuspended: false, suspendedAt: null, suspendReason: null, isLoading: false, refetch: () => {} }}>
      {children}
    </SuspensionContext.Provider>
  )
}

export const useSuspension = () => useContext(SuspensionContext)
