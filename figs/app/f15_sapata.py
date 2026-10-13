# Fig. 15 (app) — sapata corrida: corte perpendicular ao muro com todas as entradas da fundação.
# Acrescenta o que faltava na fig15 da planilha (cotas de h da sapata e do dente, a carga P no topo, δ e SPT
# na base) e tira a coluna "Verificações" (é memória de cálculo). As três posições da sapata ficam, sem a
# citação de quem fez o roteiro.
# Régua comum (12/10, applib): solo à DIREITA (antes estava à esquerda), em K_GERAL, com parede(), sapata(), solo(),
# empuxo() e sobrecarga() da applib. O talão fica sob o aterro (à direita), a ponta e o passivo na frente (à esquerda).
# "FS" deixou de rotular seta e arco (fator de segurança não é força): a base mostra a resistência R e o pé o momento
# de tombamento M_tomb, e os campos FS_desl/FS_tomb ficam no grupo deles. Símbolos da memória: h_s, b_den, h_den, P_topo,
# φ'_b, N_SPT, σ_máx/σ_mín. As miniaturas das posições ganharam título de vista no lugar da legenda em texto.
import math
from applib import Fig, C, T_SIM, T_TXT, T_PEQ, K_GERAL as K

B, A, TM, HS, HM, BD, HD = 1.4, 0.95, 0.19, 0.30, 1.4, 0.25, 0.4
HSO = HM - 0.2                          # o muro passa um pouco do aterro, como na Fig. 1
FRENTE, FUNDO, ABAIXO = 0.75, 0.95, 0.65  # quanto de solo aparece à esquerda, à direita e abaixo da base (m)


def mini(s, x, y, aa, titulo):
    """Miniatura de uma posição da sapata (esquemática, menor que K_GERAL): parede a `aa` m da borda esquerda,
    aterro à direita. As três lado a lado mostram o que o `a` faz; o desenho principal tem a cota."""
    k = 45
    with s.campo('a_ater'):
        s.titulo_vista(x, y, titulo)
        yb = y + 26 + 1.3 * k
        xw = x + aa * k
        s.solo([(xw + TM * k, yb), (x + (B + 0.35) * k, yb), (x + (B + 0.35) * k, yb - 1.15 * k), (xw + TM * k, yb - 1.15 * k)],
               topo=[(xw + TM * k, yb - 1.15 * k), (x + (B + 0.35) * k, yb - 1.15 * k)])
        s.sapata(x, yb, B, HS, K=k)
        s.parede(xw, yb, TM, 1.3, K=k, barra=False)


