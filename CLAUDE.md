# Al-rimo — muro de arrimo em alvenaria estrutural

Planilha (e, depois, app gratuito) de muro de arrimo em **bloco de concreto**, montada a partir do curso de alvenaria
estrutural do Prof. Matheus Carini (aulas 12.1 a 12.3), do manual da ABCP (Parsekian & Medeiros, "Parâmetros de Projeto
de Alvenaria Estrutural") e da NBR 16868-1:2020. A fundação segue o roteiro da aba "Fundação Sapata Corrida p muro" da
planilha do Eng. Gilberto, adaptado.

Objetivo final: app gratuito (3D, quantitativo, vista frontal, corte lateral, isométrico, memória de cálculo editável e
auditável citando item de norma e fórmula) para atrair público para o Pró-Viga 3D. **Fica separado do A-PORT.**
**Intenção nova (Jose, 13/10):** comercializar — produto físico instalável, licença perpétua, "ver se consigo vender
por 100 reais". Muda: termo de uso (hoje licença gratuita), empacotar o app como programa instalável, controle de
licença, e rever os limites do "app gratuito" (alturas 3,0/4,0). Ainda não decidido o como; anotar e esperar ele.

## Como trabalhar com o Jose

- Português do Brasil, tom casual. Ele é engenheiro estrutural (domina a NBR 6118), não programador.
- **Planilha primeiro.** Ele audita planilha, não código. O app só vem depois da planilha validada.
- Separar sempre o que foi **medido** (print, fórmula, número da aula) do que foi **deduzido** — marcar dedução como tal.
- Fluxo "se bater a gente pula": ele assiste a aula e manda prints; a gente prevê os números antes, ele confere no vídeo.
- Não explicar o básico de engenharia; explicar conceitos especializados fora do domínio dele quando aparecerem.
- Em conta que ele vai assinar, ele faz à mão e usa o Claude como conferente.

## Estrutura

```
tools/build_new.py      gerador (openpyxl). Abas: Entradas, Solo e Empuxo, Muro em balanço, Arranjos,
                        Painel não armado, ELS, Contrafortes, Fundação, Referências, Ilustrações
tools/contrafortes.py   aba Contrafortes (aula 12.3) — executado dentro do build_new (mesmo namespace)
tools/fundacao.py       aba Fundação (sapata corrida) — idem
tools/cenarios.py       VAL123 = contrafortes em concreto 14x39 com a geometria da aula 12.3 (regressão); aplicar()/ler()
                        por nome definido; OPCOES + sortear() = sorteio da varredura e do golden (só valores das listas)
tools/gerar.py          gera planilha/ (só a base, aula 12.2)
tools/testar.py         regressão: reconstrói, recalcula, confere a aula 12.2 e a última versão (base e VAL123);
                        --atualizar regrava a regressão do VAL123
tools/varredura.py      N cenários aleatórios procurando #DIV/0!, #VALOR! etc.
tools/recalc_lo.py      recálculo headless pelo LibreOffice
figs/                   figlib.py + figNN_*.py (SVG) → render.py (PNG, Playwright) → make_pdf.py (índice em PDF)
dados/lib_tabs.json     tabelas de Libânio (Bares/Pinheiro) copiadas da planilha 11 do curso
dados/transcricao_aula_12.3.md   transcrição de todos os prints da aula 12.3
dados/referencia_regressao.json  valores da última versão validada (o testar.py compara com eles: base e VAL123)
planilha/               a planilha entregue (base, aula 12.2)
```

Comandos: `python tools/gerar.py` · `python tools/testar.py` (precisa do LibreOffice) · `python tools/varredura.py 20`.
Figuras: `cd figs && python fig15_sapata.py && python render.py fig15_sapata.svg && python make_pdf.py`.
**Depois de mudar o gerador: rodar `testar.py`.** Se um valor mudar de propósito, atualizar `dados/referencia_regressao.json`
e dizer ao Jose o que mudou e por quê.

## Regras do gerador (lições já aprendidas)

- Tudo por **nome definido** (`line(..., nm='nome')`). Nunca criar nome que pareça célula (`br3`, `tab13`, `cf1`, `R1C1`) —
  o Excel apaga ao "reparar". O build tem um assert que pega isso.
- Excel em PT-BR: listas de validação com vírgula decimal quebram → usar intervalo (ex.: `'Referências'!$L$5:$L$10`).
  Itens de lista não podem ter vírgula. Não usar `TEXT(x;"0.00")` → usar `FIXED`. Matriz inline `{13,18,11}` funciona.
- Listas que dependem de outra entrada (altura × tipo de muro; vão, contraforte, espaçamentos × bloco): intervalo com
  FÓRMULA na aba Referências (colunas AJ em diante, dicionário `LST` no build_new), valores como n·20/100 (mesmo double
  que o digitado). `allow_blank=False` em todas (com "ignorar em branco" e célula vazia no intervalo o Excel aceita
  qualquer coisa). O Excel só confere ao digitar: a linha `lim_lst` ("Entradas nas listas") acusa o que ficou fora
  depois de trocar bloco/tipo. O exportar_motor manda intervalo com fórmula como `opcoesRef` (o app lê as opções da
  conta atual e troca valor fora da lista pela opção mais próxima, mostrando "→"); intervalo só de constantes vai fixo
  (`opcoes`; célula vazia = null = "auto").
- Fórmulas de resultado nas abas ELS, Painel, Contrafortes e Fundação são embrulhadas em `IFERROR(...;"—")` no pós-processamento.
- `finalize.py` liga `fullCalcOnLoad` (Excel recalcula ao abrir).
- Cores: amarelo = entrada, verde = sugestão, azul = resultado. Coluna E das Entradas = link para a figura.

## Decisões do projeto

- **Só bloco de concreto, família 39 (14×39 e 19×39).** Motivo do Jose: cerâmico em arrimo satura mais e tem aderência
  ruim ao graute. O "modo validação" (cerâmico 14×29, só para reproduzir a aula 12.3) SAIU em 09/10 com todo ramo de
  cerâmico (fsd reduzido do furo liso, Em 600·fpk, As,máx 4%, família 14×29 e peça de 44 na modulação). `L_bloco` = 39
  fixo (não é mais entrada; o nome fica porque a conta usa); `eenr` = t (não é mais entrada).
- **Aviso do solo** no topo das Entradas: parâmetros do solo e empuxo são escolha do projetista; recomendar ensaio
  (cisalhamento direto/triaxial); ferramenta só auxilia; o engenheiro é o responsável e valida a memória.
  O Jose despreza a coesão (mesmo com argila coesiva na região, Uberaba/MG).
- **Posição da barra explícita no projeto**: no balanço, barra encostada do lado do solo (Fig. 4); no painel entre
  contrafortes, uma barra vertical em CADA face a 5 cm (Fig. 14); horizontal centralizada na canaleta.
- Contrafortes no mesmo arquivo. **Fundação: só sapata corrida** (ela é o engaste, sem viga), dimensionada a flexão,
  cortante e torção. Não aprofundar em outros modelos.
- Fundação (escolhas do Jose): sobrecarga sobre o talão **estabiliza** (padrão Sim, como o Gilberto; o seletor permite rodar
  a combinação sem ela); deslizamento só com atrito N·tg δ (δ = 2/3·φ padrão), **adesão opcional = 0**; **passivo da frente
  DESLIGADO por padrão (Jose, 10/10, pelo Bastos "Sapatas de Fundação" 1.8 e NBR 6122 7.6.3): só com garantia de que o
  solo da frente jamais será escavado/removido, e então dividido por 2,0** (aviso_passivo); tombamento com
  **FS em torno do pé ≥ 2,0 E |e| ≤ B/4 (Gilberto), vale o pior**. σadm: digitado ou 20·mín(SPT; 20) (Gilberto, só dentro da faixa da regra — Jose, 14/10; com SPT < 5 não há
  automático e a tensão reprova pedindo o σadm); a aba Fundação
  também sugere Mello 100·(√N − 1), cada regra com a faixa de N (`sadm_20N`, `sadm_mel` + `_fx`), e a calculadora de
  consulta embaixo da Fig. 15 lê esses nomes (Jose, 10/10). ⚠️ `estabilidade.ts` e `modulacao/leitura.ts` ainda leem
  algumas células da aba Fundação por ENDEREÇO (B101, B102, B104, B105, B96): linha nova acima delas exige ajustar.
- **Dente com posição e passivo (Jose, 13/10):** entrada `x_den` = eixo do dente a partir do CENTRO da sapata, + para o
  pé (|x| ≤ (B − b)/2, verificação "Dente dentro da sapata"). O peso do dente saiu da linha da sapata: linha própria
  "Dente" (24, no fim da tabela de cargas) em x = B/2 + x_den. Passivo: com o solo da frente garantido, a face toda
  Kp·γ·(h_fr + h + h_den)²/2 ÷ 2 (como antes); SEM a garantia, o dente do centro para trás (x_den ≤ 0) conta
  Kp·γ·h_den²/2 ÷ 2 ("para escavar até a metade da sapata o cara tem que ser um tatu"); para a ponta, nada. O FS de
  deslizamento da aula 12.2 e do VAL123 subiu de ~0,91 para 1,11 por isso (referência atualizada à mão na base).
  3D e cortes desenham o dente na posição (entorno.ts). Desenhos da sapata na memória (`memoria/desenhoDaSapata.ts`):
  forças que estabilizam (setas numeradas, legenda N + braço até o pé, cotas), forças que tombam (empuxo até a base,
  H na altura y = M tomb/H, giro no pé) e tensões (centro da base, e, núcleo B/6, trapézio/triângulo). Pontos de
  giro: tombamento no PÉ; excentricidade e tensões no CENTRO; armadura da sapata na FACE DO MURO.
  Memória "lúdica" (Jose, 13/10): braços escritos A PARTIR DO PÉ (x_p = ponta + t/2…) e distâncias ao CENTRO
  (d_c = B/2 − x_p), com o desenho de cargas cotado de cada referência; flexão da ponta/talão (balanço com peso e
  solo fatia a fatia, Mk na face) e cortante (seção a d da face, fatias além de d) desenhados. Fig. 15 só no card de
  cargas; deslizamento com a Fig. 24. "Momento tombador" virou "momento de tombamento" em todo lugar.
- **l entre travamentos = o muro desenhado (Jose, 12/10).** Contrafortes: o he_ usa o espaçamento adotado
  (`l_cf_adot`) e ignora o `l_trav`. Balanço travado nas duas pontas: l = comprimento do muro — a planilha não tem o
  comprimento, então o app manda o L_total MODULAR como `l_trav` (store.ts, 2ª volta quando a modulação arredonda);
  no Excel o projetista digita. No app a linha "l" da Geometria ESPELHA o campo de verdade (`campoEspelhado`:
  `l_cf` com a lista, ou `L_total`) e o 3D refaz. Vãos que amarram (provado em `modulacao/vaosDaLista.test.ts`,
  muro real, 34/54 e 59/79, enterrado e aparente, sem junta a prumo): bloco 19 → 0,80 a 4,00 de 0,20 em 0,20; bloco
  14 → 0,95 a 3,75 de 0,40 em 0,40 (só nº par de meios módulos). Abaixo de 0,80 também amarra (14: 0,55; 19: 0,40 e
  0,60), mas fica fora da lista pela decisão do vão mínimo.

- **Peso próprio da parede CALCULADO (Jose, 12/10):** "dado que a gente não precisa perder tempo fornecendo". Entradas:
  `peso_us` = t·[22·Aliq/Abr + 24·(1 − Aliq/Abr)·f_gr] + 21·reboco·faces (kN/m²). f_gr = 1 com graute a cada 20;
  senão 1 − (1 − m/X)·(1 − 0,20/h) com a GRADE DO GRAUTE (X, ver abaixo) e as canaletas adotadas (balanço: `h_pan`;
  contrafortes: `s_ph` do painel). Entrada nova só o reboco (`reb_fac` Nenhum/Só na frente/Nas duas faces, `reb_esp` cm).
  24 graute e 21 argamassa = NBR 6120; 22 do concreto do bloco = DEDUÇÃO (catálogo ÷ volume). `peso_par` virou
  opcional (digitado manda). O M2d usa `peso_ch` (todos os furos grauteados): a favor e sem conta circular com o
  espaçamento automático. γ do contraforte idem (`gama_cf` opcional → `gama_cf_us` = 22·r + 24·(1 − r) ≈ 22,9).
- **σsg somado por padrão (Jose, 12/10):** "o muro tem peso e isso contribui". `sg_on` padrão Sim. A aula 12.2 é
  conferida com `AULA_122_ENTRADAS` (cenarios.py: σsg Não, peso 3,0). No app, entrada opcional vazia mostra o valor
  usado no lugar do "auto" (`VALOR_AUTO` em estado/campos.ts).
- **Aterro sobre a ponta (Jose, 12/10):** entrada `h_fr` (m acima do topo da sapata). Conta SÓ com `pass_on` = Sim
  (a mesma garantia do passivo, agora "solo da frente garantido"): linha 23 da tabela de cargas verticais da Fundação
  (γ·h_fr·ponta, x = B − ponta/2, desconta o contraforte APARENTE), fatias da ponta (q = σ − γc·h − γ·h_fr) e passivo
  Kp·γ·(h_fr + h + dente)²/2 ÷ 2. As verificações da Fundação que o app lê ganharam nome (`chk_fs_t`, `chk_e_t`,
  `chk_fs_d`, `chk_sig`, `e_lim`, `s_tor_f`): não há mais leitura por endereço da Fundação fora das linhas 12–23.
- **Proposta da entrada por figuras (12/10, aprovada: "pode ir desenvolvendo"; recomendações aceitas):** https://claude.ai/artifact/XxiHij7TtwkNdtg5CrHmnw —
  abas Muro / Solo e cargas / Materiais / Armadura (Contraforte + Painel) / Fundação / Drenagem / Critérios de cálculo,
  lista lateral recolhível, escolhas com desenho, cota editável, padrão único das figuras, aterro sobre a ponta.
  FEITO 12/10: abas (`estado/abas.ts`), lista recolhível, botão Entradas na barra de cima, Novo abre nas figuras,
  escolhas com desenho (`ui/EscolhaComDesenho.tsx`), cota editável no corte vivo, aterro no corte vivo. FALTA: padrão
  único das 24 figuras (regras na proposta; Jose quer avaliar quais melhorar) e as figuras vivas novas.
- **Régua comum das figuras (Jose, 12/10: "pode ser todas"; "ficaram menos poluídas"):** `figs/app/applib.py`, bloco
  "A RÉGUA COMUM" — moldura única 1000 × 640, K_GERAL 150 / K_DETALHE 400 / K_BLOCO 600 px/m, peças padrão (parede,
  sapata, solo, empuxo, sobrecarga, na, fissura, junta, titulo_vista, legenda), solo à direita nos cortes e em cima nas
  plantas, vermelho só aço (espera vermelha + barra do muro rosa), sem fórmula/tabela no desenho. Refeitas 1–21 e 24;
  a 22 (solos) ficou para a outra sessão do Jose. Antes × depois: https://claude.ai/artifact/EtiZjvYevsFzfm61yGfWhg.
  Tabelas que eram figura viraram tabela clicável no app (`ui/TabelasDeReferencia.tsx`: fbk/Fig. 23, ftk/Fig. 8,
  α/Fig. 7). Fig. 23 (Jose, 13/10): linhas na ordem da planilha 01 do Carini (fbk, fa, fgk, fpk/fbk, fpk*/fpk, fpk,
  fpk*), fa e eficiências DIGITADAS como no curso em Referências E:G (só consulta; a divisão daria 1,76 onde o curso
  diz 1,75), zebra, legenda com desenho (bloco, argamassa e graute em corpo de prova, prisma oco e cheio). fgk
  vazio mostra o da tabela pelo fbk e acompanha a troca (VALOR_AUTO); digitado manda. Argamassa segue entrada por
  classe da NBR (Jose, 13/10: "temos o limite da norma"); fa é só consulta. Pontos dos agentes para o Jose confirmar: Fig. 12 desenhada com vão 1,00; Fig. 21 com t_enr 79 e
  construtivas com espera dobrada; Fig. 19 painel cinza (amarelo só para não armado); borda livre fraca; Fig. 24
  sem o h_fr; Fig. 15 miniaturas em escala esquemática.
- **Flexão do balanço pela geometria real (Jose, 12/10: "resistência real do negócio na faixa de 1 metro"):** aba Muro
  em balanço. Mesa = parede do bloco no metro (fd_m = 0,7·fpk/(Aliq/Abr)/γm, igual no parcial e no total); almas = furos
  grauteados do metro (bw_m = 100/s_web × bw_f, total = 100) com fd_g = 0,7·fpk*/γm (DEDUÇÃO). 0,8x ≤ hf → só a mesa
  (ln_mesa = Sim); senão seção T (M_mesa, M_alma, y_alma, x = (hf + y)/0,8), C_c e z = Md/C ≤ 0,95d. s_web = X, o
  graute a cada (desde 13/10; antes s digitado ou 6t). A "área de referência do fpk" saiu da flexão (fica no
  Em do ELS e no painel). Verificações da aba com nome (chk_*).
- **GRAUTE EM GRADE (Jose, 13/10: "vamos fazer um campo de graute; na hora da armadura, bloqueia de acordo"):** a
  entrada `Graute` virou número — "Graute a cada" X cm, lista 20, 40, 60, 80, 100 até 6t (bloco 14 vai a 80;
  Referências BB, `lst_gr`). 20 = todos os furos (`gr_tot` = Sim: seção cheia, fpk*, K 2,0, painel com K_ph 1,0);
  40 = furo sim, furo não; 60 = um sim, dois não… Vale para a PAREDE (balanço e painel entre contrafortes); o
  CONTRAFORTE é sempre todo grauteado, em qualquer situação (Jose). A barra cai num furo da grade: a lista do
  espaçamento (`lst_s`, balanço e painel) só tem múltiplos de X; s_adot/s_pv descem para a grade; no app o "→"
  desce (mais barra) e só sobe sem opção abaixo. A mesma grade dá: peso (f_furo = m/X), almas da flexão (100/X por
  metro), almas do ELS (n_alm = s/X na faixa, balanço e painel vertical), K_ph automático (opcional: 0,5 / 1,0 com
  todos) e o 3D (gerar.ts `grauteDaGrade`: furo da parede a múltiplo de X da barra mais próxima). Aba Arranjos
  ganhou a coluna "na grade do graute?" (as faixas seguem as da aula). Arquivo antigo (texto): Total → 20; Parcial
  → a grade das barras do arquivo (s ≤ 6t) ou 40. Figura nova: Fig. 25 (fileira de 10 blocos com as 5 grades);
  escolha com desenho (fiada de 3 blocos). Padrão 40 = aula 12.2 (barras a 40), números da aula iguais.
- **Figuras do peso próprio (Jose, 13/10: "o que as figuras relacionadas têm a ver?" — o peso abria a Fig. 7, de
  esbeltez; "tem só do contraforte e só da parede"):** Fig. 26 (reboco, espessura, peso da parede) = planta da faixa de
  1 m com a grade do graute e o reboco nas faces + corte com as canaletas grauteadas; Fig. 27 (γ do contraforte) =
  planta só do contraforte, todo grauteado, com a parede apagada atrás. Cor nova da régua: `C['reboco']` (applib, e
  na legenda). Estáticas, no acervo (só no app; a planilha não tem a figura).
  Ficou de fora, por ser escolha de engenharia (anotar com o Jose quando for o caso): fpk/Em só sobem com X = 20
  (graute parcial não dá crédito no fpk — μ do Carini poderia interpolar); K único para mesa e alma; a mesa do T
  do contraforte (a parede) segue fpk vazado mesmo com X = 20; cisalhamento do balanço com b = 100 qualquer X.
- **Seções cotadas na memória (Jose, 12/10: "não pode jogar número do nada"):** `memoria/desenhoDaSecaoI.ts` —
  faixa de 1 m da flexão do balanço (barras a cada s, LN x, bloco 0,8x), seção I do ELS do balanço e as duas seções I
  do painel. O card de flexão do balanço abre com a cadeia do fd (fbk → fpk → fpk,liq → fk → fd → K·fd).
- **Figuras na memória (Jose, 12/10: "olha o tanto de espaço sobrando"; "coloca o desenho depois da seção 2"):** na
  tela a figura do acervo sai recortada na caixa do desenho (`data-desenho` do SVG, copiado pelo `figs/app/gerar.py`
  para `app/src/figuras/recortes.gerado.json`; o modal das entradas segue com a moldura única) e ocupa o vão à direita
  da conta — largura da coluna e altura da conta, MEDIDAS no card (`memoria/CardMemoria.tsx`). Card até 1320 px.
  Desenhos gerados (faixa da flexão, forças, seções) vão para a direita do grupo deles quando a coluna tem ≥ 600 px;
  senão largura cheia antes do grupo. Forças da flexão: depois da verificação da parede. Papel e Word não mudaram.

## App (começou em 08/10/2026) — `app/` (Vite + React + TS + three, como o A-PORT)

- **A conta do app É a planilha.** `tools/exportar_motor.py` exporta as fórmulas para `app/src/motor/planilha.gerada.json`;
  o avaliador em TS (`app/src/motor/excel/`) calcula como o Excel. O `build_new.py` segue sendo o ÚNICO lugar da conta.
  `tools/golden.py` roda N cenários no Excel (COM) → `dados/golden/`; o teste do app confere célula a célula.
  **Mudou o gerador: `exportar_motor.py` + `golden.py` + `npx vitest run` no app.**
- Sem LibreOffice nesta máquina: `recalc_lo.recalc()` cai sozinho no Excel (`tools/recalc_excel.py`).
- Contratos entre frentes: `motor/tipos.ts` (conta), `modelo/tipos.ts` (muro peça a peça: quem fabrica é `modulacao/`;
  3D, IFC, desenhos e quantitativo só leem), `memoria/tipos.ts` (cada linha é uma expressão que desenha o TeX e é
  conferida contra a célula), `modelo/entradasDoModelo.ts` (entradas que só o modelo usa: comprimento, juntas, drenagem).
- 3D é só visualização + IFC; toda a modelagem é por entradas. Toda entrada tem botão de figura (modal).
- Decisões do Jose (08/10): ~~**altura** — a conta usa a altura de solo digitada; o muro desenhado sobe até fechar a fiada
  (folga no topo)~~ (substituída em 09/10: duas alturas, ver abaixo). **Contraforte nas duas pontas**, junta de controle configurável (0 = sem). **Cinta (canaleta) no topo
  nos dois tipos**, canaleta passando direto pelo contraforte. **Drenagem** (barbacã, dreno, manta, impermeabilização) no
  3D e no quantitativo, toda configurável. Os demais valores que não fecham no módulo (eixo a eixo e comprimento do
  contraforte, espaçamento das barras) são ajustados NA PLANILHA (nomes `*_adot`) e a conta usa o ajustado.
- **Contraforte em bloco 14×39**: modelado pelo Jose no Revit (09/10) com as peças de 34 e 54; só amarra com nº par de
  meios módulos no vão. A família 19 está ok pela regra. (Era provisório até 09/10.)
- **App gratuito = básico e com limites** (Jose, 08/10, noite): poucos métodos de montagem, fechados; quem quiser montar
  diferente faz a própria conta. Decidido: ~~bloco 14 só muro em balanço~~ (liberado em 09/10 com o 34/54 do Revit; a
  linha lim_cf saiu); **altura de solo: balanço ≤ 3,0 m, contrafortes ≤ 4,0 m** (a lista da altura para aí);
  **coesão liberada, com aviso** quando c' > 0 (aviso curto, não prosa: ao lado do campo/barra de estado e no memorial —
  "o app é ferramenta; a responsabilidade é do engenheiro"). **Em aberto, para ele modelar no Revit (09/10):** os TEMPLATES de montagem básicos
  — amarração direta com meio bloco (o exemplo do Revit, `dados/encaixes_revit/19x39_casaR.json`), grampo é outra forma
  possível, e ele quer **contraforte de dois blocos** também. A modulação lê os encaixes de uma tabela: template novo = linha nova.

