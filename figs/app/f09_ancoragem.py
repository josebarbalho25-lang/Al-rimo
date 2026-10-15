# Fig. 9 (app) — ancoragem da espera na sapata e traspasse com a barra do muro. O quadro de fórmulas da
# planilha sai (é memória de cálculo, não figura); entra a cota do traspasse, que agora é entrada do modelo.
# Régua comum (12/10, applib): detalhe em K_DETALHE; parede, sapata e espera pelas peças padrão; o solo deixou de ser
# só a palavra e virou hachura à direita (aterro sobre o talão) e em volta da sapata, como em todo corte; legenda
# pela legenda() da applib.
from applib import Fig, C, T_SIM, T_TXT, K_DETALHE as K

T = 0.19            # parede (m)
HP = 0.62           # trecho de parede mostrado acima da sapata (m); o resto fica acima da linha de interrupção
HS = 0.45           # altura da sapata no detalhe (m): cabe ℓ_b com o gancho e o cobrimento
LB = 0.35           # ℓ_b desenhado (m)
CASCA = 0.035       # parede do bloco (m): o graute fica entre as duas cascas


def interrupcao(s, x0, x1, y):
    """Linha de interrupção (zigue-zague) no alto da parede: o muro continua para cima — sem ela o retângulo da
    parede se lê como o topo do muro. A faixa branca por cima apaga a aresta do retângulo acima do corte."""
    xm = (x0 + x1) / 2
    zz = [(x0, y), (xm - 9, y), (xm - 4, y - 10), (xm + 4, y + 10), (xm + 9, y), (x1, y)]
    s.poly(zz + [(x1, y - 16), (x0, y - 16)], fill=C['hollow'], stroke='none')
    s.pline(zz, stroke=C['line'], sw=1)


def desenhar():
    s = Fig(9, 1000, 640)
    xw, yb = 420, 330                     # face externa do muro / topo da sapata
    tw = T * K
    xs = xw + tw
    xa, xc = xw - 0.45 * K, xs + 0.55 * K  # bordas da sapata (ponta à esquerda, talão sob o aterro à direita)
    xl, xr = xa - 0.15 * K, xc + 0.15 * K
    ycut = yb - HP * K
    ybot = yb + (HS + 0.12) * K
    # solo: aterro à direita da parede até o corte, e a fundação enterrada (o solo da frente no topo da sapata, como
    # na Fig. 1). Um polígono só: duas hachuras emendadas deixam costura.
    s.solo([(xl, yb), (xs, yb), (xs, ycut), (xr, ycut), (xr, ybot), (xl, ybot)])
    s.line(xl, yb, xw, yb, stroke=C['soil'], sw=2)
    with s.campo('fck_fund'):
        s.sapata(xa, yb, (xc - xa) / K, HS, K=K)
        s.text(xa + 34, yb + HS * K - 30, 'f_{ck}', size=T_SIM, anchor='start')
    # parede com a espera (gancho para o lado do solo). O graute do furo entra logo depois do retângulo da parede
    # e ANTES da espera: a applib desenha os dois na mesma chamada, então o furo é encaixado na lista nessa posição
    # (desenhado por último, cobriria a espera).
    n0 = len(s.el)
    s.parede(xw, yb, T, HP + 0.03, K=K, barra=False, espera=LB)
    s.rect(xw + CASCA * K, yb - (HP + 0.03) * K, tw - 2 * CASCA * K, (HP + 0.03) * K,
           fill=C['groutfill'], stroke=C['grout'], sw=1)
    s.el.insert(n0 + 1, s.el.pop())
    xe = xs - 0.05 * K                     # a espera da parede(): 5 cm da face do solo
    # barra do muro, rosa, ao lado da espera: o traspasse é o trecho em que as duas correm juntas. Fica à mão porque
    # a barra da parede() vai até o pé, na mesma linha da espera — aqui ela tem de correr AO LADO e parar antes.
    ylap = yb - 0.30 * K                   # topo da espera (a parede() sobe a espera 30 cm acima da sapata)
    ypb = yb - 8
    s.line(xe - 9, ycut, xe - 9, ypb, stroke=C['barra2'], sw=2.6)
    interrupcao(s, xw - 14, xs + 14, ycut)
    with s.campo('traspasse_dir'):
        s.dim_v(xs + 46, ylap, ypb, 'traspasse', side=1, ext_from=(xe + 2, xe + 2), halo=True)
    # o arranque (padrão de hoje ou nó de cachorro — Jose, 15/10) é a forma da espera dentro da sapata
    with s.campo('gancho_', 'arranque'):
        # rótulo na ponta do gancho (a parede() dobra a espera 20 cm para o lado do solo)
        s.text(xe + 0.2 * K + 12, yb + LB * K + 6, 'gancho', size=T_TXT, anchor='start', halo=True)
    with s.campo('zona_ad', 'fck_fund', 'gancho_'):
        s.dim_v(xw - 46, yb, yb + LB * K, 'ℓ_{b}', side=-1, ext_from=(xe, xe))
    s.legenda(xl, ybot + 44, [('aco', 'espera'), ('aco2', 'barra do muro'), ('graute', 'graute')])
    return s
