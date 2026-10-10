# Fig. 16 — Tombamento e deslizamento da sapata corrida, no traço da Fig. 1.116 do Bastos (UNESP, Sapatas, §1.8)
from figlib import SVG, C
K = '#1a1a1a'; G = '#548235'
S = 120.0
W, H = 1240, 620
s = SVG(W, H)
s.defs.append('<marker id="arrK" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="%s"/></marker>' % K)
s.defs.append('<marker id="arrG" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="%s"/></marker>' % G)
s.text(30, 34, 'Fig. 16 — Sapata corrida: tombamento e deslizamento', size=18, anchor='start', weight='bold')
s.text(30, 56, 'Corte por módulo. Traço da Fig. 1.116 do Bastos, com as forças do muro de arrimo. Solo contido à esquerda.', size=13, anchor='start', color=C['note'])
B, a, t, hs, Hm = 1.40, 0.95, 0.19, 0.30, 1.60
def painel(x0, yb, tomb):
    X = lambda v: x0 + v * S; Y = lambda v: yb - v * S
    # contorno: sapata + muro (linha preta, sem hachura, como no Bastos)
    s.pline([(X(a - t/2), Y(hs + Hm)), (X(a - t/2), Y(hs)), (X(0), Y(hs)), (X(0), Y(0)), (X(B), Y(0)), (X(B), Y(hs)),
             (X(a + t/2), Y(hs)), (X(a + t/2), Y(hs + Hm))], stroke=K, sw=2.2)
    s.line(X(a - t/2) - 6, Y(hs + Hm), X(a + t/2) + 6, Y(hs + Hm), stroke=K, sw=1.4)
    # solo sobre o talão (contorno tracejado)
    s.poly([(X(0), Y(hs)), (X(a - t/2), Y(hs)), (X(a - t/2), Y(hs + Hm)), (X(0), Y(hs + Hm))], fill='none', stroke=C['soil'], sw=1, extra='stroke-dasharray="5,3"')
    s.text(X((a - t/2) / 2), Y(hs + Hm * 0.80), 'solo', size=12, color=C['soil'])
    s.text(X((a - t/2) / 2), Y(hs + Hm * 0.80) + 15, 'sobre o talão', size=12, color=C['soil'])
    # cargas verticais
    def vert(xv, ytop, ybot, lab, side=1):
        s.arrow(X(xv), ytop, X(xv), ybot, color=K, sw=1.6, marker='arrK')
        s.text(X(xv) + side * 6, ytop + 14, lab, size=15, anchor='start' if side > 0 else 'end', color=K)
    vert(a, Y(hs + Hm) - 46, Y(hs + Hm) - 2, 'P<tspan font-size="11" dy="4">muro</tspan>')
    vert((a - t/2) / 2, Y(hs + Hm * 0.55), Y(hs + 0.05), 'P<tspan font-size="11" dy="4">solo</tspan>')
    vert(B / 2 + 0.05, Y(hs) + 4, Y(0.04), 'P<tspan font-size="11" dy="4">sap</tspan>')
    for k in range(4):
        xx = 0.06 + k * 0.22
        s.arrow(X(xx), Y(hs + Hm) - 30, X(xx), Y(hs + Hm) - 3, color=C['load'], sw=1.1)
    s.text(X(0), Y(hs + Hm) - 36, 'q', size=14, anchor='start', color=C['load'], italic=True)
    # empuxo ativo (triângulo até a base da sapata) e resultante
    Ht = hs + Hm; px = X(0) - 10
    s.poly([(px, Y(Ht)), (px - 70, Y(0)), (px, Y(0))], fill='none', stroke=C['load'], sw=1, extra='stroke-dasharray="4,3"')
    s.arrow(px - 110, Y(Ht / 3), px - 2, Y(Ht / 3), color=K, sw=2.0, marker='arrK')
    s.text(px - 110, Y(Ht / 3) - 8, 'E<tspan font-size="11" dy="4">a</tspan>', size=15, anchor='start', color=K)
    s.dim_v(px - 130, Y(Ht / 3), Y(0), '(H + h)/3', side=-1, ext_from=(px - 110, X(0)), size=11)
    if tomb:
        # ponto 1 no pé
        s.circle(X(B), Y(0), 5, fill=K)
        s.text(X(B) + 10, Y(0) + 6, '1', size=16, anchor='start', color=K, weight='bold')
        s.text(X(B) + 10, Y(0) + 24, 'pé (giro)', size=11, anchor='start', color=C['note'])
        # braços até o ponto 1
        yy = Y(0) + 36
        for xv, lab, dy in ((a, 'b<tspan font-size="10" dy="3">muro</tspan>', 0), ((a - t/2) / 2, 'b<tspan font-size="10" dy="3">solo</tspan>', 26), (B / 2 + 0.05, 'b<tspan font-size="10" dy="3">sap</tspan>', 52)):
            s.dim_h(X(xv), X(B), yy + dy, lab, size=12, off_text=-4)
            s.line(X(xv), Y(0) + 4, X(xv), yy + dy + 4, stroke=C['dim'], sw=0.5, extra='stroke-dasharray="2,2"')
        s.line(X(B), Y(0) + 4, X(B), yy + 56, stroke=C['dim'], sw=0.5)
        s.dim_h(X(0), X(B), yy + 82, 'B', size=13, off_text=-4)
    else:
        # atrito na base
        for k in range(5):
            xx = 0.12 + k * 0.28
            s.arrow(X(xx), Y(0) + 9, X(xx) + 26, Y(0) + 9, color=K, sw=1.2, marker='arrK')
        s.text(X(B / 2), Y(0) + 32, 'atrito na base: N·tg δ  (+ adesão·B)', size=13, color=K)
        s.text(X(B / 2), Y(0) + 48, 'N = P muro + P solo + P sap (+ q sobre o talão)', size=11, color=C['note'])
        # passivo opcional na frente
        s.poly([(X(B) + 4, Y(hs)), (X(B) + 4, Y(0)), (X(B) + 50, Y(0))], fill='#e2efda', stroke=G, sw=1, extra='stroke-dasharray="5,3"')
        s.arrow(X(B) + 130, Y(hs / 3), X(B) + 6, Y(hs / 3), color=G, sw=1.8, marker='arrG')
        s.text(X(B) + 136, Y(hs / 3) - 6, 'E<tspan font-size="11" dy="4">p</tspan><tspan dy="-4" dx="3">÷ 2,0</tspan>', size=15, anchor='start', color=G)
        s.text(X(B) + 136, Y(hs / 3) + 14, 'opcional, padrão desligado', size=11, anchor='start', color=G)
        s.text(X(B) + 136, Y(hs / 3) + 28, '(NBR 6122 7.6.3)', size=11, anchor='start', color=G)
    if tomb: s.dim_v(X(B) + 40, Y(hs), Y(0), 'h', side=2, ext_from=(X(B), X(B)), size=12)