- **A régua é o curso do Carini** (Jose, 09/10): flecha da aula (vão/250, balanço 2L/250), armadura mínima do contraforte
  como está, nenhuma verificação nova tirada do livro/rascunho da NBR. Divergências com o livro ficam anotadas em
  `_trabalho/fontes/indice.md`, sem perguntar a ele. **Área de graute do furo sai da geometria do bloco desenhada**
  (o engenheiro usa o bloco que acha no mercado): paredes/septos do bloco como entrada, com o curso de padrão.

- **Templates de montagem do Jose** (Revit, 09/10, `dados/encaixes_revit/`): 14x39 contraforte 34 e 54 (T e L); 19x39
  contraforte 39 (Casa R), 59 e 79 (T e L); 19x39 DOBRADO 59 (completo) e 79 (parcial). Todos amarram, **exceto o dobrado:
  os blocos da frente não ficam amarrados → precisa de GRAMPO**, conta a desenvolver (o curso usou modulações simples com
  junta a prumo + grampo). A modulação lê os encaixes de uma tabela; o teste-selo confere peça a peça contra os gabaritos.
  **Decisão (09/10): o DOBRADO SAI do app** — "o pessoal acha que é festa do bloco" e executa errado; o ganho de inércia vem
  do comprimento do contraforte, não da largura; montagem simples (que já não é fácil). Altura ~4 m no máximo, confirmado.
