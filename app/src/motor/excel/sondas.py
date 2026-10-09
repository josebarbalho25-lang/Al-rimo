"""Sondas: pergunta ao Excel desta máquina o valor de fórmulas avulsas e grava excel/sondas.gerado.json.

Para que serve: o gabarito (dados/golden) prova o motor nas fórmulas da planilha, mas não exercita todo canto do
Excel (ninguém na planilha faz 0,5-0,4-0,1 nem compara "a-b" com "ab"). Estas sondas fixam, com a resposta do
próprio Excel pt-BR, as regras que o motor implementa — comparação com 15 dígitos, "zero forçado", INT/TETO que
enxergam 15 dígitos, DEF.NÚM.DEC/TEXTO/& no formato pt-BR, CORRESP por busca binária etc. O sondas.test.ts
confere o motor contra este arquivo.

Uso (Windows com Excel; abre uma instância PRÓPRIA por COM, não mexe no Excel aberto):
    python app/src/motor/excel/sondas.py
"""
import json, math, os, random
from decimal import Decimal, getcontext
import pythoncom, win32com.client

SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sondas.gerado.json')
ERROS = {-2146826281: '#DIV/0!', -2146826246: '#N/A', -2146826259: '#NAME?', -2146826288: '#NULL!',
         -2146826252: '#NUM!', -2146826265: '#REF!', -2146826273: '#VALUE!'}

# Células auxiliares que as sondas usam (o teste monta a mesma folha). Z1 fica VAZIA de propósito.
AUX = {'Z2': 0.3, 'Z3': 0.1, 'Z4': 0.2, 'Z5': 'OK', 'Z6': 'ok', 'Y1': 0.1, 'Y2': 0.2, 'Y3': '=Z3+Z4',
       'AB1': 'OK', 'AB2': 'NÃO', 'AB3': 'OK', 'AB4': 'x', 'AC1': 10, 'AC2': 20, 'AC3': 30, 'AC4': 40}
for i in range(1, 601):
    AUX[f'AA{i}'] = i * 10   # para conferir a interseção implícita: =AA1:AA600*1 na linha i dá 10·i

Q = '"'
F = []
# precedência e operadores
F += ['=-2^2', '=2^3^2', '=2*-3^2', '=-2^0.5', '=1-2^2', '=2^-1', '=5%', '=-50%', '=1&2', '=1&2+3', '=-Z2^2', '=-(Z2)^2',
      '=(-8)^(1/3)', '=(-8)^3', '=0^0', '=0^-1', '=1/0', '=SQRT(-1)', '=1.1^2', '=1.7^3', '=0.7^2.5', '=3^2', '=10^-2',
      '=SQRT(2)^2', '=2^0.5', '=PI()*12.5^2/400', '=PI()', '=TAN(RADIANS(45))', '=RADIANS(180)', '=TAN(RADIANS(30))']
# comparação: 15 significativos
F += ['=0.1+0.2=0.3', '=1E-16=0', '=Y3=0.3', '=(Z3+Z4)=Z2', '=(Z3+Z4)>=Z2', '=(Z3+Z4)>Z2', '=Z2<(Z3+Z4)', '=(Z3+Z4)<>Z2',
      '=(1+3E-16)=1', '=(1+1E-15)=1', '=(1+5E-15)=1', '=(1+1E-14)=1', '=0.5-0.4-0.1=0']
F += [f'=(1+{k}*2^-52)=1' for k in range(1, 13)] + [f'=(1-{k}*2^-53)=1' for k in range(1, 13)]
F += [f'=(1.9+{k}*2^-52)=1.9' for k in range(1, 13)] + [f'=(1.9+{k}*2^-52)>1.9' for k in range(1, 13)]
F += ['="a"="A"', '="abc"<"ABD"', '=1<"a"', '="a"<TRUE', '=Z1=""', '=Z1=0', '=Z1=FALSE', '=Z5=Z6', '="á"="a"', '="a-b"<"ab"',
      '=LEFT("Líquida",4)="Líqu"']
# zero forçado na última operação + ou −
F += ['=(0.1+0.2)-0.3', '=1*(0.5-0.4-0.1)', '=0.5-0.4-0.1', '=IFERROR(0.5-0.4-0.1,"x")', '=(0.5-0.4-0.1)', '=0.5-0.4-0.1+0',
      '=-(0.5-0.4-0.1)', '=0+(0.5-0.4-0.1)', '=(0.5-0.4)-0.1', '=0.1+0.2-0.3', '=0.3-0.2-0.1', '=-0.1+(0.5-0.4)',
      '=IF(TRUE,0.5-0.4-0.1)', '=MAX(0.5-0.4-0.1)', '=Z2-Z3-Z4', '=Z2-(Z3+Z4)', '=1*((1+2^-52)-1)', '=1-(1+2^-52)']
for k in range(1, 13):
    F += [f'=(1+{k}*2^-52)-1', f'=(1.9+{k}*2^-52)-1.9', f'=(1-{k}*2^-53)-1']
