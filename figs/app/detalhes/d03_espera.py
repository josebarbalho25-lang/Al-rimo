# Detalhe 3 — espera da sapata no furo grauteado: corte vertical da base do muro sobre a sapata.
#
# O que vem do app (app/src/modulacao/armaduras.ts e barras.ts, que seguem a planilha e a NBR 6118):
#   - uma espera por barra vertical, do mesmo Ø, AO LADO dela no mesmo furo (emenda por contato), do pé até
#     ℓ traspasse acima da sapata; a barra do muro nasce no topo da sapata;
#   - o pé da espera apoia na malha da sapata (cobrimento c + Ø transversal + Ø longitudinal) e dobra 90° para o
#     lado do solo (Fig. 1 e 9); pino de dobra D = 5φ (φ < 20) ou 8φ (φ ≥ 20) — NBR 6118 Tab. 9.1, CA-50;
#   - o que o app confere: altura útil na sapata (h_s − c − Ø − Ø) ≥ ℓb — é a cota ℓb da Fig. 9;
#   - bloco inteiro com paredes de 3,2 (14x39 e 19x39, Revit do Jose); 1ª fiada sobre 1 cm de argamassa.
# Cores e posição como na Fig. 9 do app: espera em vermelho escuro, do lado do solo; barra do muro em vermelho claro.
#
# (esquema) A FORMA da ancoragem: o Jose vai modelar no Revit a dele ("nó de cachorro"); até lá vai a dobra em L.
# DEDUÇÃO (proporção do desenho, não resultado de conta): h_s = 30, c = 4, Ø 10 (D = 5), ℓ traspasse = 50φ,
# ponta reta da dobra 8φ (gancho de 90° da NBR 6118 9.4.2.3, que o app usa), graute de 1,5 entre barra e parede.
# As barras aparecem lado a lado no corte para as duas ficarem visíveis (no balanço o app põe a espera ao lado ao
# longo do muro — no corte transversal ela ficaria atrás da barra).
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from iso import Det, tom  # noqa: E402
from corte import Corte, FAMILIA, interrupcao  # noqa: E402
from applib import C, T_TIT, T_TXT, T_PEQ  # noqa: E402

K = 7.0            # px por cm
HS, COB = 30.0, 4.0
PHI, PHI_S, PHI_S2 = 1.0, 1.0, 0.63
D = 5 * PHI        # pino (φ < 20)
R = D / 2 + PHI / 2
PONTA = 8 * PHI
LT = 50 * PHI      # traspasse
Z_TOPO = 66.0      # onde o desenho do muro é interrompido
Y_ESQ = -24.0      # sapata desenhada de Y_ESQ a t + SOBRA_DIR
SOBRA_DIR = 44.0

VARIANTES = {'b14': FAMILIA['b14'], 'b19': FAMILIA['b19']}


