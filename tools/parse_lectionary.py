# -*- coding: utf-8 -*-
"""성무일과 성서정과표(484~524쪽) → 구조화 JSON.

484~523쪽은 1단 조판의 절기/요일 표, 524쪽은 2단 조판의 축일 표다.
"""
import sys, os, re, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tokens import page_token_lines
import pdfplumber

SRC = "TalkFile_성공회-기도서2004년-판 (1) (2).pdf"
WEEKDAYS = {"월": 1, "화": 2, "수": 3, "목": 4, "금": 5, "토": 6}
FOOTER = re.compile(r"^\d{3}\s|성무일과 성서정과표\s*\d{3}$|^\d{3}$|성서정과\s*\d{3}$")

# 기도서가 쓰는 성서 약어(공동번역 기준)
BOOKS = """창세 출애 레위 민수 신명 여호 판관 룻기 사무상 사무하 열왕상 열왕하 역대상 역대하
에즈 느헤 에스 욥기 시편 잠언 전도 아가 이사 예레 애가 에제 다니 호세 요엘 아모 오바 요나
미가 나훔 하바 스바 하깨 즈가 말라 토비 유딧 지혜 집회 바룩 마카상 마카하
마태 마르 루가 요한 사도 로마 고린 갈라 에페 필립 골로 데살 디모 디도 필레 히브 야고 베드 유다 묵시
""".split()
# 숫자 접두를 받는 책은 이 다섯뿐이다(사무상·열왕상·마카상 등은 상/하 표기).
NUMBERED = ["고린", "요한", "베드", "데살", "디모"]
_ANY = "|".join(sorted(BOOKS, key=len, reverse=True))
BOOK_RE = re.compile(
    r"(?:[1-3](?=(?:" + "|".join(NUMBERED) + r")))?(?:" + _ANY + r")(?=\s*\d)")
_BARE_NUMBERED = re.compile(r"^(?:" + "|".join(NUMBERED) + r")\s*\d")
# 복음서는 결코 권 번호를 갖지 않는다. 마지막 칸(복음)에는 번호를 붙이지 않는다.
_GOSPEL = re.compile(r"^(?:마태|마르|루가|요한)\s*\d")


def rejoin_book_number(cells):
    """열 경계에서 떨어져 나온 성서 권 번호를 되붙인다.

    조판상 '이사 1:1-9' / '2베드 3:1-10'의 '2'가 앞 열 끝에 붙어
    '이사 1:1-92' + '베드 3:1-10'으로 잘리는 경우를 바로잡는다.
    """
    out = list(cells)
    for i in range(len(out) - 1):
        a, b = out[i].rstrip(), out[i + 1].lstrip()
        # '이사 1:1-9' + '2베드 3:1-10' → '…-92' + '베드 …' 로 잘린 경우
        last = i + 1 == len(out) - 1
        if _BARE_NUMBERED.match(b) and re.search(r"\d[1-3]$", a) \
                and not (last and _GOSPEL.match(b)):
            out[i], out[i + 1] = a[:-1], a[-1] + b
        # 반대로 절 번호가 뒤 열로 밀려 '즈가 14:12-2' + '1필립 2:1-11'이 된 경우
        elif (m := re.match(r"^([1-3])(?=[가-힣])", b)) and not _BARE_NUMBERED.match(b[1:]) \
                and re.search(r"\d$", a):
            out[i], out[i + 1] = a + m.group(1), b[1:]
    return out

HEAD_PATTERNS = [
    (re.compile(r"^대림\s*(\d)주일"),   lambda m: ("advent", int(m.group(1)), 0)),
    (re.compile(r"^사순\s*(\d)주일"),   lambda m: ("lent", int(m.group(1)), 0)),
    (re.compile(r"^부활\s*(\d)주일"),   lambda m: ("easter", int(m.group(1)), 0)),
    (re.compile(r"^부활주일"),          lambda m: ("easter", 1, 0)),
    (re.compile(r"^성탄\s*(\d)주일"),   lambda m: ("christmas", int(m.group(1)), 0)),
    (re.compile(r"^연중\s*(\d+)주일"),  lambda m: ("ordinary", int(m.group(1)), 0)),
    (re.compile(r"^고난주일"),          lambda m: ("holyweek", 1, 0)),
    (re.compile(r"^재의\s*수요일"),     lambda m: ("lent", 0, 3)),
    (re.compile(r"^성령강림주일"),      lambda m: ("pentecost", None, 0)),
    (re.compile(r"^삼위일체주일"),      lambda m: ("trinity", None, 0)),
]
DATE_HEAD = re.compile(r"^(\d{1,2})\s*월\s*((?:\d\s*)+)일")


