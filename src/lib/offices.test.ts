import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildPlan, isContentOption, optionLabel, optionWhen, preferredOption, speechChunks } from '../components/OfficeView'
import { describeDay } from './churchCalendar'
import type { OfficeDoc } from './types'

const offices: OfficeDoc[] = JSON.parse(readFileSync('public/data/offices.json', 'utf8')).offices
const by = new Map(offices.map((o) => [o.office, o]))

describe('성무일과 예식문', () => {
  it('네 예식이 모두 실려 있다', () => {
    for (const id of ['morning', 'noon', 'evening', 'night']) {
      expect(by.get(id as never), id).toBeTruthy()
      expect(by.get(id as never)!.blocks.length).toBeGreaterThan(30)
    }
  })

  it('성서정과를 따르는 예식은 아침·저녁기도뿐이다 (기도서 484쪽)', () => {
    expect(by.get('morning')!.lectionaryLinked).toBe(true)
    expect(by.get('evening')!.lectionaryLinked).toBe(true)
    expect(by.get('noon')!.lectionaryLinked).toBe(false)
    expect(by.get('night')!.lectionaryLinked).toBe(false)
  })

  it('아침·저녁기도에 성서정과가 들어갈 자리가 있다', () => {
    for (const id of ['morning', 'evening'] as const) {
      const titles = by.get(id)!.blocks.filter((b) => b.type === 'section').map((b) => b.title ?? '')
      expect(titles.some((t) => t.includes('오늘의 시편')), id).toBe(true)
      expect(titles.some((t) => t.includes('성서독서')), id).toBe(true)
    }
  })

  it('낮기도의 선택 항목이 원문대로 묶인다', () => {
    const plan = buildPlan(by.get('noon')!.blocks)
    const groups = plan.filter((p) => p.kind === 'options')
    expect(groups).toHaveLength(3)          // 시편 · 성서소구 · 마침기도
    const psalms = groups[0] as Extract<typeof groups[0], { kind: 'options' }>
    expect(psalms.options.map((o) => o.title)).toEqual([
      '시편 119:105-112', '시편 121편', '시편 126편',
    ])
    for (const g of groups) {
      expect((g as { options: unknown[] }).options.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('아침기도의 초대송가 셋은 한 묶음이며, 절기 지시문은 해당 선택지에만 붙는다', () => {
    const plan = buildPlan(by.get('morning')!.blocks)
    const first = plan.find((p) => p.kind === 'options') as Extract<typeof plan[0], { kind: 'options' }>
    expect(first.options.map((o) => o.n)).toEqual([1, 2, 3])
    expect(first.options[2].title).toContain('부활송가')
    // '부활주일에서 성령강림주일까지는…'은 부활송가에만 걸린다
    expect(first.options[2].note?.text).toContain('부활주일에서 성령강림주일까지')
    expect(first.options[0].note).toBeUndefined()
    expect(first.options[1].note).toBeUndefined()
    // 묶음 전체 안내로는 남지 않는다
    expect(first.notes.some((n) => n.text?.includes('부활주일에서'))).toBe(false)
  })

  it('선택 목록에 그 선택지가 쓰이는 절기를 함께 보여 준다', () => {
    const plan = buildPlan(by.get('morning')!.blocks)
    const first = plan.find((p) => p.kind === 'options') as Extract<typeof plan[0], { kind: 'options' }>
    expect(optionWhen(first.options[2])).toBe('부활주일~성령강림주일')
    expect(optionWhen(first.options[0])).toBeUndefined()
    expect(optionLabel(first.options[2])).toBe('부활송가 Pascha nostrum (부활주일~성령강림주일)')
    // 표제 뒤에 붙은 성서 인용은 목록에서 덜어 낸다
    expect(optionLabel(first.options[0])).toBe('시편 95편 Venite')
    const evening = buildPlan(by.get('evening')!.blocks)
      .find((p) => p.kind === 'options') as Extract<typeof plan[0], { kind: 'options' }>
    expect(optionLabel(evening.options[0])).toBe('성모 마리아송가 Magnificat')
  })

  it('부활절기에는 부활송가가 기본으로 선택된다', () => {
    const plan = buildPlan(by.get('morning')!.blocks)
    const first = plan.find((p) => p.kind === 'options') as Extract<typeof plan[0], { kind: 'options' }>
    expect(preferredOption(first.options, describeDay('2026-04-20'))).toBe(2)  // 부활 4주
    expect(preferredOption(first.options, describeDay('2026-08-29'))).toBe(0)  // 연중
    expect(preferredOption(first.options, describeDay('2026-03-02'))).toBe(0)  // 사순
  })

  it('낭독 구간이 만들어지고 기호는 읽지 않는다', () => {
    const chunks = speechChunks(by.get('night')!, describeDay('2026-08-29'))
    expect(chunks.length).toBeGreaterThan(20)
    for (const c of chunks) {
      expect(c.text).not.toMatch(/[○●◎†‡¶✛✠]/)
      expect(c.text.trim()).not.toBe('')
    }
  })

  it('밤기도에는 성 시므온송가와 본기도 선택지가 있다', () => {
    const titles = by.get('night')!.blocks.filter((b) => b.type === 'section').map((b) => b.title)
    expect(titles).toContain('성 시므온송가')
    expect(titles).toContain('본기도')
  })
})

describe('선택지 표시', () => {
  it('이름표와 본문을 가려낸다', () => {
    // 이름표 — 무엇을 고르는지 알려 주는 표제
    expect(isContentOption('시편 121편')).toBe(false)
    expect(isContentOption('시편 119:105-112')).toBe(false)
    expect(isContentOption('부활송가 Pascha nostrum\t1고린 5:7-8, 15:20-22, 로마 6:9-11')).toBe(false)
    expect(isContentOption('즈가리야송가 Benedictus Dominus Deus \t루가 1:68-79')).toBe(false)
    // 본문 — 성서소구·본기도처럼 표제 자리에 낭송할 글이 통째로 온 경우
    expect(isContentOption('주께서는 우리 가운데에 계시는 분…마십시오.(예레 14:9, 22)')).toBe(true)
    expect(isContentOption('주여, 어둠 속에서 우리의 빛이 되시며 … 보호하소서.')).toBe(true)
  })

  it('기도서에 실린 모든 선택지가 올바르게 갈린다', () => {
    const wrong: string[] = []
    for (const o of offices) {
      for (const b of o.blocks) {
        if (b.type !== 'option') continue
        const t = b.title ?? ''
        // 이름표는 짧고 마침표로 끝나지 않는다
        const looksLikeLabel = t.length < 60 && !/[.?!]\s*$/.test(t)
        if (isContentOption(t) === looksLikeLabel) wrong.push(`${o.title}: ${t.slice(0, 40)}`)
      }
    }
    expect(wrong).toEqual([])
  })

  it('고르는 목록에는 짧은 이름을 쓴다', () => {
    const noon = by.get('noon')!
    const groups = buildPlan(noon.blocks).filter((p) => p.kind === 'options')
    const lesson = groups[1] as Extract<(typeof groups)[0], { kind: 'options' }>
    // 성서소구는 끝에 붙은 성서 인용을 이름으로 쓴다
    expect(lesson.options.map(optionLabel)).toEqual(['로마 5:5', '2고린 2:17-18', '말라 1:11'])
    // 인용이 없는 기도문은 앞부분만 잘라 보여 준다
    const closing = groups[2] as Extract<(typeof groups)[0], { kind: 'options' }>
    for (const label of closing.options.map(optionLabel)) {
      expect(label.length).toBeLessThanOrEqual(31)
      expect(label.endsWith('…')).toBe(true)
    }
  })
})

describe('지시문(rubric)', () => {
  it('여러 줄에 걸친 지시문이 한 문단으로 이어진다', () => {
    const rubrics = by.get('morning')!.blocks.filter((b) => b.type === 'rubric').map((b) => b.text ?? '')
    // 기도서 151쪽의 지시문은 세 줄에 걸쳐 있고, 가운데 줄은 원문에서 검은 잉크로 조판되어 있다
    const canticle = rubrics.find((t) => t.startsWith('독서 후 아래의 송가'))
    expect(canticle).toBeDefined()
    expect(canticle).toContain('즈가리야송가를')
    expect(canticle).toContain('180-189쪽의 송가 중 하나를 선택한다')
    // 조각난 채로 남은 지시문이 없어야 한다
    for (const t of rubrics) expect(t.length).toBeGreaterThan(6)
  })

  it('서로 다른 지시문이 잘못 합쳐지지 않는다', () => {
    const night = by.get('night')!.blocks.filter((b) => b.type === 'rubric').map((b) => b.text ?? '')
    expect(night).toContain('밤기도는 하루의 일과를 끝맺고 잠자기 전에 드리는 기도이다.')
    expect(night).toContain('잠시 묵상하거나 성가를 부르면서 시작할 수 있다.')
  })

  it('쪽 번호 같은 짜투리가 본문에 섞이지 않는다', () => {
    for (const o of offices) {
      for (const b of o.blocks) {
        const t = b.text ?? b.title ?? ''
        expect(t, `${o.title}: ${t}`).not.toMatch(/^\S*\s*\d{3}$/)
      }
    }
  })
})

describe('낭독 구간', () => {
  it('화면에서 고른 선택지를 그대로 읽는다', () => {
    const noon = by.get('noon')!
    const day = describeDay('2026-08-29')
    const groups = buildPlan(noon.blocks).filter((p) => p.kind === 'options')
    const lesson = groups[1] as Extract<(typeof groups)[0], { kind: 'options' }>

    const 기본 = speechChunks(noon, day).map((c) => c.text).join(' ')
    expect(기본).toContain('고통은 인내를 낳고')          // 성서소구 1)

    const 둘째 = speechChunks(noon, day, { [lesson.id]: 1 }).map((c) => c.text).join(' ')
    expect(둘째).toContain('누구든지 그리스도를 믿으면')   // 성서소구 2)
    expect(둘째).not.toContain('고통은 인내를 낳고')
  })

  it('부활절기에는 부활송가를 읽는다', () => {
    const morning = by.get('morning')!
    const 부활 = speechChunks(morning, describeDay('2026-04-20')).map((c) => c.text).join(' ')
    expect(부활).toContain('과월절 어린양')
    const 연중 = speechChunks(morning, describeDay('2026-08-29')).map((c) => c.text).join(' ')
    expect(연중).toContain('어서 와 주님께 기쁜 노래')
  })
})
