/**
 * 성구 공유카드 — 절기색 배경에 본문과 출처를 얹어 PNG로 만든다.
 *
 * · 글자 크기는 카드 폭과 상관없이 일정하다. 그래서 긴 독서는 카드를 넓혀 주면
 *   한 줄에 더 담겨 세로로 덜 길어진다. 짧은 글은 정사각형에 가깝게 둔다.
 * · 절 번호는 시편처럼 절마다 줄이 바뀌면 왼쪽에 매달아 세우고,
 *   이어지는 산문에서는 본문 사이에 윗첨자로 넣는다.
 * · 문단의 마지막 줄을 뺀 나머지는 양쪽을 맞춘다.
 */
import { SEASON_COLORS } from './theme'
import type { LiturgicalColor } from './churchCalendar'
import { splitVerseMarks, type TextSegment } from './verseMarks'

export interface CardOptions {
  text: string
  reference: string
  color: LiturgicalColor
  dark?: boolean
  /** 카드 가로 크기를 직접 정한다. 비워 두면 글 길이에 맞춰 고른다. */
  size?: number
}

const FONT = "'Noto Serif KR', 'Nanum Myeongjo', 'Apple SD Gothic Neo', serif"
/** 낭송을 돕는 표시(구절 중간 쉼·응답)는 카드에서는 덜어 낸다. */
const RECITATION_MARKS = /[○●◎]\s*/g
/** 글자·여백 크기의 기준이 되는 폭. 카드가 넓어져도 글자 크기는 그대로다. */
const BASE_W = 1080
/** 큰 글자부터 차례로 시도한다 (기준 폭에 대한 비율) */
const BODY_RATIOS = [0.048, 0.044, 0.04, 0.036, 0.033, 0.03, 0.027, 0.024]
/** 글이 길면 이 차례로 폭을 넓혀 세로 길이를 줄인다 */
const WIDTH_STEPS = [1080, 1350, 1650, 1980]
/** 세로가 가로의 이 배를 넘지 않도록 폭을 고른다 */
const MAX_RATIO = 2.4
/** 줄 첫머리에 홀로 오면 어색한 글자 — 앞 줄에 붙여 둔다. */
const NO_BREAK_BEFORE = new Set([...'.,!?;:)]}」』”’…·'])
/** '1 주님께 비오니…' 처럼 절 번호로 시작하는 문단 */
const VERSE_HEAD = /^(\d{1,3}:\d{1,3}|\d{1,3}|¶)\s+(.*)$/

/** 한 글자와 그 글자를 어떻게 그릴지 */
interface Atom {
  ch: string
  /** 절 번호는 작게, 옅게, 윗선에 맞춰 그린다 */
  verse: boolean
  w: number
}

interface Line {
  atoms: Atom[]
  /** 이 줄 앞에 세울 절 번호 (시편처럼 절마다 줄이 바뀔 때) */
  num?: string
  /** 문단의 마지막 줄이면 양쪽을 맞추지 않는다 */
  last: boolean
}

const bodyFont = (size: number) => `${size}px ${FONT}`
const verseFont = (size: number) => `${Math.round(size * 0.66)}px ${FONT}`

/** 글월을 글자 단위로 재어 둔다. 절 번호는 작은 서체로 잰다. */
function atomize(ctx: CanvasRenderingContext2D, segments: TextSegment[], bodySize: number): Atom[] {
  const out: Atom[] = []
  let current: boolean | null = null
  for (const seg of segments) {
    const verse = !!seg.verse
    if (current !== verse) {
      ctx.font = verse ? verseFont(bodySize) : bodyFont(bodySize)
      current = verse
    }
    for (const ch of seg.text) out.push({ ch, verse, w: ctx.measureText(ch).width })
    if (verse) out.push({ ch: ' ', verse: false, w: bodySize * 0.18 })   // 번호와 본문 사이 숨
  }
  return out
}

