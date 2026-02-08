'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  sources?: { title: string; url: string; snippet?: string }[]
}

export interface Chat {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

interface ChatContextType {
  chats: Chat[]
  activeChat: Chat | null
  createChat: (title?: string) => Chat
  selectChat: (id: string) => void
  deleteChat: (id: string) => void
  renameChat: (id: string, newTitle: string) => void
  addMessage: (chatId: string, message: ChatMessage) => void
  updateMessage: (
    chatId: string,
    messageId: string,
    patch: Partial<ChatMessage>,
  ) => void
  clearAllChats: () => void
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

const API_BASE =
  typeof window === 'undefined'
    ? process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:8000'
    : ''

export function ChatProvider({
  children,
  userId,
  token,
}: {
  children: React.ReactNode
  userId?: string | null
  token?: string | null
}) {
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChat, setActiveChat] = useState<Chat | null>(null)
  const storageKey = userId ? `selfgpt_chats_${userId}` : 'selfgpt_chats'

  // Load chats from backend on login
  useEffect(() => {
    let cancelled = false

    async function loadFromServer() {
      if (!token || !userId) {
        setChats([])
        setActiveChat(null)
        return
      }
      try {
        const resp = await fetch(`${API_BASE}/api/threads`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!resp.ok) {
          throw new Error(await resp.text())
        }
        const data = await resp.json()
        const threads: string[] = Array.isArray(data?.threads) ? data.threads : []
        const loaded: Chat[] = []
        for (const threadId of threads) {
          const msgResp = await fetch(`${API_BASE}/api/threads/${threadId}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (!msgResp.ok) continue
          const msgData = await msgResp.json()
          const messagesRaw = Array.isArray(msgData?.messages) ? msgData.messages : []
          const messages: ChatMessage[] = messagesRaw.map((msg, index) => ({
            id: `${threadId}-${index}`,
            role: msg.role,
            content: msg.content,
            timestamp: msg.created_at ? Date.parse(msg.created_at) : Date.now(),
          }))
          const firstUser = messages.find(m => m.role === 'user')
          const title = firstUser
            ? firstUser.content.slice(0, 50) + (firstUser.content.length > 50 ? '...' : '')
            : 'New Chat'
          const createdAt = messages[0]?.timestamp || Date.now()
          const updatedAt = messages[messages.length - 1]?.timestamp || createdAt
          loaded.push({
            id: threadId,
            title,
            messages,
            createdAt,
            updatedAt,
          })
        }
        if (!cancelled) {
          if (loaded.length === 0) {
            const initialChat: Chat = {
              id: Date.now().toString(),
              title: 'New Chat',
              messages: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }
            setChats([initialChat])
            setActiveChat(initialChat)
            if (typeof window !== 'undefined') {
              localStorage.setItem(storageKey, JSON.stringify([initialChat]))
            }
          } else {
            setChats(loaded)
            setActiveChat(loaded[0] || null)
            if (typeof window !== 'undefined') {
              localStorage.setItem(storageKey, JSON.stringify(loaded))
            }
          }
        }
      } catch (error) {
        console.error('[v0] Error loading chats:', error)
      }
    }

    loadFromServer()
    return () => {
      cancelled = true
    }
  }, [token, userId, storageKey])

  const createChat = (title?: string): Chat => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: title || 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setChats(prev => [newChat, ...prev])
    setActiveChat(newChat)
    return newChat
  }

  const selectChat = (id: string) => {
    const chat = chats.find(c => c.id === id)
    if (chat) {
      setActiveChat(chat)
    }
  }

  const deleteChat = (id: string) => {
    const filtered = chats.filter(c => c.id !== id)
    setChats(filtered)
    if (activeChat?.id === id) {
      setActiveChat(filtered.length > 0 ? filtered[0] : null)
    }
  }

  const renameChat = (id: string, newTitle: string) => {
    setChats(prev =>
      prev.map(chat =>
        chat.id === id ? { ...chat, title: newTitle, updatedAt: Date.now() } : chat
      )
    )
    if (activeChat?.id === id) {
      setActiveChat({ ...activeChat, title: newTitle, updatedAt: Date.now() })
    }
  }

  const addMessage = (chatId: string, message: ChatMessage) => {
    setChats(prev =>
      prev.map(chat =>
        chat.id === chatId
          ? { ...chat, messages: [...chat.messages, message], updatedAt: Date.now() }
          : chat
      )
    )
    if (activeChat?.id === chatId) {
      setActiveChat(prev =>
        prev
          ? { ...prev, messages: [...prev.messages, message], updatedAt: Date.now() }
          : null
      )
    }
  }

  const updateMessage = (
    chatId: string,
    messageId: string,
    patch: Partial<ChatMessage>,
  ) => {
    setChats(prev =>
      prev.map(chat =>
        chat.id === chatId
          ? {
              ...chat,
              messages: chat.messages.map(msg =>
                msg.id === messageId ? { ...msg, ...patch } : msg,
              ),
              updatedAt: Date.now(),
            }
          : chat,
      ),
    )
    if (activeChat?.id === chatId) {
      setActiveChat(prev =>
        prev
          ? {
              ...prev,
              messages: prev.messages.map(msg =>
                msg.id === messageId ? { ...msg, ...patch } : msg,
              ),
              updatedAt: Date.now(),
            }
          : null,
      )
    }
  }

  const clearAllChats = () => {
    setChats([])
    setActiveChat(null)
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(storageKey)
      } catch (error) {
        console.error('[v0] Error clearing chats:', error)
      }
    }
  }

  return (
    <ChatContext.Provider
      value={{
        chats,
        activeChat,
        createChat,
        selectChat,
        deleteChat,
        renameChat,
        addMessage,
        updateMessage,
        clearAllChats,
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChat must be used within ChatProvider')
  }
  return context
}
