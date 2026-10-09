import sys, asyncio, os, re, subprocess, pathlib, tempfile
# SVG → PNG (2×). Playwright quando houver; senão o Chrome/Edge da máquina em modo headless (09/10: esta máquina não
# tem o Playwright). Mesmo resultado: página do tamanho do SVG, fator de escala 2, sem margem.
try:
    from playwright.async_api import async_playwright
except ImportError:
    async_playwright = None


async def main(paths):
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(device_scale_factor=2)
        for sp in paths:
            svg = open(sp, encoding='utf8').read()
            w = int(re.search(r'width="(\d+)"', svg).group(1)); h = int(re.search(r'height="(\d+)"', svg).group(1))
            await pg.set_viewport_size({'width': w, 'height': h})
            await pg.set_content(f'<html><body style="margin:0">{svg}</body></html>')
            await pg.screenshot(path=sp.replace('.svg', '.png'), clip={'x': 0, 'y': 0, 'width': w, 'height': h})
        await b.close()


def pelo_navegador(paths):
    nav = next((c for c in (r'C:\Program Files\Google\Chrome\Application\chrome.exe',
                            r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe') if os.path.exists(c)), None)
    if not nav:
        raise SystemExit('sem Playwright e sem Chrome/Edge para desenhar o PNG')
    tmp = tempfile.mkdtemp(prefix='render_')
    for sp in paths:
        svg = open(sp, encoding='utf8').read()
        w = int(re.search(r'width="(\d+)"', svg).group(1)); h = int(re.search(r'height="(\d+)"', svg).group(1))
        html = os.path.join(tmp, 'f.html')
        open(html, 'w', encoding='utf8').write(f'<html><body style="margin:0">{svg}</body></html>')
        subprocess.run([nav, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
                        f'--window-size={w},{h}', f'--screenshot={os.path.abspath(sp.replace(".svg", ".png"))}',
                        pathlib.Path(html).as_uri()], check=True, capture_output=True)


if async_playwright:
    asyncio.run(main(sys.argv[1:]))
else:
    pelo_navegador(sys.argv[1:])
