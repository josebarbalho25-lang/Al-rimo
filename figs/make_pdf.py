import asyncio, re, sys
sys.path.insert(0, '../tools')
FIGS = [(1,'fig01_geral','Muro de arrimo em balanço: visão geral e entradas'),(2,'fig02_bloco','Blocos de concreto: dimensões usadas na planilha'),
 (3,'fig03_secao','Seção / grauteamento: seção I ou seção cheia'),(4,'fig04_barra','POSIÇÃO DA BARRA: encostada do lado do solo — não centralizar'),
 (5,'fig05_elevacao','Elevação: barras verticais, canaletas e painel não armado'),(6,'fig06_casos','Casos de vinculação do painel não armado'),
 (7,'fig07_he','Altura efetiva (he) e esbeltez'),(8,'fig08_tracao','Tração na flexão: direção em relação à fiada'),
 (9,'fig09_ancoragem','Ancoragem da espera na fundação'),(10,'fig10_els','ELS do balanço: fissuração e flecha'),(11,'fig11_pressoes','Pressões: sem coesão, com coesão e com água'),
 (12,'fig12_contraforte','Contraforte em planta: enterrado (seção T) ou aparente (retangular)'),(13,'fig13_painel','Painel entre contrafortes: vinculação, cargas, armaduras e charneiras'),
 (14,'fig14_barras_painel','PAINEL: uma barra vertical em CADA face; horizontal centralizada'),
 (15,'fig15_sapata','Sapata corrida: posição, forças, tombamento e deslizamento')]
CAMPOS = {1:'Altura do muro, Altura de solo contido, Tipo de muro, Tipo de solo, NSPT, γ, φ\', Ka direto, Sobrecarga (q)',2:'Espessura do bloco (t), Área de referência do fpk',
 3:'Seção / grauteamento (B8), Largura da alma da seção I',4:'d (altura útil)',5:'Ø armadura vertical, Espaçamento das barras, Espaçamento das canaletas',
 6:'Caso de vinculação do painel, βf manual',7:'Travamento lateral, αv, αh, l, Somar M2d',8:'Argamassa',9:'Concreto da fundação, Zona de aderência, Gancho',
 10:'Ma/Mk, Limite de deslocamento, Vão de referência do balanço, Δξ, Somar σsg',11:"c' adotada, Considerar água?, Profundidade do NA, γw",
 12:'Espaçamento entre contrafortes, Comprimento (tenr), Posição do contraforte, Contraforte calculado, Balanço, Ø/nº de barras, Cobrimento, K, construtivas, estribo',
 13:'Bordas laterais do painel, Ø e espaçamento vertical/horizontal, K vertical/horizontal, almas da seção I no ELS',
 14:'Posição das barras verticais, Cobrimento ao eixo das barras do painel, Posição da barra horizontal',
 15:'Largura e altura da sapata, Distância da borda aterrada ao eixo, Dente, Carga no topo, Sobrecarga estabiliza?, φ e δ da base, Adesão, Passivo, SPT, σadm, FS mínimos'}
css = """@page{size:A4 landscape;margin:12mm} body{font-family:Arial,'DejaVu Sans',sans-serif;color:#262626;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.pg{page-break-after:always;display:flex;flex-direction:column;align-items:center;justify-content:center;height:180mm}
.pg svg{max-width:270mm;max-height:170mm;width:auto;height:auto} h1{font-size:22pt;margin:0 0 4mm} .sub{color:#595959;font-size:11pt;margin-bottom:8mm}
table{border-collapse:collapse;width:100%;font-size:11pt} td,th{border-bottom:1px solid #d9d9d9;padding:2.2mm 3mm;text-align:left;vertical-align:top} th{background:#1F3864;color:#fff}
.idx{page-break-after:always} .warn{color:#c00000;font-weight:bold}"""
rows = ''.join(f'<tr><td><b>Fig. {n}</b></td><td class="{"warn" if n in (4,14) else ""}">{t}</td><td>{CAMPOS[n]}</td></tr>' for n, f, t in FIGS)
html = [f'<html><head><meta charset="utf-8"><style>{css}</style></head><body>',
        f'<div class="idx"><h1>Muro de arrimo em alvenaria estrutural — Índice de ilustrações</h1><div class="sub">Planilha "Arrimo Alvenaria — base Carini". Cada campo da aba Entradas aponta para a figura correspondente (coluna Figura).</div>',
        f'<table><tr><th>Figura</th><th>Título</th><th>Campos das Entradas</th></tr>{rows}</table></div>']
for n, f, t in FIGS:
    svg = open(f + '.svg', encoding='utf8').read()
    w = re.search(r'width="(\d+)"', svg).group(1); h = re.search(r'height="(\d+)"', svg).group(1)
    svg = svg.replace(f'width="{w}" height="{h}"', f'width="100%" height="100%" preserveAspectRatio="xMidYMid meet"', 1)
    html.append(f'<div class="pg"><div style="width:270mm;height:170mm">{svg}</div></div>')
html.append('</body></html>')
open('indice_ilustracoes.html', 'w', encoding='utf8').write(''.join(html))
# Playwright quando houver; senão o Chrome/Edge da máquina em modo headless (09/10: esta máquina não tem o
# Playwright — o @page do CSS já dá A4 deitado e o print-color-adjust leva os fundos para o PDF).
try:
    from playwright.async_api import async_playwright
except ImportError:
    async_playwright = None
if async_playwright:
    async def main():
        async with async_playwright() as p:
            b = await p.chromium.launch(); pg = await b.new_page()
            await pg.set_content(open('indice_ilustracoes.html', encoding='utf8').read())
            await pg.pdf(path='Indice de ilustracoes - Arrimo.pdf', format='A4', landscape=True, print_background=True)
            await b.close()
    asyncio.run(main()); print('pdf ok')
else:
    import os, subprocess, pathlib
    nav = next((c for c in (r'C:\Program Files\Google\Chrome\Application\chrome.exe',
                            r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe') if os.path.exists(c)), None)
    if not nav:
        raise SystemExit('sem Playwright e sem Chrome/Edge: o HTML ficou em indice_ilustracoes.html')
    saida = os.path.abspath('Indice de ilustracoes - Arrimo.pdf')
    subprocess.run([nav, '--headless=new', '--disable-gpu', '--no-pdf-header-footer', f'--print-to-pdf={saida}',
                    pathlib.Path(os.path.abspath('indice_ilustracoes.html')).as_uri()], check=True, capture_output=True)
    print('pdf ok (navegador)')
