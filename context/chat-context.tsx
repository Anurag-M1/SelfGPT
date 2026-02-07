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

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChat, setActiveChat] = useState<Chat | null>(null)

  // Load chats from localStorage on mount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const storedChats = localStorage.getItem('selfgpt_chats')
        if (storedChats) {
          try {
            const parsed = JSON.parse(storedChats)
            setChats(parsed)
            if (parsed.length > 0) {
              setActiveChat(parsed[0])
            }
          } catch {
            localStorage.removeItem('selfgpt_chats')
          }
        } else {
          // Create initial chat
          const initialChat: Chat = {
            id: Date.now().toString(),
            title: 'New Chat',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
          setChats([initialChat])
          setActiveChat(initialChat)
        }
      }
    } catch (error) {
      console.error('[v0] Error loading chats:', error)
      // Create initial chat on error
      const initialChat: Chat = {
        id: Date.now().toString(),
        title: 'New Chat',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      setChats([initialChat])
      setActiveChat(initialChat)
    }
  }, [])

  // Save chats to localStorage whenever they change
  useEffect(() => {
    try {
      if (chats.length > 0 && typeof window !== 'undefined') {
        localStorage.setItem('selfgpt_chats', JSON.stringify(chats))
      } else if (typeof window !== 'undefined') {
        localStorage.removeItem('selfgpt_chats')
      }
    } catch (error) {
      console.error('[v0] Error saving chats:', error)
    }
  }, [chats])

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
        localStorage.removeItem('selfgpt_chats')
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
