# HACHURAS DE MATERIAL das figuras do app — as MESMAS do desenho do app (app/src/desenhos/hachuras.ts, que explica as
# escolhas): terra (trançado EARTH), concreto, areia e brita do Revit do Jose (14/10). Mesma semente, mesmo sorteio:
# a figura de apoio e o desenho gerado mostram o mesmo material com a mesma cara. Mudou lá, muda aqui.
import math

HACHURA = dict(
    terra='#a67857', terraFundo='#dbc9bb',
    areia='#5d5d5d', areiaFundo='#ffffb7',
    concreto='#5d5d5d', concretoFundo='#d4d4d4',
    brita='#4a4a4a', britaFundo='#c3bfb5',
)

E = 2   # concreto, areia e brita no dobro da amostra (proporção do Revit do Jose)


def _sorteio(semente):
    s = [semente]

    def r():
        s[0] = (s[0] * 16807) % 2147483647
        return s[0] / 2147483647
    return r


def _f1(x):
    v = math.floor(x * 10 + 0.5) / 10
    return str(int(v)) if v == int(v) else str(v)


def _risco(x, y, ang, l, cor):
    x, y, l = x * E, y * E, l * E
    return (f'<line x1="{_f1(x)}" y1="{_f1(y)}" x2="{_f1(x + l * math.cos(ang))}" y2="{_f1(y + l * math.sin(ang))}" '
            f'stroke="{cor}" stroke-width="0.6"/>')


def _ladrilho(id_, lado, fundo, miolo):
    return (f'<pattern id="{id_}" patternUnits="userSpaceOnUse" width="{_f1(lado)}" height="{_f1(lado)}">'
            f'<rect width="{_f1(lado)}" height="{_f1(lado)}" fill="{fundo}"/>{miolo}</pattern>')


def _terra(id_):
    c = 48
    T = 2 * c
    seg = []
    for k in (0, 0.375, 0.75):
        seg.append((0, k * c, c, k * c))
        seg.append((c, (1 + k) * c, 2 * c, (1 + k) * c))
    for k in (0.09375, 0.46875, 0.84375):
        seg.append((k * c, 0.9375 * c, k * c, 1.9375 * c))
        seg.append(((1 + k) * c, -0.0625 * c, (1 + k) * c, 0.9375 * c))
    s = ''
    for x1, y1, x2, y2 in seg:
        for dx in (-T, 0, T):
            for dy in (-T, 0, T):
                if max(x1, x2) + dx < 0 or min(x1, x2) + dx > T or max(y1, y2) + dy < 0 or min(y1, y2) + dy > T:
                    continue
                s += (f'<line x1="{_f1(x1 + dx)}" y1="{_f1(y1 + dy)}" x2="{_f1(x2 + dx)}" y2="{_f1(y2 + dy)}" '
                      f'stroke="{HACHURA["terra"]}" stroke-width="0.8"/>')
    return _ladrilho(id_, T, HACHURA['terraFundo'], s)


def _areia(id_):
    r = _sorteio(11)
    s = ''
    for _ in range(70):
        x, y, a, l = r() * 60, r() * 60, r() * 6.28, 0.6 + r() * 0.9
        s += _risco(x, y, a, l, HACHURA['areia'])
    return _ladrilho(id_, 60 * E, HACHURA['areiaFundo'], s)


def _concreto(id_):
    r = _sorteio(23)
    s = ''
    for _ in range(22):
        x, y, raio, a0 = 6 + r() * 68, 6 + r() * 68, 1.4 + r() * 1.6, r() * 6.28
        p = [f'{_f1(E * (x + raio * math.cos(a0 + v * 2.094)))},{_f1(E * (y + raio * math.sin(a0 + v * 2.094)))}' for v in range(3)]
        s += f'<polygon points="{" ".join(p)}" fill="none" stroke="{HACHURA["concreto"]}" stroke-width="0.6"/>'
    for _ in range(45):
        x, y, a, l = r() * 80, r() * 80, r() * 6.28, 0.5 + r() * 1.2
        s += _risco(x, y, a, l, HACHURA['concreto'])
    return _ladrilho(id_, 80 * E, HACHURA['concretoFundo'], s)


def _brita(id_):
    r = _sorteio(7)
    T, n = 72, 8
    passo = T / n
    s = ''
    for i in range(n):
        for j in range(n):
            cx = passo * (i + 0.5) + (r() - 0.5) * passo * 0.35
            cy = passo * (j + 0.5) + (r() - 0.5) * passo * 0.35
            raio, lados, a0 = 2.8 + r() * 1.4, 5 + math.floor(r() * 3), r() * 6.28
            p = []
            for v in range(lados):
                b = a0 + v * 6.28 / lados + (r() - 0.5) * 0.6
                rr = raio * (0.7 + r() * 0.3)
                p.append((cx + rr * math.cos(b), cy + rr * math.sin(b)))
            xs, ys = [q[0] for q in p], [q[1] for q in p]
            for dx in (-T, 0, T):
                for dy in (-T, 0, T):
                    if min(xs) + dx > T or max(xs) + dx < 0 or min(ys) + dy > T or max(ys) + dy < 0:
                        continue
                    pts = ' '.join(f'{_f1(E * (x + dx))},{_f1(E * (y + dy))}' for x, y in p)
                    s += f'<polygon points="{pts}" fill="none" stroke="{HACHURA["brita"]}" stroke-width="0.7"/>'
    return _ladrilho(id_, T * E, HACHURA['britaFundo'], s)


def hachuras(prefixo):
    """Os quatro ladrilhos com o prefixo da figura: {p}-soilh (terra), {p}-conc, {p}-areia, {p}-brita."""
    return [_terra(f'{prefixo}-soilh'), _concreto(f'{prefixo}-conc'), _areia(f'{prefixo}-areia'), _brita(f'{prefixo}-brita')]