- **Montagens finais (Jose, 09/10 tarde):** bloco 19 → contraforte 59 ou 79; bloco 14 (14x39) → contraforte 34 ou 54; sem
  dobrado, sem o 39 da Casa R; 14x29 saiu junto com o cerâmico; bloco 19 só existe 19x39. **Entradas TRAVADAS** em lista
  na planilha (o app herda; FEITO 09/10): altura em múltiplos de 20 cm (0,60–3,00 balanço / –4,00 contrafortes — solo =
  muro, fiadas inteiras); tenr 59/79 (19) e 34/54 (14); eenr = t; eixo a eixo que amarra (19×39: t + 1 + n·20, 0,80 a
  4,00 m; 14×39: só n par, 0,95 a 3,75 m — abaixo de ~0,8 o vão livre vira 2–3 blocos, acima de 4,0 a tabela de δ satura
  e o Libânio só cobre h ≥ 1,2 m); barras do balanço e do painel vertical em múltiplos de m até 6t (+ auto); canaletas
  0,20–1,60 m no balanço e 20–160 cm nos contrafortes (+ auto); Ø comerciais (furo/canaleta 6,3–20; estribo do
  contraforte 5/6,3; sapata 6,3–25; secundária e torção 5–12,5). **d real do contraforte (Revit):** 19·59 → 49,0; 19·79 → 69,0; 14·34 → 24,5 (planilha 27, −9%); 14·54 →
  44,5 (planilha 47, −5%) — no 14 o furo da ponta fica a 9,5 cm do fim, não t/2. Levar para a planilha e a memória.
