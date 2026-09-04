import { useMemo, useState } from 'react'
import {
  OfficeView, defaultReadingMask, optionGroups, optionLabel, preferredOption,
  readingChoices, speechChunks, toggleReadingMask,
} from '../components/OfficeView'
import { assignedCanticles, canticleLabel } from '../lib/canticles'
import { resolveCollect } from '../lib/collects'
import { TtsBar } from '../components/TtsBar'
import { formatKoreanDate } from '../components/DayHeader'
import { officePrintTitle, printWithTitle } from '../lib/print'
import type { ChurchDay } from '../lib/churchCalendar'
import type { OfficeLectionary } from '../lib/lectionary'
import type { AppData } from '../lib/useApp'
import type { OfficeDoc } from '../lib/types'

interface Props {
  doc: OfficeDoc
  day: ChurchDay
  lectionary: OfficeLectionary | null
  data: AppData
  showBibleText: boolean
  speechRate: number
  completed: boolean
  onToggleComplete: () => void
  onBack: () => void
}

export function OfficePage({
  doc, day, lectionary, data, showBibleText, speechRate, completed, onToggleComplete, onBack,
}: Props) {
  const [speakingId, setSpeakingId] = useState<string | null>(null)

  // 선택지(시편·성서소구·본기도 …)는 화면에서 고른 것이 낭독·인쇄에 그대로 쓰인다.
  // 인쇄 전에 한자리에서 다시 고를 수 있도록 상태를 여기서 쥔다.
  // 「독서 후 송가」 절은 이제 독서마다 그 자리에서 부르므로 절로 그리지 않는다.
  // 그 절의 선택칸이 인쇄 패널에 남으면 바꿔도 아무 일이 없어 헷갈린다.
  const groups = useMemo(
    () => optionGroups(doc.blocks)
      .filter((g) => !(doc.lectionaryLinked && g.section.includes('독서 후 송가'))),
    [doc.blocks, doc.lectionaryLinked],
  )
  const [chosen, setChosen] = useState<Record<string, number>>({})
  // 대축일·주요축일에는 송가 배정표의 '대축일, 주의 축일' 항목을 쓴다 (기도서 181쪽)
  const isFeast = useMemo(() => {
    const [, mm, dd] = day.date.split('-').map(Number)
    return data.feasts.some((f) =>
      f.month === mm
      && (f.day === dd || (f.dayEnd !== undefined && dd >= f.day && dd <= f.dayEnd))
      && (f.rank === 'principal' || f.rank === 'major'))
  }, [data.feasts, day.date])

  // 인쇄 패널에서도 독서·송가·본기도를 고를 수 있도록, 본문과 같은 값을 쓴다
  const choices = useMemo(
    () => readingChoices(lectionary, doc.office === 'evening'),
    [lectionary, doc.office],
  )
  const readMask = chosen['readings'] ?? defaultReadingMask(choices.length)
  const assigned = assignedCanticles(data.canticleTable, day, doc.office, isFeast)
  const cantAt = (slot: number) => {
    const saved = chosen[`cant-${slot + 1}`]
    if (saved !== undefined) return saved
    const name = assigned[slot]
    return name ? data.canticles.findIndex((c) => c.name === name) : -1
  }
  const pickedCount = choices.filter((_, i) => readMask & (1 << i)).length
  const collect = doc.lectionaryLinked ? resolveCollect(data.collects, day) : null

  const chunks = useMemo(
    () => speechChunks(doc, day, chosen,
                       { list: data.canticles, table: data.canticleTable, isFeast }),
    [doc, day, chosen, data.canticles, data.canticleTable, isFeast],
  )
  const [printOpen, setPrintOpen] = useState(false)
  const [showOthers, setShowOthers] = useState(false)
  const choose = (id: string, index: number) => setChosen((c) => ({ ...c, [id]: index }))
  const pickOf = (g: (typeof groups)[number]) => chosen[g.id] ?? preferredOption(g.options, day)


  return (
    <div>
      <div className="no-print mb-5 flex items-center justify-between">
        <button className="tap -ml-2 px-2 text-sm" style={{ color: 'var(--ink-muted)' }} onClick={onBack}>
          ← 오늘
        </button>
        <button
          className="tap px-2 text-sm"
          style={{ color: printOpen ? 'var(--accent)' : 'var(--ink-muted)' }}
          aria-expanded={printOpen}
          onClick={() => setPrintOpen((v) => !v)}
        >
          인쇄 · PDF
        </button>
      </div>

      <header className="mb-6">
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          {formatKoreanDate(day.date)} · {day.name}
        </p>
        <h1 className="mt-1 text-[1.7em] font-semibold">{doc.title}</h1>
        {!doc.lectionaryLinked && (
          <p className="mt-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
            기도서 구조상 날짜별 전례독서를 따르지 않는 예식입니다. 아래에서 시편과 성서소구를 고를 수 있습니다.
          </p>
        )}
      </header>

      {printOpen && (
        <section
          className="no-print mb-7 rounded-2xl border p-5"
          style={{ borderColor: 'var(--rule)' }}
        >
          <h2 className="mb-1 text-sm" style={{ color: 'var(--accent)' }}>인쇄할 내용 고르기</h2>
          <p className="mb-4 text-sm" style={{ color: 'var(--ink-muted)' }}>
            여기서 고른 것이 화면과 인쇄물에 그대로 반영됩니다.
          </p>

          {groups.length > 0 && (
            <div className="mb-4 grid gap-3">
              {groups.map((g, gi) => (
                <label key={g.id} className="block text-sm">
                  <span className="mb-1 block" style={{ color: 'var(--ink-muted)' }}>
                    {g.section || '선택'}
                    {/* 밤기도 본기도처럼 같은 절에 선택 묶음이 둘일 때 구분해 준다 */}
                    {groups.filter((o) => o.section === g.section).length > 1 &&
                      ` ${groups.filter((o, oi) => o.section === g.section && oi <= gi).length}`}
                  </span>
                  <select
                    className="tap w-full min-w-0 rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: 'var(--rule)', background: 'var(--paper-raised)', color: 'var(--ink)' }}
                    value={pickOf(g)}
                    onChange={(e) => choose(g.id, Number(e.target.value))}
                  >
                    {g.options.map((o, oi) => (
                      <option key={o.n} value={oi}>{o.n}) {optionLabel(o)}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}


          {doc.lectionaryLinked && choices.length > 0 && (
            <div className="mb-4">
              <span className="mb-2 block text-sm" style={{ color: 'var(--ink-muted)' }}>
                성서독서 — 하나 혹은 둘
              </span>
              <div className="flex flex-wrap gap-2">
                {choices.map((c, i) => {
                  const on = (readMask & (1 << i)) !== 0
                  return (
                    <button
                      key={c.key}
                      aria-pressed={on}
                      onClick={() => choose('readings', toggleReadingMask(readMask, i, choices.length))}
                      className="tap rounded-full px-4 py-1.5 text-sm"
                      style={on
                        ? { background: 'var(--accent)', color: 'var(--paper)' }
                        : { border: '1px solid var(--rule)', color: 'var(--ink-muted)' }}
                    >
                      {c.slot})
                      <span className="ml-2 text-[0.85em]" style={{ opacity: 0.75 }}>{c.reference}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {doc.lectionaryLinked && data.canticles.length > 0 && (
            <div className="mb-4 grid gap-3">
              {Array.from({ length: Math.max(pickedCount, 1) }, (_, slot) => (
                <label key={slot} className="block text-sm">
                  <span className="mb-1 block" style={{ color: 'var(--ink-muted)' }}>
                    {slot + 1}독서 후 송가
                  </span>
                  <select
                    className="tap w-full min-w-0 rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: 'var(--rule)', background: 'var(--paper-raised)', color: 'var(--ink)' }}
                    value={cantAt(slot)}
                    onChange={(e) => choose(`cant-${slot + 1}`, Number(e.target.value))}
                  >
                    {data.canticles.map((c, i) => (
                      <option key={c.name} value={i}>{canticleLabel(c)}</option>
                    ))}
                    <option value={-1}>하지 않음</option>
                  </select>
                </label>
              ))}
            </div>
          )}

          {collect && collect.texts.length > 1 && (
            <label className="mb-4 block text-sm">
              <span className="mb-1 block" style={{ color: 'var(--ink-muted)' }}>오늘의 본기도</span>
              <select
                className="tap w-full min-w-0 rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--rule)', background: 'var(--paper-raised)', color: 'var(--ink)' }}
                value={Math.min(chosen['collect'] ?? 0, collect.texts.length - 1)}
                onChange={(e) => choose('collect', Number(e.target.value))}
              >
                {collect.texts.map((t, i) => (
                  <option key={i} value={i}>{i + 1}) {t.slice(0, 30)}…</option>
                ))}
              </select>
            </label>
          )}

          <label className="mb-4 flex items-center gap-3 text-sm">
            <input type="checkbox" checked={showOthers} onChange={(e) => setShowOthers(e.target.checked)} />
            <span>고르지 않은 선택지도 이름만 함께 적기</span>
          </label>

          <button
            className="tap w-full rounded-xl py-3 text-sm"
            style={{ background: 'var(--accent)', color: 'var(--paper)' }}
            onClick={() => {
              setPrintOpen(false)
              window.setTimeout(() => printWithTitle(officePrintTitle(day, doc.title)), 60)
            }}
          >인쇄 · PDF</button>
        </section>
      )}

      <div className="mb-7">
        <TtsBar chunks={chunks} rate={speechRate} onSpeaking={setSpeakingId} />
      </div>

      <OfficeView
        doc={doc}
        day={day}
        lectionary={lectionary}
        data={data}
        showBibleText={showBibleText}
        chosen={chosen}
        onChoose={choose}
        showOtherOptions={showOthers}
        isFeast={isFeast}
        speakingId={speakingId}
      />

      <div className="no-print mt-12 mb-4">
        <button
          onClick={onToggleComplete}
          className="tap w-full rounded-2xl py-4 text-[1.05em]"
          style={completed
            ? { border: '1px solid var(--accent)', color: 'var(--accent)', background: 'var(--accent-soft)' }
            : { background: 'var(--accent)', color: 'var(--paper)' }}
        >
          {completed ? '✓ 마친 기도입니다 (누르면 취소)' : '기도를 마쳤습니다'}
        </button>
      </div>

      <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>
        「대한성공회 기도서」(2004) {doc.pages[0]}–{doc.pages[1]}쪽
      </p>
    </div>
  )
}
