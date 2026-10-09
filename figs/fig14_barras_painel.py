from figlib import SVG, C
S = 12.0
W, H = 1180, 640
s = SVG(W, H)
s.rect(0, 0, W, 64, fill='#c00000', stroke='none')
s.text(30, 30, 'Fig. 14 — PAINEL ENTRE CONTRAFORTES: UMA BARRA VERTICAL EM CADA FACE', size=19, anchor='start', weight='bold', color='#ffffff')
s.text(30, 52, 'O momento vertical troca de sinal: na base traciona o lado do solo, no vão traciona o lado de fora. As duas barras ficam a 5 cm das faces (d = 9 no bloco de 14).', size=13, anchor='start', color='#ffffff')
# planta do furo com 2 barras
t, hf = 14, 2.2
x0, y0 = 90, 170
Xp = lambda v: x0 + v * S; Yp = lambda v: y0 + v * S
s.text(Xp(15), y0 - 52, 'Planta (barras verticais)', size=16, weight='bold')
s.text(Xp(15), y0 - 14, '▲ SOLO', size=12, color=C['soil'], weight='bold')
s.rect(Xp(0), Yp(0), 30 * S, t * S, fill=C['blockfill'], stroke=C['block'], sw=1.4)
s.rect(Xp(4), Yp(hf), 13.6 * S, (t - 2 * hf) * S, fill=C['groutfill'], stroke=C['grout'], sw=1.2, extra='rx="5"')
s.rect(Xp(19.6), Yp(hf), 8 * S, (t - 2 * hf) * S, fill=C['hollow'], stroke=C['block'], sw=1.0, extra='rx="5"')
for yy in (5, t - 5):
    s.circle(Xp(10.8), Yp(yy), 0.5 * S + 1.5)
s.dim_v(Xp(0) - 24, Yp(0), Yp(5), '5', side=-1, ext_from=(Xp(10.8), Xp(0)), size=12)
s.dim_v(Xp(0) - 24, Yp(t - 5), Yp(t), '5', side=-1, ext_from=(Xp(10.8), Xp(0)), size=12)
s.dim_v(Xp(30) + 24, Yp(5), Yp(t), 'd = 9', side=1, ext_from=(Xp(10.8), Xp(30)), size=12)
s.text(Xp(15), Yp(t) + 24, '▼ face externa', size=12, color=C['note'])
s.text(Xp(10.8), Yp(t) + 52, 'barra do lado do solo → momento da base (Mdyei)', size=12, color=C['steel'])
s.text(Xp(10.8), Yp(t) + 70, 'barra do lado de fora → momento do vão (Mdy)', size=12, color=C['steel'])
# corte da canaleta com barra centralizada
S2 = 8.0
cx, cy = 660, 170
Xc = lambda v: cx + v * S2; Yc = lambda v: cy + v * S2
s.text(Xc(7) + 90, 118, 'Corte (barra horizontal na canaleta)', size=16, weight='bold')
s.poly([(Xc(0), Yc(0)), (Xc(hf), Yc(0)), (Xc(hf), Yc(17)), (Xc(t - hf), Yc(17)), (Xc(t - hf), Yc(0)), (Xc(t), Yc(0)), (Xc(t), Yc(19)), (Xc(0), Yc(19))],
       fill=C['blockfill'], stroke=C['block'], sw=1.4)
s.rect(Xc(hf), Yc(0), (t - 2 * hf) * S2, 17 * S2, fill=C['groutfill'], stroke=C['grout'], sw=1.0)
s.circle(Xc(t / 2), Yc(12), 0.625 * S2 + 1.5)
s.rect(Xc(0), Yc(19), t * S2, 10 * S2, fill=C['blockfill'], stroke=C['block'], sw=1.2)
s.dim_h(Xc(0), Xc(t / 2), Yc(0) - 8, '7', size=12)
s.dim_h(Xc(t / 2), Xc(t), Yc(0) - 8, '7', size=12)
s.text(Xc(t) + 18, Yc(12) + 4, 'Ø12,5 centralizada → d = t/2 = 7', size=13, anchor='start', color=C['steel'], weight='bold')
s.text(Xc(t) + 18, Yc(12) + 24, 'atende os dois sinais do momento horizontal', size=12, anchor='start', color=C['note'])
s.text(Xc(t) + 18, Yc(12) + 42, 'K = 0,5 (seção horizontal sem graute)', size=12, anchor='start', color=C['note'])
s.text(Xc(t) + 18, Yc(25), 'bloco da fiada de baixo (sem graute)', size=12, anchor='start', color=C['note'])
s.text(Xc(-2), Yc(10), 'SOLO', size=12, anchor='end', color=C['soil'], weight='bold')
s.text(Xc(t) + 18, Yc(3), 'face externa →', size=11, anchor='start', color=C['note'])
# notas
y = 470
s.text(40, y, 'Na obra', size=15, anchor='start', weight='bold')
notes = ['• Verticais: indicar em planta, corte e notas "uma barra em cada face, a 5 cm — não centralizar".', '   Com uma barra só no meio do furo, d cai de 9 para 7 e o As do momento da base sobe quase 40% (0,65 → 0,89 cm² na faixa de 45).',
         '• Horizontais: barra centralizada na canaleta (é o que a planilha considera por padrão). Encostada na face externa só se as laterais forem apoiadas (sem momento negativo no contraforte).',
         '• Estribos do contraforte (Ø ≤ 6,3) vão nas juntas de assentamento; a emenda do estribo fechado fica dentro do furo grauteado.']
for i, t_ in enumerate(notes):
    s.text(40, y + 26 + i * 24, t_, size=12.5, anchor='start')
s.text(40, 632, 'Campos das Entradas: Posição das barras verticais, Cobrimento ao eixo das barras do painel, Posição da barra horizontal.', size=11, anchor='start', color=C['note'])
s.save('fig14_barras_painel.svg'); print('ok')
