import { useEffect, useState } from 'react'
import { fetchPassage, verseLabels, type Passage } from '../lib/bibleRef'
import { correctReference } from '../lib/errata'
import type { LiturgicalColor } from '../lib/churchCalendar'
import { Selectable } from './Selectable'

interface Props {
  /** 성서정과에 인쇄된 그대로의 인용 */
  reference: string
  /** 구약 / 서신 / 복음 등 자리 이름 */
  slot?: string
  color: LiturgicalColor
  showText: boolean
  /** '또는'으로 붙은 대체 본문 */
  alternates?: string[]
}

export function ReadingBlock({ reference, slot, color, showText, alternates = [] }: Props) {
  const [passage, setPassage] = useState<Passage | null>(null)
  const [loading, setLoading] = useState(false)
  const [showAlt, setShowAlt] = useState(false)
  const erratum = correctReference(reference)

  useEffect(() => {
    if (!showText) return
    let alive = true
    setLoading(true)
    fetchPassage(reference)
      .then((p) => alive && setPassage(p))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [reference, showText])

  // 즐겨찾기·공유카드에는 절 번호를 안에 넣고 한 문단으로 이어 담는다
  const labels = passage ? verseLabels(passage.verses) : []
  const plain = passage?.verses.map((v, i) => `${labels[i]} ${v.text}`).join(' ') ?? ''

  return (
    <section className="office-section mb-6">
      <h4 className="mb-2 flex flex-wrap items-baseline gap-2">
        {slot && <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>{slot}</span>}
        <span className="text-[0.95em]" style={{ color: 'var(--accent)' }}>{reference}</span>
      </h4>

      {erratum && (
        <p className="mb-2 text-xs" style={{ color: 'var(--ink-faint)' }}>
          기도서 {erratum.page}쪽 원문은 「{erratum.printed}」이지만 {erratum.reason} 여기서는 「{erratum.corrected}」 본문을 보여 줍니다.
        </p>
      )}

      {showText && (
        <div className="reading-block rounded-r px-4 py-3">
          {loading && <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>본문을 불러오는 중…</p>}
          {passage?.error && <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>{passage.error}</p>}
          {passage && !passage.error && (
            <Selectable reference={`${passage.bookName} ${reference.replace(/^\S+\s*/, '')}`} text={plain} type="reading" color={color}>
              <p className="prayer-text whitespace-pre-line">
                {passage.verses.map((v, i) => (
                  <span key={`${v.chapter}-${v.number}`} style={v.optional ? { color: 'var(--ink-muted)' } : undefined}>
                    {i > 0 && v.paragraphBreak && <br />}
                    <sup className="mr-1 text-[0.65em] tabular-nums" style={{ color: 'var(--ink-faint)' }}>
                      {labels[i]}
                    </sup>
                    {v.text}{' '}
                  </span>
                ))}
              </p>
            </Selectable>
          )}
        </div>
      )}

      {alternates.length > 0 && (
        <div className="no-print mt-2">
          <button
            className="tap text-sm underline underline-offset-4"
            style={{ color: 'var(--ink-muted)' }}
            onClick={() => setShowAlt((v) => !v)}
            aria-expanded={showAlt}
          >
            {showAlt ? '대체 독서 접기' : `대체 독서 보기 (${alternates.length})`}
          </button>
          {showAlt && (
            <div className="mt-3 space-y-4 border-l pl-4" style={{ borderColor: 'var(--rule)' }}>
              {alternates.map((a) => (
                <ReadingBlock key={a} reference={a} slot="또는" color={color} showText={showText} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
