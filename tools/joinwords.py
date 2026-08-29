# -*- coding: utf-8 -*-
"""줄바꿈으로 끊긴 한국어 어절을 되붙일지 판정한다.

이 PDF는 양쪽 맞추기 조판이라 줄 끝에 공백 글리프가 남지 않는다. 그래서 줄이
어절 중간에서 끊겼는지('살'+'려' → 살려) 어절 경계에서 끊겼는지('결정을'+'가르쳐')
알 수 없다. 책 전체를 사전 삼아 판정한다.

  · 어휘표   줄 안쪽에 온전히 들어 있던 낱말과 그 빈도
  · 접두표   어떤 토막이 낱말의 '앞부분'으로 쓰인 정도
  · 접미표   어떤 토막이 낱말의 '뒷부분'으로 쓰인 정도

앞뒤가 각각 온전한 낱말이라는 증거(fa×fb)와, 각각 한 낱말의 앞·뒤 토막이라는
증거(PRE×SUF)를 견주어 정한다. 실제 본문에서 무작위로 8,500여 곳을 잘라 대조한
결과 정확도는 98.3%다 (scratch/eval_join.py).
"""
import json, re, collections

_LEX = None
_PRE = None
_SUF = None

# 온전한 어절임을 알려 주는 대표적인 조사
PARTICLE_END = re.compile(
    r"(에서|에게|께서|으로|부터|까지|처럼|보다|에|께|을|를|이|가|은|는|의|로|와|과|도|만)$")

# 띄어쓰기 증거를 얼마나 무겁게 볼지 (eval_join.py로 고른 값)
SPACE_WEIGHT = 4.0


def lexicon(book_json="scratch/book.json"):
    global _LEX, _PRE, _SUF
    if _LEX is None:
        c = collections.Counter()
        for p in json.load(open(book_json)):
            for l in p["lines"]:
                toks = [t for t in re.split(r"[\s\t]+", l["text"]) if t]
                # 첫·마지막 낱말은 줄바꿈에 잘렸을 수 있으므로 제외
                for t in toks[1:-1]:
                    w = t.strip("().,·「」‘’“”[]?!:;")
                    if w and re.fullmatch(r"[가-힣]+", w):
                        c[w] += 1
        _LEX = c
        _PRE, _SUF = collections.Counter(), collections.Counter()
        for w, f in c.items():
            for i in range(1, len(w)):
                _PRE[w[:i]] += f
                _SUF[w[i:]] += f
    return _LEX


def _stem_looks_complete(word):
    """'악마가'처럼 조사를 떼어낼 수 있으면 온전한 어절로 본다."""
    m = PARTICLE_END.search(word)
    return bool(m) and m.start() >= 2


def join(prev_text, next_text):
    """이어지는 두 줄을 알맞게 잇는다."""
    prev_text, next_text = prev_text.rstrip(), next_text.lstrip()
    if not prev_text or not next_text:
        return (prev_text + next_text).strip()
    lex = lexicon()
    # 줄 끝의 한글 덩어리와 다음 줄 첫 한글 덩어리만 본다.
    # ('오.(예레 14:9, 22)'처럼 뒤에 인용이 붙어 있어도 '오'만 떼어 판단한다)
    ma = re.search(r"[가-힣]+$", prev_text)
    mb = re.match(r"^[가-힣]+", next_text)
    if not ma or not mb:
        return prev_text + " " + next_text
    ca, cb = ma.group(), mb.group()
    fa, fb = lex[ca], lex[cb]
    merged = ca + cb
    fm = lex[merged]
    if not fm:
        # '즈가리야송가를'처럼 조사가 붙어 그대로는 안 잡히는 경우, 조사를 떼고 찾아본다
        m = PARTICLE_END.search(merged)
        if m and m.start() >= 2:
            fm = lex[merged[: m.start()]]

    if fm and (fa == 0 or fb == 0 or fm >= fa + fb or fm > fb):
        glue = ""                                  # 붙인 형태가 실제로 쓰이는 낱말
    else:
        space_ev = fa * fb                         # 둘 다 온전한 낱말이라는 증거
        join_ev = _PRE[ca] * _SUF[cb]              # 한 낱말의 앞·뒤 토막이라는 증거
        if space_ev == 0 and join_ev == 0:
            # 어느 쪽 증거도 없는 드문 경우. 실측해 보면 한쪽만이라도 홀로 쓰이는
            # 낱말이면 어절 경계일 때가 훨씬 많다 (scratch/eval2.py).
            glue = " " if (fa > 0 or (fb > 0 and _SUF[cb] == 0)
                           or (len(cb) >= 2 and _stem_looks_complete(ca))) else ""
        else:
            glue = " " if space_ev * SPACE_WEIGHT > join_ev else ""
    return prev_text + glue + next_text