for k in range(5, 10):
    F += [f'=1-(1-{k}*2^-53)', f'=1-(1+{k}*2^-52)', f'=(1-{k}*2^-53)+(-1)', f'=-1+(1+{k}*2^-52)', f'=(2+{k}*2^-51)-2',
          f'=(0.75+{k}*2^-53)-0.75', f'=0.75-(0.75+{k}*2^-53)', f'=1.5-(1-{k}*2^-53)-0.5']
F += [f'=(1+2^-{k})-1' for k in (40, 45, 47, 48, 49, 50)]
# INT / ROUNDUP / ROUNDDOWN / CEILING enxergam 15 dígitos
F += [f'=INT(8-2^-{k})' for k in range(40, 52)] + [f'=ROUNDDOWN(8-2^-{k},0)' for k in range(40, 52)]
F += [f'=ROUNDUP(3+2^-{k}*3,0)' for k in range(40, 52)] + [f'=CEILING(3+2^-{k}*3,1)' for k in range(40, 52)]
F += ['=ROUNDUP(0.1*3,1)', '=ROUNDUP(0.1*3*10,0)', '=ROUNDDOWN((0.7+0.1)*10,0)', '=INT((0.7+0.1)*10)', '=CEILING(0.1*3*10,1)',
      '=(0.7+0.1)*10', '=0.1*3*10', '=0.1*3', '=INT(-8+2^-49)', '=INT(-8+2^-45)', '=INT(-2.5)', '=INT(2.9999999999999996)',
      '=ROUNDUP(-2.1,0)', '=ROUNDDOWN(-2.9,0)', '=ROUNDUP(2.15,1)', '=ROUNDUP(1234.5,-2)', '=ROUNDDOWN(2.675,2)',
      '=ROUNDUP(2.675,2)', '=ROUNDUP(1.005,2)', '=ROUNDUP(0.285,2)', '=ROUNDUP(1.115,2)', '=ROUNDUP(8.345,2)',
      '=ROUNDUP(4.35,1)', '=ROUNDUP(1.11,1)', '=ROUNDDOWN(1.15,1)', '=ROUNDUP(2.6749,2)', '=ROUNDDOWN(-2.675,2)',
      '=ROUNDUP(-2.675,2)', '=ROUNDUP(123456789.12345,3)', '=ROUNDUP(1.115,2)-1.12',
      '=CEILING(-2.5,1)', '=CEILING(2.5,-1)', '=CEILING(-2.5,-1)', '=CEILING(2.1,0)', '=CEILING(0.3,0.1)',
      '=CEILING(2.000000000000001,1)']
# DEF.NÚM.DEC (FIXED) e TEXTO
F += ['=FIXED(1234.5678,2)', '=FIXED(2.675,2)', '=FIXED(1.005,2)', '=FIXED(0.785,2)', '=FIXED(-2.5,0)', '=FIXED(1234.5,0)',
      '=FIXED(1234567.891,1)', '=FIXED(0.5,0)', '=FIXED(-0.4,0)', '=FIXED(12.5,-1)', '=FIXED(1234.5,1,TRUE)',
      '=FIXED(0.1+0.2,16)', '=FIXED(1E+16,0)', '=FIXED(-0.004,2)', '=FIXED(0.145,2)', '=FIXED(1.45,1)', '=FIXED(-1.45,1)',
      '=FIXED(1E-20,2)', '=FIXED(0.1+0.2,20)', '=FIXED(123.456,-1)', '=FIXED(-1234.5,0)', '=FIXED(5,1)', '=FIXED("3",1)',
      '=FIXED(TRUE,1)']
F += ['=TEXT(0.225,"0%")', '=TEXT(0.005,"0%")', '=TEXT(1.5,"0%")', '=TEXT(-0.125,"0%")', '=TEXT(0.125,"0%")',
      '=TEXT(12.345,"0%")', '=TEXT(0.145,"0%")', '=TEXT(-0.004,"0%")', '=TEXT("abc","0%")', '=TEXT(1234.5,"0%")',
      '=TEXT(0.5,"0%")', '=TEXT(0.995,"0%")', '=TEXT(0.0049999,"0%")', '=TEXT(Z1,"0%")', '=TEXT(TRUE,"0%")',
      '=TEXT(0.5,"0")', '=TEXT(2.5,"0")', '=TEXT(0.123,"0.0%")', '=TEXT(0.123,"0,0%")', '=TEXT(1234.5,"0")', '=TEXT("0,5","0%")']
# número → texto (formato Geral pt-BR)
F += [x + '&""' for x in ['=1/3', '=(0.1+0.2)', '=1E+15', '=1234567890123456', '=123456789012345', '=0.00001', '=0.000000001',
                         '=1E-10', '=TRUE', '=-0.5', '=1E+21', '=12345678901', '=1E+19', '=1E+20', '=123456789012345678',
                         '=1/7*1E-5', '=2/3*1E+16', '=(1+2^-50)', '=-1/3', '=1/3*1E-18', '=-1E+19', '=-1E-18', '=1.5E+19',
                         '=1.23E+19', '=0.000123456789012345', '=0.0000123456789012345', '=0.00000123456789012345',
                         '=1234567.5', '=0.1', '=100', '=-0', '=1.23456789012345E-12']]
