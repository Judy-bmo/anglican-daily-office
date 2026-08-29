/**
 * 음성 낭독 — Web Speech API.
 * 화면을 보지 않고도 기도를 따라갈 수 있도록 구간별로 이어서 읽는다.
 */
export interface SpeechChunk {
  /** 화면에서 이 구간을 가리키는 데 쓰는 식별자 */
  id: string
  text: string
}

export type SpeechState = 'idle' | 'speaking' | 'paused'

export class OfficeSpeaker {
  private chunks: SpeechChunk[] = []
  private cursor = 0
  private rate = 0.95
  private onChange?: (state: SpeechState, index: number) => void

  get supported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window
  }

  constructor(onChange?: (state: SpeechState, index: number) => void) {
    this.onChange = onChange
  }

  /** 한국어 음성을 고른다. 없으면 브라우저 기본 음성을 쓴다. */
  private korean(): SpeechSynthesisVoice | undefined {
    const voices = window.speechSynthesis.getVoices()
    return voices.find((v) => v.lang === 'ko-KR') ?? voices.find((v) => v.lang.startsWith('ko'))
  }

  start(chunks: SpeechChunk[], rate: number, from = 0) {
    if (!this.supported) return
    this.stop()
    this.chunks = chunks
    this.rate = rate
    this.cursor = from
    this.speakCurrent()
  }

  private speakCurrent() {
    if (this.cursor >= this.chunks.length) {
      this.onChange?.('idle', -1)
      return
    }
    const u = new SpeechSynthesisUtterance(this.chunks[this.cursor].text)
    u.lang = 'ko-KR'
    u.rate = this.rate
    const voice = this.korean()
    if (voice) u.voice = voice
    u.onend = () => {
      this.cursor++
      this.speakCurrent()
    }
    u.onerror = () => this.onChange?.('idle', -1)
    this.onChange?.('speaking', this.cursor)
    window.speechSynthesis.speak(u)
  }

  pause() {
    if (!this.supported) return
    window.speechSynthesis.pause()
    this.onChange?.('paused', this.cursor)
  }

  resume() {
    if (!this.supported) return
    window.speechSynthesis.resume()
    this.onChange?.('speaking', this.cursor)
  }

  stop() {
    if (!this.supported) return
    window.speechSynthesis.cancel()
    this.onChange?.('idle', -1)
  }

  skip(delta: number) {
    const next = Math.max(0, Math.min(this.chunks.length - 1, this.cursor + delta))
    this.start(this.chunks, this.rate, next)
  }
}

/** 낭독할 때는 기호를 읽지 않고 쉼으로 바꾼다. */
export function speechText(raw: string): string {
  return raw
    .replace(/[○●◎†‡¶✛✠]/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/,\s*,/g, ',')
    .trim()
}
