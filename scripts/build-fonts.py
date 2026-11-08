#!/usr/bin/env python3
"""Build the self-hosted web fonts for the site.

Why: Google Fonts is unreliable in mainland China, so every font is served
from /assets/fonts. The Chinese serif (Noto Serif SC) is subset to exactly
the characters that appear in index.html and main.js, which keeps it small.

Re-run this whenever Chinese copy in index.html or main.js changes.
The member app and the back office get their own subset (noto-serif-sc-600-app.woff2),
built from app/, admin/ and shared/ (copy, floor plan, demo data):
    python3 scripts/build-fonts.py --app /tmp/sv-fonts


    pip install fonttools brotli
    mkdir -p /tmp/sv-fonts && cd /tmp/sv-fonts
    npm pack @fontsource/noto-serif-sc @fontsource-variable/source-serif-4 @fontsource-variable/jost @fontsource/ibm-plex-mono
    for f in *.tgz; do mkdir -p "${f%.tgz}" && tar -xzf "$f" -C "${f%.tgz}"; done
    cd -  # back to the repo
    python3 scripts/build-fonts.py /tmp/sv-fonts
"""
import glob
import os
import re
import shutil
import sys
import tempfile

from fontTools import subset
from fontTools.merge import Merger
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "fonts")
SOURCES = [os.path.join(ROOT, "index.html"), os.path.join(ROOT, "assets", "js", "main.js")]
APP_SOURCES = [os.path.join(ROOT, p) for p in ("app/index.html", "app/app.js", "admin/index.html", "admin/admin.js", "shared/ui.js", "shared/core.js", "shared/plan.js")]
# shared/core.js includes the demo data too (names, programme, content): names and titles are set in the serif
CUT = {}

CJK = re.compile(r"[　-〿㐀-䶿一-鿿＀-￯]")
LATIN_UNICODES = (
    "U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,"
    "U+2013-2014,U+2018-201A,U+201C-201E,U+2022,U+2026,U+2039-203A,U+2122,U+2190-2193"
)


def pkg_dir(src, name):
    hits = glob.glob(os.path.join(src, f"fontsource-{name}-*", "package", "files"))
    if not hits:
        sys.exit(f"missing package {name} in {src}")
    return hits[0]


def collect_cjk(sources=SOURCES):
    chars = set()
    for path in sources:
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
        if path in CUT:
            text = text.split(CUT[path])[0]
        chars.update(CJK.findall(text))
    # punctuation that copy edits are likely to introduce
    chars.update("，。、：；！？「」『』（）《》——…·")
    return "".join(sorted(chars))


def subset_options(keep_variations=True):
    opts = subset.Options()
    opts.flavor = None
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    opts.hinting = False
    opts.desubroutinize = True
    return opts


def build_noto_serif_sc(src, weight, text, name=None):
    files = pkg_dir(src, "noto-serif-sc")
    slices = sorted(glob.glob(os.path.join(files, f"noto-serif-sc-*-{weight}-normal.woff2")))
    wanted = {ord(c) for c in text}
    tmp = tempfile.mkdtemp()
    parts = []
    for path in slices:
        font = TTFont(path)
        cmap = font.getBestCmap()
        hit = wanted & set(cmap)
        if not hit:
            continue
        sub = subset.Subsetter(options=subset_options())
        sub.populate(unicodes=hit)
        sub.subset(font)
        font.flavor = None
        part = os.path.join(tmp, f"part-{len(parts)}.ttf")
        font.save(part)
        parts.append(part)
        wanted -= hit
    if wanted:
        print("  warning: not found in Noto Serif SC:", "".join(chr(c) for c in sorted(wanted)))
    merged = Merger().merge(parts)
    merged.flavor = "woff2"
    out = os.path.join(OUT, name or f"noto-serif-sc-{weight}-subset.woff2")
    merged.save(out)
    shutil.rmtree(tmp)
    return out


def build_latin_serif(src, style):
    files = pkg_dir(src, "variable-source-serif-4")
    path = os.path.join(files, f"source-serif-4-latin-opsz-{style}.woff2")
    font = TTFont(path)
    opts = subset_options()
    opts.flavor = "woff2"
    sub = subset.Subsetter(options=opts)
    sub.populate(unicodes=subset.parse_unicodes(LATIN_UNICODES))
    sub.subset(font)
    font.flavor = "woff2"
    suffix = "" if style == "normal" else "-italic"
    out = os.path.join(OUT, f"source-serif-4-latin-var{suffix}.woff2")
    font.save(out)
    return out


def build_jost(src):
    files = pkg_dir(src, "variable-jost")
    font = TTFont(os.path.join(files, "jost-latin-wght-normal.woff2"))
    opts = subset_options()
    opts.flavor = "woff2"
    sub = subset.Subsetter(options=opts)
    sub.populate(unicodes=subset.parse_unicodes(LATIN_UNICODES))
    sub.subset(font)
    font.flavor = "woff2"
    out = os.path.join(OUT, "jost-latin-var.woff2")
    font.save(out)
    return out


def copy_mono(src, weight):
    files = pkg_dir(src, "ibm-plex-mono")
    out = os.path.join(OUT, f"ibm-plex-mono-latin-{weight}.woff2")
    shutil.copyfile(os.path.join(files, f"ibm-plex-mono-latin-{weight}-normal.woff2"), out)
    return out


def main():
    args = [a for a in sys.argv[1:] if a != "--app"]
    if len(args) != 1:
        sys.exit(__doc__)
    src = args[0]
    if "--app" in sys.argv:
        text = collect_cjk(APP_SOURCES)
        print(f"CJK characters in the app and back office: {len(text)}")
        out = build_noto_serif_sc(src, 600, text, "noto-serif-sc-600-app.woff2")
        print(f"  {os.path.relpath(out, ROOT)}  {os.path.getsize(out) / 1024:.1f} KB")
        return
    os.makedirs(OUT, exist_ok=True)
    text = collect_cjk()
    print(f"CJK characters on the page: {len(text)}")
    outs = [
        build_noto_serif_sc(src, 600, text),
        build_latin_serif(src, "normal"),
        build_latin_serif(src, "italic"),
        build_jost(src),
        copy_mono(src, 400),
        copy_mono(src, 500),
    ]
    for out in outs:
        print(f"  {os.path.relpath(out, ROOT)}  {os.path.getsize(out) / 1024:.1f} KB")


if __name__ == "__main__":
    main()
