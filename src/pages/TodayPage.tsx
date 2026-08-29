import { DayHeader } from '../components/DayHeader'
import type { ChurchDay } from '../lib/churchCalendar'
import type { OfficeLectionary } from '../lib/lectionary'
import type { Feast, OfficeId } from '../lib/types'

const OFFICES: Array<{ id: OfficeId; title: string; when: string; note: string }> = [
  { id: 'morning', title: '아침기도', when: '아침', note: '성서정과에 따른 시편과 독서' },
  { id: 'noon', title: '낮기도', when: '정오 전후', note: '시편과 성서소구를 고를 수 있습니다' },
  { id: 'evening', title: '저녁기도', when: '저녁', note: '성서정과에 따른 시편과 독서' },
  { id: 'night', title: '밤기도', when: '잠자기 전', note: '고정된 시편과 기도' },
]

interface Props {
  day: ChurchDay
  feasts: Feast[]
  lectionary: OfficeLectionary | null
  completed: Set<string>
  streak: number
  threshold: number
  onOpen: (office: OfficeId) => void
  onShiftDay: (delta: number) => void
  isToday: boolean
}

export function TodayPage({ day, feasts, lectionary, completed, streak, threshold, onOpen, onShiftDay, isToday }: Props) {
  return (
    <div>
      <nav className="no-print mb-5 flex items-center justify-between text-sm">
        <button className="tap px-2" style={{ color: 'var(--ink-muted)' }} onClick={() => onShiftDay(-1)}>← 어제</button>
        {!isToday && <span style={{ color: 'var(--accent)' }}>다른 날 보기</span>}
        <button className="tap px-2" style={{ color: 'var(--ink-muted)' }} onClick={() => onShiftDay(1)}>내일 →</button>
      </nav>

      <DayHeader day={day} feasts={feasts} />

      {streak > 0 && (
        <p className="mb-6 text-sm" style={{ color: 'var(--accent)' }}>
          🔥 {streak}일째 이어가는 중
          <span className="ml-2" style={{ color: 'var(--ink-faint)' }}>하루 {threshold}개 기준</span>
        </p>
      )}

      <ul className="space-y-3">
        {OFFICES.map((o) => {
          const done = completed.has(o.id)
          return (
            <li key={o.id}>
              <button
                onClick={() => onOpen(o.id)}
                className="tap flex w-full items-center gap-4 rounded-2xl border p-5 text-left transition-colors"
                style={{
                  borderColor: done ? 'var(--accent)' : 'var(--rule)',
                  background: done ? 'var(--accent-soft)' : 'var(--paper-raised)',
                }}
              >
                <span aria-hidden className="text-lg" style={{ color: done ? 'var(--accent)' : 'var(--ink-faint)' }}>
                  {done ? '✓' : '○'}
                </span>
                <span className="flex-1">
                  <span className="block text-[1.05em]">{o.title}</span>
                  <span className="block text-sm" style={{ color: 'var(--ink-muted)' }}>{o.when} · {o.note}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {lectionary && (
        <section className="mt-9 rounded-2xl border p-5" style={{ borderColor: 'var(--rule)' }}>
          <h2 className="mb-3 text-sm" style={{ color: 'var(--accent)' }}>오늘의 전례독서</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex gap-3">
              <dt className="w-14 shrink-0" style={{ color: 'var(--ink-faint)' }}>시편</dt>
              <dd>
                아침 {lectionary.morningPsalms.map((p) => p.number).join(', ') || '—'}
                <span style={{ color: 'var(--ink-faint)' }}> ✛ </span>
                저녁 {lectionary.eveningPsalms.map((p) => p.number).join(', ') || '—'}
              </dd>
            </div>
            {(['ot', 'epistle', 'gospel'] as const).map((k) =>
              lectionary.readings[k] ? (
                <div className="flex gap-3" key={k}>
                  <dt className="w-14 shrink-0" style={{ color: 'var(--ink-faint)' }}>
                    {{ ot: '구약', epistle: '서신', gospel: '복음' }[k]}
                  </dt>
                  <dd>{lectionary.readings[k]}</dd>
                </div>
              ) : null,
            )}
          </dl>
          <p className="mt-3 text-xs" style={{ color: 'var(--ink-faint)' }}>
            기도서 {lectionary.day.page}쪽 「{lectionary.day.label}」
          </p>
        </section>
      )}
    </div>
  )
}
