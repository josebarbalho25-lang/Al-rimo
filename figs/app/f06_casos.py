# Fig. 6 (app) — casos de vinculação do painel não armado (11, 13, 18). Acrescenta a pré-compressão no
# topo do caso 13 (entrada sig_pan, que não tinha figura).
# Régua comum (12/10, applib):
#   - o painel é NÃO ARMADO, então é C['sub'] (antes estava na cor do empuxo, que agora é só de diagrama de
#     pressão). Aqui o contorno do painel SÃO as bordas: um contorno C['sub_line'] por baixo deixava a borda livre
#     (tracejado cinza fino) parecendo uma linha cheia, e a figura existe justamente para mostrar qual borda é livre;
#   - as bordas seguem a MESMA convenção da legenda() da applib (apoio, engaste, livre): a função borda() abaixo
#     desenha a borda de comprimento qualquer com o traço idêntico ao da amostra da legenda — se o traço do painel
#     fosse outro, a legenda embaixo mentiria. A Fig. 13 e a Fig. 19 importam a mesma borda() daqui;
#   - sem as frases "lateral livre" / "4 bordas apoiadas": a borda desenhada e a legenda já dizem isso;
#   - o "h" sozinho é a altura do muro: a altura do painel é h_{p}, como nas Figs. 1 e 5;
#   - a pré-compressão σ entra por CIMA da borda (é carga no topo do painel), e por isso a cota ℓ desceu para baixo
#     do painel nos três casos (iguais entre si, para comparar lado a lado).
import math
from applib import Fig, C, K_GERAL as K

# Painel-esquema a K_GERAL: proporção de um painel típico (ℓ um pouco maior que h_p). Não é medida do usuário.
L_P, H_P = 1.6, 1.4      # m


def borda(s, x1, y1, x2, y2, tipo, fora):
    """Borda de painel na convenção da legenda(): 'apoio' = traço grosso; 'engaste' = traço grosso + pente do lado
    de fora; 'livre' = tracejado cinza. fora = (nx, ny), versor que aponta para FORA do painel (lado do pente).
    Peça local (a applib só tem a amostra da legenda, de 26 px): mesmos traço, espessura, passo 7 e inclinação."""
    if tipo == 'livre':
        s.line(x1, y1, x2, y2, stroke=C['cinza'], sw=1.4, extra='stroke-dasharray="4,3"')
        return
    s.line(x1, y1, x2, y2, stroke=C['line'], sw=2.4)
    if tipo == 'engaste':
        L = math.hypot(x2 - x1, y2 - y1)
        ux, uy = (x2 - x1) / L, (y2 - y1) / L
        nx, ny = fora
        # Inclinação do dente amarrada ao "fora" (e não ao sentido em que a borda foi passada): na amostra da
        # legenda o dente sai 6 px para fora e 3 px "para trás" (bx, by) = fora girado de 90°. Assim as quatro
        # bordas de um painel ficam com o pente girando junto, seja qual for a ordem dos pontos.
        bx, by = -ny, nx
        d = 3.0
        while d <= L:
            px, py = x1 + ux * d, y1 + uy * d
            s.line(px, py, px + 6 * nx + 3 * bx, py + 6 * ny + 3 * by, stroke=C['line'], sw=1)
            d += 7


def painel(s, x, y, livres, titulo, sigma=False):
    w, h = L_P * K, H_P * K
    with s.campo('caso_pan'):
        s.rect(x, y, w, h, fill=C['sub'], stroke='none')
        bordas = {'esq': (x, y + h, x, y, (-1, 0)), 'dir': (x + w, y, x + w, y + h, (1, 0)),
                  'sup': (x, y, x + w, y, (0, -1)), 'inf': (x + w, y + h, x, y + h, (0, 1))}
        for k, (a, b, c, d, fora) in bordas.items():
            borda(s, a, b, c, d, 'livre' if k in livres else 'apoio', fora)
        s.titulo_vista(x, y - 66, titulo)
    with s.campo('beta_dir'):
        s.text(x + w / 2, y + h / 2 + 8, 'β_{f}', size=22, color=C['note'])
    s.dim_h(x, x + w, y + h + 34, 'ℓ')
    s.dim_v(x - 22, y, y + h, 'h_{p}', side=-1)
    if sigma:
        # pré-compressão: carga distribuída no topo, setas laranja de cima para a borda
        with s.campo('sig_pan'):
            for k in range(1, 6):
                xx = x + w * k / 6
                s.arrow(xx, y - 42, xx, y - 3, sw=1.6)
            s.line(x + w / 6, y - 42, x + 5 * w / 6, y - 42, stroke=C['load'], sw=1.5)
            s.text(x + 5 * w / 6 + 10, y - 36, 'σ', size=22, anchor='start', color=C['load'], weight='bold')


def desenhar():
    s = Fig(6, 1000, 640)
    y0 = 140
    passo = L_P * K + 92          # vão entre painéis: cabe a cota h_{p} do painel seguinte
    painel(s, 70, y0, ['dir'], 'Caso 11')
    painel(s, 70 + passo, y0, [], 'Caso 13', sigma=True)
    painel(s, 70 + 2 * passo, y0, ['sup'], 'Caso 18')
    s.legenda(70, y0 + H_P * K + 96, [('apoio', 'apoiada'), ('livre', 'livre')])
    return s
