from figlib import SVG, C
S = 11.0
W, H = 1180, 700
s = SVG(W, H)
s.rect(0, 0, W, 64, fill='#c00000', stroke='none')
s.text(30, 30, 'Fig. 4 — POSIÇÃO DA BARRA: ENCOSTADA DO LADO DO SOLO — NÃO CENTRALIZAR', size=19, anchor='start', weight='bold', color='#ffffff')
s.text(30, 52, 'O cálculo usa d = 14 cm no bloco de 19 (aula 12.2). O costume de obra é deixar a barra no meio do furo, com d = 9,5 cm.', size=13, anchor='start', color='#ffffff')
def cell(x0, y0, bary, ok):
    t, hf, L = 19, 3.5, 21.25
    X = lambda v: x0 + v * S; Y = lambda v: y0 + v * S
    # trecho do bloco: septo + furo + septo
    s.rect(X(0), Y(0), L * S, t * S, fill=C['blockfill'], stroke=C['block'], sw=1.4)
    s.rect(X(3.5), Y(hf), 14.25 * S, 12 * S, fill=C['groutfill'], stroke=C['grout'], sw=1.2, extra='rx="5"')
    s.circle(X(10.625), Y(bary), 0.625 * S + 1.5, fill=C['steel'])
    s.text(X(L / 2), Y(0) - 12, '▲ SOLO — face tracionada', size=12, color=C['soil'], weight='bold')
    s.text(X(L / 2), Y(t) + 22, '▼ face externa — comprimida', size=12, color=C['note'])
    s.dim_v(X(0) - 26, Y(bary), Y(t), f'd = {str(round(t - bary, 1)).replace(".", ",")} cm', side=-1, ext_from=(X(10.625), X(0)), size=13)
    if ok:
        s.dim_v(X(L) + 22, Y(0), Y(bary), '5 cm', side=1, ext_from=(X(10.625), X(L)), size=12)
        s.text(X(L) + 48, Y(hf) + 26, 'graute entre a barra', size=11, anchor='start', color=C['grout'])
        s.text(X(L) + 48, Y(hf) + 40, 'e a parede ≥ 1,5 cm', size=11, anchor='start', color=C['grout'])
    else:
        s.dim_v(X(L) + 22, Y(0), Y(bary), '9,5 cm', side=1, ext_from=(X(10.625), X(L)), size=12)
# correto
x1, y1 = 120, 150
s.rect(60, 92, 520, 360, fill='#eaf5ea', stroke='#2e7d32', sw=2)
s.text(320, 122, '✔ COMO FOI CALCULADO', size=17, weight='bold', color='#2e7d32')
cell(x1 + 60, y1 + 45, 5.0, True)
# errado
s.rect(610, 92, 520, 360, fill='#fdecea', stroke='#c00000', sw=2)
s.text(870, 122, '✘ BARRA CENTRALIZADA (erro de obra)', size=17, weight='bold', color='#c00000')
cell(690, y1 + 45, 9.5, False)
# consequências
y = 490
s.text(60, y, 'Por que importa', size=15, anchor='start', weight='bold')
txt = ['• O braço de alavanca cai cerca de 1/3. No exemplo da aula, o As necessário passa de 1,52 para 2,46 cm²/m e o Ø10 c/40 deixa de atender.',
       '• A planilha mostra isso na aba Muro em balanço, em "E se a barra for centralizada na obra?". Se der NÃO, o projeto depende da barra encostada.',
       'Como garantir na obra', '• Indicar em planta, no corte e nas notas: "armadura vertical encostada na face do solo — não centralizar".',
       '• Espaçador ou gabarito na espera e na barra; amarrar a barra na espera; conferir a posição antes de grautear.']
for i, l in enumerate(txt):
    bold = l == 'Como garantir na obra'
    s.text(60, y + 28 + i * 24 + (8 if i >= 2 else 0), l, size=15 if bold else 13, anchor='start', weight='bold' if bold else 'normal')
s.text(60, 685, 'Campo das Entradas: "d (altura útil) — opcional" (em branco = barra no meio, d = t/2).', size=11, anchor='start', color=C['note'])
s.save('fig04_barra.svg'); print('ok')
