import { useState, type ReactNode } from 'react'
import { addFavorite } from '../lib/storage'
import { shareCard } from '../lib/shareCard'
import type { LiturgicalColor } from '../lib/churchCalendar'

interface Props {
  reference: string
  text: string
  type: 'psalm' | 'reading' | 'prayer'
  color: LiturgicalColor
  children: ReactNode
  className?: string
}

/** 구절을 눌러 즐겨찾기에 담거나 이미지 카드로 나눌 수 있게 한다. */
export function Selectable({ reference, text, type, color, children, className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const say = (msg: string) => {
    setDone(msg)
    window.setTimeout(() => { setDone(null); setOpen(false) }, 1600)
  }

  return (
    <div className={`relative ${className}`}>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${reference} — 눌러서 즐겨찾기·공유`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((v) => !v) } }}
        onContextMenu={(e) => { e.preventDefault(); setOpen(true) }}
        className="cursor-pointer rounded transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]"
      >
        {children}
      </div>
      {open && (
        <div className="no-print mt-1 flex flex-wrap items-center gap-2 text-sm">
          <button
            className="tap rounded-full border px-4 py-1.5"
            style={{ borderColor: 'var(--rule)', color: 'var(--accent)' }}
            onClick={async () => {
              await addFavorite({ type, reference, text })
              say('즐겨찾기에 담았습니다')
            }}
          >★ 즐겨찾기</button>
          <button
            className="tap rounded-full border px-4 py-1.5"
            style={{ borderColor: 'var(--rule)', color: 'var(--accent)' }}
            onClick={async () => {
              const how = await shareCard({
                text, reference, color,
                dark: document.documentElement.dataset.theme === 'dark',
              })
              say(how === 'shared' ? '공유했습니다' : '이미지를 내려받았습니다')
            }}
          >⇪ 카드로 공유</button>
          <button
            className="tap rounded-full px-3 py-1.5"
            style={{ color: 'var(--ink-faint)' }}
            onClick={() => setOpen(false)}
          >닫기</button>
          {done && <span style={{ color: 'var(--ink-muted)' }}>{done}</span>}
        </div>
      )}
    </div>
  )
}
