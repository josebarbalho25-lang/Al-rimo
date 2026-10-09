# Fig. 19 (app, nova) — bordas laterais do painel entre contrafortes: apoiadas (Libânio tipo 21) ×
# engastadas (tipo 22). Base engastada na sapata, topo livre nos dois. Convenção de desenho: hachura = engaste,
# linha grossa = apoio, tracejado = livre (a mesma da fig. 6). Com as laterais engastadas aparece o momento
# no contraforte (Mdxe).
from applib import Fig, C, T_TIT, T_TXT, T_PEQ


def engaste(s, x1, y1, x2, y2, lado):
    """Borda engastada: linha grossa + hachura curta do lado de fora."""
    s.line(x1, y1, x2, y2, stroke=C['line'], sw=4)
    n = int(max(abs(x2 - x1), abs(y2 - y1)) / 12)
    for k in range(n + 1):
        t = k / max(n, 1)
        x = x1 + (x2 - x1) * t
        y = y1 + (y2 - y1) * t
        dx, dy = {'baixo': (-8, 12), 'esq': (-12, 8), 'dir': (12, -8)}[lado]
        s.line(x, y, x + dx, y + dy, stroke=C['line'], sw=1.2)


def painel(s, x, y, w, h, engastadas):
    s.rect(x, y, w, h, fill=C['empuxo2'], stroke='none')
    engaste(s, x, y + h, x + w, y + h, 'baixo')
    s.line(x, y, x + w, y, stroke=C['line'], sw=2.6, extra='stroke-dasharray="10,7"')
    with s.campo('lat_pan'):
        if engastadas:
            engaste(s, x, y, x, y + h, 'esq')
            engaste(s, x + w, y + h, x + w, y, 'dir')
            s.text(x + 10, y + h / 2 - 20, 'M_{dxe}', size=T_TXT, anchor='start', color=C['steel'], weight='bold')
            s.text(x + w - 10, y + h / 2 - 20, 'M_{dxe}', size=T_TXT, anchor='end', color=C['steel'], weight='bold')
        else:
            s.line(x, y, x, y + h, stroke=C['line'], sw=5)
            s.line(x + w, y, x + w, y + h, stroke=C['line'], sw=5)
        s.text(x + w / 2, y - 50, 'Engastadas' if engastadas else 'Apoiadas', size=T_TIT, weight='bold')
    s.text(x + w / 2, y - 14, 'topo livre', size=T_PEQ, color=C['note'])
    s.text(x + w / 2, y + h + 44, 'sapata', size=T_PEQ, color=C['note'])
    s.text(x - 30, y + h / 2, 'contraforte', size=T_PEQ, color=C['note'], rot=-90)
    s.text(x + w + 44, y + h / 2, 'contraforte', size=T_PEQ, color=C['note'], rot=-90)


def desenhar():
    s = Fig(19, 1000, 460)
    painel(s, 110, 110, 300, 240, False)
    painel(s, 590, 110, 300, 240, True)
    ly = 470
    s.line(150, ly - 6, 210, ly - 6, stroke=C['line'], sw=5)
    s.text(222, ly, 'apoiada', size=T_PEQ + 1, anchor='start')
    engaste(s, 400, ly - 6, 460, ly - 6, 'baixo')
    s.text(472, ly, 'engastada', size=T_PEQ + 1, anchor='start')
    s.line(660, ly - 6, 720, ly - 6, stroke=C['line'], sw=2.6, extra='stroke-dasharray="10,7"')
    s.text(732, ly, 'livre', size=T_PEQ + 1, anchor='start')
    return s
