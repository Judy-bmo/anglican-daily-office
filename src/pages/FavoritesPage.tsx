import { useEffect, useState } from 'react'
import { listFavorites, removeFavorite, type Favorite } from '../lib/storage'
import { shareCard } from '../lib/shareCard'
import { splitVerseMarks } from '../lib/verseMarks'
import type { LiturgicalColor } from '../lib/churchCalendar'


/** '1 주님께 비오니…' 처럼 절 번호로 시작하는 줄은 번호를 따로 세워 보여 준다. */
const VERSE_HEAD = /^(\d{1,3}:\d{1,3}|\d{1,3}|¶)\s+(.*)$/

/**
 * 담아 둔 글 손질.
 *
 * 독서는 이어지는 산문이므로 한 문단으로 보여 준다. 예전에 절마다 줄을 바꿔
 * 저장한 항목도 여기서 함께 이어 붙인다. 시편은 줄 나눔을 그대로 둔다.
 */
export function tidyFavoriteText(text: string, type: Favorite['type'], reference: string) {
  if (type !== 'reading' || reference.startsWith('시편')) return text
  return text.split('\n').map((l) => l.trim()).filter(Boolean).join(' ')
}

/** 한 문단으로 이어진 독서에서 절 번호만 윗첨자로 보여 준다. */
function renderInlineVerses(text: string) {
  return splitVerseMarks(text).map((seg, i) =>
    seg.verse ? (
      <sup key={i} className="mr-1 text-[0.65em] tabular-nums" style={{ color: 'var(--ink-faint)' }}>
        {seg.text}
      </sup>
    ) : (
      <span key={i}>{seg.text}</span>
    ),
  )
}

function renderVerses(text: string) {
  const lines = text.split('\n')
  // 절이 줄줄이 있는 시편만 번호를 따로 세운다.
  // 독서는 이어지는 산문이라 첫 절 번호만 떨어져 보이면 어색하다.
  const numbered = lines.filter((l) => VERSE_HEAD.test(l)).length >= 2
  return lines.map((line, i) => {
    const m = numbered ? line.match(VERSE_HEAD) : null
    // 번호만 왼쪽 좁은 칸에 걸어 두고, 본문은 모든 줄이 같은 자리에서 시작하게 한다
    if (!m) {
      return (
        <p key={i} className={numbered ? 'pl-[calc(1.7em*0.65+0.375rem)]' : undefined}>
          {numbered ? line : renderInlineVerses(line)}
        </p>
      )
    }
    return (
      <p key={i} className="flex gap-1.5">
        <span
          className="shrink-0 pt-[0.2em] text-[0.65em] tabular-nums"
          style={{ color: 'var(--ink-faint)', minWidth: '1.7em', textAlign: 'right' }}
        >{m[1]}</span>
        <span className="min-w-0 flex-1">{m[2]}</span>
      </p>
    )
  })
}

const TYPE_LABEL = { psalm: '시편', reading: '독서', prayer: '기도문' } as const

export function FavoritesPage({ color }: { color: LiturgicalColor }) {
  const [items, setItems] = useState<Favorite[]>([])
  useEffect(() => { listFavorites().then(setItems) }, [])

  if (!items.length) {
    return (
      <div>
        <h1 className="mb-3 text-[1.5em] font-semibold">즐겨찾기</h1>
        <p style={{ color: 'var(--ink-muted)' }}>
          기도 중 시편이나 독서 구절을 눌러 담아 두면 여기 모입니다.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-6 text-[1.5em] font-semibold">즐겨찾기 <span className="text-sm" style={{ color: 'var(--ink-faint)' }}>{items.length}</span></h1>
      <ul className="space-y-4">
        {items.map((f) => (
          <li key={f.id} className="rounded-2xl border p-5" style={{ borderColor: 'var(--rule)' }}>
            <p className="mb-2 text-sm">
              {/* '시편 시편 20편'처럼 겹치지 않게, 출처가 이미 갈래를 말하면 딱지를 생략한다 */}
              {!f.reference.startsWith(TYPE_LABEL[f.type]) && (
                <span
                  className="mr-2 rounded-full px-2 py-0.5 text-[0.75em]"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                >{TYPE_LABEL[f.type]}</span>
              )}
              <span style={{ color: 'var(--accent)' }}>{f.reference}</span>
            </p>
            <div className="prayer-text">{renderVerses(tidyFavoriteText(f.text, f.type, f.reference))}</div>
            <div className="no-print mt-3 flex gap-2 text-sm">
              <button
                className="tap rounded-full border px-4 py-1.5"
                style={{ borderColor: 'var(--rule)', color: 'var(--accent)' }}
                onClick={() => shareCard({
                  text: tidyFavoriteText(f.text, f.type, f.reference),
                  reference: f.reference,
                  color,
                  dark: document.documentElement.dataset.theme === 'dark',
                })}
              >⇪ 카드로 공유</button>
              <button
                className="tap rounded-full px-3 py-1.5"
                style={{ color: 'var(--ink-faint)' }}
                onClick={async () => { await removeFavorite(f.id); setItems(await listFavorites()) }}
              >지우기</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
