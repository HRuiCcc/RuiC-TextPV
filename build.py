"""把 src/ 下的引擎、app/ 下的界面、vendor/ 里的第三方库
打包成一个可以单独运行的 index.html。

用法：
    python3 build.py          -> index.html
    python3 build.py --dev    -> 另外生成 dev/www/ruic.js 便于调试
"""
import glob, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)

read = lambda p: open(p, encoding='utf-8').read()

sources = sorted(glob.glob('src/*.js'))
js = '\n'.join(read(f) for f in sources)
mux = ('/*! mp4-muxer v5.2.2 | MIT License | (c) 2023 Vanilagy | '
       '见 vendor/THIRD_PARTY_NOTICES.md */\n') + read('vendor/mp4-muxer.min.js')

title = 'RuiC-TextPV — 歌词文字 PV 自动成片'
description = '填进歌词，自动排出文字 PV 的分镜、排版与动效，并在浏览器里直接导出 MP4。'
canonical = 'https://hruiccc.github.io/RuiC-TextPV/'

html = f'''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{description}">
<meta property="og:type" content="website">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta name="twitter:card" content="summary">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<style>
{read('app/theme.css')}
</style>
</head>
<body>
{read('app/shell.html')}
<script>
{mux}
</script>
<script>
{js}
</script>
</body>
</html>
'''

open('index.html', 'w', encoding='utf-8').write(html)
print('index.html', len(html), 'bytes')

if '--dev' in sys.argv:
    os.makedirs('dev/www', exist_ok=True)
    open('dev/www/ruic.js', 'w', encoding='utf-8').write(js)
    open('dev/www/shell.html', 'w', encoding='utf-8').write(read('app/shell.html'))
    print('dev/www ready: cd dev/www && python3 -m http.server 8766')
