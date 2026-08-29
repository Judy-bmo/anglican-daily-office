"""대한성공회 기도서(2004) PDF → 구조화 텍스트 추출기.

pdfplumber의 문자 좌표를 이용해 읽기 순서를 복원하고, 글자색으로 '지시문(rubric,
붉은 이탤릭)'과 '본문'을 구분한다. 서체 크기로 제목 수준을 함께 기록한다.
"""
import re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from decode import decode_cid

CIDRE = re.compile(r"^\(cid:(\d+)\)$")


def char_cid(ch):
    m = CIDRE.match(ch["text"])
    return int(m.group(1)) if m else None


def char_text(ch, unknown="�"):
    n = char_cid(ch)
    if n is None:
        return ch["text"]
    c = decode_cid(n)
    if c is not None:
        return c
    return unknown if unknown is not None else f"⟨{n}⟩"


def _is_rubric(ch):
    """붉은 지시문 판정.

    이 PDF는 지시문을 별색(Separation) 컬러스페이스로 인쇄한다. 다른 판본을 대비해
    RGB/CMYK 붉은색도 함께 인정한다.
    """
    if ch.get("ncs") == "Separation":
        return True
    color = ch.get("non_stroking_color")
    if not color or isinstance(color, (int, float)):
        return False
    c = list(color)
    if len(c) == 3:
        r, g, b = c
        return r > 0.4 and r - max(g, b) > 0.2
    if len(c) == 4:
        cy, m, y, k = c
        return m > 0.4 and y > 0.3 and cy < 0.3 and k < 0.5
    return False


def _space_threshold(gaps):
    """어절 공백 임계값을 줄마다 적응적으로 정한다.

    한글 본문은 글리프가 조금씩 겹쳐(음수 간격) 이어지고, 공백만 뚜렷하게 커진다.
    양쪽 판짜기(justify) 때문에 절대값이 페이지마다 달라 최빈 간격을 기준선으로 삼는다.
    """
    if not gaps:
        return 0.12
    rounded = [round(g, 2) for g in gaps]
    base = max(set(rounded), key=rounded.count)
    return base + 0.12


def page_lines(page, y_tol=4.2, unknown="�"):
    chars = [c for c in page.chars if c.get("upright", True) and c["text"].strip()]
    if not chars:
        return []
    rows = []
    for c in sorted(chars, key=lambda c: (c["top"], c["x0"])):
        mid = (c["top"] + c["bottom"]) / 2
        for row in rows:
            if abs(row["mid"] - mid) <= y_tol:
                row["chars"].append(c)
                row["mid"] = (row["mid"] * len(row["chars"]) + mid) / (len(row["chars"]) + 1)
                break
        else:
            rows.append({"mid": mid, "chars": [c]})
    lines = []
    for row in sorted(rows, key=lambda r: r["mid"]):
        cs = sorted(row["chars"], key=lambda c: c["x0"])
        gaps = [(b["x0"] - a["x1"]) / a["size"] for a, b in zip(cs, cs[1:])]
        thr = _space_threshold(gaps)
        parts = [char_text(cs[0], unknown)]
        for (a, b), g in zip(zip(cs, cs[1:]), gaps):
            if g > thr:
                parts.append(" " if g < thr + 1.6 else "\t")
            parts.append(char_text(b, unknown))
        text = "".join(parts).strip()
        if not text:
            continue
        red = sum(1 for c in cs if _is_rubric(c))
        lines.append({
            "text": text,
            "x0": round(min(c["x0"] for c in cs), 1),
            "x1": round(max(c["x1"] for c in cs), 1),
            "top": round(row["mid"], 1),
            "size": round(max(c["size"] for c in cs), 1),
            "rubric": red > len(cs) * 0.6,
            "font": max(set(c["fontname"] for c in cs), key=[c["fontname"] for c in cs].count),
        })
    # 판면의 오른쪽 한계. 양쪽 맞추기 조판이므로 '줄이 여기까지 찼는가'가
    # 그 줄에서 문단이 끝났는지 아니면 다음 줄로 이어지는지를 알려 준다.
    margin = max((l["x1"] for l in lines), default=0)
    for l in lines:
        l["full"] = l["x1"] > margin - 12
    return lines


def page_text(page, **kw):
    return "\n".join(l["text"] for l in page_lines(page, **kw))
