# ruff: noqa: E501 — the page script reads better unwrapped
"""Screenshots for Qo'llanma (/guide), taken from the LOCAL demo data (seed + seed_demo), light theme.

Each chapter file has a spec in scripts/guide/<name>.py: the records worth showing (ids()) and the pictures
(shots(ids)). The numbered red marks on a picture are the ones the guide text names (1, 2, …) in Shot.marks.
Pictures land in frontend/public/guide/<name>/<shot>.webp. Run again after the UI changes:

    # backend on :8000 (runserver), frontend (vite) on :5173, local DB with seed_demo
    uv run --with playwright==1.48.0 --with pillow python scripts/guide_shots.py <name> [only-this-shot …]

A shot is a dict:
    name    the file name
    path    the app path to open
    wait    a text on the page to wait for ("" — none)
    steps   before the picture: ["click", selector, text], ["fill", selector, value], ["select", selector, option-text-part],
            ["press", key], ["wait", ms], ["js", code], ["goto", path], ["hover", selector, text]
    scroll  a text to bring near the top
    marks   [[selector, text the element shows (or ""), pad?], …] — numbered 1, 2, … in this order;
            a text starting with "=" must match exactly ("=Avans" is not "Avans sanasi")
    crop    True: close up on the marked elements instead of the whole work area
    menu    True: keep the left menu in the picture
    height  the viewport height for this shot (default 1000)

Never press a button that saves in a step unless the chapter is about that result: the demo data is shared by
every chapter. Uses the installed Google Chrome. Signs in as the seed superuser with a token made here — local only.
"""

import importlib
import io
import os
import sys
from pathlib import Path

import django

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.conf import settings  # noqa: E402
from django.contrib.auth import get_user_model  # noqa: E402
from PIL import Image  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

from apps.users.authentication import LoginSerializer  # noqa: E402

ROOT = Path(__file__).resolve().parents[2] / "frontend" / "public" / "guide"
BASE = os.environ.get("GUIDE_BASE", "http://localhost:5173")
W, H = 1600, 1000


def _tokens() -> tuple[str, str]:
    user = get_user_model().objects.get(username=settings.SEED_ADMIN_USERNAME)
    refresh = LoginSerializer.get_token(user)
    return str(refresh.access_token), str(refresh)


# numbered marks: [selector, text the element shows (or ""), pad?] — the smallest visible match gets the next number
MARK_JS = """
(marks) => {
  document.querySelectorAll('.gd-mark').forEach((e) => e.remove())
  let n = 0
  const rects = []
  for (const [sel, text, pad] of marks) {
    n += 1
    const els = [...document.querySelectorAll(sel)].filter((e) => {
      const r = e.getBoundingClientRect()
      if (!(r.width > 0 && r.height > 0)) return false
      if (!text) return true
      const vals = [e.innerText, e.value, e.placeholder, e.getAttribute('aria-label'), e.title].map((v) => (v || '').trim())
      // «=Avans» — the element's text is exactly «Avans» (not «Avans sanasi»)
      return text.startsWith('=') ? vals.some((v) => v === text.slice(1)) : vals.some((v) => v.includes(text))
    })
    // the innermost match: «section containing X» picks the card, not the page
    const el = els.sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0]
    if (!el) { console.warn('mark not found', sel, text); rects.push(null); continue }
    const r = el.getBoundingClientRect()
    const p = pad ?? 4
    const box = document.createElement('div')
    box.className = 'gd-mark'
    Object.assign(box.style, { position: 'fixed', left: r.left - p + 'px', top: r.top - p + 'px', width: r.width + 2 * p + 'px', height: r.height + 2 * p + 'px', border: '3px solid #d42a2a', borderRadius: '10px', zIndex: 99998, pointerEvents: 'none', boxShadow: '0 0 0 3px rgba(212,42,42,.18)' })
    const dot = document.createElement('div')
    dot.className = 'gd-mark'
    dot.textContent = String(n)
    const left = Math.max(4, r.left - p - 15), top = Math.max(4, r.top - p - 15)
    Object.assign(dot.style, { position: 'fixed', left: left + 'px', top: top + 'px', width: '30px', height: '30px', borderRadius: '50%', background: '#d42a2a', color: '#fff', font: '700 16px/30px system-ui, sans-serif', textAlign: 'center', zIndex: 99999, pointerEvents: 'none', boxShadow: '0 2px 6px rgba(0,0,0,.35)', border: '2px solid #fff' })
    document.body.append(box, dot)
    rects.push([r.left - p - 16, r.top - p - 16, r.right + p, r.bottom + p])
  }
  return rects
}
"""


# Records typed by hand into the local DB (real people) never reach a picture: their name and phone are swapped
# for made-up ones in the page before each shot. The DB is not touched.
REDACT_JS = """
() => {
  const pairs = [
    ['Shohjahon Obruyev', 'Akmal Karimov'], ['Obruyev Shohjahon', 'Karimov Akmal'], ['Obruyev', 'Karimov'], ['Shohjahon', 'Akmal'],
    ['Jasur Ochilov', 'Bekzod Rahimov'], ['Ochilov Jasur', 'Rahimov Bekzod'], ['jasur@rombo.uz', 'bekzod@rombo.uz'], ['Ochilov', 'Rahimov'],
    ['+998 94 802 51 01', '+998 90 123 45 67'], ['+998948025101', '+998901234567'], ['948025101', '901234567'], ['94 802 51 01', '90 123 45 67'],
  ]
  const fix = (s) => pairs.reduce((t, [a, b]) => t.split(a).join(b), s)
  const exact = { JO: 'BR' }  // initials of the swapped user
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = walk.nextNode(); n; n = walk.nextNode()) { const t = n.nodeValue.trim(); const v = exact[t] ?? fix(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v }
  document.querySelectorAll('input, textarea').forEach((e) => { const v = fix(e.value); if (v !== e.value) e.value = v })
  document.querySelectorAll('select option').forEach((e) => { const v = fix(e.text); if (v !== e.text) e.text = v })
}
"""


