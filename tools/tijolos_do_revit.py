"""Perfis dos tijolos cerâmicos do Revit do Jose → app/src/modulacao/tijolos.gerado.json.

Por que existe (Jose, 13/11): o muro de cima é de tijolo baiano (cerâmico de furo horizontal), e as peças vêm do
Revit dele — "deixa isso comigo, vou fazer no Revit e exporto pra IFC". Cada tijolo do IFC é UM perfil com furos
(IfcArbitraryProfileDefWithVoids, quinas e furos arredondados em arco) extrudado no comprimento. O app usa o mesmo
perfil: a seção t × h com os furos, extrudada ao longo do muro (eixo X do modelo). Os arcos viram polilinha com
SEG_QUARTO segmentos por quarto de volta — o mesmo número dos furos do bloco de concreto (modulacao/perfis.ts),
para o tijolo não pesar mais que o bloco no 3D (sem as ranhuras, que o Jose tirou por travar até o Revit).

Uso: python tools/tijolos_do_revit.py [arquivo.ifc]   (padrão: dados/blocos_ceramicos/tijolos_9_115_14_19_revit.ifc)
Precisa do ifcopenshell (há nesta máquina; não há no notebook do Jose).
"""
import json, math, os, sys
import ifcopenshell

AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.dirname(AQUI)
ENTRADA = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dados', 'blocos_ceramicos', 'tijolos_9_115_14_19_revit.ifc')
SAIDA = os.path.join(RAIZ, 'app', 'src', 'modulacao', 'tijolos.gerado.json')
SEG_QUARTO = 6          # igual a perfis.ts


def pontos_da_curva(curva):
    """Polilinha (mm, no plano do perfil) de uma IfcCompositeCurve de retas e arcos."""
    out = []
    for seg in curva.Segments:
        c = seg.ParentCurve
        if c.is_a('IfcPolyline'):
            pts = [tuple(p.Coordinates[:2]) for p in c.Points]
        elif c.is_a('IfcTrimmedCurve') and c.BasisCurve.is_a('IfcCircle'):
            circ = c.BasisCurve
            cx, cy = circ.Position.Location.Coordinates[:2]
            ref = circ.Position.RefDirection.DirectionRatios if circ.Position.RefDirection else (1.0, 0.0)
            a0 = math.atan2(ref[1], ref[0])
            assert c.MasterRepresentation == 'PARAMETER', c
            t1 = math.radians(c.Trim1[0].wrappedValue); t2 = math.radians(c.Trim2[0].wrappedValue)
            if c.SenseAgreement:
                while t2 <= t1 + 1e-9: t2 += 2 * math.pi
            else:
                while t2 >= t1 - 1e-9: t2 -= 2 * math.pi
            n = max(1, round(abs(t2 - t1) / (math.pi / 2) * SEG_QUARTO))
            R = circ.Radius
            pts = [(cx + R * math.cos(a0 + t1 + (t2 - t1) * k / n), cy + R * math.sin(a0 + t1 + (t2 - t1) * k / n)) for k in range(n + 1)]
        else:
            raise SystemExit(f'segmento que não sei ler: {c.is_a()}')
        if not seg.SameSense:
            pts = pts[::-1]
        for p in pts:
            if not out or math.dist(out[-1], p) > 1e-6:
                out.append(p)
    if math.dist(out[0], out[-1]) < 1e-6:
        out.pop()
    return out


def area(p):
    return sum(p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1] for i in range(len(p))) / 2


def orientar(p, anti_horario):
    return p if (area(p) > 0) == anti_horario else p[::-1]


def main():
    f = ifcopenshell.open(ENTRADA)
    saida = {}
    for tipo in f.by_type('IfcBuildingElementProxyType'):
        sol = [i for i in f.traverse(tipo) if i.is_a('IfcExtrudedAreaSolid')]
        assert len(sol) == 1, tipo.Name
        prof = sol[0].SweptArea
        cont = pontos_da_curva(prof.OuterCurve)
        furos = [pontos_da_curva(c) for c in prof.InnerCurves]
        us = [p[0] for p in cont]; vs = [p[1] for p in cont]
        u0, v0 = min(us), min(vs)
        des = lambda pts: [[round(u - u0, 3), round(v - v0, 3)] for u, v in pts]
        t = round(max(us) - u0, 1); h = round(max(vs) - v0, 1)
        nome = tipo.Name.split(':')[0]                  # 'Tijolo 11,5'
        saida[nome] = {
            't': t, 'h': h, 'L': round(sol[0].Depth, 1),
            'contorno': des(orientar(cont, True)),
            'furos': [des(orientar(x, False)) for x in furos],
        }
    saida = dict(sorted(saida.items(), key=lambda kv: kv[1]['t']))
    with open(SAIDA, 'w', encoding='utf8', newline='\n') as fp:
        json.dump({'_fonte': os.path.basename(ENTRADA) + ' (Revit do Jose, 13/11) — gerado por tools/tijolos_do_revit.py', 'tijolos': saida}, fp, ensure_ascii=False)
        fp.write('\n')
    for k, v in saida.items():
        print(f"{k:12s} t {v['t']} h {v['h']} L {v['L']}  pontos {len(v['contorno'])} + furos {[len(x) for x in v['furos']]}")


if __name__ == '__main__':
    main()
