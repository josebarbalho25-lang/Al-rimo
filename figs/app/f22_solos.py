# Fig. 22 (app, nova) — valores de referência do solo: as tabelas que a aba Solo e Empuxo usa para sugerir γ e φ'
# (Godoy, Alonso, Gerscovich) e, desde 09/10, a de argila por consistência (c', φ' de Joppert; su de Teixeira e Godoy). É rótulo + valor, sem texto explicativo. Os números vêm das
# células da planilha (tabelas.cel). DEDUÇÃO de escopo: tabela como "imagem de referência" — decisão do Jose.
from applib import Fig
from tabelas import cel, tabela

SE = 'Solo e Empuxo!'


def desenhar():
    s = Fig(22, 1000, 700)
    # areia: γ por NSPT e umidade (Godoy 1972)
    linhas = [[cel(f'{SE}A{r}'), cel(f'{SE}E{r}'), cel(f'{SE}B{r}'), cel(f'{SE}C{r}'), cel(f'{SE}D{r}')] for r in range(25, 30)]
    w1, h1 = tabela(s, 40, 40, 'Areia — γ (kN/m³) · Godoy (1972)', ['N_{SPT} ≥', 'compacidade', 'seca', 'úmida', 'saturada'], linhas,
                    campos_col=[['NSPT'], None, ['Umidade', 'gama_solo'], ['Umidade', 'gama_solo'], ['Umidade', 'gama_solo']],
                    campo_titulo=['Tipo_solo'], alinhar=['middle', 'start', 'middle', 'middle', 'middle'])
    # areia: φ por NSPT (Alonso)
    linhas = [[cel(f'{SE}F{r}'), cel(f'{SE}G{r}')] for r in range(25, 30)]
    tabela(s, 40 + w1 + 50, 40, 'Areia — φ\' · Alonso (2010)', ['N_{SPT} ≥', 'φ\' (°)'], linhas,
           campos_col=[['NSPT'], ['phi_solo']], campo_titulo=['Tipo_solo'])
    y2 = 40 + h1 + 60
    # argila: γ por NSPT (Godoy 1972)
    linhas = [[cel(f'{SE}J{r}'), cel(f'{SE}L{r}'), cel(f'{SE}K{r}')] for r in range(25, 30)]
    w3, h3 = tabela(s, 40, y2, 'Argila — γ (kN/m³) · Godoy (1972)', ['N_{SPT} ≥', 'consistência', 'γ'], linhas,
                    campos_col=[['NSPT'], None, ['gama_solo']], campo_titulo=['Tipo_solo'], alinhar=['middle', 'start', 'middle'])
    # Gerscovich: classes de solo do Rio de Janeiro
    linhas = [[cel(f'{SE}A{r}'), cel(f'{SE}B{r}'), cel(f'{SE}C{r}')] for r in range(32, 39)]
    w4, h4 = tabela(s, 40 + w3 + 50, y2, 'Classes de solo · Gerscovich', ['classe', 'γ (kN/m³)', 'φ\' (°)'], linhas,
                    campos_col=[['Classe_G'], ['Classe_G', 'gama_solo'], ['Classe_G', 'phi_solo']], alinhar=['start', 'middle', 'middle'])
    # argila por consistência (09/10): c', φ' e su de referência — a tabela N23:S29 da aba Solo e Empuxo (o γ dela é o
    # de Godoy, já desenhado acima). A calculadora do modal (NSPT → linha desta tabela) fica embaixo da figura.
    y3 = y2 + max(h3, h4) + 60
    linhas = [[cel(f'{SE}{c}{r}') for c in 'NOQRS'] for r in range(25, 30)]
    tabela(s, 40, y3, 'Argila — c\', φ\' · Joppert (2007) · s_{u} = 10·N · Teixeira e Godoy (1996)',
           ['N_{SPT} ≥', 'consistência', 'c\' (kPa)', 'φ\' (°)', 's_{u} (kPa)'], linhas,
           campos_col=[['NSPT'], None, ['c_solo'], ['phi_solo'], None], campo_titulo=['Tipo_solo'],
           alinhar=['middle', 'start', 'middle', 'middle', 'middle'])
    return s
