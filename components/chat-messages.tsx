'use client'

import React, { useEffect, useRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Bot, User, Loader } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  sources?: { title: string; url: string; snippet?: string }[]
}

interface ChatMessagesProps {
  messages: Message[]
  isLoading: boolean
  isWide?: boolean
  isTyping?: boolean
}

export function ChatMessages({ messages, isLoading, isWide, isTyping }: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [shouldAutoScroll, setShouldAutoScroll] = React.useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const getViewport = () => {
    if (viewportRef.current) return viewportRef.current
    if (!scrollRef.current) return null
    const viewport = scrollRef.current.querySelector(
      '[data-radix-scroll-area-viewport]',
    ) as HTMLDivElement | null
    if (viewport) viewportRef.current = viewport
    return viewport
  }

  const isNearBottom = () => {
    const viewport = getViewport()
    if (!viewport) return true
    const threshold = 120
    const remaining = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
    return remaining < threshold
  }

  const scrollToBottom = (behavior: ScrollBehavior) => {
    const viewport = getViewport()
    if (!viewport) return
    viewport.scrollTo({ top: viewport.scrollHeight, behavior })
  }

  useEffect(() => {
    const viewport = getViewport()
    if (!viewport) return
    const handleScroll = () => {
      setShouldAutoScroll(isNearBottom())
    }
    viewport.addEventListener('scroll', handleScroll, { passive: true })
    return () => viewport.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!shouldAutoScroll) return
    scrollToBottom(isTyping ? 'auto' : 'smooth')
  }, [messages, isLoading, isTyping, shouldAutoScroll])

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <ScrollArea ref={scrollRef} className="flex-1 bg-gradient-to-b from-background/50 to-background">
      <div className={`${isWide ? 'max-w-none' : 'max-w-3xl'} mx-auto p-4 sm:p-6 pb-28 space-y-6`}>
        {messages.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-96 text-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-full blur-2xl opacity-30"></div>
              <div className="relative p-4 bg-card rounded-full border border-border/50">
                <Bot className="w-8 h-8 text-primary" />
              </div>
            </div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
              Welcome to SelfGPT
            </h2>
            <p className="text-muted-foreground max-w-sm">
              Start a conversation with your personal AI assistant. Ask me anything!
            </p>
          </div>
        ) : (
          <>
            {messages.map(message => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`flex gap-3 max-w-[90%] sm:max-w-xl ${
                    message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border border-border/50 ${
                      message.role === 'user'
                        ? 'bg-primary/10'
                        : 'bg-accent/10'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <User className="w-4 h-4 text-primary" />
                    ) : (
                      <Bot className="w-4 h-4 text-accent" />
                    )}
                  </div>

                  {/* Message */}
                  <div className="flex flex-col gap-2">
                    <div
                      className={`px-4 py-3 rounded-xl whitespace-pre-wrap break-words ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-br-sm'
                          : 'bg-secondary/60 text-foreground rounded-bl-sm border border-border/50'
                      }`}
                    >
                      {message.content}
                    </div>
                    {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                      <div className="px-4 py-2 rounded-lg border border-border/50 bg-card/60 text-xs space-y-1">
                        <p className="text-muted-foreground uppercase tracking-wide text-[10px]">Sources</p>
                        <div className="space-y-1">
                          {message.sources.slice(0, 3).map((source, idx) => (
                            <div key={`${message.id}-src-${idx}`} className="space-y-0.5">
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline"
                              >
                                {source.title || source.url}
                              </a>
                              {source.snippet && (
                                <p className="text-muted-foreground">{source.snippet}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground px-4">
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-accent/10 border border-border/50">
                    <Bot className="w-4 h-4 text-accent" />
                  </div>
                  <div className="bg-secondary/60 text-foreground px-4 py-3 rounded-xl border border-border/50 rounded-bl-sm">
                    <div className="flex gap-2">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                      <div
                        className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                        style={{ animationDelay: '100ms' }}
                      />
                      <div
                        className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                        style={{ animationDelay: '200ms' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  )
}
