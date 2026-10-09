# -*- coding: utf-8 -*-
"""validar_ifc.py — confere um .ifc gerado pelo app Al-rimo com o ifcopenshell (0.8.5).

    python -I tools/validar_ifc.py arquivo.ifc [--regras] [--geom | --geom-tudo] [--amostra N] [--json]

  --regras     roda também as regras WHERE do EXPRESS (CorrectItemsForType, CorrectPredefinedType, GUID...)
  --geom       monta o sólido de uma AMOSTRA de produtos (N por grupo classe:ObjectType, padrão 3)
  --geom-tudo  monta o sólido de todos os produtos e devolve caixa e volume de cada um, por Tag
  --furos      graute de cada furo no VAZIO do bloco dono (Tag 'peça.gN'); canaleta com fundo cheio e miolo vazio
  --json       imprime o relatório em JSON (UTF-8) para o teste do app ler

Sai com código 0 se não houver erro, 1 se houver, 2 se nem abrir o arquivo.
Rodar SEMPRE com `python -I` (não carrega módulo da pasta atual nem da pasta do arquivo).

O que confere, e por quê (cada item já derrubou um arquivo de verdade — ver scratchpad/entender/ifc.md):
  1. esquema IFC4: tipos, cardinalidade, atributos obrigatórios; com --regras, as regras WHERE;
  2. GUID: 22 caracteres, 1º em 0..3, ida e volta compress(expand(g)) == g, sem repetição;
  3. estrutura: elemento contido E agregado ao mesmo tempo (o validate do ifcopenshell NÃO pega), elemento solto,
     parte USERDEFINED sem ObjectType;
  4. nomes lidos de volta (o teste compara com o que foi gravado: acento em UTF-8 cru passa no esquema mas o
     ifcopenshell apaga a letra);
  5. geometria: o sólido monta; caixa e volume por grupo; comprimento da diretriz de cada barra (somando retas e
     ARCOS — o volume da malha do IfcSweptDiskSolid com dobra não serve para conferir barra, medido).
  6. com --furos, a ORIENTAÇÃO das peças: caixa e volume certos não provam que o furo está do lado certo (o bloco de
     34 e o de 54 têm furos de tamanhos diferentes, a ponta direita é a esquerda girada 180°, a haste gira 90°/270°).
     O graute de cada furo tem de cair no vazio do bloco dono, e a canaleta tem de abrir para cima.
"""
import sys, os, json, time, math, logging, collections, types

sys.stdout.reconfigure(encoding='utf-8')   # no Windows o padrão é cp1252: "Ø10" quebraria o JSON lido pelo Node


def _pytest_minimo():
    """As regras WHERE do ifcopenshell importam `_pytest.assertion.rewrite` só para pôr o texto do assert na
    mensagem. O pytest não está instalado nesta máquina (e não é dependência do projeto): sem ele as regras não
    rodam. Este substituto faz só isso — reescreve `assert x` para `assert x, "x"` — e só entra se faltar o real."""
    try:
        import _pytest.assertion.rewrite  # noqa: F401
        return
    except ImportError:
        pass
    import ast

    def rewrite_asserts(mod, source=None, **kw):
        for node in ast.walk(mod):
            if isinstance(node, ast.Assert) and node.msg is None:
                node.msg = ast.Constant(ast.unparse(node.test))
        ast.fix_missing_locations(mod)

    raiz = types.ModuleType('_pytest')
    assertion = types.ModuleType('_pytest.assertion')
    rewrite = types.ModuleType('_pytest.assertion.rewrite')
    rewrite.rewrite_asserts = rewrite_asserts
    assertion.rewrite = rewrite
    raiz.assertion = assertion
    raiz.__path__ = []
    assertion.__path__ = []
    sys.modules.update({'_pytest': raiz, '_pytest.assertion': assertion, '_pytest.assertion.rewrite': rewrite})


