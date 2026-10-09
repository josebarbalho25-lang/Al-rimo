from figlib import SVG, C
S = 150.0                     # px por metro
W, H = 1180, 770
s = SVG(W, H)
s.text(30, 34, 'Fig. 15 — Sapata corrida: posição, forças, tombamento e deslizamento', size=18, anchor='start', weight='bold')
s.text(30, 56, 'Corte perpendicular ao muro. x é medido a partir da borda aterrada. Roteiro da aba do Eng. Gilberto, adaptado.', size=13, anchor='start', color=C['note'])
# geometria (exemplo): B 1,4; a 0,95; t 0,19; h 0,30; H 1,6; dente 0,25 x 0,5
B, a, t, hs, Hm, bd, hd = 1.4, 0.95, 0.19, 0.30, 1.6, 0.25, 0.5
x0, yb = 360, 520                    # x0 = borda aterrada; yb = base da sapata
X = lambda v: x0 + v * S
Y = lambda v: yb - v * S
# solo contido (à esquerda do muro, sobre o talão e atrás)
s.rect(X(-0.9), Y(hs + Hm), (0.9 + a - t / 2) * S, Hm * S, fill='url(#soilh)', stroke='none')
s.rect(X(-0.9), Y(hs), 0.9 * S, hs * S, fill='url(#soilh)', stroke='none')
s.rect(X(-0.9), Y(0), (B + 1.7) * S, 0.6 * S, fill='url(#soilh)', stroke='none')
s.text(X(-0.45), Y(hs + Hm / 2), 'SOLO', size=13, color=C['soil'], weight='bold')
# solo da frente (até o topo da sapata)
s.rect(X(B), Y(hs), 0.8 * S, hs * S, fill='url(#soilh)', stroke='none')
s.rect(X(a + t / 2), Y(hs) - 2, (B - a - t / 2) * S, 2, fill=C['soil'], stroke='none')
# sapata + dente
s.rect(X(0), Y(hs), B * S, hs * S, fill='url(#conc)', stroke=C['line'], sw=1.4)
s.rect(X(B / 2 - bd / 2), Y(0), bd * S, hd * S, fill='url(#conc)', stroke=C['line'], sw=1.4)
s.text(X(B / 2), Y(-hd / 2) + 4, 'dente', size=11, color=C['line'], weight='bold')
# muro
s.rect(X(a - t / 2), Y(hs + Hm), t * S, Hm * S, fill=C['blockfill'], stroke=C['block'], sw=1.4)
s.line(X(a), Y(hs + Hm) - 14, X(a), Y(0) + 8, stroke=C['dim'], sw=0.8, extra='stroke-dasharray="6,3"')
s.text(X(a) + 4, Y(hs + Hm) - 18, 'eixo do muro', size=11, anchor='start', color=C['dim'])
# sobrecarga
for k in range(6):
    xx = -0.8 + k * 0.32
    if xx < a - t / 2 - 0.05:
        s.arrow(X(xx), Y(hs + Hm) - 34, X(xx), Y(hs + Hm) - 4, color=C['load'], sw=1.2)
s.text(X(-0.85), Y(hs + Hm) - 40, 'sobrecarga q (estabiliza sobre o talão: escolha nas Entradas)', size=11, anchor='start', color=C['load'])
# empuxo até a base da sapata (diagrama à esquerda, no plano da borda aterrada)
px = X(-0.95)
pts = [(px, Y(hs + Hm)), (px - 20, Y(hs + Hm)), (px - 120, Y(0)), (px, Y(0))]
s.poly(pts, fill='#fbe5d6', stroke=C['load'], sw=1.2)
for k in range(1, 6):
    yy = (hs + Hm) * k / 6
    w = 20 + 100 * (1 - yy / (hs + Hm))
    s.arrow(px - w, Y(yy), px - 3, Y(yy), color=C['load'], sw=1.1)
s.text(px - 60, Y(0) + 18, 'empuxo até a base da sapata', size=11, color=C['load'])
s.text(px - 60, Y(0) + 32, '(H + h da sapata)', size=11, color=C['load'])
# passivo na frente
s.poly([(X(B), Y(hs)), (X(B), Y(-hd)), (X(B) + 60, Y(-hd))], fill='#e2efda', stroke='#548235', sw=1.0)
for k in (0.35, 0.65, 0.9):
    yy = hs - k * (hs + hd)
    s.arrow(X(B) + 60 * k, Y(yy), X(B) + 3, Y(yy), color='#548235', sw=1.0)