function wrapAtoms(atoms: Atom[], maxWidth: number): Atom[][] {
  const lines: Atom[][] = []
  let line: Atom[] = []
  let width = 0
  for (const a of atoms) {
    if (width + a.w > maxWidth && line.length) {
      if (NO_BREAK_BEFORE.has(a.ch)) {          // 마침표 따위는 앞 줄에 붙인다
        line.push(a)
        lines.push(line)
        line = []
        width = 0
        continue
      }
      lines.push(line)
      line = a.ch === ' ' ? [] : [a]            // 줄 맨 앞의 띄어쓰기는 버린다
      width = line.length ? a.w : 0
      continue
    }
    line.push(a)
    width += a.w
  }
  if (line.some((a) => a.ch.trim())) lines.push(line)
  return lines
}

function layout(ctx: CanvasRenderingContext2D, text: string, bodySize: number, maxWidth: number) {
  ctx.font = bodyFont(bodySize)
  const paragraphs = text
    .split('\n')
    .map((p) => p.replace(RECITATION_MARKS, '').replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean)

  // 절이 줄줄이 있는 시편만 번호 칸을 세운다.
  // 독서는 이어지는 산문이라 절 번호를 본문 사이에 윗첨자로 넣는다.
  const numbers = paragraphs.map((p) => p.match(VERSE_HEAD)?.[1]).filter(Boolean) as string[]
  const useNumberColumn = numbers.length >= 2
  const numWidth = useNumberColumn
    ? Math.max(...numbers.map((n) => ctx.measureText(n).width)) + bodySize * 0.6
    : 0
  const bodyWidth = maxWidth - numWidth

  const lines: Line[] = []
  for (const p of paragraphs) {
    const m = useNumberColumn ? p.match(VERSE_HEAD) : null
    const [num, body] = m ? [m[1], m[2]] : [undefined, p]
    const segments = useNumberColumn ? [{ text: body }] : splitVerseMarks(body)
    const wrapped = wrapAtoms(atomize(ctx, segments, bodySize), bodyWidth)
    wrapped.forEach((atoms, i) => {
      lines.push({ atoms, num: i === 0 ? num : undefined, last: i === wrapped.length - 1 })
    })
  }
  return { lines, numWidth, bodyWidth }
}

/** 한 줄을 그린다. justify가 참이면 글자 사이를 고르게 벌려 양쪽을 맞춘다. */
function drawLine(
  ctx: CanvasRenderingContext2D, atoms: Atom[], x: number, y: number,
  width: number, justify: boolean, bodySize: number, fg: string, faint: string,
) {
  const natural = atoms.reduce((sum, a) => sum + a.w, 0)
  let extra = 0
  if (justify) {
    const gap = (width - natural) / Math.max(1, atoms.length - 1)
    if (gap > 0.2 && gap <= bodySize * 0.32) extra = gap
  }
  let cx = x
  let current: boolean | null = null
  for (const a of atoms) {
    if (current !== a.verse) {
      ctx.font = a.verse ? verseFont(bodySize) : bodyFont(bodySize)
      ctx.fillStyle = a.verse ? faint : fg
      current = a.verse
    }
    // 절 번호는 작은 서체를 줄 윗선에 맞춰 윗첨자처럼 보이게 한다
    if (a.ch.trim()) ctx.fillText(a.ch, cx, y)
    cx += a.w + extra
  }
}

/** 글자·여백 크기는 기준 폭에서만 정해진다 — 카드를 넓혀도 글씨는 그대로다. */
const PAD = Math.round(BASE_W * 0.1)
const REF_SIZE = Math.round(BASE_W * 0.03)
const RESERVED = PAD * 2 + Math.round(REF_SIZE * 2.6)
/** 아무리 길어도 이보다 높아지지는 않는다 */
const MAX_H = BASE_W * 10

interface CardPlan {
  lines: Line[]
  numWidth: number
  bodyWidth: number
  bodySize: number
  lineHeight: number
  height: number
}

