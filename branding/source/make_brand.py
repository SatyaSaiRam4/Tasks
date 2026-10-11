"""Builds Memo's app icons and logos as SVG, then renders PNGs with headless Chrome.

Usage: python3 make_brand.py <out_dir> <fonts_dir>
"""
import os
import subprocess
import sys
import tempfile

OUT = sys.argv[1]
FONTS = sys.argv[2]
os.makedirs(OUT, exist_ok=True)

# The mark: a bold monogram M with a four-point sparkle, in a 1024 box.
M_PATH = "M 318 700 L 318 338 L 512 566 L 706 338 L 706 700"
SPARKLE = "M790 206 C797 248 808 257 848 264 C808 271 797 280 790 322 C783 280 772 271 732 264 C772 257 783 248 790 206 Z"
SMALL_SPARK = "M232 286 C235 304 240 308 258 311 C240 314 235 318 232 336 C229 318 224 314 206 311 C224 308 229 304 232 286 Z"
# Bounding box centre of the mark (x 270–848, y 206–748), used to centre it.
MARK_CX, MARK_CY = 559, 477

GOLD = {
    "dark": [("0", "#FFF2C8"), ("0.42", "#EBCB86"), ("0.72", "#CFA04A"), ("1", "#A3712A")],
    "light": [("0", "#E9C47A"), ("0.45", "#C9963E"), ("0.8", "#9E6A1F"), ("1", "#7A4E12")],
}


def stops(kind):
    return "".join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in GOLD[kind])


def mark(kind, uid, scale=1.0, cx=512, cy=512, shadow=True):
    """The mark, scaled and centred on (cx, cy)."""
    tx = cx - MARK_CX * scale
    ty = cy - MARK_CY * scale
    glow = (
        f'<filter id="sh{uid}" x="-30%" y="-30%" width="160%" height="160%">'
        + (
            '<feDropShadow dx="0" dy="10" stdDeviation="22" flood-color="#E2B866" flood-opacity="0.38"/>'
            if kind == "dark"
            else '<feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#3B2A10" flood-opacity="0.28"/>'
        )
        + "</filter>"
    )
    return f"""
  <defs>
    <linearGradient id="g{uid}" x1="0" y1="0" x2="0.35" y2="1">{stops(kind)}</linearGradient>
    <linearGradient id="hl{uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.5"/>
      <stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <mask id="mk{uid}">
      <path d="{M_PATH}" fill="none" stroke="#fff" stroke-width="98" stroke-linecap="round" stroke-linejoin="round"/>
    </mask>
    {glow}
  </defs>
  <g transform="translate({tx:.1f} {ty:.1f}) scale({scale})">
    <g {'filter="url(#sh' + uid + ')"' if shadow else ''}>
      <path d="{M_PATH}" fill="none" stroke="url(#g{uid})" stroke-width="98" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="{SPARKLE}" fill="url(#g{uid})"/>
      <path d="{SMALL_SPARK}" fill="url(#g{uid})" opacity="0.85"/>
    </g>
    <!-- A polished edge: a soft light along the top of the strokes. -->
    <g mask="url(#mk{uid})">
      <path d="{M_PATH}" transform="translate(-9 -12)" fill="none" stroke="url(#hl{uid})" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </g>"""


def background(kind, uid, size=1024, radius=0):
    if kind == "dark":
        grad = '<stop offset="0" stop-color="#1D2948"/><stop offset="0.55" stop-color="#0B1122"/><stop offset="1" stop-color="#04060C"/>'
        ring = "#D4AF6A"
    else:
        grad = '<stop offset="0" stop-color="#FFFFFF"/><stop offset="0.55" stop-color="#F8F1E3"/><stop offset="1" stop-color="#EADCC2"/>'
        ring = "#B48B45"
    s = size
    return f"""
  <defs>
    <radialGradient id="bg{uid}" cx="50%" cy="32%" r="78%">{grad}</radialGradient>
    <radialGradient id="halo{uid}" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="{ring}" stop-opacity="{0.16 if kind == 'dark' else 0.10}"/>
      <stop offset="1" stop-color="{ring}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="{s}" height="{s}" rx="{radius}" fill="url(#bg{uid})"/>
  <circle cx="{s / 2}" cy="{s / 2}" r="{s * 0.42}" fill="url(#halo{uid})"/>"""


