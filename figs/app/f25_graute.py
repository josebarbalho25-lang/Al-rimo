# Fig. 25 (app) — GRAUTE A CADA X (Jose, 13/10: "uma fileira de blocos; na primeira, todos grauteados; na segunda,
# furo sim, furo não; e vai fazendo a sequência… até a cada 100"). É a figura do campo "Graute a cada": a parede é
# grauteada numa grade de furos, e a barra só cai num furo dela (o espaçamento das barras é múltiplo de X).
#   - uma fiada em planta, 10 blocos 19 × 39 (4 m, 20 furos a cada 20 cm), repetida para 20, 40, 60, 80 e 100;
#   - furo grauteado em azul, vazio em branco; a cota X entre os dois primeiros furos grauteados de cada linha.
# Fora da régua do bloco (K_BLOCO daria 2,4 m de desenho): aqui a escala é a de caber 10 blocos na moldura — o que
# importa é o ritmo dos furos, não a medida do bloco (que está nas Figs. 2, 3 e 4).
from applib import Fig, C, T_PEQ, T_TIT

K = 1.85               # px por cm: 400 cm de fiada em 740 px
T, L, HF = 19, 39, 3.5
LH = (L - 3 * HF) / 2  # comprimento do furo
GRADES = [(20, 'todos os furos'), (40, 'furo sim, furo não'), (60, 'um sim, dois não'), (80, 'um sim, três não'),
          (100, 'um sim, quatro não')]


def desenhar():
    s = Fig(25, 1000, 640)
    x0 = 230                           # início da fiada (à esquerda ficam os rótulos)
    y0 = 70
    passo_linha = 104
    for i, (X, nome) in enumerate(GRADES):
        y = y0 + i * passo_linha
        s.text(x0 - 24, y + T * K / 2 - 2, f'a cada {X}', size=T_TIT, anchor='end', weight='bold')
        s.text(x0 - 24, y + T * K / 2 + 20, nome, size=T_PEQ, anchor='end', color=C['note'])
        n = X // 20
        centros = []
        with s.campo('Graute'):
            for b in range(10):
                xb = x0 + b * 40 * K       # bloco de 39 + junta de 1
                s.rect(xb, y, L * K, T * K, fill=C['blockfill'], stroke=C['block'], sw=1.0)
                for j, a in enumerate((HF, 2 * HF + LH)):
                    k = 2 * b + j          # índice do furo na fiada (a cada 20 cm)
                    g = k % n == 0
                    xf = xb + a * K
                    s.rect(xf, y + HF * K, LH * K, (T - 2 * HF) * K, fill=C['groutfill'] if g else C['hollow'],
                           stroke=C['grout'] if g else C['block'], sw=1.0, extra='rx="2"')
                    if g:
                        centros.append(xf + LH * K / 2)
        # a cota X entre os dois primeiros furos grauteados (no "todos" ela seria a própria grade de 20)
        if len(centros) > 1:
            s.dim_h(centros[0], centros[1], y - 12, str(X), size=T_PEQ, ext_from=(y + HF * K, y + HF * K))
    s.legenda(x0, y0 + len(GRADES) * passo_linha + 16, [('graute', 'furo grauteado'), ('bloco', 'bloco (furo vazio)')])
    return s