def norm_label(s):
    s = re.sub(r"(\d)\s+(?=\d)", r"\1", s)              # '5월 1 4일' → '5월 14일'
    s = re.sub(r"(\d일)(?=[가-힣])", r"\1 ", s)          # '3월19일성요셉' → '… 성요셉'
    s = re.sub(r"(\d+월)(?=\d)", r"\1 ", s)
    return re.sub(r"\s+", " ", s).strip()


def clean_psalm(s):
    return re.sub(r"^\s*시편\s*", "", s.strip()).strip(" ,") or None


def split_psalms(s):
    if "✛" in s:
        a, b = s.split("✛", 1)
        return clean_psalm(a), clean_psalm(b)
    return clean_psalm(s), None


def split_cells(text):
    """한 셀에 여러 성서 인용이 붙어 있으면 책 이름 경계로 나눈다."""
    text = re.sub(r"([가-힣])[;:](?=[가-힣]|\s)", r"\1", text)   # 원문의 잔글자 정리
    starts = [m.start() for m in BOOK_RE.finditer(text)]
    if len(starts) < 2:
        return [text.strip()] if text.strip() else []
    return [text[s:(starts[i + 1] if i + 1 < len(starts) else len(text))].strip(" ,")
            for i, s in enumerate(starts)]


def cells_of(tokens):
    """토큰 목록 → 성서 인용 셀 목록 (권 번호 복원 포함)."""
    cells = []
    for t in tokens:
        cells.extend(split_cells(t["text"] if isinstance(t, dict) else t))
    return rejoin_book_number(cells)


def parse_flow(lines, days):
    """1단 조판(484~523) 흐름 파싱."""
    cur = None
    base = 118.9
    for l in lines:
        toks = l["tokens"]
        text = " ".join(t["text"] for t in toks)
        rel = l["x0"] - base

        if l["rubric"]:
            if cur: cur["notes"].append(text)
            continue

        if rel < -25:                                    # 표제
            head = toks[0]["text"]
            rest = " ".join(t["text"] for t in toks[1:])
            inline = ""
            m = re.search(r"시편", head)
            if m:
                inline, head = head[m.start():], head[:m.start()].strip()
            if rest.startswith("시편") or rest.startswith("또는"):
                inline = (inline + " " + rest).strip()
            elif rest and not inline:
                head = f"{head} {rest}".strip()
            head = norm_label(head)
            meta = next((fn(mm) for pat, fn in HEAD_PATTERNS if (mm := pat.match(head))), None)
            cur = mkday(days, head, meta, l["page"], "sunday" if meta and meta[2] == 0 else "special")
            if dm := DATE_HEAD.match(head):
                cur.update(month=int(dm.group(1)), day=int(re.sub(r"\s", "", dm.group(2))), kind="date")
            if inline:
                a, b = split_psalms(inline)
                cur["psalms"] = {"morning": a, "evening": b, "raw": inline.strip()}
            continue

        if cur is None:
            continue

        if toks[0]["text"] in WEEKDAYS and rel < 0:      # 요일 줄
            wd = WEEKDAYS[toks[0]["text"]]
            parent = cur.get("_parent") or cur
            cur = mkday(days, f"{parent['label']} {toks[0]['text']}요일",
                        (parent.get("season"), parent.get("week"), wd), l["page"], "weekday")
            cur["_parent"] = parent
            raw = " ".join(t["text"] for t in toks[1:])
            a, b = split_psalms(raw)
            cur["psalms"] = {"morning": a, "evening": b, "raw": raw}
            continue

        if toks[0]["text"] in ("1", "2"):                # 독서 줄
            cells = cells_of(toks[1:])
            cur["readings"][toks[0]["text"]] = dict(zip(["ot", "epistle", "gospel"], cells[:3]))
            if len(cells) > 3:
                cur["readings"][toks[0]["text"]]["extra"] = cells[3:]
            continue

        if text.startswith("또는"):                       # 대체 본문
            (cur["alternates"]).append(text[2:].strip())
            continue

        # 고난주일·부활주일의 '[아침]/[저녁]', 성탄주간 축일의 '아침기도/저녁기도'
        if m := re.match(r"^(?:\[(아침|저녁)\]|(아침|저녁)기도)\s*(.*)$", text):
            slot = "morning" if (m.group(1) or m.group(2)) == "아침" else "evening"
            cur["offices"][slot] = office_entry(m.group(3))
            continue

        if text.startswith("시편") and not cur["psalms"]:
            a, b = split_psalms(text)
            cur["psalms"] = {"morning": a, "evening": b, "raw": text}
            continue

        cells = split_cells(text)
        if cells:
            cur["readings"].setdefault("both", {}).update(
                dict(zip(["ot", "epistle", "gospel"], cells[:3])))


