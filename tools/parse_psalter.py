# -*- coding: utf-8 -*-
"""시편(525~764쪽) → 구조화 JSON.

기도서 526쪽 안내:
  ○  한 구절을 두 부분으로 나눈 표시(낭송 시 숨을 맞추는 자리)
  :  긴 구절을 잠시 끊는 표시
  ¶  한 절을 두 절로 나누었다는 표시
"""
import sys, os, re, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pdfplumber
from extract import page_lines
from joinwords import join as join_lines

SRC = "TalkFile_성공회-기도서2004년-판 (1) (2).pdf"
FIRST, LAST = 526, 764
HEAD = re.compile(r"^(\d{1,3})\s*편\s*$")
FOOTER = re.compile(r"^시편\s*[\d\-,\s]+편\s*\d{3}$|^\d{3}\s*시편|^\d{3}$|^시편$")
VERSE = re.compile(r"^(\d{1,3}(?:\s*,\s*\d{1,3})?)\s+(?=\S)")
GLORIA = re.compile(r"^[◎●]")
SECTION = re.compile(r"^[가-힣]{1,4}\s*$")
# 긴 시편을 나누어 낭송하도록 표시한 구분 (기도서 526쪽)
PART = re.compile(r"^\((\d{1,2})\)$")


def main():
    psalms, cur, prev = [], None, None
    with pdfplumber.open(SRC) as pdf:
        for pno in range(FIRST, LAST + 1):
            for l in page_lines(pdf.pages[pno - 1]):
                t = l["text"].strip()
                if not t or FOOTER.match(t):
                    continue

                if (m := HEAD.match(t)) and l["size"] >= 21:
                    cur = {"number": int(m.group(1)), "page": pno, "verses": [], "gloria": None}
                    psalms.append(cur); prev = None
                    continue
                if cur is None:
                    continue

                if m := PART.match(t):
                    cur["verses"].append({"part": m.group(1), "_x": l["x0"]})
                    prev = None
                    continue

                # 연속행: 더 깊게 들여쓴 줄은 앞 절에 이어 붙인다
                if prev is not None and l["x0"] > prev["_x"] + 8 and not VERSE.match(t) \
                        and not GLORIA.match(t) and not t.startswith("¶"):
                    prev["text"] = join_lines(prev["text"], t)
                    continue

                if GLORIA.match(t):
                    cur["gloria"] = t[1:].strip()
                    prev = {"text": cur["gloria"], "_x": l["x0"]}
                    cur["_gloria_ref"] = prev
                    continue
                if t.startswith("¶"):
                    v = {"n": "¶", "text": t[1:].strip(), "_x": l["x0"]}
                    cur["verses"].append(v); prev = v
                    continue
                if m := VERSE.match(t):
                    v = {"n": re.sub(r"\s", "", m.group(1)), "text": t[m.end():].strip(), "_x": l["x0"]}
                    cur["verses"].append(v); prev = v
                    continue
                if SECTION.fullmatch(t) and l["size"] >= 16:
                    cur["verses"].append({"n": None, "section": t, "_x": l["x0"]}); prev = None
                    continue
                # 그 밖의 줄은 앞 절에 이어 붙인다
                if prev is not None:
                    prev["text"] = join_lines(prev["text"], t)
                else:
                    v = {"n": None, "text": t, "_x": l["x0"]}
                    cur["verses"].append(v); prev = v

    for p in psalms:
        if (g := p.pop("_gloria_ref", None)) is not None:
            p["gloria"] = g["text"]
        for v in p["verses"]:
            v.pop("_x", None)
    json.dump({"source": "대한성공회 기도서(2004) 526~764쪽 「시편」",
               "note": "○=구절 중간 쉼, :=긴 구절 끊음, ¶=한 절을 두 절로 나눔",
               "psalms": psalms}, open("public/data/psalter.json", "w"), ensure_ascii=False, indent=1)

    nums = [p["number"] for p in psalms]
    print("추출된 편 수:", len(psalms))
    print("범위:", min(nums), "~", max(nums))
    missing = sorted(set(range(1, 151)) - set(nums))
    dupes = sorted({n for n in nums if nums.count(n) > 1})
    print("누락:", missing or "없음", "| 중복:", dupes or "없음")
    print("영광송 없는 편:", [p["number"] for p in psalms if not p["gloria"]][:12])
    print("절 수 합계:", sum(len(p["verses"]) for p in psalms))


main()
