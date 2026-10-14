from figlib import SVG, C
W, H = 1100, 470
s = SVG(W, H)
s.text(30, 34, 'Fig. 6 — Casos de vinculação do painel não armado', size=18, anchor='start', weight='bold')
s.text(30, 56, 'Linha cheia = borda apoiada (barra grauteada, canaleta, fundação ou contraforte). Tracejada = borda livre.', size=13, anchor='start', color=C['note'])
def pan(x, y, w, h, free, title, note):
    s.rect(x, y, w, h, fill='#fbe5d6', stroke='none')
    edges = {'esq': (x, y, x, y + h), 'dir': (x + w, y, x + w, y + h), 'sup': (x, y, x + w, y), 'inf': (x, y + h, x + w, y + h)}
    for k, (a, b, c, d) in edges.items():
        if k in free:
            s.line(a, b, c, d, stroke=C['line'], sw=2.5, extra='stroke-dasharray="10,7"')
        else:
            s.line(a, b, c, d, stroke=C['line'], sw=4)
    s.text(x + w / 2, y - 40, title, size=16, weight='bold')
    s.dim_h(x, x + w, y - 14, 'l', size=13)
    s.dim_v(x - 18, y, y + h, 'h', side=-1, size=13)
    for i, l in enumerate(note):
        s.text(x + w / 2, y + h + 34 + i * 17, l, size=12, color=C['note'])
pan(90, 150, 220, 200, ['dir'], 'Caso 11', ['lateral direita livre', '(ex.: extremidade do muro sem barra)'])
pan(430, 150, 220, 200, [], 'Caso 13', ['4 bordas apoiadas', 'painel entre barras e canaletas', '(muro em balanço armado)'])
pan(770, 150, 220, 200, ['sup'], 'Caso 18', ['topo livre', '(último painel sem cinta no topo)'])
s.text(30, 455, 'Campo das Entradas: "Caso de vinculação do painel". O βf sai da tabela do caso (NBR 16868-1, Anexo E), interpolado em h/l e μ.', size=11, anchor='start', color=C['note'])
s.save('fig06_casos.svg'); print('ok')
