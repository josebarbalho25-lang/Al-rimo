# Fig. 23 (app, nova) — resistências de referência do bloco de concreto: fbk → fpk, fpk* e fgk, a tabela da
# aba Referências (ABCP, tab. 3.2). Transposta (fbk nas colunas) para ficar deitada no modal. Os números são
# lidos das células da planilha. DEDUÇÃO de escopo: tabela como "imagem de referência" — decisão do Jose.
from applib import Fig, C, T_TXT
from tabelas import cel

R = 'Referências!'


def desenhar():
    s = Fig(23, 1000, 300)
    rows = list(range(5, 17))
    x0, y0 = 40, 40
    w0, wc, alt = 96, 64, 36
    W = w0 + wc * len(rows)
    s.text(x0, y0, 'Bloco de concreto (MPa) · ABCP, tab. 3.2', size=T_TXT + 2, anchor='start', weight='bold')
    yt = y0 + 14
    linhas = [('f_{bk}', 'H', ['fbk_']), ('f_{pk}', 'I', None), ('f_{pk}*', 'J', None), ('f_{gk}', 'K', ['fgk_dir'])]
    for i, (rot, col, campos) in enumerate(linhas):
        yy = yt + alt * (i + 1) - 11
        if campos:
            s.add(f'<g data-campo="{" ".join(campos)}">')
            s._campos.extend(campos)
        s.text(x0 + 10, yy, rot, size=T_TXT, anchor='start', weight='bold')
        for k, r in enumerate(rows):
            s.text(x0 + w0 + wc * (k + 0.5), yy, cel(f'{R}{col}{r}'), size=T_TXT, weight='bold' if i == 0 else 'normal')
        if campos:
            s.add('</g>')
    s.line(x0, yt, x0 + W, yt, stroke=C['line'], sw=1.4)
    s.line(x0, yt + alt, x0 + W, yt + alt, stroke=C['line'], sw=1)
    for i in (2, 3):
        s.line(x0, yt + alt * i, x0 + W, yt + alt * i, stroke=C['cinza2'], sw=0.7)
    s.line(x0, yt + alt * 4, x0 + W, yt + alt * 4, stroke=C['line'], sw=1.4)
    s.line(x0 + w0 - 6, yt, x0 + w0 - 6, yt + alt * 4, stroke=C['cinza2'], sw=0.7)
    return s
