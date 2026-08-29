import { useEffect, useState } from 'react'
import { cachedChapterCount, warmBibleCache } from '../lib/offline'
import type { OfficeId } from '../lib/types'
import type { Settings, ThemeMode } from '../lib/storage'

const THEMES: Array<{ id: ThemeMode; label: string; note: string }> = [
  { id: 'system', label: '시스템 설정 따르기', note: '기기 설정에 맞춥니다' },
  { id: 'light', label: '항상 밝게', note: '' },
  { id: 'dark', label: '항상 어둡게', note: '' },
  { id: 'auto', label: '시간대 자동', note: '저녁 6시부터 새벽 5시까지 어둡게' },
]

const OFFICE_LABELS: Array<[OfficeId, string]> = [
  ['morning', '아침기도'], ['noon', '낮기도'], ['evening', '저녁기도'], ['night', '밤기도'],
]

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-b py-6" style={{ borderColor: 'var(--rule)' }}>
      <h2 className="mb-1 text-[1.02em]">{title}</h2>
      {hint && <p className="mb-3 text-sm" style={{ color: 'var(--ink-muted)' }}>{hint}</p>}
      {children}
    </section>
  )
}

export function SettingsPage({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => void }) {
  const [cacheState, setCacheState] = useState<string | null>(null)
  const [cached, setCached] = useState<number | null>(null)
  const [warming, setWarming] = useState<string | null>(null)

  useEffect(() => { cachedChapterCount().then(setCached) }, [])

  const askNotification = async () => {
    if (!('Notification' in window)) { setCacheState('이 브라우저는 알림을 지원하지 않습니다.'); return }
    const p = await Notification.requestPermission()
    setCacheState(p === 'granted' ? '알림을 허용했습니다.' : '알림이 허용되지 않았습니다.')
  }

  return (
    <div>
      <h1 className="mb-6 text-[1.5em] font-semibold">설정</h1>

      <Row title="화면 밝기" hint="절기색은 밝은 화면과 어두운 화면에 맞춰 따로 조정됩니다.">
        <div className="grid gap-2">
          {THEMES.map((t) => (
            <label key={t.id} className="tap flex items-center gap-3 rounded-xl border px-4 py-3"
                   style={{ borderColor: settings.theme === t.id ? 'var(--accent)' : 'var(--rule)' }}>
              <input type="radio" name="theme" checked={settings.theme === t.id}
                     onChange={() => update({ theme: t.id })} />
              <span>
                <span className="block">{t.label}</span>
                {t.note && <span className="block text-sm" style={{ color: 'var(--ink-muted)' }}>{t.note}</span>}
              </span>
            </label>
          ))}
        </div>
      </Row>

      <Row title="글자 크기" hint={`현재 ${Math.round(settings.fontScale * 100)}%`}>
        <input type="range" min={0.85} max={1.6} step={0.05} value={settings.fontScale}
               className="w-full" aria-label="글자 크기"
               onChange={(e) => update({ fontScale: Number(e.target.value) })} />
      </Row>

      <Row title="음성 낭독 속도" hint={`현재 ${settings.speechRate.toFixed(2)}배`}>
        <input type="range" min={0.6} max={1.4} step={0.05} value={settings.speechRate}
               className="w-full" aria-label="낭독 속도"
               onChange={(e) => update({ speechRate: Number(e.target.value) })} />
      </Row>

      <Row title="성서 본문 보기" hint="끄면 구절 표시만 보여 줍니다.">
        <label className="tap flex items-center gap-3">
          <input type="checkbox" checked={settings.showBibleText}
                 onChange={(e) => update({ showBibleText: e.target.checked })} />
          <span>공동번역성서 본문을 함께 보기</span>
        </label>
      </Row>

      <Row title="하루 완료 기준" hint="네 기도 중 몇 개를 마쳐야 그날을 이어간 것으로 볼지 정합니다.">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((n) => (
            <button key={n} onClick={() => update({ streakThreshold: n })}
                    className="tap flex-1 rounded-xl border py-3"
                    style={settings.streakThreshold === n
                      ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)', color: 'var(--accent)' }
                      : { borderColor: 'var(--rule)' }}>
              {n}개
            </button>
          ))}
        </div>
      </Row>

      <Row title="기도 시간 알림"
           hint="앱이 열려 있는 동안 알려 줍니다. iOS에서는 홈 화면에 추가한 뒤에야 알림이 동작하며, 앱이 닫혀 있을 때의 알림은 지원되지 않습니다.">
        <div className="grid gap-3">
          {OFFICE_LABELS.map(([id, label]) => (
            <label key={id} className="flex items-center justify-between gap-3">
              <span>{label}</span>
              <input
                type="time"
                className="tap rounded-lg border px-3 py-2"
                style={{ borderColor: 'var(--rule)', background: 'var(--paper-raised)', color: 'var(--ink)' }}
                value={settings.reminders[id] ?? ''}
                onChange={(e) => update({ reminders: { ...settings.reminders, [id]: e.target.value } })}
              />
            </label>
          ))}
          <button className="tap mt-1 self-start rounded-full border px-4 py-2 text-sm"
                  style={{ borderColor: 'var(--rule)', color: 'var(--accent)' }}
                  onClick={askNotification}>알림 권한 요청</button>
          {cacheState && <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>{cacheState}</p>}
        </div>
      </Row>

      <Row title="오프라인으로 쓰기"
           hint={`예식문·시편·성서정과는 이미 기기에 저장되어 있습니다. 성서 본문 1,329장은 읽은 곳부터 저장되며, 여기서 한꺼번에 받아 둘 수도 있습니다.${cached !== null ? ` (현재 ${cached}장 저장됨)` : ''}`}>
        <button
          className="tap rounded-full border px-4 py-2 text-sm"
          style={{ borderColor: 'var(--rule)', color: 'var(--accent)' }}
          disabled={warming !== null}
          onClick={async () => {
            setWarming('내려받는 중… 0%')
            const r = await warmBibleCache((p) =>
              setWarming(`내려받는 중… ${Math.round((p.done / p.total) * 100)}% (${p.done}/${p.total})`))
            setWarming(`${r.total}장을 모두 저장했습니다.`)
            setCached(await cachedChapterCount())
          }}
        >성서 본문 전체 내려받기 (약 10MB)</button>
        {warming && <p className="mt-2 text-sm" style={{ color: 'var(--ink-muted)' }}>{warming}</p>}
      </Row>

      <section className="py-6 text-sm" style={{ color: 'var(--ink-muted)' }}>
        <h2 className="mb-2 text-[1.02em]" style={{ color: 'var(--ink)' }}>출처와 저작권</h2>
        <p className="mb-2">
          예식문·시편·성서정과·축일은 「대한성공회 기도서」(2004)에서, 성서 본문은 「공동번역성서
          개정판」(1999)에서 가져왔습니다.
        </p>
        <p>
          개인 기도용으로 만든 앱입니다. 기도 기록과 즐겨찾기는 기기 안에만 저장되며 어디로도
          전송되지 않습니다.
        </p>
      </section>
    </div>
  )
}
