import { useEffect, useRef, useState } from 'react'
import { OfficeSpeaker, type SpeechChunk, type SpeechState } from '../lib/tts'

interface Props {
  chunks: SpeechChunk[]
  rate: number
  onSpeaking: (id: string | null) => void
}

/** 화면을 보지 않고도 따라갈 수 있도록 예식을 구간별로 읽어 준다. */
export function TtsBar({ chunks, rate, onSpeaking }: Props) {
  const [state, setState] = useState<SpeechState>('idle')
  const speaker = useRef<OfficeSpeaker | null>(null)

  if (!speaker.current) {
    speaker.current = new OfficeSpeaker((s, i) => {
      setState(s)
      onSpeaking(s === 'idle' || i < 0 ? null : (chunks[i]?.id ?? null))
    })
  }

  useEffect(() => () => speaker.current?.stop(), [])

  if (!speaker.current.supported) return null
  const s = speaker.current

  const Btn = ({ label, onClick, primary = false }: { label: string; onClick: () => void; primary?: boolean }) => (
    <button
      onClick={onClick}
      aria-label={label}
      className="tap rounded-full px-4 py-2 text-sm"
      style={primary
        ? { background: 'var(--accent)', color: 'var(--paper)' }
        : { border: '1px solid var(--rule)', color: 'var(--ink-muted)' }}
    >{label}</button>
  )

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      {state === 'idle' && <Btn label="▶ 낭독" primary onClick={() => s.start(chunks, rate)} />}
      {state === 'speaking' && <Btn label="❙❙ 일시정지" primary onClick={() => s.pause()} />}
      {state === 'paused' && <Btn label="▶ 이어듣기" primary onClick={() => s.resume()} />}
      {state !== 'idle' && (
        <>
          <Btn label="◀ 이전" onClick={() => s.skip(-1)} />
          <Btn label="다음 ▶" onClick={() => s.skip(1)} />
          <Btn label="■ 정지" onClick={() => { s.stop(); onSpeaking(null) }} />
        </>
      )}
    </div>
  )
}
