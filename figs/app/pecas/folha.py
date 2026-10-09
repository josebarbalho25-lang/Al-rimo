# Folha-catálogo das peças (as duas famílias lado a lado, como a foto do catálogo do Revit que o Jose mandou):
#
#   python folha.py <pasta>      → <pasta>/folha_pecas.svg e, com o Chrome instalado, <pasta>/folha_pecas.png
#
# Não vai para o app: é a folha para mostrar ao Jose e conferir as peças juntas, na mesma escala. Cada peça entra
# como a figura de pecas.py (mesmo desenho do quantitativo), recortada no desenho com as cotas.
import os
import subprocess
import sys

sys.dont_write_bytecode = True
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import pecas  # noqa: E402
from applib import C, FONT, T_TIT, T_TXT  # noqa: E402

CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
GRUPOS = [('bloco 14', '14x39', [['inteiro', 'meio', 'bloco34', 'bloco54'], ['canaleta', 'meia_canaleta', 'canaleta_cortada']]),
          ('bloco 19', '19x39', [['inteiro', 'meio'], ['canaleta', 'meia_canaleta', 'canaleta_cortada']])]
VAO = 46          # entre peças
MARGEM = 40


def dims(fam, arq):
    L, Lmax, t, h = pecas.medidas(fam, arq)
    comp = 'ℓ' if arq == 'canaleta_cortada' else pecas.cm(L)
    return f'{pecas.cm(t)}x{pecas.cm(h)}x{comp}'


def texto(x, y, t, size, weight='normal', cor=C['line']):
    return (f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" text-anchor="middle" fill="{cor}" font-weight="{weight}" '
            f'style="{FONT}">{t}</text>')


def celula(fam, arq):
    """(largura, altura, função que desenha em (x, y))."""
    fig = pecas.desenhar(fam, arq)
    x0, y0, x1, y1 = fig.caixa
    f = 10
    x0, y0, w, h = x0 - f, y0 - f, x1 - x0 + 2 * f, y1 - y0 + 2 * f
    rot = 2 * T_TIT + 18

    def por(x, y):
        corpo = (f'<svg x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" viewBox="{x0:.1f} {y0:.1f} {w:.1f} {h:.1f}" '
                 f'overflow="visible"><defs>{"".join(fig.defs)}</defs>{"".join(fig.el)}</svg>')
        corpo += texto(x + w / 2, y + h + T_TIT + 6, pecas.NOME_CURTO[arq], T_TIT, 'bold')
        corpo += texto(x + w / 2, y + h + 2 * T_TIT + 10, dims(fam, arq), T_TXT, cor=C['note'])
        return corpo
    return w, h + rot, por


def folha():
    partes, y, larg = [], MARGEM, 0.0
    for titulo, fam, linhas in GRUPOS:
        partes.append(f'<text x="{MARGEM}" y="{y + T_TIT * 1.3:.1f}" font-size="{T_TIT * 1.4:.0f}" font-weight="bold" '
                      f'fill="{C["line"]}" style="{FONT}">{titulo}</text>')
        y += T_TIT * 1.3 + 30
        for linha in linhas:
            cels = [celula(fam, a) for a in linha]
            alt = max(c[1] for c in cels)
            x = MARGEM
            for w, h, por in cels:
                partes.append(por(x, y + (alt - h)))       # peças alinhadas pela base do rótulo
                x += w + VAO
            larg = max(larg, x - VAO + MARGEM)
            y += alt + 34
        y += 30
    W, H = larg, y + MARGEM - 64
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W:.0f}" height="{H:.0f}" viewBox="0 0 {W:.0f} {H:.0f}">'
            f'<rect width="{W:.0f}" height="{H:.0f}" fill="#ffffff"/>' + ''.join(partes) + '</svg>'), W, H


def main(pasta):
    os.makedirs(pasta, exist_ok=True)
    svg, W, H = folha()
    caminho = os.path.join(pasta, 'folha_pecas.svg')
    open(caminho, 'w', encoding='utf8', newline='\n').write(svg)
    print(caminho)
    if os.path.exists(CHROME):
        png = os.path.join(pasta, 'folha_pecas.png')
        subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
                        '--no-first-run', '--no-default-browser-check', '--user-data-dir=' + os.path.join(pasta, '_perfil'),
                        f'--window-size={int(W) + 1},{int(H) + 1}', f'--screenshot={png}',
                        'file:///' + caminho.replace(os.sep, '/')], capture_output=True, timeout=90)
        print(png)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit('uso: python folha.py <pasta de saída>')
    main(sys.argv[1])
