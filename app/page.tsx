'use client'

import React, { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from '@/context/auth-context'
import { ChatProvider } from '@/context/chat-context'
import { SettingsProvider } from '@/context/settings-context'
import { ChatApp } from '@/components/chat-app'

function PageContent() {
  const { isLoading } = useAuth()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || isLoading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <SettingsProvider>
      <ChatProvider>
        <ChatApp />
      </ChatProvider>
    </SettingsProvider>
  )
}

export default function Page() {
  return (
    <AuthProvider>
      <PageContent />
    </AuthProvider>
  )
}
