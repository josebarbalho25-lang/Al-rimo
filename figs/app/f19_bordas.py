# Fig. 19 (app, nova) — bordas laterais do painel entre contrafortes: apoiadas (Libânio tipo 21) ×
# engastadas (tipo 22). Base engastada na sapata, topo livre nos dois. Com as laterais engastadas aparece o
# momento no contraforte (M_{dxe}).
# Régua comum (12/10, applib):
#   - as bordas saem da borda() da Fig. 6, que reproduz a amostra da legenda() — antes o pente do engaste era feito
#     à mão aqui, com outro passo e outro traço, e a legenda desta figura não batia com a da Fig. 6;
#   - o painel é alvenaria ARMADA (é o painel da Fig. 13, com Ø_{v} e Ø_{h}): fica no cinza do bloco, como na
#     Fig. 13. O amarelo C['sub'] é só do painel NÃO armado (Fig. 6) — cor com um significado só;
#   - em vez de escrever "contraforte" quatro vezes e "sapata" duas, as peças aparecem desenhadas: contraforte em
#     vista (cinza C['cinza2']) dos dois lados e a sapata embaixo — o pente do engaste cai em cima da peça que
#     engasta, que é o jeito de prancha;
#   - rótulo de momento na cor da linha (vermelho é só aço).
from applib import Fig, C, K_GERAL as K
from f06_casos import borda

L_P, H_P = 1.8, 1.6      # painel-esquema (m), a K_GERAL
E_CF = 0.14              # espessura do contraforte (m)
H_SAP = 0.30             # altura da sapata (m)


def painel(s, x, y, engastadas, titulo):
    """x = face esquerda do contraforte da esquerda; y = topo do painel."""
    w, h, e = L_P * K, H_P * K, E_CF * K
    xp = x + e                                   # face esquerda do painel
    yb = y + h
    s.sapata(x - 0.12 * K, yb, L_P + 2 * E_CF + 0.24, H_SAP)
    with s.campo('lat_pan'):
        for xc in (x, xp + w):
            s.rect(xc, y, e, h, fill=C['cinza2'], stroke=C['block'], sw=1.2)
    s.rect(xp, y, w, h, fill=C['blockfill'], stroke='none')
    borda(s, xp + w, yb, xp, yb, 'engaste', (0, 1))          # base na sapata
    borda(s, xp, y, xp + w, y, 'livre', (0, -1))              # topo
    with s.campo('lat_pan'):
        tipo = 'engaste' if engastadas else 'apoio'
        borda(s, xp, yb, xp, y, tipo, (-1, 0))
        borda(s, xp + w, y, xp + w, yb, tipo, (1, 0))
        if engastadas:
            s.text(xp + 12, y + h * 0.42, 'M_{dxe}', size=18, anchor='start', color=C['line'], weight='bold', halo=True)
            s.text(xp + w - 12, y + h * 0.42, 'M_{dxe}', size=18, anchor='end', color=C['line'], weight='bold', halo=True)
        s.titulo_vista(x, y - 30, titulo)


def desenhar():
    s = Fig(19, 1000, 640)
    y0 = 170
    larg = (L_P + 2 * E_CF) * K
    painel(s, 80, y0, False, 'Laterais apoiadas')
    painel(s, 80 + larg + 110, y0, True, 'Laterais engastadas')
    s.legenda(80, y0 + H_P * K + H_SAP * K + 52, [('apoio', 'apoiada'), ('engaste', 'engastada'), ('livre', 'livre')])
    return s