F += [f'=1E-{e}&""' for e in range(15, 22)] + [f'=1.5E-{e}&""' for e in range(15, 22)]
F += ['=2.5&"x"', '="a"&1.5', '="x"&-0.0000000000000001', '=1&TRUE', '=5&Z1', '=Z1&"x"']
# texto → número (pt-BR)
F += ['=VALUE("20")', '=VALUE("2,5")', '=VALUE("2.5")', '=VALUE(" 3 ")', '=VALUE("1.234,5")', '="2,5"*2', '="2.5"*2',
      '=""+1', '=TRUE+1', '=Z1+1', '="50%"*1', '=ABS("-2")', '=SQRT("4")', '=SQRT(Z1)']
# SE, SEERRO, E, OU, ÉNÚM, ESCOLHER
F += ['=IF(1>2,1)', '=IF(1<2,,2)', '=IF(1>2,1,)', '=IF("x",1,2)', '=IF("TRUE",1,2)', '=IF("VERDADEIRO",1,2)', '=IF(Z1,1,2)',
      '=IF(TRUE,Z1)', '=IFERROR(1/0,Z1)', '=IFERROR(#N/A,1)', '=Z1',
      '=AND(1,TRUE)', '=AND("x")', '=AND(Z5,TRUE)', '=AND(Z1)', '=OR(0,Z1)', '=AND(1/0,FALSE)', '=AND(TRUE,"")', '=OR(Z5)',
      '=OR(FALSE,Z1)', '=ISNUMBER(Z1)', '=ISNUMBER("1")', '=ISNUMBER(1/0)', '=ISNUMBER(Z5)', '=ISNUMBER(Z2:Z4)',
      '=CHOOSE(2.7,"a","b","c")', '=CHOOSE(0,"a")', '=CHOOSE(4,"a")', '=ABS(-3)']
# agregadores
F += ['=MAX("3",2)', '=MAX(TRUE,0)', '=MAX(Z1,-1)', '=MAX(Z5,-1)', '=MAX("x",1)', '=MAX({1,"9",TRUE})', '=SUM({1,2,"3"})',
      '=SUM("3",1)', '=SUM(Z2:Z5)', '=SUM(TRUE,1)', '=MIN(Z2:Z6)', '=MAX(AC1:AC4)']
# texto
F += ['=LEFT(TRUE,3)', '=LEFT(12.5,3)', '=LEFT("abc")', '=LEFT("abc",0)', '=LEFT("abc",-1)', '=LEFT(Z1,3)', '=MID("C20",2,2)',
      '=MID("C20",5,2)', '=VALUE(MID("C20",2,2))']
# busca
F += ['=MATCH(5,{1,3,5,7},1)', '=MATCH(6,{1,3,5,7},1)', '=MATCH(0,{1,3,5,7},1)', '=MATCH(0.5,{1,0.8,0.6,0.4},-1)',
      '=MATCH("c25",{"C20","C25","C30"},0)', '=MATCH("C*",{"A","C25"},0)', '=MATCH(1,{TRUE,1},0)', '=MATCH(2,{1,"2",2},0)',
      '=MATCH(9,{1,3,5,7},1)', '=MATCH(0.3,{0.1,0.2,0.3},0)', '=MATCH(0.1+0.2,{0.1,0.2,0.3},0)',
      '=MATCH(0.1+0.2,{0.1,0.2,0.3},1)', '=MATCH(0.3,Y1:Y3,1)', '=MATCH(0.3,Y1:Y3,0)', '=VLOOKUP(0.3,Y1:Y3,1,FALSE)',
      '=MATCH(Y3,{0.1,0.2,0.3},0)', '=MATCH(2,{1,2,3,2,5},1)', '=MATCH(4,{1,5,2,3,4},1)', '=MATCH(3,{5,4,3,2,1},1)',
      '=MATCH("b",{"a","b","c"},1)', '=MATCH(2.5,{1,"x",2,3},1)', '=MATCH(0.65,{1,0.9,0.8,0.7,0.6,0.5},-1)',
      '=MATCH(1.2,{1,0.9,0.8},-1)', '=MATCH(0.1,{1,0.9,0.8},-1)', '=MATCH(2,{1,2,2,2,3},1)', '=MATCH(2,{2,2,2,2,2},1)',
      '=MATCH(2,{1,2,2,2,2,2,2,3},1)', '=MATCH(2.5,{1,2,"x",3},1)', '=MATCH(2.5,{"x",1,2,3},1)',
      '=MATCH(0.8,{1,0.8,0.8,0.8,0.5},-1)', '=MATCH(2,{1,2,2,2,3},0)', '=MATCH("b",{"a","b","b","c"},1)',
      '=MATCH(3,{1,2},1)', '=MATCH(1,{1},-1)', '=MATCH(5,{3,1},-1)', '=MATCH("OK",AB1:AB4,0)', '=MATCH("ok",AB2:AB4,0)',
      '=VLOOKUP("b",{"A",1;"B",2},2,FALSE)', '=VLOOKUP(3,{1,10;3,30},2,FALSE)', '=VLOOKUP(4,{1,10;3,30},2,FALSE)',
      '=VLOOKUP(3,{1,10;3,30},3,FALSE)', '=VLOOKUP(2.5,{1,10;2,20;3,30},2,TRUE)', '=VLOOKUP(2.5,{1,10;2,20;3,30},2)']
