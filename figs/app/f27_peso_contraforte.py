# Fig. 27 (app) — PESO PRÓPRIO DO CONTRAFORTE (Jose, 13/10: "tem só do contraforte e só da parede"; "contraforte
# sempre grauteado, independente do que aconteça"). É a figura do campo "γ do contraforte": o contraforte é bloco com
# TODOS os furos cheios de graute, então pesa γ = 22·Aliq/Abr + 24·(1 − Aliq/Abr) por m³ (a conta e a fonte vão na
# memória). A parede fica apagada atrás: ela pesa pela Fig. 26, com a grade do graute dela.
#   - planta com o solo em cima (contraforte enterrado, como o padrão), bloco 19 e t_enr 59 (os padrões do 19);
#   - o furo da parede debaixo do contraforte também é grauteado (é a célula de amarração);
#   - cotas e_enr (= t) e t_enr, os símbolos da memória do contraforte.
# Escala K_BLOCO (6 px/cm), a mesma das plantas de bloco (Figs. 2, 3, 4 e 14).
from applib import Fig, C, K_BLOCO

K = K_BLOCO / 100
T, L, HF = 19, 39, 3.5
LH = (L - 3 * HF) / 2
TEN = 59               # t_enr: da face de fora da parede à ponta do contraforte


def furos_do_bloco(s, x, y, deitado, cheios, apagado=False):
    """Os dois furos de um bloco cujo canto é (x, y): deitado = ao longo de x (parede), senão ao longo de y."""
    for i, a in enumerate((HF, 2 * HF + LH)):
        g = cheios[i]
        fx, fy, fw, fh = (x + a * K, y + HF * K, LH * K, (T - 2 * HF) * K) if deitado else \
                         (x + HF * K, y + a * K, (T - 2 * HF) * K, LH * K)
        s.rect(fx, fy, fw, fh, fill=C['groutfill'] if g else C['hollow'],
               stroke=C['grout'] if g else (C['cinza2'] if apagado else C['block']), sw=1.0, extra='rx="4"')


def desenhar():
    s = Fig(27, 1000, 640)
    x0, y0 = 140, 400                  # canto esquerdo da parede, face do SOLO (a de cima)
    s.titulo_vista(x0, 90, 'Planta')
    xc = x0 + (40 + HF + LH / 2) * K   # eixo do contraforte: o 1º furo do bloco do meio
    ponta = y0 - (TEN - T) * K         # ponta do contraforte, dentro do solo
    # solo em cima da parede, dos dois lados do contraforte
    s.solo([(x0 - 10, ponta - 40), (x0 + 120 * K + 10, ponta - 40), (x0 + 120 * K + 10, y0), (x0 - 10, y0)])
    # a parede, apagada (pesa pela Fig. 26): três blocos, só o furo da amarração grauteado
    for b in range(3):
        xb = x0 + b * 40 * K
        s.rect(xb, y0, L * K, T * K, fill=C['claro'], stroke=C['cinza2'], sw=1.0, extra='stroke-dasharray="6,3"')
        furos_do_bloco(s, xb, y0, True, (b == 1, False), apagado=True)
    with s.campo('gama_cf'):
        # o bloco do contraforte, de pé (ao longo de y), com os dois furos cheios; junta de 1 cm até a parede
        yb = y0 - 40 * K
        s.rect(xc - T / 2 * K, yb, T * K, L * K, fill=C['blockfill'], stroke=C['line'], sw=1.4)
        furos_do_bloco(s, xc - T / 2 * K, yb, False, (True, True))
        # a célula da amarração, na parede, com o contorno do contraforte (é dele)
        s.rect(xc - T / 2 * K, y0, T * K, T * K, fill='none', stroke=C['line'], sw=1.4)
    # cotas: e_enr em cima da ponta; t_enr da face de fora da parede à ponta, à direita da parede
    s.dim_h(xc - T / 2 * K, xc + T / 2 * K, ponta - 18, 'e_{enr}', ext_from=(ponta, ponta))
    xd = x0 + 120 * K + 34            # depois do fim da parede: a cota não passa por cima do bloco
    s.dim_v(xd, ponta, y0 + T * K, 't_{enr}', side=1, ext_from=(xc + T / 2 * K, x0 + 120 * K))
    s.legenda(x0, y0 + T * K + 80, [('bloco', 'bloco'), ('graute', 'graute (todos os furos do contraforte)')])
    return s
