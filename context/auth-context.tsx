'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

interface User {
  id: string
  email: string
  name: string
  avatar?: string
  theme?: 'light' | 'dark'
}

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  signupEmail: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
  updateProfile: (updates: Partial<User>) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const API_BASE =
  typeof window === 'undefined'
    ? process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:8000'
    : ''

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load user from localStorage on mount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const storedToken = localStorage.getItem('selfgpt_token')
        if (storedToken) {
          const loadUser = async () => {
            try {
              const resp = await fetch(`${API_BASE}/api/auth/me`, {
                headers: { Authorization: `Bearer ${storedToken}` },
              })
              if (resp.ok) {
                const data = await resp.json()
                setUser(data.user)
                setToken(storedToken)
              } else {
                localStorage.removeItem('selfgpt_token')
                localStorage.removeItem('selfgpt_user')
              }
            } catch {
              localStorage.removeItem('selfgpt_token')
              localStorage.removeItem('selfgpt_user')
            }
          }
          loadUser()
        }
      }
    } catch (error) {
      console.error('[v0] Error loading user:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const login = async (email: string, password: string) => {
    if (!email.trim() || !password.trim()) {
      throw new Error('Email and password are required.')
    }
    setIsLoading(true)
    try {
      const resp = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!resp.ok) {
        const errText = await resp.text()
        throw new Error(errText || 'Login failed')
      }
      const data = await resp.json()
      setUser(data.user)
      setToken(data.token)
      if (typeof window !== 'undefined') {
        localStorage.setItem('selfgpt_user', JSON.stringify(data.user))
        localStorage.setItem('selfgpt_token', data.token)
      }
    } catch (error) {
      console.error('[v0] Login error:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const signupEmail = async (email: string, password: string, name: string) => {
    if (!email.trim() || !password.trim() || !name.trim()) {
      throw new Error('Name, email and password are required.')
    }
    setIsLoading(true)
    try {
      const resp = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })
      if (!resp.ok) {
        const errText = await resp.text()
        throw new Error(errText || 'Signup failed')
      }
      const data = await resp.json()
      setUser(data.user)
      setToken(data.token)
      if (typeof window !== 'undefined') {
        localStorage.setItem('selfgpt_user', JSON.stringify(data.user))
        localStorage.setItem('selfgpt_token', data.token)
      }
    } catch (error) {
      console.error('[v0] Signup error:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('selfgpt_user')
        localStorage.removeItem('selfgpt_token')
      }
    } catch (error) {
      console.error('[v0] Error removing user:', error)
    }
  }

  const updateProfile = (updates: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updates }
      setUser(updatedUser)
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('selfgpt_user', JSON.stringify(updatedUser))
        }
      } catch (error) {
        console.error('[v0] Error saving user:', error)
      }
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, signupEmail, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