def _step(page, st) -> None:
    kind = st[0]
    if kind == "click":
        (page.locator(st[1], has_text=st[2]) if st[2] else page.locator(st[1])).first.click()
    elif kind == "hover":
        (page.locator(st[1], has_text=st[2]) if st[2] else page.locator(st[1])).first.hover()
    elif kind == "fill":
        page.locator(st[1]).first.fill(st[2])
    elif kind == "select":
        sel = page.locator(st[1]).first
        label = next(o for o in sel.locator("option").all_inner_texts() if st[2] in o)
        sel.select_option(label=label)
    elif kind == "press":
        page.keyboard.press(st[1])
    elif kind == "wait":
        page.wait_for_timeout(st[1])
    elif kind == "js":
        page.evaluate(st[1])
    elif kind == "goto":
        page.goto(BASE + st[1])
    else:
        raise ValueError(f"unknown step {kind}")


def run(name: str, only: set[str]) -> None:
    if sys.platform == "win32":  # Django's channels picks the selector loop; Playwright needs subprocesses
        import asyncio

        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    spec = importlib.import_module(f"guide.{name}")
    ids = spec.ids()
    access, refresh = _tokens()
    out = ROOT / name
    out.mkdir(parents=True, exist_ok=True)
    missing, failed = [], []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel="chrome", headless=True, args=["--lang=en-GB"])  # dd/mm/yyyy, not the system locale
        ctx = browser.new_context(viewport={"width": W, "height": H}, device_scale_factor=1, locale="en-GB")
        ctx.add_init_script(
            f"try{{localStorage.setItem('rombo.access','{access}');localStorage.setItem('rombo.refresh','{refresh}');"
            "localStorage.setItem('rombo-theme','light')}catch(e){}"
        )
        page = ctx.new_page()
        for s in spec.shots(ids):
            if only and s["name"] not in only:
                continue
            try:
                page.set_viewport_size({"width": W, "height": s.get("height", H)})
                page.goto(BASE + s["path"])
                if s.get("wait"):
                    page.get_by_text(s["wait"], exact=False).first.wait_for(timeout=15000)
                page.wait_for_timeout(1200)
                for st in s.get("steps", []):
                    _step(page, st)
                    page.wait_for_timeout(900)
                page.evaluate("document.body.style.paddingBottom = '900px'")  # room to bring a low block up
                if s.get("scroll"):
                    page.get_by_text(s["scroll"], exact=False).first.evaluate("(e) => e.scrollIntoView({block: 'start'})")
                    page.evaluate("window.scrollBy(0, -90)")
                    page.wait_for_timeout(400)
                page.evaluate(REDACT_JS)
                found = page.evaluate(MARK_JS, s.get("marks", []))
                rects = [r for r in found if r]
                lost = [i + 1 for i, r in enumerate(found) if r is None]
                if lost:
                    missing.append(f"{s['name']}: mark {lost}")
                page.wait_for_timeout(150)
                vh = s.get("height", H)
                # the work area only (the menu is the same on every page) unless the picture is about the menu
                left = 0 if s.get("menu") else page.evaluate("Math.max(0, (document.querySelector('main')?.getBoundingClientRect().left || 0))")
                clip = {"x": left, "y": 0, "width": W - left, "height": vh}
                if s.get("crop") and rects:
                    # close up on what the marks point at: their box with a margin, at least 900×420
                    x0, y0 = min(r[0] for r in rects) - 40, min(r[1] for r in rects) - 40
                    x1, y1 = max(r[2] for r in rects) + 40, max(r[3] for r in rects) + 40
                    x0, y0, x1, y1 = max(left, x0), max(0, y0), min(W, x1), min(vh, y1)
                    if x1 - x0 < 900:
                        x0 = max(left, min(x0, x1 - 900))
                        x1 = min(W, x0 + 900)
                    if y1 - y0 < 420:
                        y1 = min(vh, y0 + 420)
                    clip = {"x": x0, "y": y0, "width": x1 - x0, "height": y1 - y0}
                png = page.screenshot(clip=clip)
                _save(png, out / f"{s['name']}.webp")
                print("ok", name, s["name"], f"marks={len(rects)}/{len(found)}")
            except Exception as e:  # noqa: BLE001
                failed.append(s["name"])
                print("FAIL", name, s["name"], str(e).splitlines()[0])
        browser.close()
    for m in missing:
        print("MARK NOT FOUND", name, m)
    if failed:
        print("FAILED SHOTS", name, failed)


def _save(png: bytes, path: Path) -> None:
    im = Image.open(io.BytesIO(png)).convert("RGB")
    im.save(path, "WEBP", quality=82, method=6)


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        sys.exit("usage: guide_shots.py <chapter> [shot …]   (chapters: scripts/guide/*.py)")
    run(args[0], set(args[1:]))