# ÍNDICE, matriz, SOMARPRODUTO, interseção implícita
F += ['=INDEX({6.3,8,10},2)', '=INDEX({1;2;3},2)', '=INDEX({1,2;3,4},2,1)', '=INDEX({1,2,3},5)', '=INDEX({1,2,3},2.9)',
      '=INDEX({1,2;3,4},0,1)', '=INDEX(AC1:AC4,3)', '=INDEX(CHOOSE(2,AB1:AB4,AC1:AC4),2)', '=INDEX(IF(TRUE,AC1:AC4),4)',
      '=SUMPRODUCT(({1,2,3}<2.5)*1)', '=SUMPRODUCT({1,2,3}<2.5)', '=SUMPRODUCT({1,"a",3})', '=SUMPRODUCT(5)',
      '=SUMPRODUCT({1,2},{3,4,5})', '=SUMPRODUCT(MAX((AB1:AB4="OK")*AC1:AC4))', '=SUMPRODUCT((AC1:AC4>15)*1)',
      '=SUMPRODUCT((Y1:Y3<0.3)*1)', '=SUMPRODUCT((Y1:Y3>=0.3)*1)', '=SUMPRODUCT(AC1:AC4,AC1:AC4)',
      '={1,2,3}*2', '=AA1:AA600*1', '=AA1:AA600', '=AC1:AC4*1', '=ISNUMBER(AA1:AA600)', '=AA1:AA600&""']

# o Excel corta número digitado com mais de 15 algarismos (não arredonda): 1234567890123456 vira ...450
F += ['=1234567890123456', '=2.99999999999999999', '=0.30000000000000004', '=123456789012345678901']

# ───── regras que entraram depois da revisão adversarial (lente semântica). Sem estas sondas, cada regra abaixo
# ficava provada só num rascunho fora do projeto; aqui ela vira prova permanente, refeita pelo Excel a cada geração.

# Índice visto com 15 dígitos em ÍNDICE, PROCV (coluna), ESQUERDA (nº de caracteres) e DEF.NÚM.DEC (casas);
# ESCOLHER, EXT.TEXTO e as casas de ARRED.PARA.CIMA/BAIXO cortam o número cru. O Excel não é coerente entre
# funções, por isso cada uma tem a sua sonda.
F += ['=CHOOSE(3-2^-51,"a","b","c")', '=INDEX({10,20,30},3-2^-51)', '=LEFT("abcdef",3-2^-51)', '=MID("abcdef",3-2^-51,2)',
      '=MID("abcdef",2,3-2^-51)', '=VLOOKUP(1,{1,10,20,30},4-2^-50,FALSE)', '=FIXED(1.25,2-2^-52)',
      '=ROUNDDOWN(1.23456,3-2^-51)', '=ROUNDUP(1.23456,3-2^-51)', '=CHOOSE(2+2^-51,"a","b","c")',
      '=INDEX({10,20,30},0.9999999999999999)', '=CHOOSE(0.9999999999999999,"a","b")', '=MATCH(30-2^-48,{10,20,30},1)',
      '=IF("1",1,2)', '=AND("VERDADEIRO")', '=(-8)^(2/3)', '=TEXT(0.0049999999999999999,"0%")']
# número minúsculo (abaixo do menor double normal) vira 0 no Excel
F += ['=1E-308/1E10', '=1E-308/1E10=0', '=(1E-308/1E10)*1E300', '=-1E-308/1E10']
# referência × valor: SE e ESCOLHER devolvem REFERÊNCIA (MÁXIMO ignora o texto dela); SEERRO devolve VALOR
F += ['=MAX(IFERROR(Z5,0),-1)', '=MAX(IF(TRUE,Z5),-1)', '=MAX(CHOOSE(1,Z5),-1)', '=IFERROR(Z1,"")&"x"', '=IF(TRUE,Z1)&"x"',
      '=ISNUMBER(IFERROR(Z1,""))', '=IFERROR(Z1,"")=0', '=IFERROR(Z1,"")=""', '=MIN(IFERROR(Z5,9),5)', '=AND(TRUE,"x")',
      '=AND(TRUE,IF(TRUE,Z5))', '=TEXT(-0.004,"0%")']
# CORRESP/PROCV com o procurado VAZIO (é o que acontece em Solo e Empuxo!B5:B7 com o NSPT em branco) e com
# número escrito como TEXTO (fbk_ "8" no lugar de 8: PROCV não acha, é por isso que a entrada é convertida)
F += ['=MATCH(Z1,{0,5,9},1)', '=MATCH(Z1,{0,5,9},0)', '=MATCH(Z1,{1,5,9},1)', '=MATCH(Z1,AC1:AC4,1)',
      '=VLOOKUP(Z1,{0,1;5,2},2,FALSE)', '=VLOOKUP(Z1,{0,1;5,2},2,TRUE)', '=VLOOKUP("8",{3,1;8,2},2,FALSE)',
      '=MATCH("13",{13,18,11},0)', '="19"=19']
