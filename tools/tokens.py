"""줄을 x좌표가 붙은 토큰 목록으로 쪼갠다(열 분할용)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract import char_text, _is_rubric, _space_threshold

def page_token_lines(page, y_tol=4.2, split_em=0.75):
    chars = [c for c in page.chars if c.get("upright", True) and c["text"].strip()]
    rows = []
    for c in sorted(chars, key=lambda c: (c["top"], c["x0"])):
        mid = (c["top"] + c["bottom"]) / 2
        for r in rows:
            if abs(r["mid"] - mid) <= y_tol:
                r["chars"].append(c); break
        else:
            rows.append({"mid": mid, "chars": [c]})
    out = []
    for r in sorted(rows, key=lambda r: r["mid"]):
        cs = sorted(r["chars"], key=lambda c: c["x0"])
        gaps = [(b["x0"] - a["x1"]) / a["size"] for a, b in zip(cs, cs[1:])]
        thr = _space_threshold(gaps)
        toks, cur = [], [cs[0]]
        for (a, b), g in zip(zip(cs, cs[1:]), gaps):
            if g > split_em:
                toks.append(cur); cur = [b]
            else:
                if g > thr: cur.append({"text": " ", "x0": b["x0"], "x1": b["x0"], "size": a["size"]})
                cur.append(b)
        toks.append(cur)
        tokens = []
        for t in toks:
            txt = "".join(ch["text"] if ch.get("text") == " " else char_text(ch) for ch in t).strip()
            if txt:
                tokens.append({"text": txt, "x0": round(t[0]["x0"], 1)})
        if tokens:
            red = sum(1 for c in cs if _is_rubric(c))
            out.append({"mid": round(r["mid"], 1), "x0": tokens[0]["x0"],
                        "size": round(max(c["size"] for c in cs), 1),
                        "rubric": red > len(cs) * 0.6, "tokens": tokens})
    return out
