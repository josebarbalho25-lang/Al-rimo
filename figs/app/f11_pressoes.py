# Fig. 11 (app) — pressões no muro (Rankine): sem coesão, com coesão e com água. Saem as frases de
# conselho ("use só com ensaio", "drenagem eficiente evita..."): o aviso do solo já está no topo das Entradas.
from applib import Fig, C, T_TIT, T_TXT, T_PEQ

Y0, HP = 130, 340
K = 9.0


def eixo(s, x, titulo, formula, campos_titulo, dx_rot=10):
    with s.campo(*campos_titulo):
        s.text(x + 100, Y0 - 62, titulo, size=T_TIT, weight='bold')
    s.text(x + 100, Y0 - 32, formula, size=T_TXT, color=C['note'])
    s.line(x, Y0, x, Y0 + HP, stroke=C['line'], sw=2.6)
    s.line(x - 30, Y0, x + 230, Y0, stroke=C['soil'], sw=1.6)
    s.text(x - dx_rot, Y0 + HP + 6, 'base', size=T_TXT, anchor='end', color=C['note'])
    s.text(x - dx_rot, Y0 + 14, 'topo', size=T_TXT, anchor='end', color=C['note'])


def desenhar():
    s = Fig(11, 1000, 560)
    # (a) c' = 0
    xa = 80
    eixo(s, xa, "c' = 0", "σ'_{h} = K_{a}·(q + γ·z)", ['c_solo'])
    with s.campo('Ka_dir'):
        s.poly([(xa, Y0), (xa + 0.8 * K, Y0), (xa + 16 * K, Y0 + HP), (xa, Y0 + HP)], fill=C['empuxo'], stroke=C['load'], sw=1.4)
    with s.campo('q_sobre'):
        s.text(xa + 0.8 * K + 8, Y0 + 20, 'K_{a}·q', size=T_TXT, anchor='start', color=C['load'])
    # (b) c' > 0
    xb = 395
    eixo(s, xb, "c' > 0", "σ'_{h} = K_{a}·σ'_{v} − 2c'·√K_{a}", ['c_solo'], dx_rot=46)
    z0 = 0.35 * HP
    with s.campo('c_solo'):
        s.poly([(xb, Y0), (xb - 4 * K, Y0), (xb, Y0 + z0)], fill='none', stroke=C['load'], sw=1.4, extra='stroke-dasharray="5,4"')
        s.poly([(xb, Y0 + z0), (xb + 10 * K, Y0 + HP), (xb, Y0 + HP)], fill=C['empuxo'], stroke=C['load'], sw=1.4)
        s.dim_v(xb + 110, Y0, Y0 + z0, 'z_{0}', side=1, ext_from=(xb, xb))
        s.text(xb - 4 * K - 6, Y0 + 66, 'tração', size=T_PEQ, anchor='end', color=C['load'])
        s.text(xb - 4 * K - 6, Y0 + 84, 'desprezada', size=T_PEQ, anchor='end', color=C['load'])
    # (c) com NA
    xc = 705
    eixo(s, xc, 'com NA', "σ_{h} = σ'_{h} + u", ['Agua'])
    zna = 0.4 * HP
    s.poly([(xc, Y0), (xc + 0.8 * K, Y0), (xc + 7 * K, Y0 + zna), (xc + 10.5 * K, Y0 + HP), (xc, Y0 + HP)], fill=C['empuxo'], stroke=C['load'], sw=1.4)
    with s.campo('Agua', 'gama_w'):
        s.poly([(xc + 7 * K, Y0 + zna), (xc + 10.5 * K, Y0 + HP), (xc + 16.5 * K, Y0 + HP)], fill=C['groutfill'], stroke=C['water'], sw=1.4)
    with s.campo('gama_w'):
        s.text(xc + 17 * K, Y0 + HP - 12, 'u = γ_{w}·(z − z_{NA})', size=T_TXT, anchor='start', color=C['water'])
    with s.campo('z_NA', 'Agua'):
        s.line(xc - 30, Y0 + zna, xc + 230, Y0 + zna, stroke=C['water'], sw=1.6, extra='stroke-dasharray="9,6"')
        s.poly([(xc + 196, Y0 + zna - 15), (xc + 212, Y0 + zna - 15), (xc + 204, Y0 + zna - 2)], fill=C['water'], stroke='none')
        s.text(xc + 218, Y0 + zna - 6, 'NA', size=T_TXT, anchor='start', color=C['water'], weight='bold')
        s.dim_v(xc + 262, Y0, Y0 + zna, 'z_{NA}', side=1, ext_from=(xc + 232, xc + 232))
    return s
