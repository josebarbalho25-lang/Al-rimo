"""Exporta a planilha gerada para o app: app/src/motor/planilha.gerada.json.

A conta do app É a planilha: o app carrega as fórmulas daqui e as avalia com o motor de fórmulas em TypeScript
(app/src/motor/excel/). Assim o build_new.py continua sendo o ÚNICO lugar da conta — o Jose audita a planilha e o
app herda a mesma conta, sem segunda cópia para divergir. O golden.py + os testes do app provam que o avaliador
TypeScript dá o mesmo número que o Excel, célula a célula.

Uso: python tools/exportar_motor.py      (rodar sempre que o gerador mudar; o testar.py do app acusa se esquecer)"""
import hashlib, json, os, re, subprocess, sys, tempfile
import openpyxl

AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.dirname(AQUI)
OUT = os.path.join(RAIZ, 'app', 'src', 'motor', 'planilha.gerada.json')
GERADOR = ['build_new.py', 'contrafortes.py', 'fundacao.py', 'muro_de_cima.py']

tmp = tempfile.mkdtemp(prefix='exp_')
arq = os.path.join(tmp, 'base.xlsx')
subprocess.run([sys.executable, os.path.join(AQUI, 'build_new.py'), arq], check=True, capture_output=True)
wb = openpyxl.load_workbook(arq)

nome_de, nomes = {}, {}
for nm, dn in wb.defined_names.items():
    sh, ref = list(dn.destinations)[0]
    nomes[nm] = f'{sh}!{ref.replace("$", "")}'
    nome_de[(sh, ref.replace('$', ''))] = nm

celulas = {}
for ws in wb:
    if ws.title == 'Ilustrações':
        continue
    for row in ws.iter_rows():
        for c in row:
            if c.value is None:
                continue
            v = c.value
            if not isinstance(v, (int, float, str, bool)):
                v = str(v)
            celulas[f'{ws.title}!{c.coordinate}'] = v


def opcoes_da_validacao(ws, f1):
    """(opções, referência) de uma validação: '"a,b"' (inline) ou intervalo (='Aba'!$L$5:$L$10).

    Intervalo com FÓRMULA é lista que depende de outra entrada (o vão depende do bloco, a altura do tipo de muro):
    não dá para exportar fixa. Vai a referência ('Referências!AK5:AK21') e o formulário do app lê as opções da
    conta atual, célula a célula (EntradaMeta.opcoesRef). Intervalo só de constantes vai como lista fixa; célula
    vazia nele é a opção "em branco" (automático), que vai como null."""
    if f1 is None:
        return None, None
    f1 = f1.lstrip('=')
    if f1.startswith('"'):
        return [x for x in f1.strip('"').split(',')], None
    m = re.fullmatch(r"'?([^'!]+)'?!\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)", f1)
    if m:
        aba, c1, r1, c2, r2 = m.groups()
        cels = [c for linha in wb[aba][f'{c1}{r1}:{c2}{r2}'] for c in linha]
        if any(isinstance(c.value, str) and c.value.startswith('=') for c in cels):
            return None, f'{aba}!{c1}{r1}:{c2}{r2}'
        return [c.value for c in cels], None
    return None, None


# Entradas: uma por linha amarela da aba Entradas, na ordem da aba, com a seção (faixa azul-marinho) em que está.
E = wb['Entradas']
opcoes_por_celula = {}
for dv in E.data_validations.dataValidation:
    ops = opcoes_da_validacao(E, dv.formula1)
    for rng in str(dv.sqref).split():
        for linha in E[rng] if ':' in rng else ((E[rng],),):
            for c in linha:
                opcoes_por_celula[c.coordinate] = ops

entradas, secao = [], None
for r in range(5, E.max_row + 1):
    a, b = E.cell(r, 1), E.cell(r, 2)
    if a.fill.fill_type == 'solid' and (a.fill.fgColor.rgb or '').endswith('1F3864'):
        secao = a.value
        continue
    if not (b.fill.fill_type == 'solid' and (b.fill.fgColor.rgb or '').endswith('FFF2CC')):
        continue
    nm = nome_de.get(('Entradas', f'B{r}'))
    if not nm:
        continue
    fig = E.cell(r, 5).value
    entradas.append({
        'nome': nm, 'rotulo': a.value, 'padrao': b.value, 'unidade': E.cell(r, 3).value or '',
        'nota': E.cell(r, 4).value or '', 'figura': fig if isinstance(fig, str) and fig.startswith('Fig') else None,
        'opcoes': opcoes_por_celula.get(f'B{r}', (None, None))[0], 'formato': b.number_format, 'secao': secao,
        'ref': f'Entradas!B{r}',
        **({'opcoesRef': opcoes_por_celula[f'B{r}'][1]} if opcoes_por_celula.get(f'B{r}', (None, None))[1] else {}),
    })

h = hashlib.sha256()
for g in GERADOR:
    h.update(open(os.path.join(AQUI, g), 'rb').read())

os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump({'versao': h.hexdigest()[:16], 'abas': [ws.title for ws in wb if ws.title != 'Ilustrações'],
           'nomes': nomes, 'entradas': entradas, 'celulas': celulas},
          open(OUT, 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
print('ok', OUT, len(celulas), 'células,', len(nomes), 'nomes,', len(entradas), 'entradas, versão', h.hexdigest()[:16])
