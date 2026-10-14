# Variante "app" das figuras de referência (botão ao lado de cada entrada do Al-rimo).
#
# Por que uma biblioteca separada da figlib (e não um modo dentro dela): as figuras da planilha continuam
# exatamente como estão (aba Ilustrações e o índice em PDF dependem delas). A figura do app tem regras
# diferentes, e misturar as duas num mesmo .py faria cada ajuste do app arriscar mudar a planilha:
#   - letra maior: o modal tem ~900 px; viewBox de ~1000 → escala ~0,9. Texto mínimo 15 no viewBox;
#   - sem título, subtítulo, rodapé nem prosa (o título vai no cabeçalho do modal; regra do Jose: tela sem tutorial);
#   - grandezas por SÍMBOLO, nunca o número do exemplo da aula (o usuário acharia que é o resultado dele);
#   - ids com prefixo por figura: se dois SVG forem postos inline no mesmo documento, um rouba o
#     <marker>/<pattern> do outro;
#   - cada grandeza que corresponde a uma entrada fica num <g data-campo="nome_definido">. O modal NÃO
#     acende mais a grandeza (09/10, Jose: "essa cor no SVG tá poluindo" — a figura aparece como desenhada);
#     o data-campo fica porque o teste do app confere com ele que dados/figuras.json aponta para uma
#     grandeza que existe no desenho;
#   - o viewBox é recortado no desenho: a caixa de cada elemento é acumulada aqui mesmo (sem navegador),
#     com folga, para o gerador não depender de Playwright/Chrome.
# Paleta: só as cores que as figuras da planilha já usam (regra do Jose: cor nova só com autorização).
# O tema escuro inverte o desenho (filter: invert(.88) hue-rotate(180deg), receita das pranchetas do Pró-Viga),
# então o desenho é sempre autorado CLARO.
import html
import math
import re
from contextlib import contextmanager

from hachuras import HACHURA, hachuras

C = dict(line='#262626', dim='#404040', block='#7f7f7f', blockfill='#d9d9d9', grout='#2e75b6', groutfill='#bdd7ee',
         steel='#c00000', soil=HACHURA['terra'], soilfill=HACHURA['terraFundo'], water='#2e75b6', load='#c55a11', hollow='#ffffff',
         note='#595959', empuxo='#f8cbad', empuxo2='#fbe5d6', mesa='#f4b183', mesa_txt='#843c0c',
         passivo='#548235', passivo_fill='#e2efda', passivo_txt='#385723', sub='#fff2cc', sub_line='#bf9000',
         sub_txt='#7f6000', ok='#2e7d32', ok_fill='#eaf5ea', erro='#c00000', erro_fill='#fdecea',
         cinza='#a6a6a6', cinza2='#bfbfbf', claro='#f2f2f2', concreto=HACHURA['concretoFundo'], pressao='#ddebf7', barra2='#ff6f6f',
         reboco='#e9e1d1')   # argamassa do reboco (13/10): bege-claro, nem bloco nem graute
FONT = "font-family:Arial,'DejaVu Sans',sans-serif"

# ── A RÉGUA COMUM (Jose, 12/10: "padronizar as figuras para ficarem harmônicas") ───────────────────────────────
# Proposta aprovada em https://claude.ai/artifact/XxiHij7TtwkNdtg5CrHmnw (seção 5). Antes, cada figura desenhava a
# mesma peça do seu jeito e na sua escala (parede de 21 a 93 px; bloco de 19 cm em 5 escalas). Agora:
#   - UMA ESCALA POR TIPO DE VISTA: corte/elevação geral do muro em K_GERAL px/m; detalhe ampliado (ancoragem,
#     armadura da sapata) em K_DETALHE; bloco em planta em K_BLOCO px/m (o 19 × 39 sempre do mesmo tamanho);
#   - UMA MOLDURA: toda figura sai na mesma proporção (ASPECTO) e com a mesma largura mínima, então a caixa do
#     modal não muda de tamanho de uma aba para outra e a letra fica do mesmo tamanho em todas;
#   - CADA PEÇA DE UM JEITO SÓ: parede, sapata, solo, empuxo, sobrecarga, NA, fissura, junta, título de vista e
#     legenda saem dos métodos abaixo — figura nenhuma redesenha à mão;
#   - SOLO À DIREITA nos cortes (como o corte vivo do app);
#   - COR COM UM SIGNIFICADO: vermelho só aço (com espera e barra juntas, espera vermelha e barra rosa, como a
#     Fig. 9); fissura e junta em cinza-escuro; cor de empuxo só em pressão; painel não armado sempre C['sub'];
#     contraforte em corte/planta é graute (azul), em vista é cinza (C['cinza2']);
#   - SÓ DESENHO, SÍMBOLO E COTA: nada de fórmula, lista ou tabela dentro da figura (vão para a memória ou para
#     tabela do app). Símbolos iguais aos da memória: h_{muro}, h_{solo}, h_{s} (sapata), B, a, t, t_{enr}.
K_GERAL = 150       # px por metro — corte e elevação gerais do muro
K_DETALHE = 400     # px por metro — detalhe ampliado
K_BLOCO = 600       # px por metro — bloco em planta (6 px/cm)
ASPECTO = 1000 / 640
LARG_MIN = 1000

