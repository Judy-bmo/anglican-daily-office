import { describe, it, expect } from 'vitest'
import { splitVerseMarks } from './verseMarks'

const marks = (t: string) => splitVerseMarks(t).filter((s) => s.verse).map((s) => s.text)
const plain = (t: string) => splitVerseMarks(t).map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim()

describe('산문 독서에서 절 번호 골라내기', () => {
  it('장:절과 이어지는 절 번호를 찾아낸다', () => {
    expect(marks('9:1 욥이 다시 말을 받았다. 10:1 숨쉬는 일이 괴로워서 2 나 이제 아룁니다. 3 당신께서'))
      .toEqual(['9:1', '10:1', '2', '3'])
  })

  it('본문 속 숫자를 절 번호로 잘못 읽지 않는다', () => {
    expect(marks('16:1 그가 600 명을 불렀다. 2 이튿날')).toEqual(['16:1', '2'])
    expect(marks('1 이스라엘 자손 1000 명이 모였다.')).toEqual(['1'])
  })

  it('절 번호가 없으면 그대로 둔다', () => {
    const t = '주님은 나의 목자시니 아쉬울 것 없어라.'
    expect(marks(t)).toEqual([])
    expect(splitVerseMarks(t)).toEqual([{ text: t }])
  })

  it('나눈 조각을 다시 이으면 원래 글이 된다', () => {
    const t = '9:1 욥이 다시 말을 받았다. 10:1 숨쉬는 일이 괴로워서 2 나 이제 아룁니다.'
    expect(plain(t)).toBe(t)
  })
})
