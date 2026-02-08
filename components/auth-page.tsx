'use client'

import React, { useState } from 'react'
import { useAuth } from '@/context/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Mail, Lock, User, Sparkles } from 'lucide-react'

type AuthMode = 'login' | 'signup'

export function AuthPage() {
  const { login, signupEmail } = useAuth()
  const [mode, setMode] = useState<AuthMode>('login')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const email = formData.email.trim()
    const password = formData.password.trim()
    if (!email || !password) {
      setError('Email and password are required.')
      return
    }
    if (mode === 'signup' && !formData.name.trim()) {
      setError('Full name is required.')
      return
    }
    setIsLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await signupEmail(email, password, formData.name.trim())
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border/50 shadow-2xl">
        <div className="p-8">
          {/* Logo */}
          <div className="flex items-center justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-lg blur opacity-75"></div>
              <div className="relative bg-background rounded-lg p-3">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
            </div>
            <h1 className="ml-3 text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              SelfGPT
            </h1>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-center mb-2">
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-center text-muted-foreground mb-8">
            {mode === 'login' ? 'Sign in to your account' : 'Start your AI journey'}
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="relative">
                <User className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                <Input
                  name="name"
                  type="text"
                  placeholder="Full Name"
                  value={formData.name}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  className="pl-10"
                />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
              <Input
                name="email"
                type="email"
                placeholder="Email address"
                value={formData.email}
                onChange={handleInputChange}
                disabled={isLoading}
                className="pl-10"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
              <Input
                name="password"
                type="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleInputChange}
                disabled={isLoading}
                className="pl-10"
              />
            </div>

            <Button
              type="submit"
              disabled={
                isLoading ||
                !formData.email.trim() ||
                !formData.password.trim() ||
                (mode === 'signup' && !formData.name.trim())
              }
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              {isLoading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>
          {error && (
            <p className="mt-3 text-sm text-destructive text-center">{error}</p>
          )}

          {/* Toggle Auth Mode */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login')
                setFormData({ email: '', password: '', name: '' })
              }}
              className="text-primary hover:underline font-semibold"
            >
              {mode === 'login' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </Card>
    </div>
  )
}
