import { useMemo } from 'react'
import type { ChurchDay } from '../lib/churchCalendar'
import type { OfficeLectionary } from '../lib/lectionary'
import type { AppData } from '../lib/useApp'
import type { OfficeBlock, OfficeDoc } from '../lib/types'
import { PsalmBlock } from './PsalmBlock'
import { ReadingBlock } from './ReadingBlock'
import { speechText } from '../lib/tts'

/* ─────────  선택지 묶기  ───────── */

interface OptionItem {
  n: number
  title: string
  page: number
  /** 이 선택지에만 걸리는 지시문 (예: '부활주일에서 성령강림주일까지는…') */
  note?: OfficeBlock
  blocks: OfficeBlock[]
}

/** '부활주일에서 성령강림주일까지는 …' → '부활주일~성령강림주일' */
const WHEN_RANGE = /([가-힣0-9 ]+?)\s*(?:에서|부터)\s*([가-힣0-9 ]+?)\s*까지/

/** 선택지 끝에 붙은 성서 인용 — '…마십시오.(예레 14:9, 22)' */
const OPTION_REF = /\(([1-3]?[가-힣]{2,4}\s*\d+[:\d\-,\s]*)\)\s*$/

/**
 * 선택지의 표제가 '이름표'인가 '본문'인가.
 *
 * '시편 121편', '즈가리야송가 Benedictus…'처럼 무엇을 고르는지 알려 주는 이름표가
 * 있고, 성서소구·본기도처럼 표제 자리에 인용문이나 기도문이 통째로 들어오는 경우가
 * 있다. 뒤엣것은 이름표가 아니라 낭송할 본문이므로 일반 본문처럼 보여 준다.
 */
export function isContentOption(title: string): boolean {
  return /[.?!]\s*$/.test(title) || OPTION_REF.test(title)
}

export function optionReference(title: string): string | undefined {
  return title.match(OPTION_REF)?.[1]?.trim()
}

/** 이 선택지가 쓰이는 절기 — 지시문에서 뽑아낸다. */
export function optionWhen(o: OptionItem): string | undefined {
  const m = o.note?.text?.match(WHEN_RANGE)
  return m ? `${m[1].trim()}~${m[2].trim()}` : undefined
}

/** 고르는 목록에 쓸 짧은 이름 */
export function optionLabel(o: OptionItem): string {
  if (!isContentOption(o.title)) {
    const name = o.title.split('\t')[0].trim()
    const when = optionWhen(o)
    return when ? `${name} (${when})` : name
  }
  const ref = optionReference(o.title)
  if (ref) return ref
  const plain = o.title.replace(/\s+/g, ' ').trim()
  return plain.length > 30 ? `${plain.slice(0, 30)}…` : plain
}
type PlanItem =
  | { kind: 'block'; block: OfficeBlock }
  | { kind: 'options'; id: string; notes: OfficeBlock[]; options: OptionItem[] }

/**
 * 예식문을 화면에 그릴 순서로 정리한다.
 *
 * '1) … 2) … 3) …'처럼 이어지는 선택지는 하나의 묶음으로 만들어 사용자가 원문에 있는
 * 다른 선택지로 바꿀 수 있게 한다. 선택지 사이에 낀 지시문(예: "부활주일에서 성령강림
 * 주일까지는 아래의 송가를 사용한다")은 묶음을 끊지 않고 묶음 전체의 안내로 남긴다.
 */
export function buildPlan(blocks: OfficeBlock[]): PlanItem[] {
  const plan: PlanItem[] = []
  let group: OptionItem[] | null = null
  let notes: OfficeBlock[] = []

  let pendingNote: OfficeBlock | undefined

  const flush = () => {
    if (group?.length) plan.push({ kind: 'options', id: `opt-${plan.length}`, notes, options: group })
    group = null
    notes = []
    pendingNote = undefined
  }

  /** 이 지시문 뒤에 곧바로 이어지는 선택지가 오는가? */
  const leadsToNextOption = (from: number, lastN: number) => {
    for (let j = from + 1; j < blocks.length; j++) {
      const b = blocks[j]
      if (b.type === 'option') return Number(b.n) > lastN
      if (b.type === 'section' || b.type === 'rubric') return false
    }
    return false
  }

  blocks.forEach((b, i) => {
    if (b.type === 'option') {
      const n = Number(b.n)
      if (group && n <= group[group.length - 1].n) flush()
      if (!group) group = []
      group.push({ n, title: b.title ?? '', page: b.page, note: pendingNote, blocks: [] })
      pendingNote = undefined
      return
    }
    if (group) {
      if (b.type === 'section') {
        flush()
      } else if (b.type === 'rubric' && leadsToNextOption(i, group[group.length - 1].n)) {
        pendingNote = b                     // 바로 뒤 선택지에만 걸리는 안내
        return
      } else if (b.type === 'rubric') {
        flush()
      } else {
        group[group.length - 1].blocks.push(b)
        return
      }
    }
    plan.push({ kind: 'block', block: b })
  })
  flush()
  return plan
}