def svg(size_w, size_h, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{size_w}" height="{size_h}" viewBox="0 0 {size_w} {size_h}">{body}</svg>'


def font_face():
    path = os.path.join(FONTS, "CormorantGaramond-SemiBoldItalic.ttf")
    return f"@font-face {{ font-family: 'Cormorant'; src: url('file://{path}'); }}"


def wordmark(kind, uid, x, y, size):
    if kind == "dark":
        fill = f"url(#wg{uid})"
        defs = f'<defs><linearGradient id="wg{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF6DD"/><stop offset="1" stop-color="#E8D3A6"/></linearGradient></defs>'
    else:
        fill = "#0B1122"
        defs = ""
    return f'{defs}<text x="{x}" y="{y}" font-family="Cormorant" font-size="{size}" font-style="italic" fill="{fill}" letter-spacing="2">Memo</text>'


def render(name, svg_text, w, h, transparent=True):
    with open(os.path.join(OUT, "svg", name + ".svg"), "w") as f:
        f.write(svg_text)
    html = f"""<!doctype html><html><head><meta charset="utf-8"><style>{font_face()}
      html,body{{margin:0;padding:0;background:transparent}} svg{{display:block}}</style></head>
      <body>{svg_text}</body></html>"""
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, dir=os.path.dirname(__file__)) as f:
        f.write(html)
        page = f.name
    png = os.path.join(OUT, name + ".png")
    subprocess.run(
        [
            "google-chrome", "--headless=new", "--disable-gpu", "--hide-scrollbars",
            "--force-device-scale-factor=1", f"--window-size={w},{h}",
            "--default-background-color=00000000" if transparent else "--default-background-color=ffffffff",
            "--virtual-time-budget=1500", f"--screenshot={png}", f"file://{page}",
        ],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60,
    )
    os.unlink(page)
    return png


os.makedirs(os.path.join(OUT, "svg"), exist_ok=True)

for kind in ("dark", "light"):
    # App icon, full square (stores and iOS round the corners themselves).
    render(f"app-icon-{kind}-1024", svg(1024, 1024, background(kind, "b" + kind) + mark(kind, "m" + kind, 0.88)), 1024, 1024)
    # The same with rounded corners, to preview or share.
    render(f"app-icon-{kind}-rounded-1024", svg(1024, 1024, background(kind, "r" + kind, radius=230) + mark(kind, "q" + kind, 0.88)), 1024, 1024)
    # The mark alone, transparent.
    render(f"mark-{kind}", svg(1024, 1024, mark(kind, "k" + kind, 0.92)), 1024, 1024)
    # Horizontal logo: mark and "Memo", transparent.
    render(
        f"logo-{kind}",
        svg(1600, 560, mark(kind, "l" + kind, 0.5, cx=300, cy=280) + wordmark(kind, "w" + kind, 560, 380, 300)),
        1600, 560,
    )
    # Stacked logo (mark over "Memo"), transparent: splash and sign-in screens.
    render(
        f"logo-stacked-{kind}",
        svg(1024, 1100, mark(kind, "s" + kind, 0.72, cx=512, cy=430) + wordmark(kind, "t" + kind, 280, 1010, 270)),
        1024, 1100,
    )
    # Logo previews on their own background.
    bg = background(kind, "p" + kind, size=1600)
    render(
        f"logo-on-{kind}-background",
        svg(1600, 560, bg.replace('height="1600"', 'height="560"') + mark(kind, "o" + kind, 0.5, cx=300, cy=280) + wordmark(kind, "v" + kind, 560, 380, 300)),
        1600, 560,
    )

# Android adaptive icon layers (108dp, 4x = 432 px): the mark inside the 66dp safe zone.
render("android-foreground-432", svg(432, 432, mark("dark", "af", 0.33, cx=216, cy=216)), 432, 432)
render("android-background-432", svg(432, 432, background("dark", "ab", size=432)), 432, 432)
mono = mark("dark", "am", 0.33, cx=216, cy=216, shadow=False).replace('stroke="url(#gam)"', 'stroke="#000"').replace('fill="url(#gam)"', 'fill="#000"')
render("android-monochrome-432", svg(432, 432, mono), 432, 432)
print("done")
