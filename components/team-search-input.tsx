'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'

interface TeamHit {
  id: number
  name: string
  acronym: string | null
  image_url: string | null
}

interface TeamSearchInputProps {
  value: string
  onChange: (value: string) => void
  game: 'dota2' | 'lol' | 'csgo' | 'valorant'
  placeholder?: string
  className?: string
}

export function TeamSearchInput({ value, onChange, game, placeholder, className }: TeamSearchInputProps) {
  const [hits, setHits] = useState<TeamHit[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const lastCommittedRef = useRef<string>('')

  // Debounced fetch — short delay so typing isn't laggy but we still respect rate limits.
  useEffect(() => {
    const query = value.trim()
    if (query.length < 2 || query === lastCommittedRef.current) {
      setHits([])
      return
    }
    const handle = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/pandascore/search-teams?q=${encodeURIComponent(query)}&game=${game}`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) {
            setHits(data)
            setHighlight(0)
            setOpen(data.length > 0)
          }
        }
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => clearTimeout(handle)
  }, [value, game])

  // Close on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const pick = (hit: TeamHit) => {
    lastCommittedRef.current = hit.name
    onChange(hit.name)
    setOpen(false)
  }

  return (
    <div ref={wrapperRef} className={`relative ${className ?? ''}`}>
      <Input
        value={value}
        onChange={e => {
          onChange(e.target.value)
          lastCommittedRef.current = ''
          setOpen(true)
        }}
        onFocus={() => hits.length > 0 && setOpen(true)}
        onKeyDown={e => {
          if (!open || hits.length === 0) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlight(h => Math.min(h + 1, hits.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlight(h => Math.max(h - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            pick(hits[highlight])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        placeholder={placeholder}
      />
      {loading && (
        <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
      )}
      {open && hits.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border border-border bg-popover shadow-md max-h-72 overflow-auto">
          {hits.map((hit, i) => (
            <button
              key={hit.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); pick(hit) }}
              onMouseEnter={() => setHighlight(i)}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                i === highlight ? 'bg-secondary' : 'hover:bg-secondary/50'
              }`}
            >
              {hit.image_url ? (
                <img src={hit.image_url} alt="" className="h-5 w-5 object-contain shrink-0" />
              ) : (
                <div className="h-5 w-5 rounded bg-muted shrink-0" />
              )}
              <span className="font-medium truncate">{hit.name}</span>
              {hit.acronym && <span className="text-xs text-muted-foreground ml-auto font-mono">{hit.acronym}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