s.text(X(B) + 66, Y(-hd) + 4, 'passivo (opcional): Kp·γ·(h + dente)²/2', size=11, anchor='start', color='#385723', weight='bold')
# pressões no solo (trapézio)
s.poly([(X(0), Y(0) + 105), (X(B), Y(0) + 105), (X(B), Y(0) + 105 + 46), (X(0), Y(0) + 105 + 14)], fill='#ddebf7', stroke=C['grout'], sw=1.0)
s.text(X(B) + 8, Y(0) + 105 + 40, 'σ máx (lado do pé)', size=11, anchor='start', color=C['grout'])
s.text(X(-0.02), Y(0) + 105 + 14, 'σ mín', size=11, anchor='end', color=C['grout'])
# cotas
s.dim_h(X(0), X(a), Y(hs + Hm) - 70, 'distância da borda aterrada ao eixo', size=11)
s.dim_h(X(0), X(B), Y(0) + 185, 'B', size=12)
s.dim_h(X(0), X(a - t / 2), Y(hs) - 12, 'talão', size=11)
s.dim_h(X(a + t / 2), X(B), Y(hs) - 12, 'ponta', size=11)
s.text(X(0), Y(0) + 203, 'borda aterrada', size=11, color=C['note'])
s.text(X(B), Y(0) + 203, 'pé (borda externa)', size=11, color=C['note'])
# texto à direita
lx = 790
s.text(lx, 110, 'Verificações (por módulo)', size=15, anchor='start', weight='bold')
lines = ['Tombamento: FS = ΣN·(B − x) / M tombador ≥ 2,0', '   e também |e| ≤ B/4 (critério do Gilberto) — vale o pior',
         'Deslizamento: (N·tg δ + adesão + passivo)/H ≥ 1,5', '   δ = 2/3·φ por padrão; adesão = 0 (curto prazo)',
         'Tensão: σ máx ≤ σadm (trapézio ou triângulo)', 'Sapata: flexão e cortante da ponta e do talão;', '   com contrafortes, torção ±Md/2 junto a cada um']
for i, l in enumerate(lines):
    s.text(lx, 136 + i * 21, l, size=12.5, anchor='start', color=C['line'] if not l.startswith('   ') else C['note'])
s.text(lx, 300, 'Posição da sapata', size=15, anchor='start', weight='bold')
def mini(x, y, aa, lab, lab2):
    sc = 40
    s.rect(x, y + 1.3 * sc, 1.4 * sc, 0.3 * sc, fill='url(#conc)', stroke=C['line'], sw=1)
    s.rect(x + (aa - 0.095) * sc, y, 0.19 * sc, 1.3 * sc, fill=C['blockfill'], stroke=C['block'], sw=1)
    s.rect(x - 0.5 * sc, y, (aa - 0.095 + 0.5) * sc, 1.3 * sc, fill='url(#soilh)', stroke='none')
    s.text(x + 0.7 * sc, y + 1.6 * sc + 16, lab, size=11)
    s.text(x + 0.7 * sc, y + 1.6 * sc + 30, lab2, size=10, color=C['note'])
mini(820, 320, 0.095, 'toda para fora', 'divisa; contraforte aparente')
mini(940, 320, 0.7, 'mista', 'aba do Gilberto')
mini(1060, 320, 1.305, 'toda sob o aterro', 'contraforte enterrado')
s.text(lx, 470, 'Contraforte enterrado precisa de talão ≥ tenr − t;', size=12, anchor='start')
s.text(lx, 488, 'aparente precisa de ponta ≥ tenr − t (a planilha avisa).', size=12, anchor='start')
s.text(30, 758, 'Campos das Entradas: seção "Fundação — sapata corrida" (largura, altura, distância da borda aterrada ao eixo, dente, cargas, base, FS, σadm, armaduras).', size=11, anchor='start', color=C['note'])
s.save('fig15_sapata.svg'); print('ok')
