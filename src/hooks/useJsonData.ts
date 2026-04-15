import { useEffect, useState } from 'react'

const dataCache = new Map<string, unknown>()
const inflightRequests = new Map<string, Promise<unknown>>()

export async function loadJsonData<T>(url: string): Promise<T> {
  if (dataCache.has(url)) {
    return dataCache.get(url) as T
  }

  const existingRequest = inflightRequests.get(url) as Promise<T> | undefined
  if (existingRequest) {
    return existingRequest
  }

  const request = fetch(url, { cache: 'force-cache' })
    .then(async response => {
      if (!response.ok) {
        throw new Error(`Failed to load ${url}: ${response.status}`)
      }

      const json = await response.json() as T
      dataCache.set(url, json)
      inflightRequests.delete(url)
      return json
    })
    .catch(error => {
      inflightRequests.delete(url)
      throw error
    })

  inflightRequests.set(url, request)
  return request
}

export function useJsonData<T>(url: string) {
  const [data, setData] = useState<T | null>(() => {
    return (dataCache.get(url) as T | undefined) ?? null
  })
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    if (dataCache.has(url)) {
      setData(dataCache.get(url) as T)
      setError(null)
      return () => {
        cancelled = true
      }
    }

    loadJsonData<T>(url)
      .then(result => {
        if (cancelled) return
        setData(result)
        setError(null)
      })
      .catch(err => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
      })

    return () => {
      cancelled = true
    }
  }, [url])

  return { data, error }
}
