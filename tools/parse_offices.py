# -*- coding: utf-8 -*-
"""성무일과 예식문(147~190쪽) → 구조화 JSON."""
import sys, os, re, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pdfplumber
from extract import page_lines
from joinwords import join as join_lines

SRC = "TalkFile_성공회-기도서2004년-판 (1) (2).pdf"
SECTIONS = [
    ("morning", "아침기도", 149, 156),
    ("noon",    "낮기도",   157, 161),
    ("evening", "저녁기도", 162, 167),
    ("night",   "밤기도",   168, 176),
    ("brief",   "간략한 기도예식", 177, 179),
    ("canticles", "성무일과 송가", 180, 190),
]
FOOTER = re.compile(r"^[가-힣][가-힣 ]{0,9}\s*\d{3}$|^\d{3}\s*[가-힣][가-힣 ]{0,9}$|^\d{3}$")
SPEAKER = {"†": "versicle", "◎": "response", "○": "versicle", "●": "response", "‡": "versicle"}
SEC_RE = re.compile(r"^(\d+)\.\s*(.+)$")
OPT_RE = re.compile(r"^(\d+)\)\s*(.+)$")
VERSE_RE = re.compile(r"^(\d{1,3})\s+(?=\S)")


def parse_page(page, pno):
    out = []
    for l in page_lines(page):
        t = l["text"].strip()
        if not t or FOOTER.match(t):
            continue
        l["page"] = pno
        out.append(l)
    return out


# 이어지는 줄을 붙일 수 있는 블록과, 그 블록에서 본문을 담는 필드
CONTINUABLE = {"text": "text", "versicle": "text", "response": "text",
               "verse": "text", "rubric": "text", "option": "title"}


def is_continuation(line, prev):
    """다음 줄이 앞 블록의 이어지는 줄인가?

    성서소구·본기도처럼 선택지(option) 자체가 여러 줄에 걸친 긴 인용인 경우가 있어
    option도 이어 붙일 수 있게 한다. '시편 121편' 같은 짧은 표제는 다음 줄이 절 번호로
    시작하므로 아래 조건에서 걸러진다.
    """
    if prev is None or prev["type"] not in CONTINUABLE:
        return False
    if not prev.get("full", False):
        return False                      # 앞 줄이 판면 끝까지 차지 않았으면 거기서 끝난 문단
    # 지시문은 원문에서 이어지는 줄이 검은 잉크로 조판된 곳이 있어(151쪽 등)
    # 색이 아니라 글자 크기로 같은 문단인지 본다.
    if prev["type"] == "rubric":
        return abs(line["size"] - prev["size"]) < 0.6
    if line["rubric"] != prev.get("rubric", False):
        return False
    t = line["text"]
    if t[0] in SPEAKER or SEC_RE.match(t) or OPT_RE.match(t) or VERSE_RE.match(t) or t[0] == "¶":
        return False
    # 앞 줄이 판면 끝까지 찼고 새로운 구조가 시작되지 않았다면 같은 문단이다.
    # '은혜를 구하는 기도'처럼 들여쓰기 없이 이어지는 기도문도 이렇게 이어진다.
    return True


def classify(l):
    t = l["text"].strip()
    if l["rubric"]:
        return {"type": "rubric", "text": t, "x0": l["x0"], "rubric": True}
    if l["size"] >= 26:
        return {"type": "title", "text": t, "x0": l["x0"]}
    if m := SEC_RE.match(t):
        return {"type": "section", "n": int(m.group(1)), "title": m.group(2).strip(), "x0": l["x0"]}
    if m := OPT_RE.match(t):
        return {"type": "option", "n": int(m.group(1)), "title": m.group(2).strip(), "x0": l["x0"]}
    if t[0] in SPEAKER:
        return {"type": SPEAKER[t[0]], "marker": t[0], "text": t[1:].strip(), "x0": l["x0"]}
    if t.startswith("¶"):
        return {"type": "verse", "n": "¶", "text": t[1:].strip(), "x0": l["x0"]}
    if m := VERSE_RE.match(t):
        return {"type": "verse", "n": m.group(1), "text": t[m.end():].strip(), "x0": l["x0"]}
    if l["size"] < 16.5:
        # 지시문 크기(15pt)로 조판된 안내문. 원문에 붉은 잉크가 빠진 곳이 있어
        # 문장 끝맺음으로도 알아본다.
        if re.search(r"(다|함)\.?$", t):
            return {"type": "rubric", "text": t, "x0": l["x0"], "rubric": True}
        return {"type": "heading", "text": t, "x0": l["x0"]}
    return {"type": "text", "text": t, "x0": l["x0"]}


def main():
    offices = []
    with pdfplumber.open(SRC) as pdf:
        for key, title, first, last in SECTIONS:
            lines = []
            for pno in range(first, last + 1):
                lines.extend(parse_page(pdf.pages[pno - 1], pno))
            blocks, prev = [], None
            for l in lines:
                if is_continuation(l, prev):
                    field = CONTINUABLE[prev["type"]]
                    prev[field] = join_lines(prev[field], l["text"])
                    prev["full"] = l.get("full", False)
                    continue
                b = classify(l)
                b["page"] = l["page"]
                b["full"] = l.get("full", False)
                b["size"] = l["size"]
                blocks.append(b)
                prev = b
            for b in blocks:
                for k in ("x0", "rubric", "full", "size"):
                    b.pop(k, None)
            offices.append({"office": key, "title": title,
                            "pages": [first, last],
                            "lectionaryLinked": key in ("morning", "evening"),
                            "blocks": blocks})
    json.dump({"source": "대한성공회 기도서(2004) 147~190쪽 「성무일과」", "offices": offices},
              open("public/data/offices.json", "w"), ensure_ascii=False, indent=1)
    for o in offices:
        kinds = {}
        for b in o["blocks"]: kinds[b["type"]] = kinds.get(b["type"], 0) + 1
        print(f"{o['title']:<14} 블록 {len(o['blocks']):>4}  {kinds}")


main()
