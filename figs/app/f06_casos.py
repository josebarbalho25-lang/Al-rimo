# Fig. 6 (app) — casos de vinculação do painel não armado (11, 13, 18). Acrescenta a pré-compressão no
# topo do caso 13 (entrada sig_pan, que não tinha figura).
from applib import Fig, C, T_TIT, T_TXT, T_PEQ


def painel(s, x, y, w, h, livres, titulo, rotulo, sigma=False):
    with s.campo('caso_pan'):
        s.rect(x, y, w, h, fill=C['empuxo2'], stroke='none')
        bordas = {'esq': (x, y, x, y + h), 'dir': (x + w, y, x + w, y + h), 'sup': (x, y, x + w, y), 'inf': (x, y + h, x + w, y + h)}
        for k, (a, b, c, d) in bordas.items():
            if k in livres:
                s.line(a, b, c, d, stroke=C['line'], sw=2.6, extra='stroke-dasharray="10,7"')
            else:
                s.line(a, b, c, d, stroke=C['line'], sw=5)
        s.text(x + w / 2, y - 62, titulo, size=T_TIT, weight='bold')
        s.text(x + w / 2, y + h + 34, rotulo, size=T_TXT, color=C['note'])
    s.dim_h(x, x + w, y - 18, 'ℓ')
    s.dim_v(x - 20, y, y + h, 'h', side=-1)
    if sigma:
        with s.campo('sig_pan'):
            for k in range(1, 6):
                xx = x + w * k / 6
                s.arrow(xx, y + 8, xx, y + 46, sw=1.6)
            s.text(x + w / 2, y + 74, 'σ', size=22, color=C['load'], weight='bold', halo=True)
    else:
        with s.campo('beta_dir'):
            s.text(x + w / 2, y + h / 2 + 8, 'β_{f}', size=22, color=C['note'])


def desenhar():
    s = Fig(6, 1000, 460)
    painel(s, 80, 120, 230, 210, ['dir'], 'Caso 11', 'lateral livre')
    painel(s, 410, 120, 230, 210, [], 'Caso 13', '4 bordas apoiadas', sigma=True)
    with s.campo('beta_dir'):
        s.text(525, 120 + 210 / 2 + 30, 'β_{f}', size=22, color=C['note'])
    painel(s, 740, 120, 230, 210, ['sup'], 'Caso 18', 'topo livre')
    # legenda
    ly = 420
    s.line(240, ly - 6, 300, ly - 6, stroke=C['line'], sw=5)
    s.text(312, ly, 'apoiada', size=T_PEQ + 2, anchor='start')
    s.line(520, ly - 6, 580, ly - 6, stroke=C['line'], sw=2.6, extra='stroke-dasharray="10,7"')
    s.text(592, ly, 'livre', size=T_PEQ + 2, anchor='start')
    return s
