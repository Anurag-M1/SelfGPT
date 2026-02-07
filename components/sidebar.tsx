'use client'

import React from 'react'
import { useChat } from '@/context/chat-context'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Plus,
  Trash2,
  MessageSquare,
  Sparkles,
  Settings,
  ChevronLeft,
  Menu,
} from 'lucide-react'

interface SidebarProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSettingsClick: () => void
}

export function Sidebar({ isOpen, onOpenChange, onSettingsClick }: SidebarProps) {
  const { chats, activeChat, createChat, selectChat, deleteChat } = useChat()

  return (
    <div
      className={`relative h-svh flex-shrink-0 transition-[width] duration-300 ${
        isOpen ? 'w-64' : 'w-0'
      }`}
    >
      {!isOpen && (
        <button
          onClick={() => onOpenChange(true)}
          className="absolute top-3 left-0 w-9 h-9 bg-sidebar border border-sidebar-border rounded-lg flex items-center justify-center hover:bg-sidebar-accent/10 transition-colors shadow-sm z-50"
          aria-label="Expand sidebar"
        >
          <Menu className="w-4 h-4" />
        </button>
      )}

      <div
        className={`h-svh bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-[width] duration-300 overflow-hidden z-40 ${
          isOpen ? 'w-64' : 'w-0'
        }`}
      >
        <div
          className={`${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'} transition-opacity duration-200`}
        >
          <div className="p-3 border-b border-sidebar-border">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-gradient-to-br from-primary to-accent rounded-lg">
                  <Sparkles className="w-4 h-4 text-primary-foreground" />
                </div>
                <h1 className="text-lg font-bold">SelfGPT</h1>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="p-2 hover:bg-sidebar-accent/10 rounded-lg transition-colors"
                aria-label="Collapse sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-3 border-b border-sidebar-border">
            <Button
              onClick={() => createChat()}
              className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground gap-2"
            >
              <Plus className="w-4 h-4" />
              New Chat
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-2 p-3">
              {chats.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-xs text-muted-foreground">No chats yet</p>
                </div>
              ) : (
                chats.map(chat => (
                  <div key={chat.id} className="relative group">
                    <button
                      onClick={() => selectChat(chat.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 pr-10 rounded-lg transition-all ${
                        activeChat?.id === chat.id
                          ? 'bg-sidebar-accent/15 text-sidebar-foreground border border-sidebar-border'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/10'
                      }`}
                      aria-current={activeChat?.id === chat.id ? 'page' : undefined}
                    >
                      <MessageSquare className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm truncate text-left flex-1">{chat.title}</span>
                    </button>
                    <button
                      onClick={() => deleteChat(chat.id)}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors hover:bg-destructive/10 text-destructive ${
                        activeChat?.id === chat.id
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                      }`}
                      aria-label="Delete chat"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="p-3 mt-auto border-t border-sidebar-border">
            <Button
              onClick={onSettingsClick}
              variant="outline"
              className="w-full border-sidebar-border/70 bg-transparent hover:bg-sidebar-accent/10 gap-2 justify-start"
            >
              <Settings className="w-4 h-4" />
              Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