/** 주어진 폭에 맞춰, 들어가는 가장 큰 글자로 짠다. */
function planCard(ctx: CanvasRenderingContext2D, text: string, width: number): CardPlan {
  const maxWidth = width - PAD * 2
  let bodySize = Math.round(BASE_W * BODY_RATIOS[BODY_RATIOS.length - 1])
  let lineHeight = Math.round(bodySize * 1.62)
  let plan = layout(ctx, text, bodySize, maxWidth)
  for (const ratio of BODY_RATIOS) {
    bodySize = Math.round(BASE_W * ratio)
    lineHeight = Math.round(bodySize * 1.62)
    plan = layout(ctx, text, bodySize, maxWidth)
    if (RESERVED + plan.lines.length * lineHeight <= MAX_H) break
  }
  return {
    ...plan,
    bodySize,
    lineHeight,
    height: RESERVED + plan.lines.length * lineHeight,
  }
}

export function drawShareCard(opts: CardOptions): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  // 글이 길면 카드를 넓혀 세로 길이를 줄인다. 글자 크기는 그대로라 읽기는 같다.
  const widths = opts.size ? [opts.size] : WIDTH_STEPS
  let W = widths[0]
  let plan = planCard(ctx, opts.text, W)
  for (const candidate of widths) {
    W = candidate
    plan = planCard(ctx, opts.text, W)
    if (plan.height <= W * MAX_RATIO) break
  }
  const { bodySize, lineHeight } = plan

  const height = Math.max(W, Math.min(MAX_H, plan.height))
  const room = height - RESERVED
  const maxLines = Math.max(1, Math.floor(room / lineHeight))
  let lines = plan.lines
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines)
    const last = lines[lines.length - 1]
    lines[lines.length - 1] = {
      ...last,
      atoms: [...last.atoms, { ch: '…', verse: false, w: bodySize }],
      last: true,
    }
  }

  canvas.width = W
  canvas.height = height

  const palette = SEASON_COLORS[opts.color]
  const bg = opts.dark ? '#16181a' : palette.soft
  const fg = opts.dark ? '#eceae4' : '#23241f'
  const accent = opts.dark ? palette.dark : palette.light
  const faint = opts.dark ? '#8b8b83' : '#7c7a70'

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, height)
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, Math.round(BASE_W * 0.012), height)   // 왼쪽 절기색 띠

  ctx.textBaseline = 'top'
  const bodyX = PAD + plan.numWidth
  // 짧은 글은 가운데로 모아 준다
  let y = PAD + Math.max(0, Math.round((room - lines.length * lineHeight) / 2))
  for (const line of lines) {
    if (line.num) {
      ctx.font = verseFont(bodySize)
      ctx.fillStyle = faint
      const w = ctx.measureText(line.num).width
      ctx.fillText(line.num, bodyX - bodySize * 0.32 - w, y)
    }
    drawLine(ctx, line.atoms, bodyX, y, plan.bodyWidth, !line.last, bodySize, fg, faint)
    y += lineHeight
  }

  y += Math.round(REF_SIZE * 0.9)
  ctx.font = `${REF_SIZE}px ${FONT}`
  ctx.fillStyle = accent
  ctx.fillText(opts.reference, PAD, y)

  return canvas
}

export async function shareCardBlob(opts: CardOptions): Promise<Blob> {
  const canvas = drawShareCard(opts)
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지를 만들지 못했습니다'))), 'image/png')
  })
}

/** 공유 시트를 지원하면 그쪽으로, 아니면 내려받기로 넘긴다. */
/**
 * 파일 이름에 쓸 인용 표기.
 *
 * 파일 이름에는 쌍점(:)을 쓸 수 없으므로 '판관기 16:15-31'을 '판관기 16장 15-31절'처럼
 * 우리말 표기로 바꾼다.
 */
export function referenceFileName(reference: string): string {
  let s = reference.trim()
  s = s.replace(/^시편\s*(\d+):([\d\-\u2013,\s]+)편$/, '시편 $1편 $2절')
  s = s.replace(/(\d+):([\d\-\u2013]+)/g, '$1장 $2절')
  return s.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function shareCard(opts: CardOptions): Promise<'shared' | 'downloaded'> {
  const blob = await shareCardBlob(opts)
  const name = `성무일과 ${referenceFileName(opts.reference)}`
  const file = new File([blob], `${name}.png`, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], text: opts.reference })
    return 'shared'
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}.png`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return 'downloaded'
}