# Célula VAZIA (Z1) em cada posição de argumento de cada função que a planilha usa. Entrada opcional em branco é
# caminho normal do app (e o usuário pode apagar qualquer campo); o CORRESP com procurado vazio mostrou que o
# vazio não se comporta igual em todo lugar — então cada função tem a sua sonda, em vez de supor.
F += ['=INDEX({10,20,30},Z1)', '=INDEX({10;20;30},Z1)', '=INDEX(AC1:AC4,Z1)', '=INDEX({1,2;3,4},Z1,1)',
      '=INDEX({1,2;3,4},1,Z1)', '=CHOOSE(Z1,"a","b")', '=LEFT(Z1,2)', '=LEFT("abc",Z1)', '=MID(Z1,1,2)', '=MID("abc",Z1,2)',
      '=MID("abc",1,Z1)', '=VALUE(Z1)', '=FIXED(Z1,2)', '=FIXED(1.5,Z1)', '=FIXED(1234.5,1,Z1)', '=TEXT(1.5,Z1)',
      '=ABS(Z1)', '=TAN(Z1)', '=RADIANS(Z1)', '=INT(Z1)', '=ROUNDUP(Z1,0)', '=ROUNDUP(1.25,Z1)', '=ROUNDDOWN(1.25,Z1)',
      '=CEILING(Z1,1)', '=CEILING(2.5,Z1)', '=SUM(Z1)', '=MIN(Z1)', '=MAX(Z1)', '=SUMPRODUCT(Z1)', '=SUMPRODUCT(Z1:Z2)',
      '=OR(Z1,TRUE)', '=IF(Z1="",1,2)', '=IFERROR(Z1,1)', '=VLOOKUP(1,{1,2},Z1,FALSE)', '=VLOOKUP(1,{1,2},2,Z1)',
      '=MATCH(1,{1,2},Z1)', '=MATCH(2,{1,2},Z1)', '=Z1^2', '=2^Z1', '=Z1/2', '=2/Z1', '=-Z1', '=Z1%', '=Z1&Z1', '=Z1>-1',
      '=Z1<"a"', '=MATCH(Z1,{"",0},0)', '=MATCH("",{0,""},0)', '=MATCH(Z1,{"a","b"},1)', '=VLOOKUP(Z1,{"a",1;"b",2},2,TRUE)',
      '=MATCH(Z1,{-1,0,1},1)', '=MATCH(Z1,{1,0,-1},-1)', '=ISNUMBER(MATCH(Z1,{0,5},1))']
# os vizinhos das duas surpresas que a varredura do vazio achou: SOMARPRODUTO de UMA célula e TEXTO com formato ""
F += ['=SUMPRODUCT(Z2)', '=SUMPRODUCT(Z5)', '=SUMPRODUCT("a")', '=SUMPRODUCT("3")', '=SUMPRODUCT(TRUE)', '=SUMPRODUCT(Z1:Z1)',
      '=SUMPRODUCT(Z1,Z2)', '=SUMPRODUCT(Z1*1)', '=SUMPRODUCT(Z5:Z6)', '=SUMPRODUCT(Z2:Z3,Z1:Z2)', '=SUMPRODUCT(1/0)',
      '=SUMPRODUCT(Z1+0)', '=SUMPRODUCT(IF(TRUE,Z1))', '=SUMPRODUCT(INDEX(Z1:Z2,1))',
      '=TEXT(1.5,"")', '=TEXT(-1.5,"")', '=TEXT("abc","")', '=TEXT(TRUE,"")', '=TEXT(Z1,"")', '=TEXT(0,"")']

# Potência inteira e RADIANS bit a bit. O Excel MULTIPLICA (x^2 = x·x, x^3 = x·x·x, x^4 = (x²)²) e faz
# RADIANS = x·(π/180), cada multiplicação com o arredondamento dele (x87.ts); Math.pow e x·π/180 erram o último bit
# em 25 a 50% dos casos. Valores sorteados com semente fixa (o arquivo gerado tem de ser o mesmo a cada rodada) mais
# os números redondos que a planilha usa. O 18,2^4 era a exceção antes do arredondamento duplo; agora bate.
_rng = random.Random(11)
XS = [_rng.uniform(0.01, 50) for _ in range(60)]
XS += [round(_rng.uniform(0.1, 30), _rng.choice([1, 2, 3])) for _ in range(30)]
XS += [9.5, 9.3, 9.0, 1.1, 0.3, 2.675, 7.25, 12.5, 6.3, 3.7, 14 - 2 * 2.5, 18.2]
for i, x in enumerate(XS, start=1):
    AUX[f'AD{i}'] = x
    F += [f'=AD{i}^2', f'=AD{i}^3', f'=AD{i}^4', f'=RADIANS(AD{i})', f'=AD{i}*AD{i}*AD{i}']