def column_lines(page_lines_tokens, lo, hi):
    """2단 조판 페이지에서 한쪽 단만 뽑아 줄 단위로 다시 묶는다."""
    rows = {}
    for l in page_lines_tokens:
        toks = [t for t in l["tokens"] if lo <= t["x0"] < hi]
        if toks:
            rows.setdefault(l["mid"], []).extend(toks)
    out = []
    for mid in sorted(rows):
        toks = sorted(rows[mid], key=lambda t: t["x0"])
        out.append({"mid": mid, "x0": toks[0]["x0"],
                    "text": " ".join(t["text"] for t in toks), "tokens": toks})
    return out


def parse_feasts(lines, days):
    """524쪽 축일 성무일과 정과. 왼쪽·오른쪽 단을 따로 흘려 읽는다."""
    for lo, hi in ((0, 300), (300, 10_000)):
        cur = None
        for l in column_lines(lines, lo, hi):
            txt = l["text"].strip()
            if not txt or FOOTER.search(txt) or "주요축일" in txt.replace(" ", ""):
                continue
            if m := re.match(r"^(조|만)\b\s*(.*)$", txt):
                if cur is None:
                    continue
                slot = "morning" if m.group(1) == "조" else "evening"
                cur["offices"][slot] = office_entry(m.group(2))
                continue
            if txt.startswith("시편"):
                if cur is None:
                    continue
                e = office_entry(txt)
                cur["psalms"] = {"morning": e["psalms"], "evening": None, "raw": txt}
                if e["readings"]:
                    cur["readings"]["both"] = dict(zip(["ot", "epistle", "gospel"], e["readings"]))
                continue
            # 표제 줄: 성서 인용만 있는 줄은 앞 항목에 이어 붙인다
            if BOOK_RE.search(txt) and cur is not None:
                cells = rejoin_book_number(split_cells(txt))
                target = cur["readings"].setdefault("both", {})
                for key, val in zip(["ot", "epistle", "gospel"], cells):
                    target.setdefault(key, val)
                continue
            cur = mkday(days, norm_label(txt), None, 524, "feast")


def office_entry(text):
    """'시편 19  이사 45:18-25  필립 3:4하-11' → 시편과 독서 목록."""
    m = re.match(r"\s*시편\s*([0-9:,\-\s]+)", text)
    psalms = clean_psalm(m.group(0)) if m else None
    rest = text[m.end():] if m else text
    return {"psalms": psalms, "readings": rejoin_book_number(split_cells(rest))}


def mkday(days, label, meta, page, kind):
    d = {"label": label, "kind": kind, "page": page, "psalms": {}, "readings": {},
         "offices": {}, "alternates": [], "notes": []}
    if meta:
        d["season"], d["week"], d["weekday"] = meta
    days.append(d)
    return d


def main():
    days = []
    with pdfplumber.open(SRC) as pdf:
        flow, feast = [], []
        for pno in range(484, 525):
            for l in page_token_lines(pdf.pages[pno - 1]):
                l["page"] = pno
                if FOOTER.search(" ".join(t["text"] for t in l["tokens"])):
                    continue
                (feast if pno == 524 else flow).append(l)
    started = False
    kept = []
    for l in flow:
        if not started:
            if re.match(r"^대림\s*1주일", l["tokens"][0]["text"]):
                started = True
            else:
                continue
        kept.append(l)
    parse_flow(kept, days)
    parse_feasts(feast, days)
    days[:] = [d for d in days if not (d["kind"] == "feast" and not d["psalms"]
                                       and not d["readings"] and not d["offices"])]
    for d in days:
        d.pop("_parent", None)
        for k in ("offices", "alternates", "notes"):
            if not d[k]: d.pop(k)
    json.dump({"source": "대한성공회 기도서(2004) 484~524쪽 「성무일과 성서정과표」", "days": days},
              open("public/data/lectionary.json", "w"), ensure_ascii=False, indent=1)
    kinds = {}
    for d in days: kinds[d["kind"]] = kinds.get(d["kind"], 0) + 1
    print("블록:", len(days), kinds)
    full = sum(1 for d in days if d["readings"].get("1") and d["readings"].get("2"))
    print("1해·2해 완비:", full)
    bad = [d["label"] for d in days if d["readings"].get("1") and len(d["readings"]["1"]) < 3]
    print("독서 3개 미만:", len(bad), bad[:8])


main()
