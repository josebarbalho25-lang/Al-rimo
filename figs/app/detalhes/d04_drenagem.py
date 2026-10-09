# Detalhe 4 — barbacã e dreno no tardoz: corte vertical do muro junto à sapata (embaixo) e no topo do dreno (em
# cima), com o trecho do meio interrompido.
#
# O que vem do app (app/src/modulacao/entorno.ts, mesma montagem da Fig. 17):
#   - barbacã de Ø (entrada) na 1ª fiada, atravessando o bloco inteiro numa célula SEM graute, ponta rente às duas
#     faces, no meio da altura do bloco (1 cm de junta + 19/2);
#   - dreno de brita de espessura e no tardoz, do topo da sapata até `folga` abaixo do topo do solo; manta só na face
#     do lado do solo e no topo do dreno (o lado do muro fica aberto: é por ali que a água chega ao barbacã);
#   - impermeabilização do tardoz do topo da sapata até a altura de solo (quantitativo);
#   - bloco inteiro com paredes de 3,2 (Revit do Jose); juntas de 1 cm só nas paredes.
# DEDUÇÃO: o caimento do barbacã para fora (o app modela o tubo na horizontal; a Fig. 17 já o desenha caindo) —
# valor não definido, desenhado com 1,5 cm na espessura do bloco. Proporções do desenho, não resultado de conta:
# e = 20, folga = 30, Ø = 5, altura de solo 130.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from iso import Det  # noqa: E402
from corte import Corte, FAMILIA, interrupcao  # noqa: E402
from applib import C, T_TIT, T_TXT, T_PEQ  # noqa: E402

K = 5.0
E, FOLGA, H_SOLO = 20.0, 30.0, 130.0
PHI_B = 5.0
QUEDA = 1.5                  # DEDUÇÃO (ver cabeçalho)
SOBRA = 25.0                 # solo desenhado além do dreno
Y_ESQ = -22.0                # sapata desenhada à frente do muro
Z_BAIXO, Z_CORTE1 = -16.0, 46.0       # janela de baixo
Z_CORTE2, Z_ALTO = 84.0, 152.0        # janela de cima
VAO = 44                     # px entre as duas janelas

VARIANTES = {'b14': FAMILIA['b14'], 'b19': FAMILIA['b19']}

MANTA = dict(stroke=C['passivo'], sw=2.2, extra='stroke-dasharray="7,4"')
IMPER = dict(stroke=C['line'], sw=3.4)


def muro(cc, f, z0, z1):
    """Paredes e juntas do muro entre z0 e z1, cortado por uma célula vazia (a do barbacã)."""
    t, par = f['t'], f['parede']
    cc.ret(par, z0, t - par, z1, fill=C['hollow'], stroke='none')
    zf = math.floor(z0 / 20) * 20
    while zf < z1:
        if zf >= z0:
            cc.argamassa(f, zf)
        a, b = max(zf + 1, z0), min(zf + 20, z1)
        if b > a:
            cc.bloco_no_furo(f, a, b, miolo='vazio')
        zf += 20


