#!/usr/bin/env python3
"""รวม index.html + js/*.js เป็นไฟล์ HTML ไฟล์เดียว (ใช้เผยแพร่เป็น Artifact หรือส่งให้คนอื่นเปิดทันที)

วิธีใช้:  python3 build.py                 -> สร้าง dist/wanzer-single.html
          python3 build.py --fragment OUT  -> สร้างแบบไม่มี <html>/<head>/<body> (สำหรับ Artifact)
"""
import re
import sys
from pathlib import Path

root = Path(__file__).parent
html = (root / "index.html").read_text(encoding="utf-8")

scripts = re.findall(r'<script src="(js/[^"]+)"></script>', html)
bundle = "\n\n".join((root / s).read_text(encoding="utf-8") for s in scripts)
# ฝังภาพใน assets/ (png/jpg/webp/gif) เป็น data URI เพื่อให้ยังเป็นไฟล์เดียว: EMBEDDED_ASSETS["assets/xxx.png"] = "data:..."
import base64, json, mimetypes
assets = {}
adir = root / "assets"
if adir.is_dir():
    for f in sorted(adir.rglob("*")):
        if f.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp", ".gif", ".ogg", ".mp3", ".wav"):
            mime = mimetypes.guess_type(f.name)[0] or ("audio/ogg" if f.suffix.lower() == ".ogg" else "image/png")
            assets[f.relative_to(root).as_posix()] = "data:%s;base64,%s" % (mime, base64.b64encode(f.read_bytes()).decode())
if assets:
    bundle = "const EMBEDDED_ASSETS = " + json.dumps(assets) + ";\n\n" + bundle
inline = "<script>\n" + bundle + "\n</script>"

if len(sys.argv) >= 3 and sys.argv[1] == "--fragment":
    title = re.search(r"<title>.*?</title>", html, re.S).group(0)
    links = "\n".join(re.findall(r"<link [^>]*>", html))
    style = re.search(r"<style>.*?</style>", html, re.S).group(0)
    main = re.search(r"<main.*?</main>", html, re.S).group(0)
    out = Path(sys.argv[2])
    out.write_text("\n".join([title, links, style, main, inline]) + "\n", encoding="utf-8")
else:
    full = re.sub(r'(<script src="js/[^"]+"></script>\s*)+', lambda m: inline + "\n", html)
    out = root / "dist" / "wanzer-single.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(full, encoding="utf-8")

print("wrote", out, f"({out.stat().st_size // 1024} KB, {len(scripts)} scripts)")