def comprimento_da_curva(curva):
    """Comprimento de IfcIndexedPolyCurve (retas + arcos de 3 pontos) ou IfcPolyline, em unidades do arquivo."""
    if curva.is_a('IfcPolyline'):
        pts = [p.Coordinates for p in curva.Points]
        return sum(math.dist(a, b) for a, b in zip(pts, pts[1:]))
    if not curva.is_a('IfcIndexedPolyCurve'):
        return None
    pts = curva.Points.CoordList
    if not curva.Segments:
        return sum(math.dist(a, b) for a, b in zip(pts, pts[1:]))
    total = 0.0
    for seg in curva.Segments:
        idx = [i - 1 for i in seg.wrappedValue]
        if seg.is_a('IfcLineIndex'):
            total += sum(math.dist(pts[a], pts[b]) for a, b in zip(idx, idx[1:]))
        else:   # IfcArcIndex: início, ponto do meio, fim → círculo pelos 3 pontos
            a, m, b = (pts[i] for i in idx)
            ab, am, mb = math.dist(a, b), math.dist(a, m), math.dist(m, b)
            # raio do círculo circunscrito: R = abc / (4·área)
            s = (ab + am + mb) / 2
            area = math.sqrt(max(s * (s - ab) * (s - am) * (s - mb), 0.0))
            if area < 1e-15:
                total += ab
                continue
            R = ab * am * mb / (4 * area)
            # ângulo central: soma dos ângulos das duas cordas (o meio está sobre o arco)
            ang = 2 * math.asin(min(1.0, am / (2 * R))) + 2 * math.asin(min(1.0, mb / (2 * R)))
            total += R * ang
    return total


def disco_da_barra(el):
    """IfcSweptDiskSolid do corpo da barra, atravessando IfcMappedItem se houver."""
    if not el.Representation:
        return None
    pilha = list(el.Representation.Representations)
    while pilha:
        rep = pilha.pop(0)
        for it in rep.Items:
            if it.is_a('IfcSweptDiskSolid'):
                return it
            if it.is_a('IfcMappedItem'):
                pilha.append(it.MappingSource.MappedRepresentation)
    return None


def dentro_da_malha(np, tri, P):
    """Ponto dentro de malha fechada: paridade dos cruzamentos de um raio torto (Möller–Trumbore em todos os
    triângulos de uma vez). Raio fora dos eixos para não passar por aresta de peça alinhada."""
    v0, e1, e2 = tri
    d = np.array([0.5773, 0.5012, 0.6448])
    d = d / np.linalg.norm(d)
    h = np.cross(d, e2)
    a = np.einsum('ij,ij->i', e1, h)
    ok = np.abs(a) > 1e-15
    f = np.where(ok, 1.0 / np.where(ok, a, 1.0), 0.0)
    s_ = P - v0
    u = f * np.einsum('ij,ij->i', s_, h)
    q = np.cross(s_, e1)
    w = f * (q @ d)
    t = f * np.einsum('ij,ij->i', e2, q)
    return int((ok & (u >= 0) & (u <= 1) & (w >= 0) & (u + w <= 1) & (t > 1e-12)).sum()) % 2 == 1


def conferir_furos(f, rel):
    """Graute do furo no vazio do bloco dono; canaleta com fundo cheio e miolo vazio (ver item 6 do cabeçalho)."""
    import re
    import numpy as np
    import ifcopenshell.geom, ifcopenshell.util.shape as US
    st = ifcopenshell.geom.settings()
    st.set('use-world-coords', True)
    malhas = {}
    for p in f.by_type('IfcBuildingElementPart'):
        if not p.Representation or not p.Tag:
            continue
        try:
            sh = ifcopenshell.geom.create_shape(st, p)
        except Exception as ex:
            rel['erros'].append('furos: geom falhou em %s: %s' % (p.Tag, ex))
            continue
        v = np.array(US.get_vertices(sh.geometry), float)
        fa = np.array(US.get_faces(sh.geometry), int)
        if not len(v) or not len(fa):
            continue
        T = v[fa]
        malhas[p.Tag] = (p.ObjectType, v.min(0), v.max(0), (T[:, 0], T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]))
    n_graute = n_canaleta = 0
    for tag, (tipo, mn, mx, tri) in malhas.items():
        if tipo == 'GRAUTE_FURO':
            m = re.match(r'^(.*)\.g\d+$', tag)
            dono = malhas.get(m.group(1)) if m else None
            if not dono:
                rel['erros'].append('furos: graute %s sem bloco dono' % tag)
                continue
            c = (mn + mx) / 2
            a = (mx - mn) / 2
            c[2] = (dono[1][2] + dono[2][2]) / 2          # meia altura do bloco (o graute desce a junta de baixo)
            for dx, dy in ((0, 0), (0.6, 0), (-0.6, 0), (0, 0.6), (0, -0.6)):
                P = c + np.array([dx * a[0], dy * a[1], 0.0])
                if dentro_da_malha(np, dono[3], P):
                    rel['erros'].append('furos: graute %s cai na parede do bloco %s em %s' % (tag, m.group(1), [round(float(x), 4) for x in P]))
                    break
            n_graute += 1
        elif tipo in ('CANALETA', 'MEIA_CANALETA', 'CANALETA_CORTADA'):
            c = (mn + mx) / 2
            if not dentro_da_malha(np, tri, np.array([c[0], c[1], mn[2] + 0.01])):
                rel['erros'].append('furos: canaleta %s sem fundo' % tag)
            if dentro_da_malha(np, tri, np.array([c[0], c[1], mx[2] - 0.01])):
                rel['erros'].append('furos: canaleta %s com o miolo cheio (de cabeça para baixo?)' % tag)
            n_canaleta += 1
    rel['furos'] = {'graute': n_graute, 'canaletas': n_canaleta}