def desenhar(var):
    f = VARIANTES[var]
    t, par = f['t'], f['parede']
    s = Det('det04' + var, 1000, 800)
    yd = t + E                    # face do dreno do lado do solo
    ydir = yd + SOBRA
    zt = H_SOLO - FOLGA           # topo do dreno
    cb = Corte(s, 0, 0, K)                                        # janela de baixo
    ca = Corte(s, 0, cb.Y(Z_CORTE1) - VAO, K, ref=(0, Z_CORTE2))  # janela de cima
    # ================= janela de baixo =================
    P, X, Y = cb.P, cb.X, cb.Y
    cb.ret(Y_ESQ, Z_BAIXO, ydir, 0, fill=s.CONC, stroke='none')
    cb.line(Y_ESQ, 0, ydir, 0, stroke=C['line'], sw=1.4)
    cb.ret(yd, 0, ydir, Z_CORTE1, fill=s.SOLO, stroke='none')
    cb.ret(t, 0, yd, Z_CORTE1, fill=s.BRITA, stroke='none')
    cb.line(yd, 0, yd, Z_CORTE1, **MANTA)
    muro(cb, f, 0, Z_CORTE1)
    # barbacã: tubo cortado ao longo do eixo, caindo para fora
    zc = 1.0 + 19.0 / 2
    zi, zo = zc + QUEDA / 2, zc - QUEDA / 2
    h = PHI_B / 2 * math.hypot(t, QUEDA) / t
    cb.poly([(t, zi + h), (0, zo + h), (0, zo - h), (t, zi - h)], fill=C['hollow'], stroke='none')
    for dz in (h, -h):
        cb.line(0, zo + dz, t, zi + dz, stroke=C['line'], sw=2.2)
    # impermeabilização no tardoz (furada pelo barbacã)
    cb.line(t + 0.3, 0, t + 0.3, zi - h - 0.3, **IMPER)
    cb.line(t + 0.3, zi + h + 0.3, t + 0.3, Z_CORTE1, **IMPER)
    # interrupções
    interrupcao(s, P(Y_ESQ, 3), P(Y_ESQ, Z_BAIXO - 3))
    interrupcao(s, P(Y_ESQ - 3, Z_BAIXO), P(ydir + 3, Z_BAIXO))
    interrupcao(s, P(ydir, Z_CORTE1 + 3), P(ydir, Z_BAIXO - 3))
    interrupcao(s, P(-3, Z_CORTE1), P(ydir + 3, Z_CORTE1))
    # água saindo
    a, b = P(-0.6, zo - 0.6), P(-6.5, zo - 5.0)
    s.arrow(a[0], a[1], b[0], b[1], color=C['water'], sw=1.8, marker='arrA')
    # ================= janela de cima =================
    Pa, Xa, Ya = ca.P, ca.X, ca.Y
    ca.poly([(t, zt), (yd, zt), (yd, Z_CORTE2), (ydir, Z_CORTE2), (ydir, H_SOLO), (t, H_SOLO)], fill=s.SOLO, stroke='none')
    ca.line(t, H_SOLO, ydir, H_SOLO, stroke=C['soil'], sw=2)
    ca.ret(t, Z_CORTE2, yd, zt, fill=s.BRITA, stroke='none')
    ca.pline([(t, zt), (yd, zt), (yd, Z_CORTE2)], **MANTA)
    muro(ca, f, Z_CORTE2, Z_ALTO)
    ca.line(t + 0.3, Z_CORTE2, t + 0.3, H_SOLO, **IMPER)
    interrupcao(s, Pa(-3, Z_CORTE2), Pa(ydir + 3, Z_CORTE2))
    interrupcao(s, Pa(ydir, H_SOLO + 3), Pa(ydir, Z_CORTE2 - 3))
    interrupcao(s, Pa(-3, Z_ALTO), Pa(t + 3, Z_ALTO))
    # ================= cotas =================
    s.dim_h(Xa(t), Xa(yd), Ya(zt) - 22, 'e', ext_from=(Ya(zt), Ya(zt)), size=T_TXT, halo=True)
    s.dim_v(Xa(ydir) + 26, Ya(H_SOLO), Ya(zt), 'folga', side=1, ext_from=(Xa(ydir), Xa(yd)), size=T_TXT)
    # ================= rótulos =================
    xl = X(Y_ESQ) - 34
    q = P(par / 2, 17)
    s.chamada(q[0], q[1], xl, Y(36), '1ª fiada', anchor='end')
    q = P(1.2, zo + h * 0.2)
    s.chamada(q[0], q[1], xl, Y(18), 'barbacã Ø', anchor='end')
    s.text(b[0] - 6, b[1] + 6, 'caimento', size=T_PEQ, anchor='end', color=C['water'], halo=True)
    q = Pa(t / 2, 112)
    s.chamada(q[0], q[1], xl, q[1] + 6, 'célula sem graute', anchor='end')
    s.text(Xa(-4), Ya(140), 'face externa', size=T_PEQ, anchor='end', color=C['note'])
    xr = X(ydir) + 40
    q = P(t + E * 0.55, 30)
    s.chamada(q[0], q[1], xr, q[1] + 6, 'dreno (brita)', anchor='start')
    q = P(yd, 14)
    s.chamada(q[0], q[1], xr, q[1] + 6, 'manta', color=C['passivo_txt'], anchor='start')
    q = Pa(t + 0.3, 92)
    s.chamada(q[0], q[1], xr, Ya(92) + 6, 'impermeabilização', anchor='start')
    s.text(X(yd + SOBRA / 2), Y(40), 'solo', size=T_TXT, color=C['soil'], weight='bold', halo=True)
    bb = list(s.caixa)
    s.text(bb[0], bb[1] - 30, 'corte', size=T_TIT, anchor='start', weight='bold')
    return s


if __name__ == '__main__':
    for k in VARIANTES:
        print(k, len(desenhar(k).svg()))