def desenhar(var):
    f = VARIANTES[var]
    t, par = f['t'], f['parede']
    s = Det('det03' + var, 1000, 700)
    cc = Corte(s, 0, 0, K)
    P, X, Y = cc.P, cc.X, cc.Y
    y_dir = t + SOBRA_DIR
    # ---- sapata (trecho; continua dos dois lados) ----
    cc.ret(Y_ESQ, -HS, y_dir, 0, fill=s.CONC, stroke='none')
    cc.line(Y_ESQ, 0, y_dir, 0, stroke=C['line'], sw=1.4)
    cc.line(Y_ESQ, -HS, y_dir, -HS, stroke=C['line'], sw=1.4)
    for yq in (Y_ESQ, y_dir):
        interrupcao(s, P(yq, 3), P(yq, -HS - 3))
    # malha: transversal (no plano do corte) e longitudinais (pontos) por cima
    z_tr = -HS + COB + PHI_S / 2
    z_lg = -HS + COB + PHI_S + PHI_S2 / 2
    cc.line(Y_ESQ + 2, z_tr, y_dir - 2, z_tr, stroke=C['steel'], sw=PHI_S * K * 0.75)
    y_e = t - par - 1.5 - PHI / 2          # espera: do lado do solo, 1,5 de graute até a parede
    y_b = y_e - PHI                        # barra do muro encostada nela
    yy = Y_ESQ + 6
    while yy < y_dir - 3:
        if abs(yy - y_e) > 2.5:
            q = P(yy, z_lg)
            s.circle(q[0], q[1], max(2.8, PHI_S2 / 2 * K))
        yy += 12
    # ---- muro: argamassa, blocos cortados pelo furo, graute ----
    cc.ret(par, 0, t - par, Z_TOPO, fill=C['groutfill'], stroke='none')
    z = 0.0
    while z < Z_TOPO:
        cc.argamassa(f, z)
        cc.bloco_no_furo(f, z + 1, min(z + 20, Z_TOPO), miolo='nada')
        z += 20
    interrupcao(s, P(-2, Z_TOPO), P(t + 2, Z_TOPO))
    # ---- barras ----
    zpe = -HS + COB + PHI_S + PHI_S2 + PHI / 2
    xe = X(y_e)
    a, b = P(y_e, zpe + R), P(y_e + R, zpe)
    fim = P(y_e + R + PONTA, zpe)
    d = (f'M{xe:.2f},{Y(LT):.2f} L{a[0]:.2f},{a[1]:.2f} A{R * K:.2f},{R * K:.2f} 0 0 0 {b[0]:.2f},{b[1]:.2f} '
         f'L{fim[0]:.2f},{fim[1]:.2f}')
    s.path(d, [(xe, Y(LT)), a, b, fim], stroke=C['steel'], sw=PHI * K, extra='stroke-linecap="butt"')
    cc.line(y_b, 0, y_b, Z_TOPO - 1, stroke=C['barra2'], sw=PHI * K, extra='stroke-linecap="butt"')
    # pino de dobra (ferramenta): círculo tracejado no canto de dentro da dobra
    cx, cy = P(y_e + R, zpe + R)
    s.add(f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{D / 2 * K:.2f}" fill="none" stroke="{C["dim"]}" stroke-width="1.2" stroke-dasharray="3 2"/>')
    s.dim_h(X(y_e + PHI / 2), X(y_e + PHI / 2 + D), Y(zpe + R + D / 2) - 12, 'D', ext_from=(cy, cy), size=T_TXT, halo=True)
    xn, yn = X(y_e + R + PONTA) + 16, Y(zpe + R + D / 2) - 12
    for k, txt in enumerate(('D = 5φ  (φ < 20 mm)', 'D = 8φ  (φ ≥ 20 mm)', 'NBR 6118 Tab. 9.1 · CA-50')):
        s.text(xn, yn + k * 21, txt, size=T_PEQ, anchor='start', color=C['dim'], halo=True)
    # ---- cotas ----
    s.dim_v(X(t + 9), Y(0), Y(LT), 'ℓ traspasse', side=1, ext_from=(X(t), X(y_e)), size=T_TXT)
    s.dim_v(X(y_dir) + 24, Y(-HS), Y(0), 'h_{s}', side=1, ext_from=(X(y_dir) + 8, X(y_dir) + 8))
    xc = X(Y_ESQ) - 24
    s.dim_v(xc, Y(-HS), Y(-HS + COB), 'c', side=-1, ext_from=(X(Y_ESQ) - 8, X(Y_ESQ + 2)), size=T_TXT)
    s.dim_v(xc, Y(zpe - PHI / 2), Y(0), 'ℓ_{b}', side=-1, ext_from=(xe, X(Y_ESQ) - 8), size=T_TXT)
    # ---- rótulos ----
    xl = xc - 40
    cor_e, cor_b = C['steel'], tom(C['barra2'], -0.3)
    q = P(y_b, 58)
    s.chamada(q[0], q[1], xl, q[1] + 6, 'barra do muro', color=cor_b, anchor='end')
    q = P((par + y_b - PHI / 2) / 2, 44)
    s.chamada(q[0], q[1], xl, q[1] + 6, 'graute', color=C['grout'], anchor='end')
    q = P(y_e, 28)
    s.chamada(q[0], q[1], xl, q[1] + 6, 'espera', color=cor_e, anchor='end')
    s.text(xl, q[1] + 28, '(esquema)', size=T_PEQ, color=cor_e, anchor='end')
    q = P(par / 2, 7)
    s.chamada(q[0], q[1], xl, q[1] + 6, '1ª fiada', anchor='end')
    s.text(X((Y_ESQ + 0) / 2) - 6, Y(-HS / 2) + 6, 'sapata', size=T_TXT, color=C['note'], halo=True)
    s.text(X(t + 22), Y(36), 'solo', size=T_TXT, color=C['soil'], weight='bold', anchor='start')
    s.text(X(-3), Y(2.5), 'face externa', size=T_PEQ, color=C['note'], anchor='end')
    bb = list(s.caixa)
    s.text(bb[0], bb[1] - 30, 'corte', size=T_TIT, anchor='start', weight='bold')
    return s


if __name__ == '__main__':
    for k in VARIANTES:
        print(k, len(desenhar(k).svg()))
