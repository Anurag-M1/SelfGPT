'use client'

import { useRef, useState } from 'react'
import { useChat } from '@/context/chat-context'
import { useAuth } from '@/context/auth-context'
import { useSettings } from '@/context/settings-context'
import { ChatMessages } from './chat-messages'
import { MessageInput } from './message-input'
import { SettingsModal } from './settings-modal'
import { Footer } from './footer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sparkles } from 'lucide-react'

const API_BASE =
  typeof window === 'undefined'
    ? process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:8000'
    : ''

export function ChatApp() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const manualAbortRef = useRef(false)
  const typingRef = useRef<number | null>(null)
  const { chats, activeChat, renameChat, addMessage, updateMessage, createChat, selectChat } = useChat()
  const { user, token } = useAuth()
  const { settings, models } = useSettings()

  const REQUEST_TIMEOUT_MS = 30000
  const TYPE_CHUNK_SIZE = 10
  const TYPE_INTERVAL_MS = 28

  const splitForTyping = (text: string) => {
    const fenceIndex = text.indexOf('```')
    if (fenceIndex === -1) {
      return { typed: text, suffix: '' }
    }
    return {
      typed: text.slice(0, fenceIndex).trimEnd(),
      suffix: text.slice(fenceIndex),
    }
  }

  const pickFastModel = (list: string[], current?: string) => {
    if (!list.length) return ''
    const scored = list
      .map(name => {
        const lower = name.toLowerCase()
        let score = 0
        if (lower.includes('mini') || lower.includes('lite') || lower.includes('small')) score -= 1000
        if (lower.includes('instant') || lower.includes('fast')) score -= 800
        const nums = lower.match(/\\d+(?:\\.\\d+)?/g)
        if (nums) score -= nums.reduce((acc, num) => acc + Number(num), 0)
        return { name, score }
      })
      .sort((a, b) => a.score - b.score)
    const best = scored[0]?.name || list[0]
    if (current && best === current && scored.length > 1) return scored[1].name
    return best
  }

  const handleSendMessage = async (text: string, files?: File[]) => {
    if (!activeChat) {
      console.error('[v0] No active chat')
      return
    }

    const messageId = Date.now().toString()
    const userMessage = {
      id: messageId,
      role: 'user' as const,
      content: text,
      timestamp: Date.now(),
    }

    addMessage(activeChat.id, userMessage)

    // Update chat title if it's the first message
    if (activeChat.messages.length === 0) {
      const title = text.substring(0, 50) + (text.length > 50 ? '...' : '')
      renameChat(activeChat.id, title)
    }

    // Send to AI
    try {
      if (abortRef.current) {
        abortRef.current.abort()
      }
      setIsLoading(true)
      manualAbortRef.current = false

      if (files && files.length > 0) {
        const form = new FormData()
        form.append('thread_id', activeChat.id)
        files.forEach(file => form.append('files', file))

        const uploadResp = await fetch(`${API_BASE}/api/upload`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: form,
        })
        if (!uploadResp.ok) {
          const errText = await uploadResp.text()
          throw new Error(errText || 'File upload failed')
        }
      }

      const sendChatRequest = async (modelOverride?: string) => {
        const controller = new AbortController()
        abortRef.current = controller
        let timedOut = false
        const timeoutId = window.setTimeout(() => {
          timedOut = true
          controller.abort()
        }, REQUEST_TIMEOUT_MS)

        try {
          const payload: Record<string, unknown> = {
            thread_id: activeChat.id,
            message: text,
          }
          if (settings.provider) payload.provider = settings.provider
          if (modelOverride || settings.model) payload.model = modelOverride || settings.model
          if (settings.systemPrompt) payload.system_prompt = settings.systemPrompt
          if (settings.useWeb) payload.use_web = true

          const resp = await fetch(`${API_BASE}/api/chat`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          })
          if (!resp.ok) {
            const errText = await resp.text()
            throw new Error(errText || 'Chat request failed')
          }

          const data = await resp.json()
          return { data, timedOut: false }
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            if (timedOut) return { data: null, timedOut: true }
            if (manualAbortRef.current) return { data: null, timedOut: false, cancelled: true }
          }
          throw err
        } finally {
          window.clearTimeout(timeoutId)
        }
      }

      let result = await sendChatRequest()
      if (result.cancelled) return
      if (result.timedOut) {
        const fastModel = pickFastModel(models, settings.model)
        if (fastModel && fastModel !== settings.model) {
          result = await sendChatRequest(fastModel)
        } else {
          throw new Error('Request timed out.')
        }
      }

      const data = result.data || {}
      const reply = typeof data?.message === 'string' ? data.message : ''

      if (reply) {
        const assistantId = `${Date.now()}-assistant`
        const { typed, suffix } = splitForTyping(reply)
        addMessage(activeChat.id, {
          id: assistantId,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          sources: Array.isArray(data?.web) ? data.web : undefined,
        })

        if (typingRef.current) {
          window.clearInterval(typingRef.current)
        }
        setIsTyping(true)
        let cursor = 0
        typingRef.current = window.setInterval(() => {
          cursor = Math.min(typed.length, cursor + TYPE_CHUNK_SIZE)
          updateMessage(activeChat.id, assistantId, {
            content: typed.slice(0, cursor),
          })
          if (cursor >= typed.length && typingRef.current) {
            window.clearInterval(typingRef.current)
            typingRef.current = null
            if (suffix) {
              updateMessage(activeChat.id, assistantId, {
                content: `${typed}${suffix}`,
              })
            }
            setIsTyping(false)
          }
        }, TYPE_INTERVAL_MS)
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      console.error('[v0] Error sending message:', error)
      addMessage(activeChat.id, {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, something went wrong while generating a response.',
        timestamp: Date.now(),
      })
    } finally {
      setIsLoading(false)
      abortRef.current = null
      manualAbortRef.current = false
      if (!typingRef.current) {
        setIsTyping(false)
      }
    }
  }

  const displayMessages = activeChat?.messages || []
  const handleStop = () => {
    if (abortRef.current) {
      manualAbortRef.current = true
      abortRef.current.abort()
      abortRef.current = null
      setIsLoading(false)
    }
    if (typingRef.current) {
      window.clearInterval(typingRef.current)
      typingRef.current = null
    }
    setIsTyping(false)
  }

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border bg-card/50 backdrop-blur-sm p-3 sm:p-4 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-4 flex-1">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-secondary transition-colors">
                <div className="p-1.5 bg-gradient-to-br from-primary to-accent rounded-lg">
                  <Sparkles className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="text-left">
                  <p className="text-xs text-muted-foreground">Chats</p>
                  <p className="text-sm sm:text-base font-semibold max-w-[140px] sm:max-w-[200px] truncate">
                    {activeChat?.title || 'SelfGPT'}
                  </p>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 max-h-80 overflow-y-auto">
                <DropdownMenuItem
                  onSelect={() => {
                    createChat()
                  }}
                >
                  New Chat
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {chats.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No chats yet
                  </div>
                ) : (
                  chats.map(chat => (
                    <DropdownMenuItem
                      key={chat.id}
                      onSelect={() => selectChat(chat.id)}
                      className={chat.id === activeChat?.id ? 'bg-secondary' : undefined}
                    >
                      <span className="truncate">{chat.title}</span>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* User Profile */}
          {user && (
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-secondary transition-colors"
              aria-label="Open settings"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-sm font-bold text-primary-foreground">
                {user.name.charAt(0).toUpperCase()}
              </div>
            </button>
          )}
        </div>

        {/* Chat Area */}
        <ChatMessages
          messages={displayMessages}
          isLoading={isLoading}
          isWide
          isTyping={isTyping}
        />

        {/* Sticky Input + Footer */}
        <div className="sticky bottom-0 z-40 bg-card/95 backdrop-blur-sm border-t border-border">
          <MessageInput onSend={handleSendMessage} isLoading={isLoading} onStop={handleStop} />
          <Footer />
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
