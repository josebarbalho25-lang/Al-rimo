from figlib import SVG, C
W, H = 1180, 620
s = SVG(W, H)
s.text(30, 34, 'Fig. 5 — Elevação do muro: barras verticais, canaletas e painel não armado', size=18, anchor='start', weight='bold')
s.text(30, 56, 'Vista da face externa. Fiadas de 20 cm, blocos em amarração. Exemplo: barras a cada 40 cm e canaletas a cada 80 cm.', size=13, anchor='start', color=C['note'])
K = 1.8
x0, yb = 150, 530
Lw, Hw = 280, 200
yt = yb - Hw * K
can_courses = (3, 7, 9)            # fiadas (0 = primeira) que são canaleta: topo a 80, 160 e 200 cm
for i in range(10):
    y = yb - (i + 1) * 20 * K
    off = 0 if i % 2 == 0 else 20
    xs = -off
    while xs < Lw:
        a = max(xs, 0); b = min(xs + 39, Lw)
        if b > a:
            is_can = i in can_courses
            s.rect(x0 + a * K, y, (b - a) * K, 19 * K, fill=C['groutfill'] if is_can else C['blockfill'], stroke=C['grout'] if is_can else C['block'], sw=0.8)
        xs += 40
bars = [10 + 40 * k for k in range(7)]
for xb in bars:
    s.rect(x0 + (xb - 6) * K, yt, 12 * K, Hw * K, fill=C['groutfill'], stroke='none', extra='fill-opacity="0.6"')
    s.line(x0 + xb * K, yt + 4, x0 + xb * K, yb + 26, stroke=C['steel'], sw=2.2)
s.rect(x0 - 20, yb, Lw * K + 40, 36, fill='url(#conc)', stroke=C['line'], sw=1.2)
s.text(x0 + Lw * K / 2, yb + 24, 'fundação', size=11, color=C['note'])
# painel de baixo: entre as barras 50 e 90, da fundação até o centro da 1ª canaleta (70)
pa, pb, ph = 10, 50, 70
s.rect(x0 + pa * K, yb - ph * K, (pb - pa) * K, ph * K, fill='#f8cbad', stroke=C['load'], sw=2.4, extra='fill-opacity="0.55"')
s.text(x0 + (pa + pb) / 2 * K, yb - ph / 2 * K - 4, 'painel', size=12, weight='bold', color=C['load'])
s.text(x0 + (pa + pb) / 2 * K, yb - ph / 2 * K + 11, 'não armado', size=12, weight='bold', color=C['load'])
# cotas
s.dim_h(x0 + 50 * K, x0 + 90 * K, yt - 16, 'l = "Espaçamento das barras"', ext_from=(yt, yt), size=12)
s.dim_v(x0 - 34, yb - 150 * K, yb - 70 * K, 'h = "Esp. canaletas"', side=-1, ext_from=(x0, x0), size=11)
s.dim_v(x0 - 74, yt, yb, '"Altura do arrimo"', side=-1, ext_from=(x0, x0), size=12)
# chamadas à direita
xr = x0 + Lw * K + 14
for ytop, lab in ((200, 'cinta do topo (canaleta)'), (160, 'canaleta + barra horizontal'), (80, 'canaleta + barra horizontal')):
    yy = yb - (ytop - 10) * K
    s.line(x0 + Lw * K, yy, xr + 6, yy, stroke=C['grout'], sw=1)
    s.text(xr + 10, yy + 4, lab, size=12, anchor='start', color=C['grout'])
notes = ['Painel entre duas barras e duas canaletas:', 'verificado como alvenaria não armada', '(aba Painel não armado, caso 13).', '',
         'O painel de baixo é o pior caso: recebe', 'a maior pressão (média do trapézio', 'de empuxo no trecho).', '',
         'Com barra a cada 20 cm não há painel:', 'todos os furos levam barra.']
for i, l in enumerate(notes):
    s.text(880, yt + 70 + i * 17, l, size=12, anchor='start')
s.rect(x0, 588, 16, 10, fill=C['groutfill'], stroke=C['grout']); s.text(x0 + 22, 597, 'graute (furos com barra e canaletas)', size=11, anchor='start')
s.line(x0 + 280, 593, x0 + 300, 593, stroke=C['steel'], sw=2.2); s.text(x0 + 306, 597, 'barra vertical', size=11, anchor='start')
s.save('fig05_elevacao.svg'); print('ok')
