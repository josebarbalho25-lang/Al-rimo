# Fig. 26 (app) — PESO PRÓPRIO DA PAREDE (Jose, 13/10: "o que as figuras relacionadas têm a ver?" — o peso abria a
# Fig. 7, de esbeltez; "tem só do contraforte e só da parede"). É a figura dos campos Reboco, Espessura do reboco e
# Peso da parede: o que pesa num metro quadrado de parede.
#   - PLANTA, faixa de 1 m: o bloco (cinza), os furos grauteados na grade do graute a cada X (azul; o desenho mostra
#     40, furo sim furo não) e os vazios (branco), o reboco nas duas faces (a entrada escolhe nenhum, só a frente ou
#     as duas);
#   - CORTE: as fiadas de canaleta grauteadas a cada s_can (no balanço; no painel, a cada s_h) e o reboco.
# O contraforte pesa à parte (Fig. 27). Escala: planta a 500 px/m (entre o K_DETALHE e o K_BLOCO: com o K_BLOCO o
# metro dá 600 px e a planta não cabe ao lado do corte); corte a 230 px/m, com o reboco desenhado mais grosso que a escala
# (2 cm dariam 5 px) — é o lugar dele que importa, a medida vai na cota da planta.
from applib import Fig, C, T_PEQ

KP = 5                 # px por cm na planta (1 m = 500 px)
T, L, HF = 19, 39, 3.5
LH = (L - 3 * HF) / 2
REB = 2.5              # cm de reboco desenhados na planta (a cota diz e_reb)
COR_REB = C['reboco']  # argamassa do reboco (applib)
X_GR = 40              # graute a cada do desenho (o padrão)


def planta(s, x0, y0):
    """Faixa de 1 m em planta, com 3 blocos (a faixa corta o 3º) e o reboco. y0 = face do fundo do BLOCO."""
    s.titulo_vista(x0, y0 - 92, 'Planta (faixa de 1 m)')
    larg = 3 * 40 * KP
    # solo em cima (o fundo da parede encosta no solo; o reboco do fundo fica entre os dois)
    s.solo([(x0 - 10, y0 - REB * KP - 46), (x0 + larg + 10, y0 - REB * KP - 46),
            (x0 + larg + 10, y0 - REB * KP), (x0 - 10, y0 - REB * KP)])
    with s.campo('reb_fac'):
        s.rect(x0 - 10, y0 - REB * KP, larg + 20, REB * KP, fill=COR_REB, stroke=C['dim'], sw=0.8)
        s.rect(x0 - 10, y0 + T * KP, larg + 20, REB * KP, fill=COR_REB, stroke=C['dim'], sw=0.8)
    centros = []
    with s.campo('Graute'):
        for b in range(3):
            xb = x0 + b * 40 * KP
            s.rect(xb, y0, L * KP, T * KP, fill=C['blockfill'], stroke=C['block'], sw=1.0)
            for j, a in enumerate((HF, 2 * HF + LH)):
                g = (2 * b + j) % (X_GR // 20) == 0
                xf = xb + a * KP
                s.rect(xf, y0 + HF * KP, LH * KP, (T - 2 * HF) * KP, fill=C['groutfill'] if g else C['hollow'],
                       stroke=C['grout'] if g else C['block'], sw=1.0, extra='rx="3"')
                if g:
                    centros.append(xf + LH * KP / 2)
    yb = y0 + (T + REB) * KP
    # cotas: graute a cada (entre dois furos grauteados) e o metro, embaixo; t à esquerda; e_reb à direita
    with s.campo('Graute'):
        s.dim_h(centros[0], centros[1], yb + 34, 'graute a cada', size=T_PEQ, ext_from=(y0 + T * KP / 2, y0 + T * KP / 2))
    s.dim_h(x0, x0 + 100 * KP, yb + 74, '1 m', ext_from=(yb, yb))
    s.dim_v(x0 - 34, y0, y0 + T * KP, 't', side=-1, ext_from=(x0, x0))
    with s.campo('reb_esp'):
        xr = x0 + larg + 34
        s.dim_v(xr, y0 + T * KP, yb, 'e_{reb}', side=1, ext_from=(x0 + larg + 10, x0 + larg + 10))
    # a faixa de 1 m acaba no meio do 3º bloco: o resto fica apagado (tracejado), a parede continua
    s.line(x0 + 100 * KP, y0 - REB * KP - 6, x0 + 100 * KP, yb + 6, stroke=C['dim'], sw=1.0, extra='stroke-dasharray="6,4"')


def corte(s, x0, y_base):
    """Corte da parede (solo à direita): blocos, as fiadas de canaleta grauteadas e o reboco nas duas faces."""
    K = 230                      # px por m
    h, t = 1.6, 0.19
    reb = 6                      # px (fora de escala, ver o cabeçalho)
    s.titulo_vista(x0 - 40, y_base - h * K - 40, 'Corte')
    s.solo([(x0 + t * K + reb, y_base - h * K + 20), (x0 + t * K + 90, y_base - h * K + 20),
            (x0 + t * K + 90, y_base), (x0 + t * K + reb, y_base)])
    s.parede(x0, y_base, t, h, K=K, canaletas=(0.6, 1.4), barra=False)
    # fiadas de 20 cm: as juntas
    for k in range(1, 8):
        s.line(x0, y_base - k * 0.2 * K, x0 + t * K, y_base - k * 0.2 * K, stroke=C['block'], sw=0.6)
    with s.campo('reb_fac'):
        s.rect(x0 - reb, y_base - h * K, reb, h * K, fill=COR_REB, stroke=C['dim'], sw=0.8)
        s.rect(x0 + t * K, y_base - h * K, reb, h * K, fill=COR_REB, stroke=C['dim'], sw=0.8)
    # canaletas a cada s_can (do eixo de uma ao da outra)
    yc1 = y_base - (0.6 + 0.095) * K
    yc2 = y_base - (1.4 + 0.095) * K
    s.dim_v(x0 - reb - 30, yc2, yc1, 's_{can}', side=-1, ext_from=(x0 - reb, x0 - reb))
    s.line(x0 - 30, y_base, x0 + t * K + 90, y_base, stroke=C['line'], sw=1.4)


def desenhar():
    s = Fig(26, 1000, 640)
    with s.campo('peso_par'):
        planta(s, 80, 200)
        corte(s, 850, 560)
    s.legenda(70, 600, [('bloco', 'bloco'), ('graute', 'graute'), ('reboco', 'reboco')])
    return s