def _vizinhos_do_meio(dig, exp10):
    """Os dois doubles colados no MEIO entre dois decimais de 15 algarismos (dig e dig+1, vezes 10^exp10).
    Comparar = e < entre eles separa a regra dos 15 dígitos de qualquer tolerância relativa fixa."""
    meio = (Decimal(dig) + Decimal('0.5')).scaleb(exp10)
    x = float(meio)
    if Decimal(x) == meio:
        return None
    lo, hi = (x, math.nextafter(x, math.inf)) if Decimal(x) < meio else (math.nextafter(x, -math.inf), x)
    return lo, hi


getcontext().prec = 80
_rng = random.Random(23)
_k = 0
while _k < 25:
    par = _vizinhos_do_meio(_rng.randrange(10 ** 14, 10 ** 15 - 1), _rng.randrange(-20, -6))
    if not par:
        continue
    _k += 1
    lo, hi = par
    AUX[f'AE{_k}'] = lo
    AUX[f'AF{_k}'] = hi
    AUX[f'AG{_k}'] = math.nextafter(lo, -math.inf)   # mais um abaixo: mesmo número com 15 dígitos que o lo
    AUX[f'AH{_k}'] = math.nextafter(hi, math.inf)    # mais um acima: mesmo número com 15 dígitos que o hi
    F += [f'=AE{_k}=AF{_k}', f'=AE{_k}<AF{_k}', f'=AG{_k}=AE{_k}', f'=AF{_k}=AH{_k}', f'=AG{_k}<AE{_k}',
          f'=AF{_k}>=AH{_k}']


# ───── a aritmética do Excel no último bit (excel/x87.ts): cada operação passa pelos 64 bits do x87 antes de virar
# double. Os pares abaixo foram ESCOLHIDOS (busca com frações exatas) para cair na borda em que o arredondamento
# duplo difere do direto — é ali que um motor com a aritmética do JavaScript erra. Na primeira rodada o Excel deu o
# arredondamento duplo em todos os 191 casos assim (aqui ficam 20 por operação).
BORDA_80 = {
    '+': [
        (0.8467981845205925, 38147.31268769192), (0.08164956041218706, 53994.37604651729),
        (1384.512223418686, 0.35873621045368514), (4506.569329314372, 0.7877440233000923),
        (6566.6592381606315, 0.9173562593364293), (9.93806322650925, 198403.9071409736),
        (95109.43504816857, 7.524495569428837), (8227.113141504035, 0.09584122122851084),
        (4611.614739424125, 0.465863488852392), (789685.1768093371, 0.36421816103391386),
        (70964.8485174543, 6.995711886942443), (465438.56568028213, 2.3782741709437545),
        (0.8988346300930066, 13154.991650703489), (0.7175882541450858, 48911.41756706856),
        (27.82517929008466, 748247.9355066069), (0.40569962879816845, 240909.64382276888),
        (86105.77952118404, 0.16143294904759525), (5.485144830628992, 479226.35285895446),
        (99118.86363207312, 1.8352517309467673), (5567.590154219182, 0.27340614479771846),
    ],
    '-': [
        (0.3191935458962686, 84894.74314732343), (0.6939055861694207, 56100.99871308703),
        (0.7042450796948285, 5440.431547600848), (97.13226496227433, 395705.39182017965),
        (788088.2002104298, 1.983311310119477), (0.6700457142969756, 8767.702792377031),
        (9.550528638588716, 546842.9066619851), (0.9325756648904436, 666017.9060063013),
        (59.42193311179287, 536956.460271655), (46105.095238480295, 0.7246573272896062),
        (0.07308459586943164, 2451.5167659893823), (2.032251361040837, 34891.15557857566),
        (907003.5175098316, 89.77320389525269), (2703.735767540319, 0.5186009885103432),
        (58127.30020426343, 0.4967650700091311), (3.6041379724356366, 22971.52495032518),
        (46.83189352513108, 0.005179723903584234), (596936.0004494791, 152.20690328482303),
        (0.3906515192556983, 29104.999855754333), (7026.18216786704, 0.3493740104017887),
    ],
    '*': [
        (9.403487358386542, 776742.6925782294), (0.6832470678415218, 0.06224247429885534),
        (0.2453685640743321, 7.289236200753866), (50528.12246983712, 7.658445731020711),
        (81.01620100856519, 354538.7704718661), (29022.753256476557, 89.11853306028057),
        (6.320739641241133, 36171.642519917186), (0.511727425517359, 76607.63399609597),
        (26.708263994067227, 0.7757277111368583), (854141.2386854119, 450.66493616993523),
        (7270.697528519855, 4192.206295034036), (0.6778397036667689, 54.108354473165434),
        (46.52326568902934, 91725.90411958397), (6519.641328312429, 80503.32080604434),
        (8.361797520736102, 100632.53144936128), (646251.2264827782, 148.677754759163),
        (319686.1328089682, 63416.102462597315), (9.679424839196411, 6.425871009113993),
        (0.15968554022769896, 63.42875606169341), (0.3486105007702113, 0.7246735131416142),
    ],
    '/': [
        (24719.58409913658, 412728.24066933664), (6576.316746482789, 289.7215051150676),
        (181180.0096700721, 0.08744741752339051), (0.29819236907075025, 2108.5480954575223),
        (7745.119313419493, 95.73795981165249), (31196.660776635228, 9.335554743743197),
        (143.79770143834077, 0.6261796437742732), (110.74564589906502, 94869.21876691344),
        (9251.803793600637, 534591.5311610635), (71.80746168899151, 4362.056017758008),
        (9.002768937189245, 251.0992451125019), (63903.22970451555, 1.8665674863768462),
        (71.61365413922873, 357489.4758419637), (0.5105861639129153, 571206.764973849),
        (4669.451144816938, 8.788630943042978), (81973.0848920274, 843.0000967416839),
        (572759.8204292927, 448774.8666428341), (179.43856692909026, 917.0901133951621),
        (336.5947591770252, 5401.213954168592), (327856.442118251, 5703.311655418005),
    ],
    'sqrt': [
        567121.7504732239, 490380.20319350687, 55394.34959317257, 7.697948520272319, 48.32622597661268,
        31498.876326575795, 424.3434684294939, 3546.9053014166666, 413.8653663775484, 898856.023218109,
        0.45893388171142746, 61854.00630693409, 3.664040314063107, 44.268835480085315, 514.4003861852555,
        0.4007617032400637, 99.06982269808424, 63.416387162517914, 0.28749272571786005, 959034.3760305023,
    ],
}
_lin = 0
for op, itens in BORDA_80.items():
    for it in itens:
        _lin += 1
        a, b = (it, None) if op == 'sqrt' else it
        AUX[f'AI{_lin}'] = a
        if b is not None:
            AUX[f'AJ{_lin}'] = b
        if op == 'sqrt':
            F += [f'=SQRT(AI{_lin})', f'=AI{_lin}^0.5']
        else:
            F += [f'=AI{_lin}{op}AJ{_lin}']
            if op == '+':
                F += [f'=SUM(AI{_lin},AJ{_lin})', f'=SUM(AI{_lin}:AJ{_lin})']
            if op == '*':
                F += [f'=SUMPRODUCT(AI{_lin},AJ{_lin})', f'=AI{_lin}*AJ{_lin}*1', f'=-AI{_lin}*AJ{_lin}']