def desenhar():
    s = Fig(15, 1000, 640)
    x0, yb = 215, 395                   # x0 = borda da frente (ponta); yb = base da sapata
    X = lambda v: x0 + v * K
    Y = lambda v: yb - v * K
    xa = B - A                          # eixo do muro, medido da borda da frente (a é medido da borda aterrada)
    xw0, xw1 = xa - TM / 2, xa + TM / 2
    # terreno: um polígono só (a sapata e o dente são pintados por cima — duas hachuras emendadas deixam costura).
    # Solo da frente no nível do topo da sapata (é o que o passivo considera); aterro à direita até h_solo.
    s.solo([(X(-FRENTE), Y(HS)), (X(xw1), Y(HS)), (X(xw1), Y(HS + HSO)), (X(B + FUNDO), Y(HS + HSO)),
            (X(B + FUNDO), Y(-ABAIXO)), (X(-FRENTE), Y(-ABAIXO))])
    s.line(X(xw1), Y(HS + HSO), X(B + FUNDO), Y(HS + HSO), stroke=C['soil'], sw=2)
    s.line(X(-FRENTE), Y(HS), X(xw0), Y(HS), stroke=C['soil'], sw=2)
    s.text(X((xw1 + B) / 2), Y(HS + HSO * 0.62), 'solo', size=20, color=C['soil'], weight='bold', halo=True)
    # empuxo até a base da sapata, no plano vertical da borda aterrada (é nele que a conta aplica o empuxo; o solo
    # sobre o talão entra como peso)
    s.empuxo(X(B), Y(HS + HSO), Y(0), larg=105)
    # sapata + dente (o dente é concreto da sapata: mesma peça, mesmo traço)
    with s.campo('gama_c'):
        s.sapata(X(0), Y(HS), B, HS)
        s.sapata(X(B / 2 - BD / 2), Y(0), BD, HD)
        s.text(X(0.17), Y(HS / 2) + 7, 'γ_{c}', size=T_SIM)
    s.parede(X(xw0), Y(HS), TM, HM, barra=False)
    # eixo do muro: referência da cota a
    s.line(X(xa), Y(HS + HM) - 8, X(xa), Y(-HD) + 150, stroke=C['dim'], sw=0.8, extra='stroke-dasharray="6,3"')
    with s.campo('P_topo'):
        s.arrow(X(xa), Y(HS + HM) - 66, X(xa), Y(HS + HM) - 4, sw=2.6)
        s.text(X(xa) - 10, Y(HS + HM) - 36, 'P_{topo}', size=T_SIM, anchor='end', color=C['load'], weight='bold')
    with s.campo('q_est', 'q_sobre'):
        s.sobrecarga(X(xw1) + 22, X(B + FUNDO) - 12, Y(HS + HSO))
    s.text(X(xw0 / 2), Y(HS) - 10, 'ponta', size=T_PEQ, color=C['note'])
    s.text(X((xw1 + B) / 2), Y(HS) - 10, 'talão', size=T_PEQ, color=C['note'], halo=True)

    # passivo na frente: da superfície do solo da frente até o fundo do dente, no plano da ponta
    with s.campo('pass_on'):
        hp = HS + HD
        s.poly([(X(0), Y(HS)), (X(0), Y(-HD)), (X(0) - 62, Y(-HD))], fill=C['passivo_fill'], stroke=C['passivo'], sw=1.2)
        for k in (0.4, 0.65, 0.9):
            yy = HS - k * hp
            s.arrow(X(0) - 62 * k + 2, Y(yy), X(0) - 3, Y(yy), color=C['passivo'], sw=1.2, marker='arrP')
        s.text(X(0) - 70, Y(-HD) - 4, 'E_{p}', size=T_SIM, anchor='end', color=C['passivo_txt'], weight='bold', halo=True)
    # deslizamento: a resistência na base (atrito δ e adesão) empurra a sapata para o lado do solo
    yf = Y(0) + 22
    with s.campo('dphi', 'phi_base', 'ades_b', 'FS_desl'):
        s.arrow(X(0.08), yf, X(B / 2 - BD / 2 - 0.07), yf, sw=2.4)
        s.text(X((0.08 + B / 2 - BD / 2 - 0.07) / 2), yf + 26, 'R', size=T_SIM, color=C['load'], weight='bold', halo=True)
    # tombamento: giro anti-horário em torno do pé (canto da frente), por cima da ponta, fora do passivo
    with s.campo('FS_tomb'):
        cx, cy, r = X(0), Y(0), 112
        a0, a1 = math.radians(292), math.radians(232)
        p0 = (cx + r * math.cos(a0), cy + r * math.sin(a0))
        p1 = (cx + r * math.cos(a1), cy + r * math.sin(a1))
        s.path(f'M{p0[0]:.1f},{p0[1]:.1f} A{r},{r} 0 0 0 {p1[0]:.1f},{p1[1]:.1f}',
               [p0, p1, (cx + r * math.cos(math.radians(262)), cy + r * math.sin(math.radians(262)))],
               stroke=C['load'], sw=2.2, extra=f'marker-end="{s.u("arrL")}"')
        s.circle(cx, cy, 4.5, fill=C['load'])
        s.text(p1[0] - 8, p1[1] + 4, 'M_{tomb}', size=T_SIM, anchor='end', color=C['line'], halo=True)
    # solo de apoio: abaixo da base, além da borda aterrada (sob a base, o dente e as cotas dele ocupam o meio)
    with s.campo('phi_base'):
        s.text(X(B + 0.42), Y(0) + 36, 'φ\'_{b}', size=21, color=C['soil'], halo=True)
    with s.campo('SPT_b'):
        s.text(X(B + 0.42), Y(0) + 70, 'N_{SPT}', size=T_TXT, color=C['soil'], weight='bold', halo=True)
    # pressão no solo sob a base (desenhada abaixo, porque o dente ocupa o meio da base): máxima no pé
    yp = Y(-ABAIXO) + 22
    with s.campo('sig_adm_dir'):
        s.poly([(X(0), yp), (X(B), yp), (X(B), yp + 16), (X(0), yp + 46)], fill=C['empuxo2'], stroke=C['load'], sw=1.2)
        for v in (0.15, 0.5, 0.85):
            s.arrow(X(v), yp + 46 - 30 * v - 3, X(v), yp + 3, sw=1.2)
        s.text(X(0) - 8, yp + 40, 'σ_{máx}', size=T_TXT, anchor='end', color=C['load'])
        s.text(X(B) + 8, yp + 16, 'σ_{mín}', size=T_TXT, anchor='start', color=C['load'])
    # cotas
    with s.campo('a_ater'):
        s.dim_h(X(xa), X(B), yp + 84, 'a', ext_from=(yp + 70, Y(0)))
    with s.campo('B_sap'):
        s.dim_h(X(0), X(B), yp + 122, 'B', ext_from=(Y(0), Y(0)))
    with s.campo('h_sap'):
        s.dim_v(X(B) - 22, Y(HS), Y(0), 'h_{s}', side=-1, halo=True)
    with s.campo('b_den'):
        s.dim_h(X(B / 2 - BD / 2), X(B / 2 + BD / 2), Y(-HD) + 22, 'b_{den}', ext_from=(Y(-HD), Y(-HD)), off_text=24, halo=True)
    with s.campo('h_den'):
        s.dim_v(X(B / 2 + BD / 2) + 20, Y(0), Y(-HD), 'h_{den}', side=1, ext_from=(X(B / 2 + BD / 2), X(B / 2 + BD / 2)), halo=True)

    # as três posições da sapata (a pequeno, médio, grande)
    mx = X(B + FUNDO) + 90
    for i, (aa, tit) in enumerate(((B - TM, 'Para fora'), ((B - TM) / 2, 'Mista'), (0.0, 'Sob o aterro'))):
        mini(s, mx, 60 + i * 185, aa, tit)
    return s
