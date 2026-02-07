'use client'

import React, { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Paperclip, Loader } from 'lucide-react'

interface MessageInputProps {
  onSend: (message: string, files?: File[]) => void
  isLoading: boolean
  onStop?: () => void
}

export function MessageInput({
  onSend,
  isLoading,
  onStop,
}: MessageInputProps) {
  const [message, setMessage] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return
    if (!message.trim() && files.length === 0) return
    onSend(message, files.length > 0 ? files : undefined)
    setMessage('')
    setFiles([])
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    setFiles(prev => [...prev, ...selectedFiles])
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return
    if (e.shiftKey) return
    e.preventDefault()
    if (isLoading) return
    if (!message.trim() && files.length === 0) return
    onSend(message, files.length > 0 ? files : undefined)
    setMessage('')
    setFiles([])
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
  }

  return (
    <div className="border-t border-border bg-card p-2 sm:p-3 space-y-3">
      {/* File Attachments */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 px-2">
          {files.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-lg text-sm border border-border/50"
            >
              <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="truncate max-w-[200px]">{file.name}</span>
              <button
                onClick={() => removeFile(idx)}
                className="text-muted-foreground hover:text-foreground ml-1"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSend} className="flex gap-2 items-center w-full max-w-2xl mx-auto">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          multiple
          className="hidden"
          disabled={isLoading}
        />

        {/* Textarea Input with Upload Button Inside */}
        <div className="flex-1 relative bg-input border border-border rounded-lg focus-within:border-primary transition-colors group">
          <Textarea
            value={message}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            disabled={isLoading}
            className="resize-y min-h-[28px] bg-transparent border-0 focus-visible:ring-0 focus-visible:border-0 pr-10"
          />
          
          {/* File Upload Button Inside Input - Right side */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-secondary/50 rounded transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
            title="Attach files"
          >
            <Paperclip className="w-4 h-4" />
          </button>
        </div>

        {/* Send/Stop Button */}
        {isLoading ? (
          <Button
            type="button"
            size="icon"
            onClick={onStop}
            className="flex-shrink-0 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            title="Stop generating"
          >
            <Loader className="w-5 h-5 animate-spin" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            disabled={!message.trim() && files.length === 0}
            className="flex-shrink-0 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground"
            title="Send message (Enter)"
          >
            <Send className="w-5 h-5" />
          </Button>
        )}
      </form>
    </div>
  )
}