# entre uma operação e a seguinte o resultado volta a double (o x87 grava): A·B − fl(A·B) dá 0, e não o resto
_rng = random.Random(9)
for i in range(1, 11):
    a, b = _rng.uniform(1, 100), _rng.uniform(1, 100)
    AUX[f'AK{i}'], AUX[f'AL{i}'], AUX[f'AM{i}'] = a, b, a * b
    F += [f'=1*(AK{i}*AL{i}-AM{i})', f'=1*(AK{i}*AL{i}/AL{i}-AK{i})']
F += ['=SUM(1,2^-60,-1)', '=1*((1+2^-60)-1)', '=SQRT(2)*SQRT(2)', '=1*(SQRT(2)*SQRT(2)-2)', '=1*(0.1*3-0.3)']

# Potência fracionária = exp(y·ln x) com a EXP do x87, e TAN reduzindo pelo π de 64 bits (excel/x87.ts).
for i, x in enumerate(XS, start=1):
    F += [f'=AD{i}^(1/3)', f'=AD{i}^(2/3)', f'=AD{i}^1.5', f'=AD{i}^2.5', f'=AD{i}^0.5', f'=TAN(AD{i}/30)',
          f'=TAN(RADIANS(AD{i}))', f'=(12*AD{i}/7)^(1/3)']
F += ['=13.765389519015969^2.5', '=TAN(47.21345776909179/30)', '=TAN(1.5707963267948966)', '=TAN(-1)', '=TAN(0)',
      '=TAN(3.14159265358979)', '=TAN(RADIANS(89.9))', '=TAN(RADIANS(-45))', '=0.5^(1/3)', '=1^(1/3)', '=1E-10^(1/3)',
      '=1E10^(2/3)', '=(-27)^(1/3)', '=(-27)^(-1/3)', '=2^0.25',
      # bordas: TAN só até 2^27 rad; estouro e número minúsculo na potência
      '=TAN(134217727)', '=TAN(134217728)', '=TAN(134217727.5)', '=TAN(-134217728)', '=TAN(1E9)', '=TAN(1000000)',
      '=TAN(12345.678)', '=2^1023.99', '=2^1024', '=10^308.3', '=0.5^1074', '=(1E-200)^2', '=(1E-200)^2.5']


