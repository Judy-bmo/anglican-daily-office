import type { Psalm } from '../lib/types'
import type { PsalmSpec } from '../lib/lectionary'
import type { LiturgicalColor } from '../lib/churchCalendar'
import { Selectable } from './Selectable'

interface Props {
  spec: PsalmSpec
  psalm?: Psalm
  color: LiturgicalColor
  showGloria?: boolean
}

/** 지정된 절 범위만 남긴다. '105-112', '1-8, 15-17' 형태를 다룬다. */
function inRange(n: string | null | undefined, verses?: string): boolean {
  if (!verses || !n) return true
  const num = Number(n.split(',')[0])
  if (!Number.isFinite(num)) return true
  return verses.split(',').some((part) => {
    const [a, b] = part.split('-').map((v) => Number(v.trim()))
    return b ? num >= a && num <= b : num === a
  })
}

export function PsalmBlock({ spec, psalm, color, showGloria = true }: Props) {
  const label = `시편 ${spec.number}${spec.verses ? `:${spec.verses}` : ''}편`
  if (!psalm) {
    return <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>{label} — 본문을 찾지 못했습니다.</p>
  }

  // ¶ 는 앞 절을 두 절로 나눈 표시이므로 앞 절의 범위를 따른다
  const verses: typeof psalm.verses = []
  let lastKept = false
  for (const v of psalm.verses) {
    if (v.part) continue                  // 낭송 구분 표시는 절이 아니다
    if (v.n === '¶') { if (lastKept) verses.push(v); continue }
    lastKept = inRange(v.n, spec.verses)
    if (lastKept) verses.push(v)
  }

  // 즐겨찾기·공유카드에도 절 번호가 함께 남도록 한다
  const plain = verses.map((v) => `${v.n ?? ''} ${v.text ?? ''}`.trim()).join('\n')

  return (
    <section className="office-section mb-7">
      <h4 className="mb-2 text-sm tracking-wide" style={{ color: 'var(--accent)' }}>
        {label}
        {spec.optional && <span className="ml-2" style={{ color: 'var(--ink-faint)' }}>(선택)</span>}
        {spec.alternative && <span className="ml-2" style={{ color: 'var(--ink-faint)' }}>(또는)</span>}
      </h4>
      <Selectable reference={label} text={plain} type="psalm" color={color}>
        {/* 번호만 왼쪽 좁은 칸에 걸어 두고, 본문은 첫 줄과 이어지는 줄이
            모두 같은 자리에서 시작하게 한다(매달림 들여쓰기). */}
        <ol className="prayer-text space-y-1.5">
          {verses.map((v, i) => (
            <li key={i} className="flex gap-1.5">
              <span
                className="shrink-0 pt-[0.2em] text-[0.65em] tabular-nums"
                style={{ color: 'var(--ink-faint)', minWidth: '1.7em', textAlign: 'right' }}
                aria-hidden={v.n === '¶'}
              >{v.n === '¶' ? '¶' : v.n}</span>
              <span className="min-w-0 flex-1">{v.text}</span>
            </li>
          ))}
        </ol>
      </Selectable>
      {showGloria && psalm.gloria && (
        <p className="prayer-text mt-3" style={{ color: 'var(--ink-muted)' }}>
          <span style={{ color: 'var(--accent)' }}>◎ </span>{psalm.gloria}
        </p>
      )}
    </section>
  )
}
