'use client'

import { Github, Instagram } from 'lucide-react'

export function Footer() {
  return (
    <footer className="bg-card border-t border-border py-4 px-4">
      <div className="max-w-6xl mx-auto flex flex-col items-center justify-center gap-3">
        <div className="flex items-center gap-6">
          <a
            href="https://github.com/anurag-m1"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary transition-colors"
            title="GitHub - anurag-m1"
          >
            <Github className="w-5 h-5" />
          </a>

          <a
            href="https://instagram.com/ca_anuragsingh"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary transition-colors"
            title="Instagram - @ca_anuragsingh"
          >
            <Instagram className="w-5 h-5" />
          </a>
        </div>
        
        <p className="text-xs text-muted-foreground">
          Designed and developed by Anurag
        </p>
      </div>
    </footer>
  )
}