- **Altura do solo × altura do muro (Jose, 09/10 fim de tarde):** INDEPENDENTES, solo ≤ muro sempre (substitui o
  "solo = muro" de horas antes). Solo carrega o empuxo; muro entra em peso próprio, esbeltez, vão da flecha.
  Classe de solo (Gerscovich) não se aplica a argila → "Não se aplica" automático. Tabela de argila por consistência
  (γ, c', φ') como sugestão, com fonte. Mini-calculadora de Ka/Kp e coesão no modal da Fig. 22 — só consulta, o
  usuário preenche à mão. **FEITO (09/10, noite):** `H_muro` = altura do muro (lista de fiadas), `H_solo` = altura de
  solo (livre, 0 < h solo ≤ h muro; validação por fórmula no Excel, linha `lim_Hs`; no app o solo desce ao topo do muro
  com "→"). SOLO: perfil de 40 fatias (z, braço), Mk/Vk, painel não armado (z e índice no perfil), solo do talão,
  subpressão, NA da sapata. MURO: he/esbeltez, Nd/σsg, δadm, bm ≤ h/3, nº de estribos, placa de Libânio, h/t do ábaco,
  peso da parede e do contraforte, limites 3,0/4,0, fiadas. Modelo: flecha no topo S = ΣV·a²(3hs − a)/6 +
  ΣV·a²/2·(hm − hs) (colunas M e N do perfil); Libânio com h = h muro e o triângulo esticado até o topo do muro
  (dedução, ≥ a carga real); painel/subpainel mais alto que o solo → z = 0 (dedução, a favor). Com h solo = h muro o
  gabarito antigo inteiro bate. Memória: grafia `h_{solo}` e `h_{muro}` (h_s é a sapata). Arquivo .alrimo v2 (v1 abre
  com o solo na altura gravada). Classe_G com Argila → "Não se aplica" (planilha: "—" na sugestão; app: campo travado).
  Argila por consistência (Solo e Empuxo N23:S29, fontes na aba Referências a partir da linha 154): c', φ' = faixa das
  três argilas de Joppert Jr. (2007, conferido em 3 reproduções; original não visto), su = 10·NSPT (Teixeira & Godoy
  1996, não drenada), γ de Godoy. Sugestões `cons_arg`, `c_arg`, `phi_arg`, `su_arg`; a calculadora da Fig. 22
  (`app/src/figuras/calculadoraDoSolo.ts`) lê esses nomes e Ka_/Kp_ pelo motor — não tem conta própria.
  **Aguardando o Jose:** resumo da aula do Gilberto sobre deslizamento ("coeficiente de
  atrito") e a POSIÇÃO DO DENTE (não é sempre centralizado: distância à borda aterrada → tombamento e deslizamento);
  "nó de cachorro" da armadura que entra na sapata (ele modela no Revit).
- **Respostas do Jose (09/10, fim do dia):** limites 3,0/4,0 valem para a altura do MURO; **bitola da espera em LISTA
  dependente da altura da sapata** (só as que a dobra cabe: pino 5φ até Ø16, 8φ a partir de Ø20 — NBR 6118 Tab. 9.1;
  "nó de cachorro" com Ø20 não cabe em sapata de 20 cm) — FAZER depois da seção real; barra do contraforte na
  canaleta do muro **dobrada em L**; canaleta cortada de 19 é **peça própria** (fundo 3,91); comprimento do muro em
  múltiplos do bloco ("o calculista se vira com o corte"); termo: mesmos dados do Pró-Viga, foro Uberaba/MG.
- **Detalhes típicos det01–det05 prontos** (`figs/app/detalhes/`, `app/public/detalhes/`; ainda não entram na prancha).
  Pontos para o Jose: cor da espera (Fig. 9 × Fig. 18 invertidas — seguiu a 9); impermeabilização até a altura de
  solo (quantitativo) × topo do muro (Fig. 17); barra vertical subindo até 3 cm do topo atravessa o fundo da canaleta
  da cinta (furar o fundo? o detalhe não mostra); junta: o app interrompe toda a barra da cinta (ABCP fala em "parte").
- **A FAZER (Jose, 09/10): DRENO DE FUNDO** além dos barbacãs — tubo correndo na longitudinal, no pé do tardoz, envolto
  por bidim (geotêxtil), areia e brita. Entra no 3D, no corte, no quantitativo (m de tubo, m² de bidim, m³ de areia e
  brita), no IFC e nas entradas de Drenagem (Ø do tubo, dimensões do envelope). Fácil; ficou para depois.
- **Armadura no 3D e canaleta no IFC (Jose, 14/10):** o Raio-X virou o botão **Armadura** — as peças não mudam e as
  barras saem por cima de tudo (apaga a profundidade antes delas, como o "visualizar desobstruído" do Revit), com luz,
  na cor da bitola dele (Revit, Casa F., vista "Iso Escada": Ø5 #00ffff, 6,3 #00ff00, 8 #ff8000, 10 #ff0000, 12,5
  #ff00ff, 16 #8000ff; Ø20 amarelo e Ø25 azul PROVISÓRIOS), legenda de bolinhas (tela e foto). No IFC a canaleta
  recortada vai como U inteiro menos os recortes (IfcBooleanResult, 'CSG'; Geometria.recortes) — em pedaços o Revit
  mostrava segmentada; o arquivo se declara DesignTransferView_V1.0 (a Reference View não aceita booleana).
  Exemplos para ele abrir: `_trabalho/ifc_canaleta_14-10/`. Reta final (Jose): depois da passada dele nos módulos de
  cálculo, entregável — desenhos, IFC, nó de cachorro da espera (Revit dele), estética.
- **Cores por tipo de bloco** (como ele faz no Revit para a obra entender): inteiro #787878, meio #004080, canaleta
  #ffff80, bloco 34 #ff8040, bloco 54 #ff0000 (`dados/encaixes_revit/cores_jose.json`) — 3D e vista frontal com legenda.
- **Ele confere pela MEMÓRIA, não pela planilha.** Parte a caprichar: **inércia e braço de alavanca da seção real** de cada
  modulação (furo grauteado com a barra → d; mesa; I bruta/fissurada). A conta simplificada (d = tenr − eenr/2, seção T por
  bm) não enxerga a peça: a seção do contraforte deve sair cotada da modulação e ir passo a passo para a memória.
  **FEITO (09/10, noite):** c da barra = centro do trecho comum aos furos das fiadas P e I (onde a barra passa reta),
  tabela na aba Referências (colunas AT–BA, nomes `mont_*`, linha `c_mont`) conferida pelo teste contra
  `app/src/modulacao/secaoDoContraforte.ts`; seção desenhada e cotada nos cards de flexão e ELS do contraforte
  (`app/src/memoria/desenhoDaSecaoCf.ts`). Furo comum + barras que cabem (15 mm, espera ao lado) e taxa de 8% só informam.

## Convenções de cálculo

- fk = 0,7·fpk; γm = 2,0; Kfd = K·0,7·fpk/γm. K do curso = 1,0 (planilha 04). Horizontal do painel K = 0,5
  (fk,horizontal = 0,5·fk se a seção horizontal não for toda grauteada — manual ABCP).
- **fpk acompanha a geometria**: seção líquida (I) → fpk/(Aliq/Abr); seção bruta → fpk bruto; prisma cheio → fpk*.
  Em = 800·fpk.
- As,mín do curso = 0,15%·b·d (b = bw no contraforte; b = faixa no painel). NBR = 0,10%·b·t (opção).
- fsd = fyd (todo Ø).
- As,máx = 8% do graute contando traspasse (2×).
- **Traspasse espera × barra (Jose, 13/10: "NBR 6118: 2,0 × ℓb no graute"):** aba Fundação, seção 10. fbd no graute =
  2,25·0,21·fgk^(2/3)/1,4 (η2 = η3 = 1); ℓb = φ/4·fyd/fbd (fgk 20 → 43,7φ); α0t = 2,0 (todas as esperas emendam na
  base); ℓ0t = α0t·ℓb·As,nec/As,ef ≥ máx(0,3·α0t·ℓb; 15φ; 20 cm), uma linha por espera (l0t_v, l0t_pv, l0t_cf, l0t_cc;
  construtiva sem relação de áreas). Muro padrão: 21 → 68 cm (antes era o ℓb da ancoragem NA SAPATA, concreto com
  gancho). Emendas que não são espera (canaleta a cada 12 m, longitudinal da sapata): o app usa o mesmo α0t com o ℓb
  do material (lbphi_gr / lbphi_c) e relação 1. O traspasse digitado no app manda (emendas defasadas).
- Cisalhamento: fvk = 0,35 + 17,5ρ ≤ 0,7; Va = fvd·b·d; Vrd2 = Va + 0,4·b·d·√fpk/γm (MPa); Asw/s = (Vsd − Va)/(0,75·fywd·d);
  Asw,mín = ρ·b, ρ 0,07% (fgk 15) a 0,14% (fgk 40).
- ELS: seção I (mesas = paredes do bloco), Branson, heq = (12·Ieq/b)^(1/3); δ∞ = δ0·(1 + Δξ), Δξ = 1; balanço 2L/250; placa menor vão/250.
- Espessura efetiva com enrijecedores: te = δ·t só para esbeltez (δ por lenr/eenr × tenr/t, limitado à tabela).
- Contraforte: largura de influência (intermediário l; extremidade l/2 + balanço). Enterrado → seção T (bm ≤ bw + 2·6t,
  ≤ h/3), fpk vazado; aparente → retangular, fpk*. d = tenr − c da montagem (templates do Revit: enterrado, da ponta,
  9,5 no bloco 14 e 10,0 no 19; aparente, da face do solo, 7,0 e 10,0 — espelho, dedução); c_cf_dir digitado manda.
  Seção bruta como no curso (alma toda grauteada; mesa com fpk bruto) — a novidade é só o d.
- Painel: Libânio Tipo 21 (laterais apoiadas) / 22 (engastadas), triangular + uniforme (Tipos 9/10). γ = h/l, l = menor vão.
  Mdx ← μy; Mdxb ← μyb; Mdy ← μx; Mdyei ← μ'x; Mdxe ← μ'y. Flecha a = α/100·p·l⁴/(E·t³) com o heq de cada direção; vale a pior.
- Painel não armado entre barras e canaletas: caso 13, βf interpolado (planilha 11), fd = 1,4·σh médio do subpainel de baixo.
- Fundação: módulo = espaçamento entre contrafortes (balanço: 1 m); empuxo até a base da sapata; solo sobre o talão sai da
  posição (distância da borda aterrada ao eixo); contraforte enterrado exige talão ≥ tenr − t, aparente exige ponta ≥ tenr − t.
  Flexão/cortante da ponta e do talão (NBR 6118, VRd1 sem estribo). Torção: TSd = Md do contraforte/2 (modelo simplificado,
  dedução nossa) pela NBR 6118 17.5.

## Validação (o `testar.py` confere)

- Aula 12.2 (balanço, h 1,6, bloco 19, fbk 8, Ka 0,4, γ 19, q 2): arranjos 0,30/0,61/0,91/1,22 → Ø10 c/40; Mr 42,45;
  Ieq 2687; heq 9,3 (Ftool 40 × 9,3, E 8889); δadm 12,8; painel βf 0,118, 26,2/13,1 kN·cm/m.
- Aula 12.3 (contrafortes) — REGISTRO HISTÓRICO: validado em 08/10 com o modo cerâmico, já removido; planilhas da
  validação guardadas em _trabalho/validacao_aula123/. Batia com o professor: δ 1,371; λ 27,1; bm 86,7; As 2,30 → 3Ø10;
  Vrd2 59,92; Asw 2,48 → Ø6,3 c/20; Mr 290,5; heq 33,43; δ∞ 9,8; Libânio 265,6/182,6/107,7/518,7; painel vertical Ø10 c/45
  (cada face); horizontal Ø12,5 c/80; não armado βf 0,1136; heq 7,0 / 8,9; δ∞ 4,0 ≤ 6,0. Diferenças pequenas explicadas na
  época: aula arredondou bm = 86,7 (Ieq 269.849 × 269.479); planilha 06 do curso usa n − 1 na 2ª barra (III 1274 × 1277);
  aula digitou As 1,23 e M 265,1 na horizontal.
- VAL123 (testar.py, só REGRESSÃO): a geometria da aula 12.3 em concreto 14×39 — h 2,6, Ka 0,4, γ 20, fbk 10, vão 1,35
  (o da lista mais perto de 1,50), contraforte 54, sapata do exemplo. Passa em todas as verificações.

## Inconsistências do material do curso (já anotadas na planilha)

- Planilha 05 com fpk 4,8 esquecido (12.2) e fgk 15 × caderno 20; As,mín bw·d (planilha) × bm·d (caderno).
- 12.3: flexão horizontal calculada com d = 9, mas detalhada com barra centralizada (d = 7 → As 1,09; Ø12,5 ainda passa).
- Tabelas de Libânio: 4 valores suspeitos de digitação (em laranja na aba Referências), mantidos como na fonte.

## Pendências

- **App — onde paramos (08/10, noite; PC desligado com agentes no meio):** motor pronto (bate com o Excel em 65.090 células,
  e o conserto também fechou: 61 cenários, 86.315 células iguais ao Excel, entrada em texto "19"/"1,6" vira número como
  no Excel, aritmética do x87 no último dígito; ver `_trabalho/relatorios/consertar_motor.md`). Frentes construídas: ui/estado/estilo, visor, ifc, figuras (23, mapa em
  `dados/figuras.json`), memoria (núcleo + 2 cards piloto), quantitativo, desenhos; modulacao parcial (interrompida).
  09/10: app ligado (`app/src/integracao.tsx`, `ABRIR.bat`); letra 120% + janela de Configurações; grupos fechados; figura
  sem destaque. Etapa da planilha rodada 1 FEITA (m_mod, s no módulo + teto 6t, l_cf_adot/tenr_adot, H_muro_des/n_fiadas,
  he da torção pela 6118 17.5.1.4.1, Kp protegido, lim_H/lim_cf, aviso_coesao, FIG_OF lendo dados/figuras.json).
  09/10 tarde: modulação com os templates do Revit (teste-selo `modulacao/gabaritos.test.ts`); memória completa (7 grupos,
  conferida nos 61 cenários); δ∞ do painel "—" sem heq (era falso OK); 3D com estilos Cores/Realista/Opaco; pranchas com
  as cores e legenda (folha branca no tema escuro); detalhes típicos `figs/app/detalhes/` (canaletas em T, amarração P×I);
  `TERMO_DE_USO.md` (falta: foro, licenciante, e-mail; tela de aceite no app). Suíte: 3108 testes, tsc limpo.
  09/10 noite (subido no GitHub): SEÇÃO REAL do contraforte (c da ponta medido nos templates: 14·34/54 → 9,5; 19·59/79
  → 10,0; d real na planilha e na memória com a seção desenhada e cotada) — **achado: com o d real, contraforte de 34 em
  h 2,6 / vão 1,35 deixa de passar (x/d 0,56 > 0,45; δ∞ 21,7 > 20,8); passava só pelo d simplificado**; VAL123 (14·54)
  foi a 4Ø10. Entradas travadas, cerâmico removido, altura solo × muro, argila, calculadora da Fig. 22, tela de aceite
  do termo + versões no rosto do memorial, aviso de coesão no app, barra do contraforte em L na canaleta, canaleta
  cortada 19 própria, detalhes det01–det05, catálogo de peças no quantitativo. Suíte: 3351 testes, tsc limpo.
  Bitola da espera em LISTA pela altura da sapata (feito: h necessária = 2c + Ø malha (2 camadas) + D + 2φ ≤ h_sap, D da
  NBR 6118 Tab. 9.1; função h_dobra() no build_new; aba Fundação seção 10; memória nos cards de ancoragem/esperas; a malha
  na conta é DEDUÇÃO — com ela o Ø16 não cabe em sapata de 20, como o Jose disse). Trocar h_dobra() quando chegar o nó de
  cachorro do Revit.
  Revisão IFC/quantitativo com o muro real (09/10 noite): IFC limpo (validador com --furos); quantitativo: avisos que
  mudam quantidade no CSV, argamassa sob canaleta, rótulo da barra em L. Achados a fazer: GUID do IFC sai do TÍTULO
  (dois "Sem título" colidem num federado → UUID do projeto no .alrimo); no 3D/IFC a barra vertical atravessa o fundo
  da canaleta (furar o fundo onde há barra) e a barra em L atravessa a parede do U (T de graute não modelado); graute da
  canaleta da haste não cobre as juntas de 10 mm; barbacã some sem aviso em muro todo em canaleta. Para o Jose:
  canaleta cortada na lista de compras (converter cortes em inteiras?); barras iguais em elementos diferentes com N
  diferentes (painel × contraforte) — é o que ele quer na lista de ferros?; GUID do IFC agora sai do id do projeto (UUID
  no .alrimo) — "Salvar como" e cópia do arquivo MANTÊM o id (como o Revit): manter ou o "Salvar como" criar muro novo?
  Achados da revisão FEITOS (09/10 noite): fundo da canaleta furado onde passa barra (Geometria.pedacos), T de graute
  no encontro das canaletas, graute da haste contínuo nas juntas, aviso BARBACA_SEM_CELULA; validador do IFC com
  --furos/--barras (tem dente). Graute total sobe ~4–5%. Para o Jose: barbacã em muro todo em canaleta — furar a
  canaleta?; IFC: cada canaleta furada diferente vira um tipo com o mesmo nome — abrir no Revit para conferir.
  Faltam: dreno de fundo; deslizamento e posição do dente
  (aguardando resumo da aula do Gilberto); nó de cachorro (Revit dele); detalhes na prancha final; T de graute no 3D
  (parede quebrada da canaleta); "→ 5,99" aparece mesmo com comprimento modular (comparar com o modular?); revisores de
  IFC/quantitativo com o muro real; Ag da conta pelo bloco desenhado (decidir).
  Relatórios dos agentes: `_trabalho/` (fora do git).

- **Revisão "o auto é sempre a favor da segurança" (Jose, 13/10)** — Grupo 1 FEITO 14/10: traspasse (Convenções),
  σadm com teto e exigido abaixo de SPT 5, estribo mínimo de torção com bw = 2·he, Kp do dente e da frente pelo
  φ' do SOLO DE APOIO (Kp_b; o γ segue o do solo contido, dedução) e φ' do solo de apoio OBRIGATÓRIO (Jose: "é o
  solo natural, do laudo de sondagem, é o que o calculista digita"; padrão 25 = exemplo; vazio → o deslizamento
  reprova pedindo o dado). Grupo 2 FEITO 14/10 (`estado/novo.ts`): o Novo abre com os dados do terreno e do
  projeto EM BRANCO (H_muro, H_solo, NSPT, γ, φ', q, B, h, a, SPT da base, φ' da base, comprimento), sem dente, e
  Ka/s/d no automático (K fica 1,0, o do curso); enquanto falta dado a conta roda mas não há muro nem veredito — a
  barra de estado diz "Faltam N dados" e leva ao 1º, a linha fica marcada. Vazio é aceito no arquivo (antes voltava
  ao número da aula). Exemplo = aula 12.2 (AULA_122_ENTRADAS) com a sapata a 0,45 (0,40 fica 3 mm abaixo do
  (1,40 − 0,19)/3); botão do livro na barra de cima; é também a 1ª abertura do app. Grupos 3/4: q_est (Sim) e sg_on
  (Sim) são decisões dele — não reabrir sem fonte (memória feedback_nao_reabrir_sem_fonte). PAINEL APOIADO nos
  contrafortes (Jose, 14/10): fica o Carini — "a gente sabe que vai ter um mínimo negativo ali, mas concreto plastifica";
  medido: apoio engastado ≤ vão apoiado em 2 de 3 casos, +6% no painel 4,0 × 2,6; não reabrir. ÁGUA × DRENAGEM
  (Jose, 14/10): ficam independentes, sem aviso — o projetista cuida. Revisão FECHADA; e os do curso (M2d, fpk líquida, Δξ, vão 2h, AsMin) seguem a régua. A perna em L da barra da canaleta do contraforte ainda usa o ℓb da sapata (muda com a
  barra em U, anotação 1 abaixo).
- **Junção de 14/10:** desenho-peso (dente, desenhos da sapata, graute em grade, peso, traspasse) e sapata-molas (aba
  Sapata sobre molas) juntas no main; o que estava solto no main foi para o stash "main sem commit antes da junção
  14/10" (era subconjunto da desenho-peso, conferido linha a linha; pode ser descartado).
- **Faxina decidida (13/10): dividir o gerador da planilha por aba** (hoje build_new.py + contrafortes.py +
  fundacao.py num namespace só — linhas de 2000+ caracteres, leitura por endereço, colisão de nome). Um arquivo por
  aba, cada um com os nomes de que precisa. Prova: spec_planilha.json e golden idênticos antes/depois. SÓ DEPOIS da
  junção da sessão "sapata sobre molas" (branch sapata-molas), que mexe no gerador.
- **Anotado do Jose (12/10, noite — fazer depois, ele avisa quando):**
  1. Barra horizontal do painel (a da canaleta) no contraforte: hoje é traspasse + L; trocar por barra dobrada em U de
     um contraforte ao outro, vários U em sequência, cada barra engastada duas vezes ("é mais fácil dobrar a barra em U
     do que fazer um traspasse e depois um L").
  2. Estribos desenhados quadrados: desenhar com as dobras reais da barra (raio de dobra, ganchos).
  3. ~~Estribo só quando a conta pede~~ FEITO 13/10 (planilha 05 do Carini: "Dispensa Estribos" se fvd ≥ τvd = o
     nosso Vd ≤ Va): com Asw_c = 0 a planilha zera Asw,ef e n_est (Vrd3 = Va), o resumo diz "sem estribos", o app
     não desenha estribo (3D/IFC/quantitativo) e apaga Ø/ramos/s nas Entradas (única regra de campo apagado que lê
     a CONTA: `ATIVA_SE` com `LerConta`). Conta sem número ("—") continua desenhando. 14 de 39 cenários dispensam.
- Receber a NBR 16868-1 em PDF: conferir numeração de itens, Anexo E (βf) e os contornos do ábaco do ELS (lidos do slide).
- Confirmar os FS da NBR 11682 (tombamento 2,0, deslizamento 1,5 — "pelo que sei").
- Fig. 24 (tombamento e deslizamento no traço do Bastos, Fig. 1.116) FEITA 10/10: planilha e app; abre em dphi, ades_b, pass_on, FS_tomb, FS_desl.
- Fundação: estribo de torção com mínimo de bw = 2·he (Jose, 14/10, dedução: as paredes da seção vazada; com bw = B a aula
  12.3 pediria Ø10 c/7); o espaçamento vale o maior entre cálculo e mínimo. Peso do contraforte grauteado é estimativa.
- **Sapata RÍGIDA só (Jose, 14/10: "a planilha de Excel não vai fazer sapata flexível, vai verificar"; elementos
  finitos ficam para o software, com o motor de casca do A-PORT):** a 1ª conta da sapata é a classificação NBR 6118 22.6.1
  na sapata CORRIDA, h ≥ (B − t)/3 (a = B, ap = espessura do muro — Bastos, Sapatas de Fundação, 1.7, nota 38; Jose:
  "o da NBR"). Topo da aba Fundação (`cls_fund`) + Verificações (`h_rig`, `chk_rig`); flexível = NÃO OK "reavaliar as
  condições de contorno (altura, largura, posição do muro)". Memória: card `fundacao.rigidez` é o 1º da fundação.
  Rígida não pune; a DIAGONAL COMPRIMIDA no contorno C se verifica (Bastos 1.7.1; NBR 6118 19.5.3.1): face do muro
  (faixa de 1 m como pilar t × 100, u0 = 2·100, K 0,45 com o Mk — dedução) e junto ao contraforte (tenr × t, K da
  Tab. 19.2 com o Md_cf), seção 7 da Fundação (`tauRd2_s`, `tw_s`, `tc_s`, `chk_bw`, `chk_bc`), card `sapata.biela`.
  A aba Sapata sobre molas (13/10, outra sessão) SAIU, com a entrada `ks_dir`; a conta das molas, da torção sobre base
  elástica e da punção ficam na branch `sapata-molas` como referência para o software. O motor guarda COS/SIN/COSH.
- Cisalhamento do painel não armado: hipótese Vsd = fd·l/2 nunca confirmada no vídeo.
- Depois da planilha: app (3D, quantitativo, desenhos, memória auditável). Reaproveitar os SVG de `figs/`.