/** 절기에 맞는 선택지를 처음부터 골라 둔다(부활절기의 부활송가 등). */
export function preferredOption(options: OptionItem[], day: ChurchDay): number {
  const easter = day.season === 'easter'
  const i = options.findIndex((o) => /부활송가|Pascha/i.test(o.title))
  if (i >= 0) return easter ? i : 0
  return 0
}

/* ─────────  본문 렌더링  ───────── */

interface Props {
  doc: OfficeDoc
  day: ChurchDay
  lectionary: OfficeLectionary | null
  data: AppData
  showBibleText: boolean
  /** 선택지 묶음마다 고른 항목 (묶음 id → 순번) */
  chosen: Record<string, number>
  onChoose: (id: string, index: number) => void
  /** 지금 낭독 중인 구간 id */
  speakingId?: string | null
  /** 인쇄물에 고르지 않은 선택지도 함께 적을지 */
  showOtherOptions?: boolean
  /** 보여 줄 독서 (없으면 그날 독서를 모두 보여 준다) */
  readings?: Set<string>
}

const SLOT_NAMES: Record<string, string> = { ot: '구약', epistle: '서신', gospel: '복음' }

/** 인쇄·낭독에서 고를 수 있는 그날의 독서 */
export interface ReadingChoice {
  key: string
  /** 구약 · 서신 · 복음, 또는 제1독서 · 제2독서 */
  slot: string
  reference: string
}

/**
 * 그날 읽을 독서 목록.
 *
 * 보통은 구약·서신·복음 셋이고, 고난주일·부활주일처럼 아침/저녁 독서가 따로 지정된
 * 날은 기도서가 적어 둔 제1·제2독서를 그대로 쓴다.
 */
export function readingChoices(
  lectionary: OfficeLectionary | null, isEvening: boolean,
): ReadingChoice[] {
  if (!lectionary) return []
  const own = lectionary.offices?.[isEvening ? 'evening' : 'morning']
  if (own) {
    return own.readings.map((reference, i) => ({
      key: `own-${i}`, slot: `제${i + 1}독서`, reference,
    }))
  }
  return (['ot', 'epistle', 'gospel'] as const)
    .filter((slot) => lectionary.readings[slot])
    .map((slot) => ({ key: slot, slot: SLOT_NAMES[slot], reference: lectionary.readings[slot]! }))
}