# Potências escolhidas (busca com frações exatas) para cair onde os modelos da EXP do x87 discordam entre si: só o
# modelo de x87.exp80 (u, 2^f−1 e 1+… em 64 bits) acerta as 60; a exp corretamente arredondada acerta 16.
POT_BORDA = [
    (49.690272682188194, 1.5), (400.87703012737495, 3.7), (75.90906680679346, 0.75), (981.4429534059042, 2.5),
    (465.56222421908865, 3.7), (376.29283437292816, 2.5), (696.0111336128423, 2.5), (19.777329928865647, 1.5),
    (559.3142243980742, 3.7), (576.6753799484951, 3.7), (800.3171374826259, 0.6666666666666666),
    (331.2535711373076, 2.5), (860.071902038537, 2.5), (11.891467385842303, 0.75), (140.557836263339, 3.7),
    (814.0858973563354, 2.5), (465.79469486817567, 0.6666666666666666), (278.37232943314183, 2.5),
    (180.27928198349866, 2.5), (288.37828858241284, 2.5), (133.6976842105513, 3.7), (952.192967600549, 1.5),
    (15.363146220542736, 0.14285714285714285), (875.1470236803304, 1.5), (882.2539453660816, 3.7),
    (90.35071681725537, 2.5), (730.756853463505, 3.7), (846.2430490817769, 3.7),
    (567.1943798297923, 0.6666666666666666), (991.7723588388687, 2.5), (697.1195127052487, 2.5),
    (579.840616954969, 0.75), (461.7423459134477, 0.14285714285714285), (595.5168178556554, 0.75),
    (989.9467297845996, 3.7), (835.614892640381, 0.25), (421.09280267565003, 2.5), (488.38495168545586, 0.75),
    (433.8195262680162, 2.5), (188.0362405512871, 1.5), (463.70318923833764, 0.25), (44.02116242420166, 1.5),
    (449.9222483378542, 2.5), (177.58437385250244, 3.7), (749.6753833774131, 2.5), (784.7871153997263, 2.5),
    (402.80977837733343, 2.5), (876.577270321814, 2.5), (217.00834324653596, 0.75), (684.8714921846571, 2.5),
    (283.03035244543787, 3.7), (345.8636619079635, 3.7), (965.8984990939051, 3.7), (624.6958684060762, 3.7),
    (285.4243894423055, 0.6666666666666666), (634.2675100777371, 3.7), (574.2601003856416, 2.5),
    (422.0766216156685, 3.7), (639.3465332823678, 1.5), (174.06313622842555, 0.6666666666666666),
]
for i, (x, y) in enumerate(POT_BORDA, start=1):
    AUX[f'AN{i}'], AUX[f'AO{i}'] = x, y
    F += [f'=AN{i}^AO{i}']

# DIVERGÊNCIAS CONHECIDAS: o Excel responde, o teste mostra a diferença, mas não exige igualdade (exige só que
# continue a um bit dela). Cada uma diz por que o motor não consegue reproduzir.
CONHECIDAS = {
    # o F2XM1 do processador não é corretamente arredondado (erro de até 1 bit em 64): em ~1 a cada 1.700 potências
    # o Excel cai do outro lado do meio. É a única célula do gabarito fora do bit (sorteio16 Contrafortes!B236).
    '=AQ1^(1/3)': 'F2XM1 do processador (sorteio16 Contrafortes!B236)',
    # número → texto exatamente no meio do 15º algarismo: o Excel arredondou para baixo (1 em 300 sondas da lente
    # semântica); a planilha só concatena inteiros e entradas.
    '=AQ2&""': 'texto no meio do 15º algarismo',
}
AUX['AQ1'] = 190.39440929090523
AUX['AQ2'] = 0.001730377551168205
F += list(CONHECIDAS)


def main():
    vistos = set(); fs = []
    for f in F:
        if f not in vistos:
            vistos.add(f); fs.append(f)
    pythoncom.CoInitialize()
    xl = win32com.client.DispatchEx('Excel.Application')
    xl.Visible = False; xl.DisplayAlerts = False; xl.ScreenUpdating = False
    out = []
    versao = f'{xl.Version} build {xl.Build} (idioma {xl.LanguageSettings.LanguageID(2)})'
    try:
        wb = xl.Workbooks.Add()
        ws = wb.Worksheets(1)
        for ref, v in AUX.items():
            if isinstance(v, str) and v.startswith('='):
                ws.Range(ref).Formula = v
            else:
                ws.Range(ref).Value2 = v
        falhas = {}
        for i, f in enumerate(fs):
            try:
                ws.Cells(i + 1, 2).Formula = f
            except Exception as e:   # o próprio Excel recusa a fórmula (ex.: =MIN())
                falhas[i] = str(e)
        xl.CalculateFull()
        for i, f in enumerate(fs):
            if i in falhas:
                continue
            c = ws.Cells(i + 1, 2)
            v = c.Value2
            if isinstance(v, int) and v in ERROS:
                v = {'erro': ERROS[v]}
            item = {'f': f, 'ref': f'B{i + 1}', 'v': v, 'lida': c.Formula}
            if f in CONHECIDAS:
                item['conhecida'] = CONHECIDAS[f]
            out.append(item)
        wb.Close(SaveChanges=False)
    finally:
        xl.Quit(); pythoncom.CoUninitialize()
    json.dump({'gerado_por': 'excel/sondas.py', 'versao_excel': versao, 'aux': AUX, 'sondas': out},
              open(SAIDA, 'w', encoding='utf8'), ensure_ascii=False, indent=0)
    print('ok', len(out), 'sondas em', SAIDA)


if __name__ == '__main__':
    main()
