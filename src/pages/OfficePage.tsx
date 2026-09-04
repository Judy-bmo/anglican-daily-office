import { useMemo, useState } from 'react'
import {
  OfficeView, optionGroups, optionLabel, preferredOption, speechChunks,
} from '../components/OfficeView'
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
  const groups = useMemo(() => optionGroups(doc.blocks), [doc.blocks])
  const [chosen, setChosen] = useState<Record<string, number>>({})
  // 대축일·주요축일에는 송가 배정표의 '대축일, 주의 축일' 항목을 쓴다 (기도서 181쪽)
  const isFeast = useMemo(() => {
    const [, mm, dd] = day.date.split('-').map(Number)
    return data.feasts.some((f) =>
      f.month === mm
      && (f.day === dd || (f.dayEnd !== undefined && dd >= f.day && dd <= f.dayEnd))
      && (f.rank === 'principal' || f.rank === 'major'))
  }, [data.feasts, day.date])

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
