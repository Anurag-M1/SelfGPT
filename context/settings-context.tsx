'use client'

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

const API_BASE =
  typeof window === 'undefined'
    ? process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:8000'
    : ''

const STORAGE_KEY = 'selfgpt_settings'

interface ProviderOption {
  id: string
  label: string
  type: string
  key_env: string
}

export interface AISettings {
  provider: string
  model: string
  systemPrompt: string
  useWeb: boolean
}

interface SettingsContextType {
  settings: AISettings
  updateSettings: (partial: Partial<AISettings>) => void
  providers: ProviderOption[]
  models: string[]
  refreshModels: (providerId?: string) => Promise<void>
  isConfigLoading: boolean
  configError: string | null
  modelError: string | null
}

const envUseWeb = process.env.NEXT_PUBLIC_USE_WEB?.trim()

const DEFAULT_SETTINGS: AISettings = {
  provider: process.env.NEXT_PUBLIC_LLM_PROVIDER?.trim() || 'groq',
  model: process.env.NEXT_PUBLIC_LLM_MODEL?.trim() || '',
  systemPrompt: process.env.NEXT_PUBLIC_SYSTEM_PROMPT?.trim() || '',
  useWeb: envUseWeb ? envUseWeb === 'true' : true,
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS)
  const [providers, setProviders] = useState<ProviderOption[]>([])
  const [models, setModels] = useState<string[]>([])
  const [isConfigLoading, setIsConfigLoading] = useState(true)
  const [configError, setConfigError] = useState<string | null>(null)
  const [modelError, setModelError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return
    try {
      const parsed = JSON.parse(stored) as Partial<AISettings>
      setSettings(prev => ({ ...prev, ...parsed }))
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    let cancelled = false

    async function loadConfig() {
      setIsConfigLoading(true)
      setConfigError(null)
      try {
        const resp = await fetch(`${API_BASE}/api/config`)
        if (!resp.ok) {
          throw new Error(await resp.text())
        }
        const data = await resp.json()
        const providerMap = data?.providers || {}
        const providerList: ProviderOption[] = Object.entries(providerMap).map(
          ([id, value]: [string, any]) => ({
            id,
            label: value?.label || id,
            type: value?.type || 'openai',
            key_env: value?.key_env || '',
          }),
        )

        if (!cancelled) {
          setProviders(providerList.sort((a, b) => a.label.localeCompare(b.label)))
        }
      } catch (err) {
        if (!cancelled) {
          setConfigError(err instanceof Error ? err.message : 'Failed to load config')
        }
      } finally {
        if (!cancelled) setIsConfigLoading(false)
      }
    }

    loadConfig()
    return () => {
      cancelled = true
    }
  }, [])

  const scoreModel = (name: string) => {
    const lower = name.toLowerCase()
    let score = 0
    if (lower.includes('mini') || lower.includes('lite') || lower.includes('small')) {
      score -= 1000
    }
    if (lower.includes('pro') || lower.includes('max') || lower.includes('ultra')) {
      score += 200
    }
    if (lower.includes('large') || lower.includes('xl')) {
      score += 150
    }
    const numbers = lower.match(/\d+(?:\.\d+)?/g)
    if (numbers) {
      score += numbers.reduce((acc, num) => acc + Number(num), 0)
    }
    return score
  }

  const pickBestModel = (list: string[]) => {
    if (list.length === 0) return ''
    const preferred = list.find(name => {
      const lower = name.toLowerCase()
      return lower.includes('llama-3') && lower.includes('70b')
    })
    if (preferred) return preferred
    return [...list].sort((a, b) => {
      const diff = scoreModel(b) - scoreModel(a)
      if (diff !== 0) return diff
      return a.localeCompare(b)
    })[0]
  }

  const refreshModels = async (providerId?: string) => {
    const target = providerId || settings.provider
    if (!target) return
    setModelError(null)
    setModels([])
    try {
      const resp = await fetch(`${API_BASE}/api/models?provider=${encodeURIComponent(target)}`)
      const data = await resp.json()
      if (!resp.ok || data?.error) {
        throw new Error(data?.error || 'Unable to load models')
      }
      const modelListRaw = Array.isArray(data?.models) ? data.models : []
      const modelList = Array.from(new Set(modelListRaw.filter(Boolean)))
      setModels(modelList)

      if (modelList.length > 0) {
        const best = pickBestModel(modelList)
        setSettings(prev => {
          if (prev.model && modelList.includes(prev.model)) return prev
          return { ...prev, model: best || prev.model || modelList[0] }
        })
      }
    } catch (err) {
      setModelError(err instanceof Error ? err.message : 'Unable to load models')
    }
  }

  useEffect(() => {
    if (!settings.provider) return
    refreshModels(settings.provider)
  }, [settings.provider])

  useEffect(() => {
    if (!providers.length) return
    const exists = providers.some(p => p.id === settings.provider)
    if (exists) return
    setSettings(prev => ({ ...prev, provider: providers[0].id }))
  }, [providers])

  const updateSettings = (partial: Partial<AISettings>) => {
    setSettings(prev => ({ ...prev, ...partial }))
  }

  const value = useMemo(
    () => ({
      settings,
      updateSettings,
      providers,
      models,
      refreshModels,
      isConfigLoading,
      configError,
      modelError,
    }),
    [settings, providers, models, isConfigLoading, configError, modelError],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider')
  }
  return context
}
