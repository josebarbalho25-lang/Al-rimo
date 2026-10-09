# Biblioteca simples de desenho técnico em SVG (unidades em px; escala definida por figura)
C = dict(line='#262626', dim='#404040', block='#7f7f7f', blockfill='#d9d9d9', grout='#2e75b6', groutfill='#bdd7ee',
         steel='#c00000', soil='#8d6e3f', soilfill='#e8d8b9', water='#2e75b6', load='#c55a11', hollow='#ffffff', note='#595959')
FONT = "font-family:Arial,'DejaVu Sans',sans-serif"

class SVG:
    def __init__(s, w, h):
        s.w, s.h, s.el = w, h, []
        s.defs = ['<marker id="arr" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#404040"/></marker>',
                  '<marker id="arrL" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="%s"/></marker>' % C['load'],
                  '<marker id="tick" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M2,8 L8,2" stroke="#404040" stroke-width="1.5"/></marker>',
                  '<pattern id="soilh" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)"><rect width="10" height="10" fill="%s"/><line x1="0" y1="0" x2="0" y2="10" stroke="%s" stroke-width="1" opacity="0.45"/></pattern>' % (C['soilfill'], C['soil']),
                  '<pattern id="conc" patternUnits="userSpaceOnUse" width="14" height="14"><rect width="14" height="14" fill="#ececec"/><circle cx="3" cy="4" r="1" fill="#9a9a9a"/><circle cx="10" cy="9" r="0.8" fill="#9a9a9a"/><circle cx="6" cy="12" r="0.6" fill="#9a9a9a"/></pattern>']
    def add(s, x): s.el.append(x)
    def rect(s, x, y, w, h, fill='none', stroke=C['line'], sw=1.2, extra=''):
        s.add(f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')
    def line(s, x1, y1, x2, y2, stroke=C['line'], sw=1.2, extra=''):
        s.add(f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')
    def poly(s, pts, fill='none', stroke=C['line'], sw=1.2, extra=''):
        p = ' '.join(f'{x:.2f},{y:.2f}' for x, y in pts)
        s.add(f'<polygon points="{p}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')
    def pline(s, pts, stroke=C['line'], sw=1.2, extra=''):
        p = ' '.join(f'{x:.2f},{y:.2f}' for x, y in pts)
        s.add(f'<polyline points="{p}" fill="none" stroke="{stroke}" stroke-width="{sw}" {extra}/>')
    def circle(s, x, y, r, fill=C['steel'], stroke='none', sw=1):
        s.add(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')
    def text(s, x, y, t, size=13, anchor='middle', color=C['line'], weight='normal', italic=False, rot=None):
        tr = f' transform="rotate({rot} {x:.2f} {y:.2f})"' if rot is not None else ''
        st = 'font-style:italic;' if italic else ''
        s.add(f'<text x="{x:.2f}" y="{y:.2f}" font-size="{size}" text-anchor="{anchor}" fill="{color}" font-weight="{weight}" style="{FONT};{st}"{tr}>{t}</text>')
    def arrow(s, x1, y1, x2, y2, color=C['load'], sw=1.6, marker='arrL'):
        s.add(f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="{color}" stroke-width="{sw}" marker-end="url(#{marker})"/>')
    def dim_h(s, x1, x2, y, label, off_text=-6, ext_from=None, size=12):
        # cota horizontal com marcas oblíquas
        if ext_from is not None:
            for x, y0 in ((x1, ext_from[0]), (x2, ext_from[1])):
                s.line(x, y0, x, y + (4 if y > y0 else -4), stroke=C['dim'], sw=0.6)
        s.add(f'<line x1="{x1:.2f}" y1="{y:.2f}" x2="{x2:.2f}" y2="{y:.2f}" stroke="{C["dim"]}" stroke-width="0.9" marker-start="url(#tick)" marker-end="url(#tick)"/>')
        s.text((x1 + x2) / 2, y + off_text, label, size=size, color=C['dim'])
    def dim_v(s, x, y1, y2, label, side=-1, ext_from=None, size=12):
        if ext_from is not None:
            for y, x0 in ((y1, ext_from[0]), (y2, ext_from[1])):
                s.line(x0, y, x + (4 if x > x0 else -4), y, stroke=C['dim'], sw=0.6)
        s.add(f'<line x1="{x:.2f}" y1="{y1:.2f}" x2="{x:.2f}" y2="{y2:.2f}" stroke="{C["dim"]}" stroke-width="0.9" marker-start="url(#tick)" marker-end="url(#tick)"/>')
        s.text(x + side * 7, (y1 + y2) / 2, label, size=size, color=C['dim'], rot=-90)
    def svg(s):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{s.w}" height="{s.h}" viewBox="0 0 {s.w} {s.h}">'
                f'<defs>{"".join(s.defs)}</defs><rect width="{s.w}" height="{s.h}" fill="#ffffff"/>' + ''.join(s.el) + '</svg>')
    def save(s, path):
        open(path, 'w', encoding='utf8').write(s.svg())