# Tamanhos (unidades do viewBox). Com o recorte, as figuras ficam entre ~850 e ~1050 de largura.
T_TIT = 20      # título de painel ("Parcial — seção I")
T_SIM = 20      # símbolo de cota (h, t, l, B...)
T_TXT = 17      # rótulo
T_PEQ = 16      # rótulo secundário (mínimo)

_SUB = re.compile(r'(_\{[^}]*\}|\^\{[^}]*\})')


def _larg_texto(t, size):
    """Largura estimada do texto em Arial (sem navegador). Conservadora: 0,58 em por caractere;
    índices a 72 % do corpo. Serve só para o recorte do viewBox e para alinhar chamadas."""
    w = 0.0
    for parte in _SUB.split(t):
        if not parte:
            continue
        if parte[0] in '_^' and parte[1:2] == '{':
            w += (len(parte) - 3) * 0.58 * size * 0.72
        else:
            w += len(parte) * 0.58 * size
    return w


def _curto(t):
    """Rótulo de cota que é só símbolo: uma ou duas letras fora dos índices (h, t_{enr}, z_{NA}, ℓ_{b})."""
    return len(_SUB.sub('', t)) <= 2 and len(t) <= 12


class Fig:
    def __init__(s, num, w, h):
        s.pid = 'fig%02d' % num
        s.w, s.h = w, h
        s.el = []
        s.caixa = [math.inf, math.inf, -math.inf, -math.inf]
        s._campos = []
        p = s.pid
        s.defs = [
            f'<marker id="{p}-arr" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{C["dim"]}"/></marker>',
            f'<marker id="{p}-arrL" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{C["load"]}"/></marker>',
            f'<marker id="{p}-arrA" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{C["water"]}"/></marker>',
            f'<marker id="{p}-arrP" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{C["passivo"]}"/></marker>',
            f'<marker id="{p}-tick" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="9" markerHeight="9" orient="auto"><path d="M2,8 L8,2" stroke="{C["dim"]}" stroke-width="1.5"/></marker>',
            # terra, concreto, areia e brita: as hachuras do Revit do Jose (14/10), as mesmas do desenho do app
            *hachuras(p),
        ]

    # ---- referências com prefixo -------------------------------------------------------------------
    def u(s, nome):
        return f'url(#{s.pid}-{nome})'

    @property
    def SOLO(s): return s.u('soilh')
    @property
    def CONC(s): return s.u('conc')
    @property
    def BRITA(s): return s.u('brita')
    @property
    def AREIA(s): return s.u('areia')

    # ---- caixa acumulada -----------------------------------------------------------------------------
    def _bb(s, x0, y0, x1, y1):
        c = s.caixa
        c[0] = min(c[0], x0, x1); c[1] = min(c[1], y0, y1); c[2] = max(c[2], x0, x1); c[3] = max(c[3], y0, y1)

    def add(s, x):
        s.el.append(x)

    @contextmanager
    def campo(s, *nomes):
        """Agrupa o que representa uma (ou mais) entrada(s): o modal acende só este grupo."""
        s._campos.extend(nomes)
        s.add(f'<g data-campo="{" ".join(nomes)}">')
        yield
        s.add('</g>')

    # ---- primitivas ----------------------------------------------------------------------------------
    def rect(s, x, y, w, h, fill='none', stroke=C['line'], sw=1.2, extra=''):
        s._bb(x, y, x + w, y + h)
        s.add(f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')

    def line(s, x1, y1, x2, y2, stroke=C['line'], sw=1.2, extra=''):
        s._bb(x1, y1, x2, y2)
        s.add(f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')

    def poly(s, pts, fill='none', stroke=C['line'], sw=1.2, extra=''):
        for x, y in pts:
            s._bb(x, y, x, y)
        p = ' '.join(f'{x:.2f},{y:.2f}' for x, y in pts)
        s.add(f'<polygon points="{p}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')

    def pline(s, pts, stroke=C['line'], sw=1.2, extra=''):
        for x, y in pts:
            s._bb(x, y, x, y)
        p = ' '.join(f'{x:.2f},{y:.2f}' for x, y in pts)
        s.add(f'<polyline points="{p}" fill="none" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round" {extra}/>')

    def path(s, d, pts_caixa, fill='none', stroke=C['line'], sw=1.2, extra=''):
        for x, y in pts_caixa:
            s._bb(x, y, x, y)
        s.add(f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')

    def circle(s, x, y, r, fill=C['steel'], stroke='none', sw=1):
        s._bb(x - r, y - r, x + r, y + r)
        s.add(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')

    def text(s, x, y, t, size=T_TXT, anchor='middle', color=C['line'], weight='normal', italic=False, rot=None, halo=False):
        """Texto com índices: 't_{enr}' → t com 'enr' subscrito; 'l^{4}' → sobrescrito. O índice usa dy (não
        baseline-shift, que o Firefox ignora)."""
        wt = _larg_texto(t, size)
        a = {'start': 0, 'middle': -wt / 2, 'end': -wt}[anchor]
        if rot is None:
            s._bb(x + a, y - size * 0.85, x + a + wt, y + size * 0.3)
        else:  # só -90 (cota vertical): a largura vira altura
            s._bb(x - size * 0.85, y - a - wt, x + size * 0.3, y - a)
        tr = f' transform="rotate({rot} {x:.2f} {y:.2f})"' if rot is not None else ''
        st = 'font-style:italic;' if italic else ''
        hl = ' stroke="#ffffff" stroke-width="5" stroke-linejoin="round" paint-order="stroke"' if halo else ''
        corpo = []
        dy_ac = 0.0
        for parte in _SUB.split(t):
            if not parte:
                continue
            if parte[0] in '_^' and parte[1:2] == '{':
                dy = size * 0.30 if parte[0] == '_' else -size * 0.42
                corpo.append(f'<tspan dy="{dy:.1f}" font-size="{size * 0.72:.1f}">{html.escape(parte[2:-1], quote=False)}</tspan>')
                dy_ac += dy
            else:
                if dy_ac:
                    corpo.append(f'<tspan dy="{-dy_ac:.1f}">{html.escape(parte, quote=False)}</tspan>')
                    dy_ac = 0.0
                else:
                    corpo.append(html.escape(parte, quote=False))
        s.add(f'<text x="{x:.2f}" y="{y:.2f}" font-size="{size}" text-anchor="{anchor}" fill="{color}" font-weight="{weight}" style="{FONT};{st}"{hl}{tr}>{"".join(corpo)}</text>')

    def arrow(s, x1, y1, x2, y2, color=C['load'], sw=1.8, marker='arrL'):
        s._bb(x1, y1, x2, y2)
        s.add(f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="{color}" stroke-width="{sw}" marker-end="{s.u(marker)}"/>')

    def dim_h(s, x1, x2, y, label, off_text=-8, ext_from=None, size=T_SIM, italic=False, halo=False):
        """Cota horizontal (traço oblíquo de arquitetura). ext_from = (y0 esq, y0 dir) das linhas de chamada."""
        if ext_from is not None:
            for x, y0 in ((x1, ext_from[0]), (x2, ext_from[1])):
                s.line(x, y0, x, y + (5 if y > y0 else -5), stroke=C['dim'], sw=0.7)
        s._bb(x1, y, x2, y)
        s.add(f'<line x1="{x1:.2f}" y1="{y:.2f}" x2="{x2:.2f}" y2="{y:.2f}" stroke="{C["dim"]}" stroke-width="1" marker-start="{s.u("tick")}" marker-end="{s.u("tick")}"/>')
        if label:      # cota curta demais: quem chama escreve o rótulo ao lado
            s.text((x1 + x2) / 2, y + off_text, label, size=size, color=C['dim'], italic=italic, halo=halo)

    def dim_v(s, x, y1, y2, label, side=-1, ext_from=None, size=T_SIM, italic=False, halo=False):
        """Cota vertical; texto girado −90°, do lado `side` (−1 esquerda, +1 direita)."""
        if ext_from is not None:
            for y, x0 in ((y1, ext_from[0]), (y2, ext_from[1])):
                s.line(x0, y, x + (5 if x > x0 else -5), y, stroke=C['dim'], sw=0.7)
        s._bb(x, y1, x, y2)
        s.add(f'<line x1="{x:.2f}" y1="{y1:.2f}" x2="{x:.2f}" y2="{y2:.2f}" stroke="{C["dim"]}" stroke-width="1" marker-start="{s.u("tick")}" marker-end="{s.u("tick")}"/>')
        if _curto(label):
            # Símbolo curto (h, t, d, c, z_{NA}...) fica EM PÉ: girado, o 'd' vira 'p' e o 't' vira um 'ꓕ' — no
            # modal a pessoa lê sem virar a cabeça. Texto longo (palavra) continua girado, como cota de prancha.
            s.text(x + side * 8, (y1 + y2) / 2 + size * 0.35, label, size=size, color=C['dim'],
                   anchor='end' if side < 0 else 'start', italic=italic, halo=halo)
        else:
            # o texto girado fica com a base voltada para a linha: à esquerda, afastado; à direita, colado
            s.text(x + (side * 8 if side < 0 else side * 8 + size * 0.75), (y1 + y2) / 2, label, size=size, color=C['dim'], rot=-90, italic=italic, halo=halo)

    def chamada(s, px, py, tx, ty, label, color=C['line'], size=T_TXT, anchor='start', weight='normal'):
        """Rótulo com linha de chamada até o ponto (px, py)."""
        wt = _larg_texto(label, size)
        if anchor == 'start':
            lx = tx - 6
        elif anchor == 'end':
            lx = tx + 6
        else:
            lx = tx
        s.line(lx, ty - size * 0.3, px, py, stroke=color, sw=1)
        s.circle(px, py, 2.6, fill=color)
        s.text(tx, ty, label, size=size, anchor=anchor, color=color, weight=weight)
        return wt

    # ---- peças padrão (a régua comum) ---------------------------------------------------------------
    # Coordenadas em px do desenho; medidas reais em m com a escala K da vista. Solo sempre à DIREITA da parede.

    def parede(s, x, y_base, t, h, K=K_GERAL, canaletas=(), barra=True, espera=None, cor_barra=None):
        """Parede em corte: face externa em x, base em y_base, espessura t e altura h em m. canaletas = alturas
        (m, do pé) das fiadas de canaleta grauteada; barra = vertical do lado do solo a 5 cm da face;
        espera = comprimento (m) que desce na sapata, com gancho para o solo; None = sem espera.
        Devolve (x da face externa, x da face do solo, y do topo)."""
        tw, hw = t * K, h * K
        s.rect(x, y_base - hw, tw, hw, fill=C['blockfill'], stroke=C['line'], sw=1.4)
        hc = 0.19 * K
        for yc in canaletas:
            s.rect(x, y_base - yc * K - hc, tw, hc, fill=C['groutfill'], stroke=C['grout'], sw=1)
        xb = x + tw - 0.05 * K
        if barra:
            s.line(xb, y_base - hw + 0.03 * K, xb, y_base, stroke=cor_barra or C['steel'], sw=2.6)
        if espera:
            s.pline([(xb, y_base - 0.3 * K), (xb, y_base + espera * K), (xb + 0.2 * K, y_base + espera * K)],
                    stroke=C['steel'], sw=2.6)
        return x, x + tw, y_base - hw

    def sapata(s, x, y_topo, b, h, K=K_GERAL):
        """Sapata em corte: concreto pontilhado, borda preta. Devolve (x direito, y da base)."""
        s.rect(x, y_topo, b * K, h * K, fill=s.CONC, stroke=C['line'], sw=1.4)
        return x + b * K, y_topo + h * K

    def solo(s, pts, topo=None):
        """Solo: hachura marrom no polígono; topo = [(x0, y), (x1, y)] desenha a linha do terreno."""
        s.poly(pts, fill=s.SOLO, stroke='none')
        if topo:
            s.line(topo[0][0], topo[0][1], topo[1][0], topo[1][1], stroke=C['soil'], sw=2)

    def empuxo(s, x_face, y_topo, y_base, larg=None, n=6, lado=1):
        """Diagrama de empuxo triangular na face do solo (lado=+1: solo à direita, setas para a esquerda)."""
        larg = larg if larg is not None else min(150, max(60, 0.4 * (y_base - y_topo)))
        x1 = x_face + lado * larg
        s.poly([(x_face, y_topo), (x_face + lado * 6, y_topo), (x1, y_base), (x_face, y_base)],
               fill=C['empuxo'], stroke=C['load'], sw=1.4, extra='fill-opacity="0.75"')
        for i in range(1, n + 1):
            f = i / (n + 1)
            y = y_topo + f * (y_base - y_topo)
            s.arrow(x_face + lado * (6 + (larg - 6) * f - 2), y, x_face + lado * 3, y, sw=1.3)

    def sobrecarga(s, x0, x1, y_solo, rotulo='q'):
        """Sobrecarga uniforme sobre o terreno: régua laranja com setas e o símbolo à direita."""
        s.line(x0, y_solo - 45, x1, y_solo - 45, stroke=C['load'], sw=1.5)
        x = x0 + 4
        while x <= x1 - 4:
            s.arrow(x, y_solo - 45, x, y_solo - 3, sw=1.5)
            x += 36
        s.text(x1 + 8, y_solo - 39, rotulo, size=22, anchor='start', color=C['load'], weight='bold')

    def na(s, x0, x1, y):
        """Nível d'água: tracejado azul, triângulo e 'NA' na ponta direita."""
        s.line(x0, y, x1, y, stroke=C['water'], sw=1.8, extra='stroke-dasharray="9,6"')
        s.poly([(x1 - 64, y - 15), (x1 - 48, y - 15), (x1 - 56, y - 2)], fill=C['water'], stroke='none')
        s.text(x1 - 42, y - 6, 'NA', size=T_TXT, anchor='start', color=C['water'], weight='bold', halo=True)

    def fissura(s, x0, y0, x1, y1, n=5):
        """Fissura: ziguezague cinza-escuro (o vermelho é só do aço)."""
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy) or 1
        pts = []
        for i in range(n + 1):
            f = i / n
            off = (4 if i % 2 else -4) if 0 < i < n else 0
            pts.append((x0 + dx * f - dy / L * off, y0 + dy * f + dx / L * off))
        s.pline(pts, stroke=C['dim'], sw=1.8)

    def junta(s, x, y0, y1):
        """Junta de controle: traço-ponto cinza-escuro."""
        s.line(x, y0, x, y1, stroke=C['dim'], sw=1.6, extra='stroke-dasharray="12,4,2,4"')

    def titulo_vista(s, x, y, texto):
        """Nome da vista ('Planta', 'Corte', 'Parcial — seção I'): sempre em cima, à esquerda, mesmo estilo."""
        s.text(x, y, texto, size=T_TIT, anchor='start', color=C['line'], weight='bold')

    def legenda(s, x, y, itens):
        """Legenda embaixo, à esquerda, numa linha: itens = [(tipo, rótulo)], tipo em 'aco', 'aco2', 'graute',
        'bloco', 'solo', 'concreto', 'brita', 'areia', 'apoio', 'engaste', 'livre', 'naoarmado', 'fissura', 'junta',
        'reboco'."""
        cx = x
        for tipo, rot in itens:
            yy = y - 6
            if tipo in ('aco', 'aco2'):
                s.line(cx, yy, cx + 26, yy, stroke=C['steel'] if tipo == 'aco' else C['barra2'], sw=2.6)
            elif tipo == 'graute':
                s.rect(cx, yy - 7, 26, 14, fill=C['groutfill'], stroke=C['grout'], sw=1)
            elif tipo == 'bloco':
                s.rect(cx, yy - 7, 26, 14, fill=C['blockfill'], stroke=C['line'], sw=1)
            elif tipo == 'solo':
                s.rect(cx, yy - 7, 26, 14, fill=s.SOLO, stroke='none')
            elif tipo == 'concreto':
                s.rect(cx, yy - 7, 26, 14, fill=s.CONC, stroke=C['line'], sw=1)
            elif tipo == 'brita':
                s.rect(cx, yy - 7, 26, 14, fill=s.BRITA, stroke=C['dim'], sw=0.8)
            elif tipo == 'areia':
                s.rect(cx, yy - 7, 26, 14, fill=s.AREIA, stroke=C['dim'], sw=0.8)
            elif tipo == 'naoarmado':
                s.rect(cx, yy - 7, 26, 14, fill=C['sub'], stroke=C['sub_line'], sw=1)
            elif tipo == 'apoio':
                s.line(cx, yy, cx + 26, yy, stroke=C['line'], sw=2.4)
            elif tipo == 'engaste':
                s.line(cx, yy, cx + 26, yy, stroke=C['line'], sw=2.4)
                for k in range(4):
                    s.line(cx + 3 + k * 7, yy, cx + k * 7, yy + 6, stroke=C['line'], sw=1)
            elif tipo == 'livre':
                s.line(cx, yy, cx + 26, yy, stroke=C['cinza'], sw=1.4, extra='stroke-dasharray="4,3"')
            elif tipo == 'fissura':
                s.fissura(cx, yy, cx + 26, yy, n=4)
            elif tipo == 'junta':
                s.line(cx, yy, cx + 26, yy, stroke=C['dim'], sw=1.6, extra='stroke-dasharray="12,4,2,4"')
            elif tipo == 'reboco':
                s.rect(cx, yy - 7, 26, 14, fill=C['reboco'], stroke=C['dim'], sw=0.8)
            s.text(cx + 34, y, rot, size=T_PEQ, anchor='start', color=C['note'])
            cx += 34 + _larg_texto(rot, T_PEQ) + 28

    # ---- saída ---------------------------------------------------------------------------------------
    def recorte(s, folga=14):
        """A caixa do desenho (sem a moldura), com folga: x, y, largura, altura no sistema do viewBox."""
        x0, y0, x1, y1 = s.caixa
        x0, y0 = math.floor(x0 - folga), math.floor(y0 - folga)
        return x0, y0, math.ceil(x1 + folga) - x0, math.ceil(y1 + folga) - y0

    def svg(s, folga=14, larg_min=LARG_MIN):
        x0, y0, w, h = s.recorte(folga)
        # data-desenho: a caixa do desenho sem a moldura. A memória de cálculo mostra a figura RECORTADA nela, no
        # tamanho do vão ao lado da conta (Jose, 12/10: "olha o tanto de espaço sobrando") — a moldura única é do
        # modal das entradas. O gerar.py copia a mesma caixa para app/src/figuras/recortes.gerado.json.
        recorte = f'{x0} {y0} {w} {h}'
        # A MOLDURA ÚNICA (12/10): largura mínima de 1000 e a proporção ASPECTO em todas. O desenho fica centrado na
        # folga. Assim a letra sai do mesmo tamanho em todas as figuras e a caixa do modal não pula de aba em aba.
        # Figura que passar de 1000 de largura encolhe a letra: o desenho é que tem de caber (a régua de cima).
        W = max(larg_min, w, math.ceil(h * ASPECTO))
        H = math.ceil(W / ASPECTO)
        x0 -= (W - w) // 2
        y0 -= (H - h) // 2
        w, h = W, H
        return (f'<svg xmlns="http://www.w3.org/2000/svg" data-figura="{s.pid}" data-desenho="{recorte}" width="{w}" height="{h}" viewBox="{x0} {y0} {w} {h}">'
                f'<defs>{"".join(s.defs)}</defs>'
                f'<rect data-fundo="" x="{x0}" y="{y0}" width="{w}" height="{h}" fill="#ffffff"/>'
                f'<g id="{s.pid}-conteudo">' + ''.join(s.el) + '</g></svg>')

    def campos(s):
        return sorted(set(s._campos))