def chave_do_grupo(el):
    return el.is_a() + ':' + (el.ObjectType or el.Name or '')


def main(argv):
    if len(argv) < 2 or argv[1].startswith('--'):
        print(__doc__)
        return 2
    caminho = argv[1]
    REGRAS = '--regras' in argv
    GEOM_TUDO = '--geom-tudo' in argv
    GEOM = GEOM_TUDO or '--geom' in argv
    AMOSTRA = int(argv[argv.index('--amostra') + 1]) if '--amostra' in argv else 3
    rel = {'arquivo': caminho, 'ok': False, 'erros': [], 'avisos': []}

    def saida(codigo):
        rel['ok'] = not rel['erros'] and codigo == 0
        if '--json' in argv:
            print(json.dumps(rel, ensure_ascii=False, indent=1))
        else:
            for k, v in rel.items():
                print(k, ':', v)
        return 0 if rel['ok'] else codigo or 1

    try:
        import ifcopenshell, ifcopenshell.validate, ifcopenshell.guid
        import ifcopenshell.util.element as UE
    except ImportError as ex:
        rel['erros'].append('ifcopenshell não instalado: %s' % ex)
        rel['sem_ifcopenshell'] = True
        return saida(2)
    rel['ifcopenshell'] = ifcopenshell.version

    t0 = time.time()
    try:
        f = ifcopenshell.open(caminho)
    except Exception as ex:
        rel['erros'].append('não abriu: %r' % ex)
        return saida(2)
    rel['abrir_s'] = round(time.time() - t0, 3)
    rel['schema'] = f.schema
    rel['bytes'] = os.path.getsize(caminho)
    rel['entidades'] = len(list(f))
    rel['contagem'] = dict(sorted(collections.Counter(e.is_a() for e in f).items()))

    # 1) esquema e, com --regras, as regras WHERE
    class Coletor(logging.Handler):
        def __init__(self):
            super().__init__()
            self.msgs = []

        def emit(self, r):
            self.msgs.append(self.format(r))

    log = logging.getLogger('validar_ifc')
    log.setLevel(logging.DEBUG)
    col = Coletor()
    log.addHandler(col)
    log.propagate = False
    if REGRAS:
        _pytest_minimo()
    t0 = time.time()
    try:
        ifcopenshell.validate.validate(f, log, express_rules=REGRAS)
    except Exception as ex:
        rel['erros'].append('validate falhou: %r' % ex)
    rel['validate_s'] = round(time.time() - t0, 3)
    rel['validate_msgs'] = col.msgs[:50]
    if col.msgs:
        rel['erros'].append('%d mensagens do ifcopenshell.validate' % len(col.msgs))

    # 2) GUID
    guids = [e.GlobalId for e in f.by_type('IfcRoot')]
    rel['guids'] = len(guids)
    rep = [g for g, n in collections.Counter(guids).items() if n > 1]
    if rep:
        rel['erros'].append('GUID repetido: %s' % rep[:5])
    for g in guids:
        if len(g) != 22 or g[0] not in '0123':
            rel['erros'].append('GUID fora do padrão: %s' % g)
            break
        try:
            volta = ifcopenshell.guid.compress(ifcopenshell.guid.expand(g))
        except Exception:
            volta = None
        if volta != g:
            rel['erros'].append('GUID não volta: %s' % g)
            break

    # 3) estrutura
    for el in f.by_type('IfcElement'):
        if el.is_a('IfcFeatureElementSubtraction'):
            continue
        contido = bool(el.ContainedInStructure)
        agregado = bool(el.Decomposes)
        if contido and agregado:
            rel['erros'].append('%s %s contido E agregado' % (el.is_a(), el.Name))
        if not contido and not agregado:
            rel['erros'].append('%s %s solto (nem contido nem agregado)' % (el.is_a(), el.Name))
    for p in f.by_type('IfcBuildingElementPart'):
        if p.PredefinedType == 'USERDEFINED' and not p.ObjectType:
            rel['erros'].append('parte USERDEFINED sem ObjectType: %s' % p.Tag)
    rel['partes_por_tipo'] = dict(sorted(collections.Counter(p.ObjectType or '(sem ObjectType)'
                                                             for p in f.by_type('IfcBuildingElementPart')).items()))

    # 4) nomes lidos de volta (o teste compara com o gravado)
    nomes = collections.defaultdict(list)
    for cl in ('IfcProject', 'IfcSite', 'IfcBuilding', 'IfcBuildingStorey', 'IfcWall', 'IfcFooting', 'IfcMaterial',
               'IfcTypeObject', 'IfcBuildingElementPart', 'IfcReinforcingBar', 'IfcPropertySet', 'IfcElementQuantity',
               'IfcSurfaceStyle', 'IfcPipeSegment', 'IfcCovering', 'IfcBuildingElementProxy'):
        for e in f.by_type(cl):
            n = e.Name
            if n is not None and n not in nomes[cl] and len(nomes[cl]) < 200:
                nomes[cl].append(n)
    rel['nomes'] = dict(nomes)
    rel['pessoas'] = [p.FamilyName for p in f.by_type('IfcPerson')]

    # Psets (com os herdados do tipo) dos contêineres e de um exemplar por grupo
    psets = {}
    vistos = set()
    for el in f.by_type('IfcElement'):
        k = chave_do_grupo(el)
        if el.is_a('IfcWall') or el.is_a('IfcFooting') or k not in vistos:
            vistos.add(k)
            psets[el.Tag or el.GlobalId] = UE.get_psets(el)
    rel['psets'] = psets

    # barras: comprimento da diretriz e nº de arcos, por Tag
    barras = {}
    for b in f.by_type('IfcReinforcingBar'):
        d = disco_da_barra(b)
        if d is None:
            rel['erros'].append('barra %s sem IfcSweptDiskSolid' % b.Tag)
            continue
        c = d.Directrix
        arcos = sum(1 for s in (c.Segments or []) if s.is_a('IfcArcIndex')) if c.is_a('IfcIndexedPolyCurve') else 0
        barras[b.Tag or b.GlobalId] = {'nome': b.Name, 'comprimento': comprimento_da_curva(c), 'raio': d.Radius,
                                       'arcos': arcos, 'mapeada': bool(b.Representation.Representations[0].Items[0].is_a('IfcMappedItem'))}
    rel['barras'] = barras

    # 5) geometria
    if GEOM:
        import ifcopenshell.geom, ifcopenshell.util.shape as US
        st = ifcopenshell.geom.settings()
        st.set('use-world-coords', True)
        t0 = time.time()
        vols = collections.defaultdict(list)
        caixas = {}
        por_tag = {}
        por_grupo = collections.Counter()
        n_geom = 0
        for el in f.by_type('IfcProduct'):
            if not el.Representation:
                continue
            k = chave_do_grupo(el)
            if not GEOM_TUDO and por_grupo[k] >= AMOSTRA:
                continue
            por_grupo[k] += 1
            try:
                sh = ifcopenshell.geom.create_shape(st, el)   # guardar `sh`: sem ele a malha é liberada e vem vazia
            except Exception as ex:
                rel['erros'].append('geom falhou em %s %s: %s' % (el.is_a(), el.Tag or el.Name, ex))
                continue
            n_geom += 1
            g = sh.geometry
            v = US.get_vertices(g)
            if len(v) == 0:
                rel['erros'].append('geom vazia em %s %s' % (el.is_a(), el.Tag or el.Name))
                continue
            vol = US.get_volume(g)
            mn = [round(float(x), 5) for x in v.min(axis=0)]
            mx = [round(float(x), 5) for x in v.max(axis=0)]
            vols[k].append(vol)
            if k in caixas:
                caixas[k] = [[min(a, b) for a, b in zip(caixas[k][0], mn)], [max(a, b) for a, b in zip(caixas[k][1], mx)]]
            else:
                caixas[k] = [mn, mx]
            if GEOM_TUDO:
                por_tag[el.Tag or el.GlobalId] = {'caixa': [mn, mx], 'volume': round(vol, 9)}
        rel['geom_s'] = round(time.time() - t0, 3)
        rel['geom_n'] = n_geom
        rel['volumes'] = {k: {'n': len(v), 'min': round(min(v), 9), 'max': round(max(v), 9), 'soma': round(sum(v), 9)}
                          for k, v in vols.items()}
        rel['caixas'] = caixas
        if GEOM_TUDO:
            rel['por_tag'] = por_tag

    if '--furos' in argv:
        t0 = time.time()
        conferir_furos(f, rel)
        rel['furos_s'] = round(time.time() - t0, 3)

    return saida(0)


if __name__ == '__main__':
    sys.exit(main(sys.argv))
