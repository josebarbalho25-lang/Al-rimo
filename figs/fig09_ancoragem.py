from figlib import SVG, C
W, H = 1180, 600
s = SVG(W, H)
s.text(30, 34, 'Fig. 9 — Ancoragem da espera na fundação', size=18, anchor='start', weight='bold')
s.text(30, 56, 'Corte vertical na base do muro. A espera fica no furo grauteado e já do lado do solo (ver Fig. 4).', size=13, anchor='start', color=C['note'])
xw, yb = 420, 300           # face externa do muro / topo da fundação
t = 76                      # 19 cm × 4 px
s.rect(xw - 220, yb, t + 440, 200, fill='url(#conc)', stroke=C['line'], sw=1.4)
s.text(xw - 120, yb + 185, 'fundação', size=12, color=C['note'])
s.rect(xw, yb - 200, t, 200, fill=C['blockfill'], stroke=C['line'], sw=1.4)
s.rect(xw + 14, yb - 200, t - 28, 200, fill=C['groutfill'], stroke=C['grout'], sw=1)
s.text(xw + t / 2, yb - 210, 'furo grauteado', size=11, color=C['grout'])
s.text(xw + t + 120, yb - 60, 'SOLO →', size=13, color=C['soil'], weight='bold')
xe = xw + t - 20           # espera do lado do solo
lb = 150
# espera com gancho
s.pline([(xe, yb - 160), (xe, yb + lb), (xe + 70, yb + lb)], stroke=C['steel'], sw=3.2)
# barra do muro (traspasse)
s.line(xe - 7, yb - 200, xe - 7, yb - 40, stroke='#ff6f6f', sw=3.2)
s.dim_v(xe + 40, yb - 160, yb - 40, 'traspasse', side=1, size=11)
s.dim_v(xw - 40, yb, yb + lb, 'lb (comprimento de ancoragem)', side=-1, ext_from=(xe, xe), size=12)
s.text(xe + 80, yb + lb + 5, 'gancho', size=12, anchor='start', color=C['steel'])
s.line(xw - 220, yb, xw + t + 220, yb, stroke=C['line'], sw=1.4)
# quadro de fórmulas
bx, by = 720, 110
s.rect(bx, by, 430, 300, fill='#f7f7f7', stroke='#bfbfbf', sw=1)
lines = [('Na planilha (aba Muro em balanço):', True), ('lb da tabela: Ø, concreto e zona (NBR 6118, 9.4.2)', False),
         ('com gancho: 0,7·lb', False), ('lb,nec = lb · As,calc / As,ef', False), ('lb,mín = máx(0,3·lb ; 10Ø ; 10 cm)  (NBR 6118)', False),
         ('ancoragem = máx(lb,nec ; lb,mín)', True), ('', False), ('Campos das Entradas:', True), ('"Concreto da fundação" (C20 / C25 / C30)', False),
         ('"Zona de aderência" (barra vertical: boa)', False), ('"Gancho na ponta da espera?"', False), ('', False), ('O traspasse espera × barra do muro não é', False), ('calculado nesta planilha: detalhar no projeto.', False)]
for i, (l, b) in enumerate(lines):
    s.text(bx + 16, by + 26 + i * 19, l, size=13, anchor='start', weight='bold' if b else 'normal', color=C['note'] if l.startswith('O traspasse') or l.startswith('calculado') else C['line'])
s.line(30, 560, 50, 560, stroke=C['steel'], sw=3.2); s.text(56, 564, 'espera (ancorada na fundação)', size=12, anchor='start')
s.line(300, 560, 320, 560, stroke='#ff6f6f', sw=3.2); s.text(326, 564, 'barra vertical do muro', size=12, anchor='start')
s.save('fig09_ancoragem.svg'); print('ok')
