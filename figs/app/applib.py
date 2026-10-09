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

C = dict(line='#262626', dim='#404040', block='#7f7f7f', blockfill='#d9d9d9', grout='#2e75b6', groutfill='#bdd7ee',
         steel='#c00000', soil='#8d6e3f', soilfill='#e8d8b9', water='#2e75b6', load='#c55a11', hollow='#ffffff',
         note='#595959', empuxo='#f8cbad', empuxo2='#fbe5d6', mesa='#f4b183', mesa_txt='#843c0c',
         passivo='#548235', passivo_fill='#e2efda', passivo_txt='#385723', sub='#fff2cc', sub_line='#bf9000',
         sub_txt='#7f6000', ok='#2e7d32', ok_fill='#eaf5ea', erro='#c00000', erro_fill='#fdecea',
         cinza='#a6a6a6', cinza2='#bfbfbf', claro='#f2f2f2', concreto='#ececec', pressao='#ddebf7', barra2='#ff6f6f')
FONT = "font-family:Arial,'DejaVu Sans',sans-serif"

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
            f'<pattern id="{p}-soilh" patternUnits="userSpaceOnUse" width="12" height="12" patternTransform="rotate(45)"><rect width="12" height="12" fill="{C["soilfill"]}"/><line x1="0" y1="0" x2="0" y2="12" stroke="{C["soil"]}" stroke-width="1" opacity="0.45"/></pattern>',
            f'<pattern id="{p}-conc" patternUnits="userSpaceOnUse" width="14" height="14"><rect width="14" height="14" fill="{C["concreto"]}"/><circle cx="3" cy="4" r="1" fill="#9a9a9a"/><circle cx="10" cy="9" r="0.8" fill="#9a9a9a"/><circle cx="6" cy="12" r="0.6" fill="#9a9a9a"/></pattern>',
            f'<pattern id="{p}-brita" patternUnits="userSpaceOnUse" width="16" height="16"><rect width="16" height="16" fill="{C["claro"]}"/><circle cx="4" cy="4" r="3" fill="none" stroke="{C["cinza"]}" stroke-width="1"/><circle cx="12" cy="11" r="3.4" fill="none" stroke="{C["cinza"]}" stroke-width="1"/><circle cx="3" cy="13" r="1.8" fill="none" stroke="{C["cinza"]}" stroke-width="1"/></pattern>',
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

    # ---- saída ---------------------------------------------------------------------------------------
    def svg(s, folga=14, larg_min=900):
        x0, y0, x1, y1 = s.caixa
        x0, y0 = math.floor(x0 - folga), math.floor(y0 - folga)
        w, h = math.ceil(x1 + folga) - x0, math.ceil(y1 + folga) - y0
        # Largura mínima do viewBox = largura do modal (~900 px): assim a letra sai do MESMO tamanho em todas as
        # figuras (escala ~1). Sem isto, uma figura estreita (Fig. 9, 544 de largura) era ampliada 1,65× e a
        # letra ficava gigante ao lado das outras. O desenho fica centrado na folga.
        if w < larg_min:
            x0 -= (larg_min - w) // 2
            w = larg_min
        return (f'<svg xmlns="http://www.w3.org/2000/svg" data-figura="{s.pid}" width="{w}" height="{h}" viewBox="{x0} {y0} {w} {h}">'
                f'<defs>{"".join(s.defs)}</defs>'
                f'<rect data-fundo="" x="{x0}" y="{y0}" width="{w}" height="{h}" fill="#ffffff"/>'
                f'<g id="{s.pid}-conteudo">' + ''.join(s.el) + '</g></svg>')

    def campos(s):
        return sorted(set(s._campos))
