# Fig. 5 (app) — elevação do muro (vista de fora): barras verticais, canaletas, cinta do topo e o painel
# não armado. Corrige o defeito da fig05 da planilha: lá o painel estava pintado no 1º vão e a cota l no 2º.
# Aqui o painel, a cota s (entre barras) e a cota h_p (entre canaletas) contam a mesma história.
# Régua comum (12/10, applib):
#   - escala K_GERAL (era 1,8 px/cm solta). Para o desenho continuar grande na moldura, o trecho de muro cresceu
#     (4,40 × 2,40 m) e as canaletas ficaram na mesma altura da Fig. 1 (topos a 0,8 / 1,6 / 2,4 m);
#   - painel não armado em C['sub'] + legenda (antes laranja, a cor do empuxo, e com a frase escrita dentro);
#   - chamadas de 1–2 palavras ("cinta", "canaleta", "barra vertical"); a barra horizontal já se vê, vermelha,
#     dentro da canaleta, e o rótulo da sapata saiu (a sapata é sempre o concreto pontilhado).
from applib import Fig, C, K_GERAL

K = K_GERAL / 100        # px por cm: a elevação é medida em cm de bloco (fiada de 20, bloco de 40)
LW, HW = 440, 240        # trecho de muro desenhado (cm)
CANALETAS = (3, 7, 11)   # fiadas (0 = 1ª) em canaleta: topos a 80, 160 e 240 cm; a 11 é a cinta do topo


def desenhar():
    s = Fig(5, 1000, 640)
    x0, yb = 120, 470
    yt = yb - HW * K
    X = lambda v: x0 + v * K
    Y = lambda v: yb - v * K
    s.sapata(x0 - 0.16 * K_GERAL, yb, LW / 100 + 0.32, 0.30)
    for i in range(HW // 20):
        y = yb - (i + 1) * 20 * K
        off = 0 if i % 2 == 0 else 20
        xs = -off
        while xs < LW:
            a = max(xs, 0); b = min(xs + 39, LW)
            if b > a:
                c = i in CANALETAS
                s.rect(X(a), y, (b - a) * K, 19 * K, fill=C['groutfill'] if c else C['blockfill'],
                       stroke=C['grout'] if c else C['block'], sw=0.8)
            xs += 40
    # painel não armado: 1º vão entre barras, da base ao eixo da 1ª canaleta. Vem antes das células grauteadas e
    # das barras, que são as bordas dele e têm de aparecer por cima.
    pa, pb, ph = 10, 50, 70
    s.rect(X(pa), Y(ph), (pb - pa) * K, ph * K, fill=C['sub'], stroke=C['sub_line'], sw=1.6, extra='fill-opacity="0.85"')
    barras = [10 + 40 * k for k in range(LW // 40)]
    for xb in barras:
        s.rect(X(xb - 6), yt, 12 * K, HW * K, fill=C['groutfill'], stroke='none', extra='fill-opacity="0.6"')
    # barras horizontais nas canaletas intermediárias (eixo da canaleta)
    for i in CANALETAS[:-1]:
        yy = Y(i * 20 + 10)
        s.line(X(2), yy, X(LW - 2), yy, stroke=C['steel'], sw=2)
    ycinta = Y(CANALETAS[-1] * 20 + 10)
    with s.campo('cinta_topo', 'phi_cinta'):
        s.line(X(2), ycinta, X(LW - 2), ycinta, stroke=C['steel'], sw=2.4)
    # barras verticais com espera na sapata
    with s.campo('phi_v'):
        for xb in barras:
            s.line(X(xb), yt + 4, X(xb), yb + 30, stroke=C['steel'], sw=2.4)
    # cotas
    with s.campo('s_dir'):
        s.dim_h(X(pa), X(pb), yt - 18, 's', ext_from=(yt, yt))
    with s.campo('h_pan'):
        s.dim_v(x0 - 40, Y(150), Y(70), 'h_{p}', side=-1, ext_from=(x0, x0))
    # chamadas à direita
    xr = X(LW) + 30
    with s.campo('cinta_topo', 'phi_cinta'):
        s.chamada(X(LW - 12), ycinta, xr, ycinta + 6, 'cinta', color=C['grout'])
    s.chamada(X(LW - 12), Y(150), xr, Y(150) + 6, 'canaleta', color=C['grout'])
    s.chamada(X(LW - 12), Y(70), xr, Y(70) + 6, 'canaleta', color=C['grout'])
    with s.campo('phi_v'):
        s.chamada(X(barras[-1]), Y(35), xr, Y(25) + 6, 'barra vertical', color=C['steel'])
    s.legenda(x0 - 0.16 * K_GERAL, yb + 0.30 * K_GERAL + 44, [('naoarmado', 'painel não armado')])
    return s
