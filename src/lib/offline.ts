/** 성서 본문을 한꺼번에 받아 두어 인터넷 없이도 읽을 수 있게 한다. */
import { loadBibleBooks } from './data'

export interface WarmProgress { done: number; total: number }

export async function warmBibleCache(onProgress?: (p: WarmProgress) => void): Promise<WarmProgress> {
  const base = `${import.meta.env.BASE_URL}data/bible`
  const books = await loadBibleBooks()
  const urls: string[] = []
  for (const b of books) {
    for (let ch = 1; ch <= b.chapter_count; ch++) urls.push(`${base}/${b.id}-${ch}.json`)
    if (b.has_prologue) urls.push(`${base}/${b.id}-prologue.json`)
  }
  let done = 0
  const total = urls.length
  const queue = [...urls]
  // 브라우저와 서버에 무리가 가지 않도록 동시 요청을 제한한다
  const workers = Array.from({ length: 6 }, async () => {
    for (;;) {
      const url = queue.pop()
      if (!url) return
      try { await fetch(url, { cache: 'force-cache' }) } catch { /* 실패한 장은 다음에 다시 받는다 */ }
      done++
      if (done % 25 === 0 || done === total) onProgress?.({ done, total })
    }
  })
  await Promise.all(workers)
  return { done, total }
}

/** 캐시에 이미 담긴 장 수를 센다. */
export async function cachedChapterCount(): Promise<number> {
  if (!('caches' in window)) return 0
  let n = 0
  for (const name of await caches.keys()) {
    const c = await caches.open(name)
    n += (await c.keys()).filter((r) => r.url.includes('/data/bible/')).length
  }
  return n
}