export function OfficeView({
  doc, day, lectionary, data, showBibleText, chosen, onChoose,
  speakingId, showOtherOptions = false, readings,
}: Props) {
  const plan = useMemo(() => buildPlan(doc.blocks), [doc.blocks])
  const isEvening = doc.office === 'evening'

  const renderBlock = (b: OfficeBlock, key: string) => {
    const id = `blk-${key}`
    const speaking = speakingId === id
    switch (b.type) {
      case 'title':
        return null
      case 'rubric':
        return (
          <p key={key} id={id} className="my-4 text-[0.9em] italic" style={{ color: 'var(--accent)' }}>
            {b.text}
          </p>
        )
      case 'section':
        return (
          <h3 key={key} id={id} className="mt-10 mb-3 flex items-baseline gap-2 border-b pb-1 text-[1.05em] font-semibold"
              style={{ borderColor: 'var(--rule)' }}>
            <span className="tabular-nums" style={{ color: 'var(--accent)' }}>{b.n}</span>
            {b.title}
          </h3>
        )
      case 'heading':
        return <p key={key} id={id} className="my-2 text-[0.9em]" style={{ color: 'var(--ink-muted)' }}>{b.text}</p>
      case 'versicle':
      case 'response':
        return (
          <p key={key} id={id} className={`prayer-text versicle-pair my-1.5 flex gap-2.5 ${speaking ? 'speaking' : ''}`}>
            <span aria-hidden className="shrink-0" style={{ color: 'var(--accent)' }}>{b.marker}</span>
            <span className={b.type === 'response' ? 'font-medium' : undefined}>{b.text}</span>
          </p>
        )
      case 'verse':
        return (
          <p key={key} id={id} className={`prayer-text my-1 flex gap-3 ${speaking ? 'speaking' : ''}`}>
            <span className="shrink-0 pt-1 text-xs tabular-nums" style={{ color: 'var(--ink-faint)', minWidth: '1.9rem', textAlign: 'right' }}>
              {b.n}
            </span>
            <span>{b.text}</span>
          </p>
        )
      default: {
        // 송가는 행마다 줄이 바뀌므로, 짧은 행이면 간격을 좁혀 한 덩어리로 읽히게 한다
        const short = (b.text ?? '').length < 40
        return (
          <p
            key={key}
            id={id}
            className={`prayer-text ${short ? 'verse-line my-0.5' : 'my-2'} ${speaking ? 'speaking' : ''}`}
          >
            {b.text}
          </p>
        )
      }
    }
  }

  const psalmSection = () => {
    if (!lectionary) return <p style={{ color: 'var(--ink-faint)' }}>오늘의 시편을 찾지 못했습니다.</p>
    const specs = isEvening ? lectionary.eveningPsalms : lectionary.morningPsalms
    if (!specs.length) return <p style={{ color: 'var(--ink-faint)' }}>지정된 시편이 없습니다.</p>
    return (
      <>
        <p className="mb-4 text-sm" style={{ color: 'var(--ink-muted)' }}>
          {lectionary.day.label} · {isEvening ? '저녁기도' : '아침기도'} 시편
        </p>
        {specs.map((s, i) => (
          <PsalmBlock key={`${s.number}-${i}`} spec={s} psalm={data.psalter.get(s.number)} color={day.color} />
        ))}
      </>
    )
  }

  const readingSection = () => {
    if (!lectionary) return <p style={{ color: 'var(--ink-faint)' }}>오늘의 독서를 찾지 못했습니다.</p>
    const eve = isEvening ? lectionary.eve : undefined
    return (
      <>
        <p className="mb-4 text-sm" style={{ color: 'var(--ink-muted)' }}>
          {lectionary.day.label}
          {lectionary.year !== 'both' && ` · ${lectionary.year}해`}
          {eve && ` · 저녁은 「${eve.label}」 정과를 씁니다`}
        </p>
        {(() => {
          const all = readingChoices(lectionary, isEvening)
          const shown = all.filter((c) => !readings || readings.has(c.key))
          if (!shown.length) {
            return <p style={{ color: 'var(--ink-faint)' }}>고른 독서가 없습니다.</p>
          }
          return shown.map((c, i) => (
            <ReadingBlock
              key={c.key}
              reference={c.reference}
              slot={c.slot}
              color={day.color}
              showText={showBibleText}
              alternates={i === shown.length - 1 ? lectionary.alternates : undefined}
            />
          ))
        })()}
        {eve && (
          <div className="mt-6 border-t pt-4" style={{ borderColor: 'var(--rule)' }}>
            <p className="mb-3 text-sm" style={{ color: 'var(--accent)' }}>{eve.label}</p>
            {Object.values(eve.readings).flatMap((set) =>
              (['ot', 'epistle', 'gospel'] as const).map((slot) =>
                set[slot] ? (
                  <ReadingBlock key={`eve-${slot}`} reference={set[slot]!} slot={SLOT_NAMES[slot]}
                                color={day.color} showText={showBibleText} />
                ) : null,
              ),
            )}
          </div>
        )}
      </>
    )
  }

  /** 선택지 묶음 하나를 그린다. */
  const renderOptions = (item: Extract<PlanItem, { kind: 'options' }>) => {
    const pick = chosen[item.id] ?? preferredOption(item.options, day)
    const opt = item.options[pick]
    return (
      <div key={item.id} className="office-section my-4">
        {item.notes.map((n, ni) => (
          <p key={ni} className="my-3 text-[0.9em] italic" style={{ color: 'var(--accent)' }}>{n.text}</p>
        ))}
        {item.options.length > 1 && (
          <div className="no-print mb-3">
            <label className="mb-1 block text-sm" style={{ color: 'var(--ink-muted)' }} htmlFor={item.id}>
              선택
            </label>
            <select
              id={item.id}
              className="tap w-full min-w-0 rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--rule)', background: 'var(--paper-raised)', color: 'var(--ink)' }}
              value={pick}
              onChange={(e) => onChoose(item.id, Number(e.target.value))}
            >
              {item.options.map((o, oi) => (
                <option key={o.n} value={oi}>{o.n}) {optionLabel(o)}</option>
              ))}
            </select>
          </div>
        )}
        {opt.note && (
          <p className="my-3 text-[0.9em] italic" style={{ color: 'var(--accent)' }}>{opt.note.text}</p>
        )}
        {isContentOption(opt.title) ? (
          // 성서소구·본기도처럼 표제 자리에 본문이 통째로 온 경우:
          // 이름표가 아니라 낭송할 글이므로 일반 본문처럼 보여 준다.
          <p className="prayer-text my-2">
            <span className="mr-2 text-sm tabular-nums" style={{ color: 'var(--ink-faint)' }}>
              {opt.n})
            </span>
            {opt.title}
          </p>
        ) : (
          <h4 className="mb-2 text-[0.95em]" style={{ color: 'var(--accent)' }}>{opt.n}) {opt.title}</h4>
        )}
        {opt.blocks.map((b, bi) => renderBlock(b, `${item.id}-${bi}`))}
        {showOtherOptions && (
          <div className="print-only">
            {item.options.filter((_, oi) => oi !== pick).map((o) => (
              <p key={o.n} className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                다른 선택: {o.n}) {optionLabel(o)}
              </p>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderItem = (item: PlanItem, i: number) =>
    item.kind === 'options' ? renderOptions(item) : renderBlock(item.block, String(i))

  /* 성서정과를 절 안에서 어디에 끼울지 — 기도서 편집 순서를 따른다.
     성서독서:  ※ 안내 지시문 → ○ "1(2)독서는 …말씀입니다" → [독서 본문] → ※ 낭독 후 응답
     오늘의 시편: ※ 안내 지시문 → [시편] (송영은 시편마다 이미 붙어 있다) */
  const nodes: React.ReactNode[] = []
  for (let i = 0; i < plan.length; i++) {
    const item = plan[i]
    const isSection = item.kind === 'block' && item.block.type === 'section'
    const title = isSection ? (item.block.title ?? '') : ''
    const slot = doc.lectionaryLinked && isSection
      ? (title.includes('오늘의 시편') ? 'psalms' : title.includes('성서독서') ? 'readings' : null)
      : null

    if (!slot) {
      nodes.push(renderItem(item, i))
      continue
    }

    // 다음 절 표제가 나오기 전까지가 이 절의 내용이다
    let end = i + 1
    while (end < plan.length &&
           !(plan[end].kind === 'block' && (plan[end] as { block: OfficeBlock }).block.type === 'section')) {
      end++
    }
    const body = plan.slice(i + 1, end)
    // 두 번째 지시문부터가 '낭독 후' 부분이다
    const outroAt = body.findIndex((x, n) => n > 0 && x.kind === 'block' && x.block.type === 'rubric')
    const intro = slot === 'readings' ? (outroAt < 0 ? body : body.slice(0, outroAt)) : body.filter(
      (x) => x.kind === 'block' && x.block.type === 'rubric')
    const outro = slot === 'readings' && outroAt >= 0 ? body.slice(outroAt) : []

    nodes.push(
      <div key={`sec-${i}`}>
        {renderItem(item, i)}
        {intro.map((x, n) => renderItem(x, i + 1 + n))}
        {slot === 'psalms' ? psalmSection() : readingSection()}
        {outro.map((x, n) => renderItem(x, i + 1 + outroAt + n))}
      </div>,
    )
    i = end - 1
  }

  return <article>{nodes}</article>
}

/** 낭독용 구간 목록 — 화면에 그린 순서와 같게 만든다. */
export function speechChunks(
  doc: OfficeDoc, day: ChurchDay, chosen: Record<string, number> = {},
): Array<{ id: string; text: string }> {
  const out: Array<{ id: string; text: string }> = []
  buildPlan(doc.blocks).forEach((item, i) => {
    const push = (b: OfficeBlock, key: string) => {
      if (b.type === 'title') return
      const text = speechText(b.text ?? b.title ?? '')
      if (text) out.push({ id: `blk-${key}`, text })
    }
    if (item.kind === 'options') {
      // 화면에서 고른 선택지를 그대로 읽는다
      const at = Math.min(
        chosen[item.id] ?? preferredOption(item.options, day),
        item.options.length - 1,
      )
      const opt = item.options[at]
      out.push({ id: `${item.id}-h`, text: speechText(opt.title) })
      opt.blocks.forEach((b, bi) => push(b, `${item.id}-${bi}`))
    } else {
      push(item.block, String(i))
    }
  })
  return out
}

/** 선택지 묶음과 그 묶음이 속한 절 이름 — 인쇄 전에 고르게 하려고 쓴다. */
export interface OptionGroup {
  id: string
  /** 이 묶음이 속한 절 (예: '시편송가', '성서소구') */
  section: string
  options: OptionItem[]
}

export function optionGroups(blocks: OfficeBlock[]): OptionGroup[] {
  const out: OptionGroup[] = []
  let section = ''
  for (const item of buildPlan(blocks)) {
    if (item.kind === 'block') {
      if (item.block.type === 'section') section = item.block.title ?? ''
      continue
    }
    if (item.options.length > 1) out.push({ id: item.id, section, options: item.options })
  }
  return out
}
