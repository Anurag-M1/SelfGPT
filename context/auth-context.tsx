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
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  signupEmail: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
  updateProfile: (updates: Partial<User>) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load user from localStorage on mount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const storedUser = localStorage.getItem('selfgpt_user')
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser))
          } catch {
            localStorage.removeItem('selfgpt_user')
          }
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
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const newUser: User = {
        id: Date.now().toString(),
        email,
        name: email.split('@')[0],
        theme: 'dark',
      }
      setUser(newUser)
      if (typeof window !== 'undefined') {
        localStorage.setItem('selfgpt_user', JSON.stringify(newUser))
      }
    } catch (error) {
      console.error('[v0] Login error:', error)
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
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const newUser: User = {
        id: Date.now().toString(),
        email,
        name,
        theme: 'dark',
      }
      setUser(newUser)
      if (typeof window !== 'undefined') {
        localStorage.setItem('selfgpt_user', JSON.stringify(newUser))
      }
    } catch (error) {
      console.error('[v0] Signup error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('selfgpt_user')
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
    <AuthContext.Provider value={{ user, isLoading, login, signupEmail, logout, updateProfile }}>
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