# painel (a): tombamento
painel(200, 390, True)
s.text(310, 560, 'a) Tombamento: momentos em torno do ponto 1', size=14, weight='bold', italic=True)
for i, l in enumerate(['M<tspan font-size="10" dy="3">tomb</tspan><tspan dy="-3"> = E</tspan><tspan font-size="10" dy="3">a</tspan><tspan dy="-3">·(H + h)/3  (+ empuxo da sobrecarga)</tspan>',
                       'M<tspan font-size="10" dy="3">estab</tspan><tspan dy="-3"> = Σ P</tspan><tspan font-size="10" dy="3">i</tspan><tspan dy="-3">·b</tspan><tspan font-size="10" dy="3">i</tspan>',
                       'FS = M<tspan font-size="10" dy="3">estab</tspan><tspan dy="-3"> / M</tspan><tspan font-size="10" dy="3">tomb</tspan><tspan dy="-3"> ≥ 2,0  e  |e| ≤ B/4</tspan>']):
    s.text(130, 662 + i * 0, '', size=1)
s.text(310, 584, 'M tomb = Ea·(H + h)/3 (+ sobrecarga)   ·   M estab = Σ Pi·bi', size=12.5, color=K)
s.text(310, 604, 'FS = M estab / M tomb ≥ 2,0  e  |e| ≤ B/4 (vale o pior)', size=12.5, color=K)
# painel (b): deslizamento
painel(780, 390, False)
s.text(900, 560, 'b) Deslizamento: forças horizontais', size=14, weight='bold', italic=True)
s.text(900, 584, 'FS = (N·tg δ + adesão·B + Ep/2,0) / Ea ≥ 1,5', size=12.5, color=K)
s.text(900, 604, 'δ = 2/3·φ (Bastos 1.74); adesão = 2/3·c, padrão 0', size=12.5, color=K)
s.line(620, 90, 620, 610, stroke='#bfbfbf', sw=1)
s.save('fig16_tomb_desl.svg'); print('ok')
