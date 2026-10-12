# Fig. 4 (app) — posição da barra vertical do balanço: encostada no lado do solo (d = t − c, o que a aula usa) ou
# no meio do furo (d = t/2, o padrão quando d fica em branco). A fig04 da planilha é a mais "tutorial" (faixa
# vermelha, "Por que importa", "Como garantir na obra"); aqui sobra só o desenho.
# Régua comum (12/10, applib): bloco inteiro a K_BLOCO (era a célula a 11 px/cm — agora do mesmo tamanho das
# Figs. 2, 3 e 14); planta com o solo em cima (hachura); saem as molduras verde/vermelha e o ✓/✗ desenhados à
# mão — as duas posições são escolha do usuário, não certo × errado: o título de cada vista diz qual é.
from applib import Fig, C, T_SIM, K_BLOCO

K = K_BLOCO / 100        # px por cm
T, L, HF = 19, 39, 3.5
LH = (L - 3 * HF) / 2
XB = HF + LH / 2         # eixo do furo grauteado
R_BARRA = 0.625 * K + 1.5
SOLO = 30                # px: faixa de solo atrás da parede, em planta


def vista(s, x0, y0, titulo, yb, encostada):
    """Um bloco em planta, furo da barra grauteado; yb = eixo da barra, em cm a partir da face do solo."""
    X = lambda v: x0 + v * K
    Y = lambda v: y0 + v * K
    s.titulo_vista(X(0), y0 - SOLO - 16, titulo)
    s.solo([(X(0), Y(0) - SOLO), (X(L), Y(0) - SOLO), (X(L), Y(0)), (X(0), Y(0))])
    s.rect(X(0), Y(0), L * K, T * K, fill=C['blockfill'], stroke=C['block'], sw=1.4)
    s.rect(X(HF), Y(HF), LH * K, (T - 2 * HF) * K, fill=C['groutfill'], stroke=C['grout'], sw=1.2, extra='rx="4"')
    s.rect(X(2 * HF + LH), Y(HF), LH * K, (T - 2 * HF) * K, fill=C['hollow'], stroke=C['block'], sw=1.0, extra='rx="4"')
    s.circle(X(XB), Y(yb), R_BARRA)
    # cotas em cadeia do mesmo lado (face do solo → barra → face externa): a soma das duas é t, e o olho lê de
    # uma vez onde a barra está
    xc = X(0) - 26
    with s.campo('d_dir'):
        cota(s, xc, Y(yb), Y(T), 'd' if encostada else 't/2', (X(XB), X(0)))
    cota(s, xc, Y(0), Y(yb), 'c' if encostada else 't/2', (X(0), X(XB)))


def cota(s, x, y1, y2, rotulo, ext):
    """Cota vertical com o rótulo EM PÉ à esquerda. "t/2" tem 3 caracteres e a dim_v o giraria (ela só deixa em pé
    símbolo de até 2 letras); girado ao lado de um "d" em pé, ele parecia outra coisa."""
    s.dim_v(x, y1, y2, '', side=-1, ext_from=ext)
    s.text(x - 8, (y1 + y2) / 2 + T_SIM * 0.35, rotulo, size=T_SIM, anchor='end', color=C['dim'])


def desenhar():
    s = Fig(4, 1000, 640)
    vista(s, 140, 260, 'Encostada no lado do solo', 5.0, True)
    vista(s, 140 + L * K + 210, 260, 'Centralizada', T / 2, False)
    return s
