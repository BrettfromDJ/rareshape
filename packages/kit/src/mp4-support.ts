'use client'

import { useSyncExternalStore } from 'react'
import { isMp4Supported } from '@rareshape/export'

/**
 * Whether this browser can encode the locked H.264 profile.
 *
 * Modelled as an external store rather than an effect: the answer is a property
 * of the browser, not of any component, and every export sheet on the page
 * should share the one probe.
 */
let support: boolean | null = null
let probing = false
const listeners = new Set<() => void>()

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  if (!probing) {
    probing = true
    isMp4Supported().then(
      (result) => {
        support = result
        for (const listener of listeners) listener()
      },
      () => {
        support = false
      },
    )
  }
  return () => {
    listeners.delete(onChange)
  }
}

const getSnapshot = () => support === true
const getServerSnapshot = () => false

export function useMp4Support(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
