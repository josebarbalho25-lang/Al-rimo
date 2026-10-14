from figlib import SVG, C
import math
W, H = 1180, 600
s = SVG(W, H)
s.text(30, 34, 'Fig. 10 — ELS do balanço: fissuração na base e flecha no topo', size=18, anchor='start', weight='bold')
s.text(30, 56, 'Faixa bm (uma barra por faixa), seção I ou cheia. Mesmo roteiro de viga: Estádio II e inércia equivalente de Branson.', size=13, anchor='start', color=C['note'])
xw, yb, hp = 200, 520, 380
s.rect(xw - 60, yb, 160, 30, fill='url(#conc)', stroke=C['line'])
s.rect(xw, yb - hp, 24, hp, fill=C['blockfill'], stroke=C['line'], sw=1.4)
# deformada
d = [(xw + 12 - 70 * ((yb - y) / hp) ** 2 * (3 - (yb - y) / hp) / 2, y) for y in range(yb, yb - hp - 1, -10)]
s.pline(d, stroke=C['load'], sw=2.2, extra='stroke-dasharray="7,4"')
s.dim_h(xw + 12 - 70, xw + 12, yb - hp - 16, 'δ', size=14)
# carga
s.poly([(xw + 24, yb - hp), (xw + 34, yb - hp), (xw + 130, yb), (xw + 24, yb)], fill='#f8cbad', stroke=C['load'], sw=1.2, extra='fill-opacity="0.5"')
for i in range(1, 6):
    y = yb - hp + i * hp / 6
    s.arrow(xw + 24 + 10 + 96 * i / 6, y, xw + 26, y, color=C['load'], sw=1.1)
s.text(xw + 140, yb - 20, 'carga de serviço', size=12, anchor='start', color=C['load'])
s.text(xw + 140, yb - 4, '(Ma/Mk = 1: carga inteira)', size=11, anchor='start', color=C['note'])
s.dim_v(xw - 100, yb - hp, yb, 'L = h', side=-1, ext_from=(xw, xw), size=13)
s.line(xw + 10, yb - 3, xw + 26, yb - 3, stroke=C['steel'], sw=3)
s.text(xw + 140, yb + 24, 'fissura na base, face do solo (tracionada)', size=11, anchor='start', color=C['steel'])
# roteiro
bx, by = 520, 100
rows = [('Roteiro (aba ELS)', True), ('1. Ma = momento no engaste na faixa bm', False), ('2. Em = 800·fpk (NBR 16868-1, Tab. 1); n = Es/Em', False),
        ('3. Im da seção (I ou cheia); Mr = ftk·Im / yt', False), ('    Ma > Mr → Estádio II (fissura na base)', False),
        ('4. x e III da seção fissurada (LN na mesa ou na alma)', False), ('5. Ieq = (Mr/Ma)³·Im + [1 − (Mr/Ma)³]·III ≤ Im', False),
        ('6. δ0 com a carga real e Em·Ieq (igual ao Ftool com', False), ('    seção bm × heq e E = Em)', False),
        ("7. δ∞ = δ0·(1 + αf),  αf = Δξ/(1 + 50ρ'),  Δξ = 1", False), ('8. Limite do balanço: 2L/250', True), ('', False),
        ('Campos: "Ma/Mk", "Limite: vão /", "Vão de referência', False), ('do balanço" (2h), "Δξ", "Somar σsg no Mr?"', False)]
for i, (l, b) in enumerate(rows):
    s.text(bx, by + i * 24, l, size=14 if b else 13, anchor='start', weight='bold' if b else 'normal', color=C['note'] if l.startswith('Campos') or l.startswith('do balanço"') else C['line'])
s.save('fig10_els.svg'); print('ok')
