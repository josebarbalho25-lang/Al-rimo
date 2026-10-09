"""Despeja a planilha gerada como especificação legível por máquina: cada célula preenchida, com rótulo da linha,
fórmula (ou valor), unidade, observação, nome definido e o tipo pela cor (entrada/sugestão/resultado).
É o contrato do motor do app: o app calcula os MESMOS nomes que a planilha, e o golden.py confere número a número.
Uso: python tools/spec_planilha.py [saida.json]   (padrão: dados/spec_planilha.json)"""
import json, os, subprocess, sys, tempfile
import openpyxl

AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.dirname(AQUI)
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dados', 'spec_planilha.json')
KIND = {'FFF2CC': 'entrada', 'E2EFDA': 'sugestao', 'DDEBF7': 'resultado', 'F2F2F2': 'texto'}

tmp = tempfile.mkdtemp(prefix='spec_')
arq = os.path.join(tmp, 'base.xlsx')
subprocess.run([sys.executable, os.path.join(AQUI, 'build_new.py'), arq], check=True, capture_output=True)
wb = openpyxl.load_workbook(arq)

nome_de = {}
for nm, dn in wb.defined_names.items():
    for sh, ref in dn.destinations:
        nome_de[(sh, ref.replace('$', ''))] = nm

abas = []
for ws in wb:
    celulas = []
    for row in ws.iter_rows():
        for c in row:
            if c.value is None and (ws.title, c.coordinate) not in nome_de:
                continue   # vazia e sem nome: não existe. Vazia COM nome é entrada opcional em branco — fica.
            cor = (c.fill.fgColor.rgb or '')[-6:] if c.fill and c.fill.fill_type == 'solid' else ''
            item = {'ref': c.coordinate, 'v': c.value if not hasattr(c.value, 'text') else str(c.value)}
            if (ws.title, c.coordinate) in nome_de: item['nome'] = nome_de[(ws.title, c.coordinate)]
            if cor in KIND: item['tipo'] = KIND[cor]
            if c.hyperlink is not None and c.hyperlink.location: item['link'] = c.hyperlink.location
            if c.comment is not None: item['comentario'] = c.comment.text
            celulas.append(item)
    validacoes = []
    for dv in ws.data_validations.dataValidation:
        validacoes.append({'celulas': str(dv.sqref), 'lista': dv.formula1})
    abas.append({'aba': ws.title, 'celulas': celulas, 'validacoes': validacoes})

nomes = {nm: [f'{sh}!{ref}' for sh, ref in dn.destinations] for nm, dn in wb.defined_names.items()}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump({'abas': abas, 'nomes': nomes}, open(OUT, 'w', encoding='utf8'), ensure_ascii=False, indent=1, default=str)
print('ok', OUT, sum(len(a['celulas']) for a in abas), 'células,', len(nomes), 'nomes')
