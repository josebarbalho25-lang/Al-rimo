# Al-rimo — muro de arrimo em alvenaria estrutural

Planilha (e, depois, app gratuito) de muro de arrimo em **bloco de concreto**, montada a partir do curso de alvenaria
estrutural do Prof. Matheus Carini (aulas 12.1 a 12.3), do manual da ABCP (Parsekian & Medeiros, "Parâmetros de Projeto
de Alvenaria Estrutural") e da NBR 16868-1:2020. A fundação segue o roteiro da aba "Fundação Sapata Corrida p muro" da
planilha do Eng. Gilberto, adaptado.

Objetivo final: app gratuito (3D, quantitativo, vista frontal, corte lateral, isométrico, memória de cálculo editável e
auditável citando item de norma e fórmula) para atrair público para o Pró-Viga 3D. **Fica separado do A-PORT.**
**DECIDIDO 15/11 (substitui o parágrafo de 13/10 abaixo):** o Al-rimo como está hoje sai GRÁTIS, como programa
instalável (sem tela de ativação, sem controle de licença, sem ofuscação; o termo é o gratuito, `TERMO_DE_USO.md`) —
ver "INSTALADOR" na seção do App. As funções novas da "obra" (terreno, traçado em planta, quinas, corte e aterro —
`PLANO_OBRA.md`) vão para um produto PAGO separado, num repositório privado ramificado deste.
~~**Intenção nova (Jose, 13/10):** comercializar — produto físico instalável, licença perpétua, "ver se consigo vender
por 100 reais".~~ (histórico) Muda: termo de uso (hoje licença gratuita), empacotar o app como programa instalável, controle de
licença, e rever os limites do "app gratuito" (alturas 3,0/4,0). **Decidido 15/10:** os limites 3,0/4,0 FICAM no
pago (4,0: a tabela de δ satura; 3,0: balanço acima disso pede contraforte) — a linha `lim_H` virou "Limite de
altura · Faixa da ferramenta"; o TERMO pago (licença perpétua, base no EULA v2.3 do Pró-Viga, mesmos dados, foro
Uberaba) se escreve JUNTO com o empacotamento e a ativação — a cláusula de ativação/LGPD descreve o programa, então
só depois que ele existir (lição do Pró-Viga: "conferido no código antes de escrever"). Até lá, TERMO_DE_USO.md é o
gratuito.

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
App: `ABRIR.bat` = modo de teste (5180, atualiza sozinho; o StrictMode faz toda conta de tela 2×); `ABRIR_RAPIDO.bat` =
produção (5185, monta e serve; o que o cliente sente). **Lentidão se mede no de produção** (23/10, soltar cota no muro
de 14,8 m: ~115 ms no teste × ~25 ms na produção; o número de abas abertas não influi — só a da frente desenha).
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
- **EMPUXO NA ALTURA DA SAPATA e PASSIVO NO TOMBAMENTO (Jose, 16/11):** à tarde: "desde o começo eu não gostei desse
  negócio de pôr o empuxo até o pé da sapata"; "o outro lado estabiliza ela naturalmente" — nasceu a entrada `emp_sap`
  ("Empuxo na altura da sapata", fim da seção Fundação das Entradas) com padrão "Não". **DECISÃO FINAL (Jose, 16/11,
  noite): PADRÃO "Sim"** — "agora eu entendo que temos de trabalhar dentro da norma, vamos manter até a base sim". Sim
  = o empuxo até a BASE da sapata, a conta dos livros (a de antes de 16/11, bit a bit). "Não" fica como escolha do
  projetista (fonte "Critério adotado (escolha do projetista)"): sai de `H_k` a fatia (sh_base + sh_b2)/2·h e de
  `M_tb` a h²·(2·sh_base + sh_b2)/6; o Vk·h (a força do muro levada ao pé) fica. Arquivo .alrimo abre com o padrão
  (sem migração). Não reabrir. E: "o negócio é fazer um
  negócio funcional e seguro" — com `pass_on` = Sim (a mesma garantia do deslizamento) o passivo entra no
  TOMBAMENTO: `Ep_tb` = Kp_b·γ·(h_fr + h)²/2 ÷ 2,0 (sem o dente, que está abaixo do pé), braço `y_ptb` = (h_fr + h)/3,
  `M_ptb`; FS_t = (M_est + M_ptb)/M_tb; a excentricidade DA VERIFICAÇÃO `e_tb` = (M_cen − M_ptb)/N (chk_e_t, chk_tomb);
  as tensões e a sapata seguem com a e_f sem o passivo (DEDUÇÃO: o passivo só se mobiliza com deslocamento).
  Com "Não" (sem passivo), para comparar: aula 12.2 FS_t 3,81 → 4,06, FS_d 1,10 → 1,53, e 8,2 → 6,9 cm, σmáx
  44,5 → 42,6 kPa; VAL123 FS_t 4,26 → 4,39, FS_d 1,10 → 1,37, e 7,6 → 6,6 cm, σmáx 56,6 → 55,4. Com o padrão Sim a
  referência da regressão voltou aos valores de f1ebc4f e a aula 12.2 volta a reprovar o deslizamento (FS 1,10).
  Golden: `alvo_emp_sap_nao` / `_nao_passivo` são os que exercitam a escolha. Memória: cards de cargas/tombamento
  escrevem conforme a escolha; com Não o desenho do empuxo para no topo da sapata; seta do passivo numerada na face
  da frente com o braço do fundo.
- **φ' DO SOLO DE APOIO — VALOR DE CONSULTA (Jose, 16/11, "Sim"):** o `phi_base` continua OBRIGATÓRIO e digitado
  (decisão de 14/10); a aba Fundação (fim da seção 6) publica só consulta pelo SPT da base: areia `phib_god` = 28° +
  0,4·N (Godoy 1983) e `phib_tei` = 15° + √(20·N) (Teixeira 1996), com `_fx`; argila `cons_b`, `phib_arg`, `cb_arg`,
  `sub_arg` (a tabela por consistência da aba Solo e Empuxo, lida pelo SPT_b). Fontes: os originais NÃO vistos;
  conferido em reprodução (Tito, PUC-Rio 2014, p. 81, eq. 3.4 e 3.5) — a reprodução NÃO dá faixa de N (a `_fx` diz
  isso) e traz também 15° + √(24·N) "de Teixeira" (eq. 3.7, divergência anotada nas Referências). A biblioteca do
  Jose (Berberian, scan) não permitiu conferir (OCR ilegível). App: segunda linha da calculadora da Fig. 15 / aba
  Fundação (`atritoPeloSpt`, figuras/calculadoraDaTensao.ts), só rótulo + valor, faixa no título.
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

- **Logomarca (Jose, 14/10):** na linha da do Pró-Viga atual (quadrado #0D1B4B, traço branco de ponta redonda,
  Fibonacci; a do arco + perfil I é ANTIGA): muro com o dente abaixo da base, base e o empuxo em 3 traços crescendo
  (folga 10 do muro). Um desenho só: `app/src/ui/Marca.tsx` (TRACOS_DA_MARCA); `app/public/marca/` (alrimo.svg,
  icone.svg) repete e o `marca.test.ts` confere. Na aba do navegador e no canto da barra de cima.
- **Modo prancha (Jose, 14/10, aprovado o plano):** aba Pranchas com folhas A0–A4 (deitada/em pé), "Enviar para a
  prancha" no 3D e nas vistas, escalas 1:10/20/25/50/75/100 e sem escala, desenho VIVO (o 3D refeito do mesmo ponto
  de vista), carimbo pela NBR 16752 (canto inferior direito; margens/campos a conferir na norma — o Jose tem acesso
  pelo CREA) com logo e redimensionável, dados do escritório guardados no app e os da obra no .alrimo, quadro lateral
  regulável preenchido sozinho (notas da conta, legenda, quadro de aço) e editável. Saída PDF (vetor) e DXF (só
  GERAR, com biblioteca pronta; mm de papel "como plotado"; hachuras EARTH/AR-CONC/AR-SAND/GRAVEL; carimbo como bloco
  com atributos; .zip). 3D: Realista vai como IMAGEM; Cores e Opaco saem em VETOR (pintor do isométrico com a câmera
  livre do visor). Contrato: `app/src/pranchas/tipos.ts`.
  FEITO 14/10 (no main): aba Pranchas (`pranchas/TelaDasPranchas.tsx`), "Enviar para a prancha" no 3D e "Prancha"
  nas abas 2D (canal `pranchas/envio.ts` → folha ativa), folha composta em mm (`folha.ts`: moldura 20/10, carimbo
  180×50 como BLOCO com um atributo por dado e ponto base no canto inferior direito, quadro lateral com notas que a
  conta sustenta, legenda e resumo do aço por categoria), vistas em escala fixa com PX_POR_MM 4,4 (cota com corpo
  2,5 mm), isométrico e 3D sem escala (largura), títulos automáticos, aviso vermelho de desenho fora da moldura ou
  sobre carimbo/quadro, desenho VIVO (desenhista por muro, 300 ms após a última tecla; 3D Realista refeito fora da
  tela com fundo transparente). PDF pelo diálogo de impressão com uma página por folha e HACHURA EM VETOR (era
  imagem de 37 dpi). DXF (`dxf.ts` sobre `@tarikjabiri/dxf` 2.9.0, AC1018, cp1252): tabela fixa de camadas
  (`camadasDxf.ts`, aço vermelho ACI 1), fundos em `*-FUNDO`/`3D-FACES` (congelar para plotar em preto e branco),
  3D e isométrico sem arestas escondidas, padrões EARTH/AR-CONC/AR-SAND/GRAVEL/ANSI31, .zip com uma prancha por
  arquivo e as imagens; `tools/validar_dxf.py --estrito` (ezdxf) é o critério. Três revisores adversariais + dois
  agentes de correção passaram; pendências do Jose em "PENDÊNCIAS ANOTADAS". Ao mudar dependência do app: `npm
  install` no `app/` do main E reiniciar o servidor da porta 5180 (o Vite guarda o erro de import).
- **Splash (tela de abertura do instalável):** o do Pró-Viga (`proviga-3d-limpo/splash.html`) é janela 987 × 610
  (proporção áurea), 3 imagens QUADRADAS de 1024 px girando à esquerda (610 × 610, a cada 4,5 s, transição de 2 s,
  brilho 78 %), logomarca, nome, versão e barra de carga à direita. Referência ilustrativa do Jose (20/10, 2000 × 1116,
  "é ilustrativa, salva de referência"): `dados/produto/splash/referencia_ilustrativa_01.jpg`. Nas que forem geradas:
  barra a cada 40 (um furo sim, outro não), não em todo furo, e a canaleta da cinta no topo — engenheiro repara.
- **Depois das pranchas: empacotar e vender** seguindo o Pró-Viga (`proviga-3d-limpo`: Electron, tela de ativação,
  `licenca.js`, contrato no instalador, gerar-icone a partir do SVG). (15/11: EMPACOTADO GRÁTIS, sem ativação nem
  licença — ver "INSTALADOR" na seção do App.) GitHub: o Jose disse para deixar o push para
  depois (14/10); em 16/10 pediu "commit e merge no repo" — main subido (a2c57c5). Os outros ramos já estão no main,
  menos o `formula-els-painel` (obra parada).

## App (começou em 08/10/2026) — `app/` (Vite + React + TS + three, como o A-PORT)

- **A conta do app É a planilha.** `tools/exportar_motor.py` exporta as fórmulas para `app/src/motor/planilha.gerada.json`;
  o avaliador em TS (`app/src/motor/excel/`) calcula como o Excel. O `build_new.py` segue sendo o ÚNICO lugar da conta.
  `tools/golden.py` roda N cenários no Excel (COM) → `dados/golden/`; o teste do app confere célula a célula.
  **Mudou o gerador: `exportar_motor.py` + `golden.py` + `npx vitest run` no app.**
- Sem LibreOffice nesta máquina: `recalc_lo.recalc()` cai sozinho no Excel (`tools/recalc_excel.py`).
- **Notebook do Jose (22/10):** clone em `C:\Claude\Al-rimo Notebook`, servidor na 5180 pelo ABRIR.bat. Python 3.13
  só pelo `py` (o `python` do PATH é o atalho da Microsoft Store): `py tools/exportar_motor.py`, `py tools/golden.py`
  (Excel instalado, COM ok); sem ifcopenshell (o `validar_ifc.py` não roda lá). O Jose roda processos pesados de
  outro projeto no notebook ao mesmo tempo: os testes de TEMPO (5 s, 60 s, o de 150 ms do muro de 20 m) estouram —
  conferir rodando o cenário sozinho com mais tempo antes de achar que é defeito. Nunca derrubar processo que não
  seja do Al-rimo.
- **INSTALADOR (15/11, grátis — receita do Pró-Viga sem licença):** casca Electron 42.0.1 em `instalador/` (package.json
  próprio; o `app/` continua montando sozinho). Montar: dois cliques no `MONTAR_INSTALADOR.bat` da raiz, ou
  `npm run dist` / `npm run dist:dir` (só a pasta) em `instalador/` (`ferramentas/montar.js`: `npm run build` no app →
  copia `app/dist` para `instalador/gerado/app` → ícones → termo → electron-builder NSIS). Sai
  `instalador/dist/Al-rimo-Setup-<versão>.exe` (~97 MB); `gerado/` e `dist/` fora do git. VERSÃO: só a de
  `app/package.json` (passada como extraMetadata; o splash e o memorial leem a mesma). O app mora em `app://alrimo/`
  (esquema próprio, `main.js servir`): os caminhos "/pecas", "/figuras", o fetch do terceiros.txt e o localStorage
  funcionam sem mexer no `base` do Vite. Arquivos: `.alrimo` pela PONTE (`instalador/preload.js` ↔
  `app/src/estado/programa.ts`; `arquivo.ts` usa a ponte com a mesma cara da janela de arquivo do Chrome — o Ctrl+S
  grava no mesmo caminho, inclusive do duplo clique); IFC, CSV, Word, DXF .zip, SVG e PNG continuam download do
  navegador e o main pergunta onde gravar (baixa para %TEMP% primeiro: o app solta o endereço 1 s depois do clique);
  PDF do memorial e das pranchas = `printToPDF` direto em arquivo (página do tamanho do @page) e abre no leitor —
  no navegador segue o diálogo de impressão. Duplo clique / "Abrir com" / 2ª cópia: abre na janela aberta (instância
  única), perguntando se havia alteração. Fechar com • pergunta Salvar / Não salvar / Cancelar (Salvar = o Ctrl+S e
  fecha). Splash 987 × 610 (`splash.html`, imagens de `dados/produto/splash/`), ícones gerados de
  `app/public/marca/icone.svg` (`ferramentas/gerar-icones.js`; traço 7/6/5 por tamanho, como o Marca.tsx), ícone do
  `.alrimo` = folha com a marca. Termo no instalador = `ferramentas/gerar-termo.js` (TXT com BOM, CRLF, 78 colunas,
  até "Fontes consultadas", como o app). Instala por usuário (escolha na 2ª página), sem administrador. Achado no
  caminho: a folha do PDF das pranchas era `.folha` e pegava o `.folha { position: absolute }` da tela — o PDF saía
  em Carta com página em branco também no navegador; virou `.pr-folha` (pdf.ts). CONFERIDO no pacote (pasta
  descompactada, porta de depuração + `ALRIMO_DIAGNOSTICO`): splash → app sem erro de console nem de rede; termo na
  1ª abertura; Componentes de terceiros abre (com o aviso do Electron/Chromium no fim); .alrimo pela linha de comando
  e pela 2ª cópia; Abrir; Salvar (e Ctrl+S por cima); IFC, CSV, Word, DXF .zip, SVG/PNG da vista, PNG do 3D; PDF do
  memorial (28 pág. A4) e das pranchas (A1); a pergunta ao fechar e o "Salvar" dela. Variáveis de conferência
  (nunca para o usuário): ALRIMO_DIAGNOSTICO, ALRIMO_TESTE_SAIDA (diálogos respondem sozinhos), ALRIMO_TESTE_ABRIR,
  ALRIMO_PERFIL, ALRIMO_DEVTOOLS. PENDENTE: sem assinatura de código (o Windows mostra o aviso do SmartScreen —
  "Mais informações › Executar assim mesmo"); sem atualização automática; o termo 1.4/2.2 fala em "navegador"
  (o programa instalado guarda o aceite no perfil dele, %APPDATA%\Al-rimo) — o Jose decide se reescreve;
  "Não salvar" ao fechar não apaga o último muro lembrado (o app o devolve na próxima abertura, com o •, como no
  navegador) — decisão dele; impressão em papel do memorial é pelo leitor de PDF (no programa não há o diálogo de
  impressão do Chrome).
  **2ª RODADA (15/11, o Jose testou o instalador):**
  · "APENAS PARA MIM" NÃO INSTALAVA (fechava sem aviso; "para todos" funcionava — é assim que ele tem o programa em
    Program Files). Erro de aplicativo no System.dll do NSIS, 0xc0000005, deslocamento 0x1581 = o laço de cópia byte
    a byte do plugin. Causa: modelo NSIS do electron-builder 26.8.1 (`multiUser.nsh` setInstallModePerUser) lia o
    caminho do SHGetKnownFolderPath com `System::Call '*$2(&w8192 .s)'` — 16 KB copiados de um bloco de ~70 bytes;
    com o bloco no fim do heap, lê memória que não existe. A 1ª chamada (ao abrir) passa; a 2ª (ao sair da página da
    escolha, só no "Apenas para mim") caía. Reproduzido de propósito (bloco no fim de uma página: mesmo módulo, erro e
    deslocamento). CONSERTO: electron-builder 26.18.0 (o do All Sec), que usa lstrcpynW. Fica a página da escolha
    com as duas opções (a do Pró-Viga, que tem o mesmo 26.8.1 e o mesmo risco — avisar quando mexer lá).
  · CÓPIA DO INSTALADOR: o electron-builder guarda ~100 MB em `%LOCALAPPDATA%\al-rimo-desktop-updater` (atualização
    automática, que não há); o `gerado/instalador.nsh` (montar.js, `nsis.include`) apaga ao instalar e ao desinstalar,
    e desinstalar tira a chave `.alrimo` vazia (só se ainda for nossa e não numa atualização). Na máquina do Jose há
    98 MB lá da instalação de 15/11 — somem na próxima instalação.
  · `node ferramentas/montar.js --teste` = o "Al-rimo Teste" (appId com.jbarbalho.alrimo.teste → outro GUID, pasta
    `%LOCALAPPDATA%\Programs\Al-rimo Teste`, extensão `.alrimoteste`, perfil `%APPDATA%\Al-rimo Teste`, saída
    `dist-teste/`): instala e desinstala sem encostar no Al-rimo dele. O AppUserModelId vem do pacote (`idDoPrograma`).
  · BARRA DE TÍTULO PRÓPRIA (o jeito do Pró-Viga e do All Sec): `titleBarStyle: 'hidden'` + `titleBarOverlay` —
    os três botões são os do WINDOWS por cima do canto do cabeçalho (vermelho no fechar, encaixe Win+setas e ao
    arrastar ao topo, duplo clique maximiza, borda redimensiona: tudo nativo; frame:false perderia isso). O cabeçalho
    (e a marca do trilho) é `-webkit-app-region: drag` só com `html.programa` (layout.css); botões, campos, janelas
    por cima e menus no-drag. `ui/barraDaJanela.tsx` manda cor do cabeçalho, tinta (--ink), altura (clientHeight, sem
    o fio de baixo) e o --bg a cada tema/Tamanho (ponte `barraDaJanela` → `janela:barra`); o main guarda em
    programa.json (`barra`) e abre a próxima já na cor certa. Antes do aceite do termo a `FaixaDaJanela` faz de
    cabeçalho. Título no cabeçalho: "nome • — Al-rimo" (o " — Al-rimo" só no programa). Navegador: nada muda.
  · SPLASH: cada abertura começa noutra imagem, em roda (`splashImagem.js`; 1ª abertura sorteia; a última em
    programa.json `splash`); barra ~3 s sozinha, splash ~4 s (era ~2,6; Pró-Viga 5 a 6 s).
  · INTERFACE DE FÁBRICA: 90 % / Compacta / Claro (era 120 % / Confortável / Escuro). Quem escolheu fica com o seu.
  · CONFERIDO (15/11), sem tocar no Al-rimo dele (Program Files, atalho público, .alrimo, HKLM intactos ao fim):
    `Al-rimo-Teste-Setup /S /currentuser` → pasta, desinstalador no HKCU com GUID próprio, atalhos no menu e na área
    de trabalho, .alrimoteste, cópia do instalador apagada; o programa abriu (porta de depuração + diagnóstico):
    perfil limpo a 90 %/Compacta/Claro com o termo; barra: WM_NCHITTEST dá legenda no cabeçalho e na marca, cliente
    nos botões do app, MIN/MAX/FECHAR nos do Windows, borda direita/baixo redimensionam; Claro/Papel/Escuro e Tamanho
    reenviam cor e altura; minimizar/maximizar/restaurar/fechar (WM_SYSCOMMAND/WM_CLOSE); maximizada + Escuro/110 %/
    Confortável voltaram depois de fechar, de reabrir e de REINSTALAR por cima; splash 1 → 2 → 3 → 1 em quatro
    aberturas; Salvar .alrimo, Abrir, IFC; fechar com • pergunta (a caixa nativa apareceu; no modo de teste fecha
    sozinho); Gráfica › Esforços com o verde/vermelho e 8 diagramas na memória; console só com o aviso THREE.Clock,
    sem erro de rede. Desinstalar `/S /currentuser` → pasta, registro, atalhos, classes e cópia do instalador fora
    (o perfil fica, de propósito: preferências sobrevivem a desinstalar e reinstalar).
    NÃO CONFERIDO: o caminho pela TELA (as páginas clicadas) e o "para todos os usuários" — o controle de tela foi
    negado nesta máquina e o "todos" pede o UAC, que daqui não se responde. O conserto está só no caminho "Apenas para
    mim"; o "todos" não usa o trecho consertado. Pedir ao Jose: rodar o instalador novo e escolher "Apenas para mim"
    numa máquina sem o Al-rimo, ou por cima (o dele está "para todos": a página já vem marcada assim).
    Achado no caminho: o muro lembrado volta com o • (o "Não salvar" acima), então a 1ª tentativa de fechar depois
    de reabrir já pergunta — coerente com a decisão pendente, mas o Jose vai notar. → CONSERTADO 15/11 (abaixo).
- **INÍCIO NO PADRÃO DO PRÓ-VIGA (Jose, 15/11: "precisamos manter esse padrão… ele deixa as vigas salvas por último
  na tela inicial") — FEITO 15/11:** copiado de `proviga-3d-limpo/app/projects.jsx` + classes home-*/export-*/recent-*
  do Proviga-3D.html, nas mesmas proporções (coluna 256, botões 36, cartões ≥ 212 com foto 16:10, tudo × escala).
  `ui/TelaInicio.tsx`: marca + "Al-rimo" (serifa; a Fraunces não vem no app — cai na Georgia) + "NBR 16868-1:2020";
  "+ Novo muro…" (cheio), Abrir…, Exemplo, Salvar, Salvar como…; EXPORTAR em linhas com ladrilho colorido desenhado
  (tokens `--arq-ifc/dxf/pdf/csv` em tokens.css, iguais nos 3 temas; sem marca de terceiro): IFC, DXF (pranchas),
  Memorial (chip "2 modos ▾": PDF no programa / Imprimir no navegador, e Word — ligação nova `exportarWord`), Pranchas
  em PDF, Quantitativo (.csv direto); apagado com chip curto ("Sem modelo", "0 folhas", "Conta com erro"); o DXF e
  o PDF das pranchas deixam o pedido em `pranchas/pedidoDeSaida.ts` e abrem a Gráfica, e a tela das pranchas atende
  (o comando fica num lugar só); linha "● Salvo · arquivo". RECENTES à direita: cartão com a foto, nome, ficha
  ("Balanço · bloco 19×39 · h 1,60 m", `estado/resumoDoMuro.ts`) e data; o mais novo primeiro, teto 12, mesmo
  arquivo = um (maiúscula/barra), arquivo sumido sai (ao listar no programa; ao clicar no navegador), × no pairar e
  "Remover da lista" no botão direito (não apaga o arquivo). Clique abre com a pergunta das alterações e a alça
  (Ctrl+S no mesmo arquivo). FOTO = 3D REALISTA fora da tela (`visor/miniatura.ts` → `refazerFoto` com a opção
  nova `enquadrar`: isométrico pela caixa do muro, 490 × 300, fundo transparente) SEM O TERRENO (desvio: com os dois
  aterros o muro virava uma faixa no cartão — visto no programa); sai DEPOIS do registro, uma por vez.
  ONDE MORAM: programa → perfil (`%APPDATA%\Al-rimo\recentes.json` + `recentes\<sha1>.png`; `instalador/recentes.js`,
  handlers `recentes:lista/lembrar/esquecer` no main, ponte em preload/programa.ts; também `app.addRecentDocument`,
  a lista do Windows); navegador com a janela de arquivo (Chrome/Edge) → IndexedDB `alrimo.recentes` com a ALÇA
  (pede a licença de novo no clique); sem ela (Firefox) a área dos Recentes some. Nada vai no .alrimo.
  CABEÇALHO numa linha como o h2 do Pró-Viga: seção em negrito + " · " + contexto apagado ("Início · Projetos do
  Al-rimo"; nas outras o nome do muro com • e, no programa, " — Al-rimo"); salvar/desfazer/refazer ficam (o Pró-Viga
  não tem no Início — mantidos por serem os aprovados em 20/10). BARRA DE ESTADO: veredito → "● Salvo · arquivo" (o
  recado da vez tem a vez) → FICHA em pares rótulo/valor mono (MURO, ALTURA, CONTRAFORTES "a cada" só nesse tipo,
  COMPRIMENTO do muro desenhado, SAPATA; o par que não cabe some inteiro) → avisos, versão da conta e "● CALCULADO
  hh:mm:ss" (a última conta que fechou). Saiu o "tipo · bloco" da direita (está na ficha; o alerta de família
  provisória não existe mais — nenhuma é).
  MURO LEMBRADO VOLTA SALVO (o achado acima): o Chromium grava o armazenamento da página com atraso, e fechar logo
  depois do Ctrl+S perdia o "salvo". Duas pontas: o main força `flushStorageData()` ao fechar; e o app guarda o
  CAMINHO do arquivo (`alrimo.caminho.v1`, amarrado ao id e ao nome) e, ao abrir o programa, lê o arquivo e, se o
  muro da tela é o mesmo do disco, fica salvo (`retomarOArquivo` → store `confirmarODisco`) — e a alça volta (Ctrl+S
  depois de reabrir grava no mesmo arquivo, sem perguntar onde). Alteração de verdade ("Não salvar") continua com o
  •; muro nunca salvo, idem. Conferido no programa empacotado: mudou o comprimento, Ctrl+S, fechou em 30 ms, reabriu
  sem o •. Prints: `_trabalho/padrao_proviga/` (inicio_claro, inicio_escuro, grafica_barras_claro). Testes:
  `estado/recentes.test.ts`, `ui/telaInicio.test.tsx` (inclui a régua: toda var(--…) do Início, cabeçalho e barra
  existe nos 3 temas), `visor/miniatura.test.ts`, `instalador/teste/recentes.test.js`. NÃO VISTO: o caminho do
  navegador (IndexedDB + licença da alça) só nos testes de lógica; a 150 % e na densidade Confortável só pela régua.
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
  Deslizamento e posição do dente: FEITOS em 13/10 (ver "Dente com posição e passivo"). **Aguardando o Jose:** o
  "nó de cachorro" da armadura que entra na sapata (ele modela no Revit).
- **Respostas do Jose (09/10, fim do dia):** limites 3,0/4,0 valem para a altura do MURO; **bitola da espera em LISTA
  dependente da altura da sapata** (só as que a dobra cabe: pino 5φ até Ø16, 8φ a partir de Ø20 — NBR 6118 Tab. 9.1;
  "nó de cachorro" com Ø20 não cabe em sapata de 20 cm) — FAZER depois da seção real; barra do contraforte na
  canaleta do muro **dobrada em L**; canaleta cortada de 19 é **peça própria** (fundo 3,91); comprimento do muro em
  múltiplos do bloco ("o calculista se vira com o corte"); termo: mesmos dados do Pró-Viga, foro Uberaba/MG.
- **Detalhes típicos det01–det05 prontos** (`figs/app/detalhes/`, `app/public/detalhes/`; ainda não entram na prancha).
  Respondidos (15/10): cor da espera — já igual na Fig. 9, Fig. 18 e det03 (a 18 foi acertada na régua de 12/10);
  impermeabilização ATÉ A ALTURA DE SOLO (Fig. 17 corrigida, quantitativo já era); junta corta a cinta TODA (como
  está — dedução: o "parte" do ABCP é da cinta que amarra laje). Em aberto: barra vertical subindo até 3 cm do topo
  atravessa o fundo da canaleta da cinta (furar o fundo? o detalhe não mostra).
- **Drenagem no 3D (Jose, 14/10, FEITO):** brita em degrau = camada do tardoz (`dreno_esp`, agora espessura SÓ da
  brita) ∪ envoltória quadrada do dreno de fundo (`drenof_env` 0,30) com o tubo perfurado (`drenof_phi` Ø100) no meio;
  AREIA de filtro entre a brita e o solo (`areia_esp` 0,10; 0 = sem); manta por fora; `dreno_folga` vai do topo do
  solo ao topo do pacote. Barbacã sai 5 cm da face e entra 5 cm no dreno, na 1ª fiada com o tubo todo acima do solo
  da frente (`h_fr`, desenhado sempre, com ou sem `pass_on`); fiada em canaleta → sobe para a de cima. Peças novas
  AREIA e TUBO_DRENO (3D, IFC, quantitativo, corte). Contraforte enterrado: CADA VÃO COM O SEU DRENO, contraforte
  NÃO é furado (Jose, 14/10) — por isso os barbacãs se distribuem vão a vão, no mínimo um por vão (a saída do dreno
  daquele vão). Opaco: tubo cinza #8c8c8c (branco sumia no bloco branco), brita #c4c4c4, areia #e4e4e4. Código:
  `modulacao/entorno.ts` (pacoteDoDreno, bordaDoPacote).
- **Barbacã na altura pedida e ligado ao dreno de fundo (Jose, 13/11: "a alternativa pro muro com contrafortes sem
  furar os contrafortes"):** entradas do modelo `barbaca_z` (m, eixo acima do topo da sapata; em branco = a
  automática de antes) e `barbaca_dreno` (Sim = o barbacã vai da face do muro até o CENTRO do tubo perfurado, na
  altura dele: z = drenof_env/2, comprimento t + 5 cm + drenof_env/2; um por vão, como já era). A fiada da altura
  pedida precisa de célula livre (sem barra); sem ela, fica a automática com aviso BARBACA_ALTURA; saída abaixo do
  aterro da frente avisa BARBACA_ABAIXO_DA_FRENTE. Limite que já existia: painel com barra em todo furo (s_pv = 20)
  não tem célula livre — nenhum barbacã (BARBACA_SEM_CELULA), ligado ou não.
  FURO COM BARRA (Jose, 13/11: "ou só deslocar o barbacã do ferro vertical… até automático"): sem furo livre na
  fiada, o tubo passa no furo da barra, ao lado dela (1 cm da barra e da borda do furo; vai antes do graute) — com
  Ø50 e Ø10, eixo a 4 cm do eixo da barra. Furo sem barra continua o primeiro lugar. Com barra em todo furo (s = 20)
  o barbacã agora sai; o BARBACA_SEM_CELULA fica para furo pequeno demais.
- **Hachuras do Revit do Jose (14/10):** terra = trançado EARTH do AutoCAD (casa 48 px, #a67857 sobre #dbc9bb),
  concreto (#5d5d5d sobre #d4d4d4), areia (#5d5d5d sobre #ffffb7), brita = pedras de quina viva (opção A, #4a4a4a sobre
  #c3bfb5). Tamanhos CALIBRADOS por ele na régua (`_trabalho/calibrar_hachuras.html`): terra ×0,40, concreto ×0,85,
  areia ×0,25, brita ×0,55 sobre a 1ª proposta (constante ESCALA). Um gerador por lado: `app/src/desenhos/hachuras.ts`
  (desenhos do app) e `figs/app/hachuras.py` (figuras), mesma semente e mesma ESCALA — mudou um, muda o outro.
- **Armação: estribo real, sapata em estribo, arranque (Jose, 15/10; feito por agente sob revisão):**
  ESTRIBO com a forma de verdade (`modulacao/barras.ts`, fonte Pró-Viga `app/viewer3d.js` buildStirrupPoints e o
  estribo 338366 do Revit dele, projeto "Al-rimo Templates"): ganchos de 135° os dois no mesmo canto, ponta reta
  max(5φ, 5 cm) — NBR 6118 9.4.6.1 ("Ok" dele; o Pró-Viga usa 10φ ≥ 7 cm, que é a regra do gancho de 90°, e o
  Revit 40 mm, abaixo da norma) —, pino 3φ até Ø10, volta em espiral ±φ/2; polilinha aberta com `Barra.estribo`
  (não mais `fechada`); na lista de ferros, o retângulo do eixo. SAPATA: entrada `sap_transv` 'Estribo' (padrão) /
  'Reta' (a de antes, barra a barra): estribo fechado na seção B × h com cobrimento, perna de baixo = flexão, de
  cima = talão (construtiva com Mk_heel = 0), ganchos no canto de cima do lado da ponta; torção continua à parte; o
  aço sobe (aula 12.2 93 → 105 kg). ARRANQUE: entrada `arranque` 'Padrão' / 'Nó de cachorro' — forma lida das
  barras 337807/337808/337806 do Revit dele: desce ao cobrimento de baixo, corre por baixo ATÉ A PONTA (Jose, 15/10
  tarde: "quando usar nó de cachorro quero que ela vá até a ponta"), sobe na face da ponta (pino 5φ/8φ nas dobras),
  corre por cima até a face do lado do talão e desce até embaixo. O nó NÃO entra na conta (Jose: "deixa quieto essa
  parte de contabilizar ela no cálculo" — cobriria só a face de cima e estragaria o estribo; ele usa o nó pela
  confiança na flexão do muro, mesmo com o ℓb atendido do outro jeito);
  avisos NO_DE_CACHORRO_DOBRA (h_sap < 2c + pino + 2φ, barra não sai), _FORA (a ponta não comporta as dobras do pé —
  espera não desenhada) e _PONTA (tabela dele, `PONTA_DO_NO`:
  bloco 14 Ø≤8 → 0, Ø10–12,5 → 4 cm, Ø16–20 → 7 cm, Ø25 não cabe — 8,4 % do furo de 117 cm² com traspasse; bloco 19
  Ø≤12,5 → 0, Ø16–20 → 2 cm, Ø25 → 7 cm DEDUZIDO, a confirmar). A "ponta" da tabela dele é a PONTA DA SAPATA à frente
  do muro. O `h_dob()` da planilha ficou (a regra do Padrão, com a malha, é mais exigente: a lista de bitolas segue
  segura para o nó). Figs. 9 e 18 marcam as entradas; a 18 desenha o estribo. Observação dele, sem verificação: a
  espera Padrão pode dar "empuxo no vazio" em sapata baixa; a partir de ~30 cm não. A CONFIRMAR com ele: canto dos
  ganchos (sapata: em cima, lado da ponta; contraforte: lado do muro); Ø25 no bloco 19; o ramo do nó que sobe anda
  um φ de lado; o nó ignora `gancho_`; ESTRIBO_NA_JUNTA avisar também Ø6,3?
- **A LISTA DO JOSE DE 16/10 (feita no mesmo dia; decisões dele nas perguntas: "Como no Revit", "Valor cheio 600",
  "Por folha"):**
  · VISTAS COMO NO REVIT (`pranchas/vistas.ts`): cada vista tem NOME numa lista por aba (o select "Vista" da aba:
    Nova vista / Duplicar — com as anotações / Renomear / Excluir), guarda o conteúdo (lugar do corte, fiada, lado do
    isométrico, câmera do 3D), a ESCALA, o título na folha, as ANOTAÇÕES e a sobreposição de gráficos. A aba mostra a
    vista escolhida NA ESCALA DELA (o mesmo desenho da folha). Uma vista vai numa folha só (o 2º envio diz "já está
    na folha NN"); tirar da folha NÃO apaga (volta pelo "Adicionar › Vistas" da aba Pranchas: é o "índice" que ele
    pediu). As de fábrica (uma por tipo 2D) são VIRTUAIS até a 1ª mexida (abrir aba não acende o •). O item da folha
    guarda lugar, número e tamanho; `noItem` → `gravarNoItem` manda cada mexida para a vista ou para o item; no
    arquivo o item de vista leva o ESPELHO do conteúdo, escala e título, sem anotações (`pranchasParaArquivo`: o app
    de antes de 16/10 abre os desenhos; vista que não se lê volta pelo espelho e vai para o recado). Arquivo de antes: cada desenho vira uma vista
    (o título vira o nome). O 3D enviado vira a vista "3D", "3D (2)"… Título na folha: vazio = o nome dado à vista
    ("Corte A"), senão o automático (`nomeDado`).
  · ANOTAR NA ABA E NA FOLHA (`pranchas/EdicaoDeAnotacoes.tsx`, a MESMA edição nos dois): clicar, arrastar texto e
    linha, duplo clique reescreve, Delete esconde/apaga, Cota (D), Texto (T), Etiqueta (I). Na folha: 1 clique
    escolhe e move o desenho; DUPLO CLIQUE ENTRA nele (véu branco no resto, moldura tracejada; Esc, duplo clique fora
    ou "Sair" saem); duplo clique no TÍTULO reescreve no lugar. Na aba: camada por cima do desenho e o quadrinho do
    escolhido no canto.
  · COTA DE VERDADE: a do A-PORT só se afasta (as alças estão PENDENTES lá também); aqui: criação em CADEIA como a do
    Revit (pontos capturados em sequência; o clique solto é o lugar da linha — `ferramentas.ts cotasDaCadeia`; a linha
    da cadeia anda junto, `CotaNova.cadeia`), ALÇAS nas duas pontas (a ponta captura outro ponto; a automática puxada
    pela ponta vira cota do projetista no lugar dela), PREFIXO/SUFIXO em volta do valor medido (automática e criada).
    Cota criada NÃO é associativa (pontos em mm do muro): muro mudou, ela não acompanha — anotar se ele estranhar.
  · ETIQUETA DE AÇO (`EtiquetaNova`, `chamadas.ts desenharEtiquetas`): clica perto da barra (anel de 1 em 1 px até 8
    px), diz o mesmo da chamada ("N1 – 15 Ø10 c/40 C=210"), âncora no ponto da barra mais perto do clique, texto por
    afastamento (a barra que anda leva junto); só na FRONTAL e no CORTE (armação/planta: não). COM/SEM LINHA DE
    CHAMADA na etiqueta e na chamada da coluna (`semLinha`).
  · VALOR CHEIO (`formato.ts cmCheio`): comprimento do muro e dos trechos entre juntas = real + 10 (5,99 → "600"), na
    frontal e na planta; o concreto segue o real.
  · TÍTULO DA IMAGEM DELE (`folha.ts titular`): número grande, branco e itálico num quadrado azul-marinho de 10 mm (o
    da marca), título como ele escreveu (sem caixa alta, SEM sublinhado) e a escala "1 : 25" embaixo. Número POR FOLHA,
    o primeiro livre (quem sai deixa a vaga; os outros não mudam), editável no painel. DXF: quadrado em TITULOS-FUNDO,
    número em ALRIMO_ITALICO (ariali.ttf) branco de verdade.
  · ENCAIXE (`pranchas/encaixe.ts`): arrastando o desenho, bordas e meio grudam nos outros, na moldura, no quadro e
    no carimbo (8 px de tela), guia magenta; Alt solta.
  · GRÁFICOS GERAL + SOBREPOSIÇÃO (substitui a tabela por tipo de 15/10): a engrenagem › "Gerais" edita a GERAL (app,
    `alrimo.graficos.v3`; a v2 abre com a geral montada das vistas + o Opaco do 3D, e a diferença do 3D vira a do visor);
    o "Gráficos" da aba (e o "Sobrepor…" do painel do desenho na folha) edita a SOBREPOSIÇÃO DA VISTA (vai no arquivo,
    na vista); o botão do 3D, a do visor (app). O "Mostrar" da aba agora é da vista. Janela = cópia da do A-PORT
    (`ui/JanelaDeGraficos.tsx`: abas Modelo/Anotação/Bitolas, Visibilidade | Projeção (Linhas, Padrões,
    Transparência) | Corte (Padrões) | Meio-tom, linha principal com "Sobrepor…", janelinha com Primeiro e Segundo
    plano, Todos/Nenhum/Inverter, fundo transparente que segura o clique, Esc cancela). MEIO-TOM novo (cor a 60 % do
    caminho até o papel, 2D e 3D). Textos e sombras com visível próprio. A prancha guarda a sobreposição com que nasceu
    (os <pattern> e as cotas criadas saem com ela).
  · GRAUTE DA FRONTAL EM SOMBRA (`vistaFrontal.ts`): uma faixa vertical por coluna de furo (`colunasDoGraute`, mesma
    coluna até 25 mm de diferença no meio, largura MÉDIA dos furos), cinza ESCURO #3d3d3d a 35 % × a transparência
    do graute (`corDaSombraDoGraute`; o graute de fábrica é `cor: null` = o neutro de cada lugar — no 3D Cores segue
    o bege claro; cor escolhida vale nos dois); no DXF, a faixa inteira sobre o papel e por cima os pedaços misturados
    com a cor de cada bloco que APARECE. Tirado o filete branco sob as barras.
  · REVISÃO ADVERSARIAL DA LISTA (16/10 noite, 3 revisores, 36 achados; `pranchas/__testes__/revisaoDaLista.test.ts`):
    Cancelar sem mexer não grava a vista virtual (`naVistaDoProjeto`) e a comparação ignora a ordem dos campos
    (`mesmoConteudo`, também no • do store e no guardar dos gráficos — o de fábrica não se grava); cores de 15/10:
    cada campo da 1ª vista que o mexeu (hachura do corte), transparência não vira geral (`geralDasVistas`); a
    sobreposição guarda 0 % e meio-tom desligado (desfaz o da geral; a janela não grava o igual à geral); Restaurar da
    janela geral mantém o visor; "Vistas 3D fora das folhas" com Excluir na aba Pranchas; nome de vista único (" (2)");
    um gerador de id só. Tela: Texto (o mousedown roubava o foco do campo; o campo de escrever agora é foreignObject
    dentro do desenho e o título fica preso ao papel — andam com zoom e rolagem); a aba não rouba foco ao montar;
    ferramenta solta sozinha quando o desenho muda (troca de folha, de vista, excluir); duplo clique dentro do
    desenho ativo (ou na cota, na alça, com a Cota armada) não sai nem reenquadra; Esc num campo é do campo
    (`teclaDeCampo`); Etiqueta só arma na frontal e no corte, cota/texto só com escala (`aceitaEtiqueta`,
    `podeAnotar`); janela de Gráficos no body (por cima do painel e da barra de estado) e fecha ao abrir outro muro;
    "Exibir categorias" do 3D cobre blocos e drenagem; transparência digitada vale no Enter; × da bitola volta à de
    fábrica; Opaco só onde o 3D lê (`camposDaSuperficie`). Desenho: categoria desligada guarda a MESMA caixa e não
    publica anotação editável (`categoriaVisivel`); traspasse obedece o "Cotas"; meio-tom uma vez na faixa do graute e
    no 3D da prancha (`corDaPecaSemMeioTom`/`corDoAcoSemMeioTom`) e na borda da hachura do PDF; número comprido do
    título encolhe e o quadrado alarga (`quadradoDoNumero`); cota de comprimento guarda a chave do valor sem a junta
    (`textoDaChave`: o ajuste de 15/10 continua achando). Ficou: cota criada entre as pontas do muro mede 599 ao lado
    da automática 600 (a criada mede a geometria — explicar se ele estranhar); o "aterro" fica com a terra a 100 %.
- **Gráficos POR VISTA (Jose, 15/10 tarde — SUBSTITUÍDO em 16/10 pela geral + sobreposição, acima):** UMA TABELA POR VISTA — 3D,
  frontal, corte, planta, isométrico e armação (`Graficos.vistas`; a tabela única da manhã abre valendo para todas).
  O desenho na prancha usa a tabela do tipo dele (o corte da folha segue a aba Corte), como o Mostrar. Cada desenho 2D
  roda em `naVista(tipo, …)` e a Prancha guarda a vista em que nasceu (o <defs> sai depois). TRANSPARÊNCIA 0–100 de 5
  em 5 por material: no 2D é `opacity` no traço do material (padrão, bloco pintado, aço — `Estilo.material`); no 3D é
  do material, um por estilo × acabamento × CLASSE do bloco (o inteiro transparente com a canaleta cheia), vale no
  Realista também (ver através é olhar, não pintar), o terreno multiplica o véu dele, 100 % não pega clique; o DXF
  (AC1018) não leva transparência. ANOTAÇÕES com cor por vista (cotas, textos, chamadas, sombras, eixos — o id é a
  camada; null = a do desenho). JANELA "Gráficos" (`ui/JanelaDeGraficos.tsx`, o VV do A-PORT): botão em cada aba 2D,
  ícone na barra do 3D e nas Configurações; abas Modelo (grupos do Mostrar com os materiais, Visível, cor, hachura,
  transparência; no 3D Cores/Opaco/hachura/Transparência e as bitolas) e Anotação; MUDA NA HORA e o Cancelar volta o
  que a janela mexeu (Esc só com o foco nela); clicar fora não cancela; "Aplicar às outras vistas" (só o que a janela
  mostra) e "Restaurar padrão" (só a vista; a do 3D com as bitolas). Guardada em `alrimo.graficos.v2`.
- **Cores, hachuras e o que aparece (Jose, 15/10 — o Visibilidade/Gráficos do Revit):** tabela de gráficos
  (`desenhos/graficos.ts`: materiais com cor do 3D Cores, cor do Opaco, cor do traço 2D do aço e hachura de corte
  — desenho terra/concreto/areia/brita/riscado/sólido/vazio, risco, fundo, escala; cor por Ø; itens desligados por
  tipo de vista). Decisões dele: GUARDADA NO APP (localStorage `alrimo.graficos.v1`, `desenhos/useGraficos.ts`,
  "Restaurar padrão"); liga/desliga POR TIPO DE VISTA (botão "Mostrar" em cada aba 2D: blocos, graute, armadura,
  sapata, drenagem, terreno, cotas, eixos, fiadas, chamadas, legenda — vale na tela e na prancha); no 3D a tabela
  vale no CORES e no OPACO, o Realista não. A tabela fica nas Configurações ("Desenhos e 3D"). Os desenhos leem
  `graficos()` na hora (variável do módulo; `versaoDosGraficos()` nos caches da vista, da folha e da foto do 3D);
  sem a tela, vale o de fábrica = as cores de antes (HACHURA de `hachuras.ts` sai de lá). `Prancha.silenciar()`
  desliga um bloco de traços sem perder as contas de posição. No DXF o fundo vai na cor da tabela e o padrão na
  escala dela; o risco do padrão segue a cor da CAMADA (o cadista manda pela camada).
- **Chamada solta (Jose, 15/10: "o tag da armadura… deixar livre pra eu colocar quando quiser do jeito que quiser?
  Girar ele, por na vertical, pra um lado, por outro"):** na folha a chamada se arrasta, gira (⟲/⟳ 90° e ângulo, em
  torno do meio) e se esconde (Delete); a linha sai da barra e encosta na ponta do texto mais perto dela, com ombro.
  Guardada no item da folha por "posição|elemento" (`ItemDaFolha.chamadas`, `ChamadaPosta`: texto contado do ponto
  da barra em px de desenho — mesma distância no papel em qualquer escala). Quem fica na coluna não anda; a caixa
  que prende o desenho na folha (`VistaParaPrancha.referencia`) é a da coluna inteira: o desenho não pula.
- **Anotações editáveis na folha (Jose, 15/10: "deletar ou criar cotas e mover anotações em geral, escrever de novo o
  que quiser"; o comportamento do A-PORT, redesenhado em SVG):** toda cota (cada trecho de cadeia) e todo texto solto
  ganha CHAVE = tipo + texto de origem + ordem ("cota:B = 140#0", `desenhos/prancha.ts` "ANOTAÇÃO EDITÁVEL"); o
  ajuste fica no item da folha (`anotacoes`: dx/dy do número ou texto, afastamento da linha, giro, texto, oculta). Muro
  mudou e o número também: a chave não casa e a cota volta ao automático (melhor sobrar que esconder errado). A
  mexida deixa o lugar de origem reservado (o "fantasma") — nada pula. Na folha: clicar seleciona, arrastar o
  texto move, arrastar a linha afasta, duplo clique reescreve no lugar, Delete esconde (a automática; "Mostrar
  ocultas"/"Voltar ao automático" no desenho) ou apaga (a criada). Ferramentas COTA (D: dois pontos capturados —
  pontas e meios dos traços, a anotação não — e o lugar da linha, horizontal ou vertical pelo terceiro clique, como o
  DIMLINEAR) e TEXTO (T: clica e escreve; desarma depois de um), Esc volta um passo, recado curto na barra. Criadas
  ficam em mm do muro no plano da vista (`cotas`, `textos`; trocar a escala não tira do lugar) e somem com o Mostrar
  das cotas. `pranchas/ferramentas.ts` (captura, direção, papel ↔ muro). Sem desfazer (o A-PORT tem; não pedido).
- **Armação da sapata — as SOMBRAS (Jose, 15/10: "sombra das armaduras… principalmente pra detalhar a sapata corrida,
  isso tem no Pró-Viga"; feito por agente sob revisão, `desenhos/armacaoDaSapata.ts`):** aba nova "Armação" (palco,
  Desenhos, prancha `{ tipo: 'armacao' }` em 1:25, tabela de gráficos própria): elevação da sapata com os estribos,
  esperas e toco do muro com interrupção; faixa de cada família de estribo ("N4 – 36 Ø10 c/17"); SOMBRA de cada
  longitudinal (uma por marca + estação + face, quantidade somada, "N5 – 11 Ø6,3 C=591"; emendas em fileiras
  vizinhas sobrepostas no traspasse) — as de baixo embaixo e as de CIMA EM CIMA (regra do Pró-Viga: o lado diz a
  face); seção transversal com "11 N5" por camada e a sombra do estribo com as medidas da forma. Camada DXF SOMBRAS
  (vermelho, 0,5). As legendas são texto solto: arrastáveis e reescrevíveis na folha. Fontes no Pró-Viga citadas no
  cabeçalho do arquivo (dxf-writer.js, armadura.jsx, detailing.js).
- **3D e prancha, comandos (Jose, 15/10):** SEM o terno de eixos X/Y/Z no 3D ("não são necessários nesse software";
  o muro se lê pelo cubo de vistas). Na aba Pranchas, rodinha = zoom no ponto do mouse e botão do meio arrastado =
  pan, como no 3D (Ctrl+rodinha fica com o navegador). Aterro do 3D desce pela face do muro até o topo do pacote do
  dreno (a refatoração de 14/10 perdeu esse vértice e deixava um triângulo vazio junto do topo).
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
  canaleta da haste não cobre as juntas de 10 mm; barbacã some sem aviso em muro todo em canaleta. Respondidos e
  FEITOS 15/10: canaleta cortada vira INTEIRA na compra (tabela "Blocos e canaletas": a linha da canaleta soma as
  cortadas e "↳ das quais, para cortar" vem embaixo, fora do total — `blocosParaCompra`); barra igual = mesmo N em
  qualquer elemento; "Salvar como" de muro que já tem arquivo = MURO NOVO (identidade nova, IFC sem GUID em comum;
  o 1º "Salvar como" de um muro nunca salvo é o mesmo muro; copiar pelo Explorer continua levando o id).
  Achados da revisão FEITOS (09/10 noite): fundo da canaleta furado onde passa barra (Geometria.pedacos), T de graute
  no encontro das canaletas, graute da haste contínuo nas juntas, aviso BARBACA_SEM_CELULA; validador do IFC com
  --furos/--barras (tem dente). Graute total sobe ~4–5%. Barbacã em muro todo em canaleta: FURA A CANALETA (Jose,
  15/10) — o tubo passa pelas duas paredes do U, 2 cm abaixo da borda e ≥ 1 cm acima da barra mais alta, longe das
  verticais (`modulacao/entorno.ts` naCanaleta), e a prancha ganha a nota "passar o tubo antes de grautear"; IFC: cada canaleta furada diferente vira um tipo com o mesmo nome — abrir no Revit para conferir.
  Faltam (dreno de fundo e dente já feitos): nó de cachorro (Revit dele); detalhes na prancha final; T de graute no 3D
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
  (Jose, 14/10): ficam independentes, sem aviso — o projetista cuida. Revisão FECHADA; e os do curso (M2d, fpk líquida, Δξ, vão 2h, AsMin) seguem a régua. A perna em L da barra da canaleta do contraforte usava o ℓb da sapata; com a barra em U
  (21/10, anotação 1 abaixo) a perna no contraforte é conferida contra o ℓb no graute.
- **Junção de 14/10:** desenho-peso (dente, desenhos da sapata, graute em grade, peso, traspasse) e sapata-molas (aba
  Sapata sobre molas) juntas no main; o que estava solto no main foi para o stash "main sem commit antes da junção
  14/10" (era subconjunto da desenho-peso, conferido linha a linha; pode ser descartado).
- **Faxina decidida (13/10): dividir o gerador da planilha por aba** (hoje build_new.py + contrafortes.py +
  fundacao.py num namespace só — linhas de 2000+ caracteres, leitura por endereço, colisão de nome). Um arquivo por
  aba, cada um com os nomes de que precisa. Prova: spec_planilha.json e golden idênticos antes/depois. SÓ DEPOIS da
  junção da sessão "sapata sobre molas" (branch sapata-molas), que mexe no gerador.
- **PENDÊNCIAS ANOTADAS (Jose, 14/10, noite: "deixa anotado, depois a gente vem corrigindo"):**
  Modo prancha — DECIDIDO E FEITO em 15/10 (Jose: "pode seguir com as suas recomendações"):
  1. FEITO: chamadas "N1 – 15 Ø10 c/40 C=210" no corte e na vista frontal da prancha (`desenhos/chamadas.ts`,
     `OpcoesDaVista.chamadas`, só na prancha — a tela 2D não mostra), numa coluna à direita do desenho, camada DXF
     CHAMADAS; a quantidade e o c/ são do ELEMENTO desenhado (papel), o N é da barra. Barra igual (Ø, dobra,
     comprimento) = mesmo N em qualquer elemento (`modulacao/barras.ts` numerarPosicoes, sem o papel na chave; a
     lista de ferros escreve "Vertical do muro + Contraforte · construtiva"). LISTA DE FERROS no quadro lateral (N, Ø,
     quant., C unit., C total, forma da barra cotada — `pranchas/formaDaBarra.ts`, medida de vértice a vértice no eixo,
     fora de escala; interruptor "Lista de ferros"). Cota de traspasse POR POSIÇÃO no corte (FEITO 15/10,
     `desenhos/corteLateral.ts`): uma cota por altura de espera; com mais de uma, o rótulo diz o N ("traspasse N4 68";
     posições da mesma altura dividem a cota) — no contraforte da aula 12.3 saem três (N3 54, N4 68, N5 88).
  2. FEITO: muro que não passa (ou sem veredito) sai com a tarja vermelha "NÃO VERIFICADO" na diagonal da área de
     desenho, vazada no PDF, camada AVISO no DXF; não trava.
  3. FEITO: "Massa + 10 % (kg)" no resumo, calculada da massa impressa (como o TQS).
  4. FEITO: carimbo de cinco faixas (180 × 65; o 180 × 50 antigo abre como o novo): Desenho nº = código da obra +
     folha (ARR → ARR-01), Desenhista, Verificação — nos dados da obra (.alrimo).
  5. FEITO: maiúscula de 2,5 mm na cota (NBR 8402 de memória): PX_POR_MM sai da letra (≈ 3,15; era 4,4) e TODA a
     anotação cresce junto, traço e ladrilho de hachura inclusive (como o fator de escala de cota do CAD). Textos da
     folha (LETRA) pela maiúscula; número das fiadas na prancha com a letra mínima, de 2 em 2 em 1:75/1:100. Ele
     compara a impressão com o TQS.
  Revisão adversarial de 15/10 (3 revisores) — corrigido: chamada por ELEMENTO (muro/contraforte/sapata, não papel:
  sem chamada repetida, espera do contraforte separada da do painel); c/ junta as barras a menos de 2φ (a emenda
  deslocada dava "c/1" na longitudinal da sapata em muro > 12 m); coluna das chamadas à direita de tudo o que já está
  desenhado (`Prancha.direita()`; em 1:75/1:100 entrava na cota); hachura AR-CONC/AR-SAND/GRAVEL do DXF acompanha o
  PX_POR_MM; tarja acima do carimbo quando ele toma a largura (A4 em pé perdia o "NÃO"); desenho sobre desenho acende
  a borda vermelha (vistas montadas antes de 15/10 engordaram); lista de ferros inteira ou nada (cortada parecia
  completa) e o resumo do aço tem a vez; cabeçalho da lista e rótulo do carimbo encolhem em quadro/carimbo estreito;
  barbacã nunca acima do aterro (pela canaleta e pela 1ª fiada); IFC: "Papel" do N compartilhado lista todos; "Salvar
  como" decide pelo DESTINO (por cima do próprio arquivo = mesmo muro; Ctrl+S depois do F5 para outro nome = muro
  novo). Ficou: bloco do carimbo segue "CARIMBO" (o de 4 faixas de 14/10 e o de 5 têm o mesmo nome — juntar DXF das
  duas versões num desenho fica com a 1ª definição); carimbo no mínimo (45 mm) põe o rótulo abaixo de 2,5 mm.
  Outras, anotadas pelo Jose:
  6. Entrada por figuras: PADRONIZAR as imagens com as dos memoriais (a figura da entrada e a da memória têm de ser
     a mesma linguagem).
  7. Vistas de elevação frontal e corte lateral: ele ainda tem ajustes a fazer (vai mandar). Visto no DXF aberto no
     CADCraft (14/10): no corte, a linha da cota da sapata passa por cima do texto "B = 140" (junto da cota 25 do
     dente) — acertar junto com os ajustes dele.
  8. FEITO 15/10 — tabelas de MATERIAIS na prancha (Jose: "a tabela de materiais com as imagens e quantidades dos
     blocos hoje não tá indo pra prancha"). Três: "Blocos e canaletas" (a figura de cada peça e a quantidade de
     compra; a cortada somada na canaleta e a linha "das quais, para cortar" recuada com o gancho DESENHADO — o "↳"
     não existe na fonte do CAD), "Materiais" (graute, argamassa e sapata numa tabela, uma faixa para cada, com os
     totais) e "Drenagem". Os números SÃO os do quantitativo (`tabelasDoQuantitativo`; `Tabela.recuadas` +
     `MARCA_DAS_QUAIS`). Como entra: seletor "Prancha" no Quantitativo (canal `envio.ts`, como o 3D e as vistas) e
     "Adicionar › Tabela" na aba Pranchas. Tamanho FIXO em mm (letra 2,5 mm de maiúscula, sem alça nem escala;
     `ItemDesenhado` 'papel'), título EM CIMA como as tabelas do quadro lateral, editável no painel; a tabela não
     conta como "sem escala" no carimbo. Código: `pranchas/tabelaDaFolha.ts` (dados + desenho) e
     `pranchas/figurasDasPecas.ts` (grade e textos na camada TABELAS). FIGURA DA PEÇA EM DESENHO, NUNCA IMAGEM
     (Jose, 15/10: "eu queria 0 imagem vinculada no DXF"): o arquivo do public/pecas (o mesmo do quantitativo) é
     lido e convertido em primitivas (`vetorDaPeca`) — faces e faixas do furo em preenchimento sólido (PECAS-FUNDO,
     cor verdadeira) e contorno 0,13 "por camada" (PECAS); a mesma conversão desenha a tela, o PDF e o DXF. O que o
     DXF 2004 não tem, feito na conta: o recorte das faixas pela boca do furo (convexa; Sutherland–Hodgman), o
     degradê de profundidade virando escurecimento médio (o furo 19 %, a parede da canaleta 19 % × 0,45), o traço
     da cor do preenchimento (tapa fresta) fora; o cinza tracejado da canaleta cortada com cor própria. Plotado em
     preto e branco com o -FUNDO congelado, cada peça vira desenho de linha limpo. A figura é buscada uma vez por
     arquivo e guardada (o desenhista renasce a cada muro e não pisca). Gerador das figuras mudou de jeito (outro
     elemento que não polígono/linha, recorte não convexo) → o teste `tabelas.test.ts` acusa. Exemplos para abrir no
     CAD: `_trabalho/tabela_vetor_15-10/` (DXF do muro de contraforte e do balanço, e as conferências em cores e em
     preto e branco). Conferido: o .zip do DXF sai só com os .dxf e passa no `validar_dxf.py --estrito`. Imagem que
     ainda vai no DXF, por decisão: a foto do 3D Realista e a logomarca do carimbo. Para o Jose olhar: a posição de
     partida em cascata faz tabela cair sobre tabela (borda vermelha até arrastar); o "Prancha" do Quantitativo é
     um seletor, não um botão por tabela.
  Margens 20/10 mm e carimbo 180 mm da NBR 16752 vieram de apostila/ISO 7200: conferir no texto da norma (ele tem
  acesso pelo CREA).
- **FILA DO JOSE (14/10, tarde — só anotado; ele confere o IFC da canaleta antes):**
  1. FEITO 14/10 (texto visível da planilha, do app, da memória, das figuras e do termo; comentários de código
     ficam). Listas renomeadas: fpk_ref 'Líquida'/'Bruta'; AsMin_crit 'Viga (b·d)'/'Parede (b·t)' (fórmulas
     LEFT(AsMin_crit,4)="Viga"); arquivo antigo traduz ao abrir (projeto.ts OPCAO_RENOMEADA); o sorteio r2 guarda a
     semente com os rótulos velhos (cenarios.py). Planilha entregue: planilha/Arrimo Alvenaria.xlsx. Exemplo do app:
     'Exemplo — muro em balanço'. Fonte nova onde era o curso: norma/livro ou 'Critério adotado'. Tirar 100% das referências ao Gilberto e ao Carini (e às aulas dele: "Aula 12.2", "Aula 12.3", "Curso · planilha
     06"…) do software e da planilha — produto comercial. A conta NÃO muda (a régua continua sendo a do curso); só sai
     o nome. Cada citação precisa de substituta: a norma/livro de onde a regra vem (NBR 16868-1, NBR 6118, NBR 6122,
     ABCP/Parsekian, Bastos…) ou "critério adotado" quando é convenção do curso (δadm 2h/250, K = 1,0, As,mín 0,15 %…).
     Inclui rótulos, notas, aba Referências, memória (Ref 'Aula 12.x', 'Curso', 'Gilberto'), figuras, termo de uso.
     Confirmar com ele na hora: "Gilberto Carini" no ditado = os dois (Eng. Gilberto da fundação e Prof. Carini).
  2. FEITO 14/10 — memória com fundo = superfície do tema (branco no claro); desenhos da memória e figuras do acervo
     na `.prancheta` (no escuro, invert + hue-rotate, a receita do Pró-Viga); desenhos 2D no escuro trocam só papel e
     tinta por CSS (as cores do Revit ficam). 3. FEITO 14/10 — coluna da direita com desenho + figura empilhados:
     85%/80%, desenho no alto e figura no pé (CardMemoria.tsx, ENCOLHE_*). Era: Memória no tema CLARO com fundo BRANCO (hoje azul-claro). Todos os SVG padronizados: fundo preto no tema escuro e
     as cores acompanhando o tema (figuras do acervo e desenhos gerados).
  3. Inércia fissurada (estádio II) do ELS: a conta é longa e as figuras da direita colidem com a fórmula grande —
     reduzir um pouco as figuras e TRAVAR a de cima na 1ª linha da seção e a de baixo na última linha.
  (4. não ditado.)
  6. FEITO 14/10 — drenagem no 3D (barbacãs de volta, dreno de fundo, areia e brita).
  5. FEITO 14/10 — modo prancha (PDF e DXF).
  ESTADO DO ITEM 3: FEITO 21/10 e JUNTADO ao main em 22/10 (PR #4, branch `inercia-em-pedacos`, refeita do main; o
  Jose testou no notebook antes; a `formula-els-painel` velha fica
  só de referência). As figuras já eram de 14/10 (95bb020). A fórmula longa do estádio II saiu em pedaços nas três
  seções I/T — balanço (aba ELS), contraforte (seção 7) e painel (seção 12, as duas direções) —, PLANILHA PRIMEIRO:
  B e C da equação do 2º grau b·x²/2 + B·x − C = 0 em linha própria (`lnB_*`, `lnC_*`; com a LN na alma `lnBw_*` =
  (bm − bw)·hf + B e `lnCw_*` = (bm − bw)·hf²/2 + C), x = (−B + √(B² + 2·b·C))/b; III = alvenaria comprimida
  (`IIc_*` = b·x³/3) + abas da mesa (`IIf_*`, zero com a LN na mesa) + barras (`IIs_els`, `IIs_cf`, `IIs1_*`,
  `IIs2_ev`), e a linha do III só soma. Painel vertical: as duas hipóteses da 2ª barra em pedaços (1 = tracionada,
  n: `lnB1_ev`, `xr1_ev`/`xt1_ev`…; 2 = comprimida, n − 1: `lnB2_ev`…); horizontal: hipótese única (`x1_eh` e
  `n2_eh` SAÍRAM — não há 2ª barra). Valores iguais: os 544 nomes de antes batem a 1e-9 no Excel (aula 12.2, aula
  12.3, sorteio06), `testar.py` TUDO OK, golden refeito (65 cenários). Memória: um termo por linha (B, C, x, I_alv,
  I_abas, I_s, I_II = soma); seção cheia (bw = bm) mostra a forma da mesa (na alma dá o mesmo número, abas de
  largura zero); faixa sem barra (x "—") não mostra B e C.
- **REGRA DO CADERNO (Jose, 21/10):** todo pendente que muda de estado (feito, pela metade, adiado) se anota AQUI na
  hora, conferido no código, e o caderno sobe no GitHub (main) junto — a sessão seguinte (outra máquina, nuvem) só
  sabe o que estiver aqui.
- **Anotado do Jose (12/10, noite — fazer depois, ele avisa quando):**
  1. FEITO 21/10 e JUNTADO ao main em 22/10 (PR #5, branch `barra-em-u`; o Jose testou no notebook antes e decidiu a
     ancoragem da perna). Barra horizontal do painel (a da canaleta) no
     contraforte: era traspasse + L; virou barra dobrada em U de um contraforte ao outro, vários U em sequência, cada
     barra engastada duas vezes ("é mais fácil dobrar a barra em U do que fazer um traspasse e depois um L"). Como ficou
     (`modulacao/armaduras.ts` barrasEmU; `barras.ts` dobrada, no lugar do emL): em cada fiada de canaleta (as da conta
     e a cinta) e em cada vão, um U — base na canaleta do muro (no y da conta: centralizada ou encostada a c_p), pernas
     nas canaletas dos dois contrafortes ATÉ A PONTA deles (cobrimento 3 cm), dobra no pino da NBR; no contraforte do
     meio as pernas dos dois vãos ficam encostadas, φ/2 de cada lado do eixo, e no da ponta a perna fica no mesmo
     lugar (φ/2 para dentro do vão): todo U do trecho é a MESMA barra (uma posição na lista de ferros, rótulo
     "Horizontal na canaleta (U)"). Sem emenda (vão ≤ 4 m: o U fica bem abaixo dos 12 m). Ø = o da canaleta da fiada.
     A corrida reta com traspasse ficou só no balanço. ANCORAGEM DA PERNA (decisão do Jose, 22/10: "dobra conta como
     gancho (α 0,7)"): a perna reta (da dobra à ponta) é conferida contra ℓb,nec = α·ℓb ≥ ℓb,mín = máx(0,3·ℓb; 10φ;
     100 mm), α = 0,7 — NBR 6118 9.4.2.5, a dobra de 90° no pino da Tab. 9.1 como gancho; ℓb = o reto no graute
     (`lbphi_gr`·φ, aba Fundação seção 10), As,calc/As,ef = 1 (`armaduras.ts` ancoragemDaPernaDoU, ALFA_GANCHO).
     Mais curta → aviso CANALETA_U_PERNA com a conta escrita ("ℓb,nec = α·ℓb = 0,7 × 54,6 = 38,2 cm… NBR 6118
     9.4.2.5"; não muda a quantidade). Com o exemplo (19·59, Ø12,5, perna 42,8) e o 14·54 da aula 12.3 passa; o 14·34
     (perna ~20 cm) avisa. Antes (21/10) era contra o ℓb reto e avisava em quase todo muro.
     Desenhos: corte do contraforte mostra as duas pernas (folga φ/2 no plano do corte), planta com uma sombra só por
     posição (perna, base, perna cotadas), 3D/IFC/quantitativo pela polilinha. Conferido: nenhuma barra atravessa
     bloco/canaleta (barrasEmPecaSolida, com o T de graute), o U em todos os cenários do gabarito × variações.
  2. Estribos desenhados quadrados: desenhar com as dobras reais da barra (raio de dobra, ganchos).
  3. ~~Estribo só quando a conta pede~~ FEITO 13/10 (planilha 05 do Carini: "Dispensa Estribos" se fvd ≥ τvd = o
     nosso Vd ≤ Va): com Asw_c = 0 a planilha zera Asw,ef e n_est (Vrd3 = Va), o resumo diz "sem estribos", o app
     não desenha estribo (3D/IFC/quantitativo) e apaga Ø/ramos/s nas Entradas (única regra de campo apagado que lê
     a CONTA: `ATIVA_SE` com `LerConta`). Conta sem número ("—") continua desenhando. 14 de 39 cenários dispensam.
- **REORGANIZAÇÃO NO MOLDE DO PRÓ-VIGA E DO A-PORT (Jose, 20/10 — antes de empacotar e publicar; em branch
  separada, etapas conferidas por ele antes de entrar no main):** trilho lateral fixo de ícones (azul-marinho, como o
  Pró-Viga), na ordem: 1 Início (abrir, salvar, exportar IFC/memorial, topo idêntico ao do Pró-Viga/A-PORT, COM
  desfazer/refazer — o A-PORT tem, o Al-rimo não) · 2 Configurações · 3 Entradas por figuras (TELA CHEIA, no lugar do
  modal) · 4 Memória de cálculo (a lista de entradas em resumo vira 2ª coluna que abre e recolhe, só nessa seção) ·
  5 Quantitativo (ícone próprio) · 6 Gráfica (navegador à esquerda como o do A-PORT — Vistas: 3D, frontal, corte,
  planta, isométrico, armação e as nomeadas; Pranchas; aba Propriedades —, faixa de ferramentas no topo com abas, onde
  entram Cota, Texto, Etiqueta, Gráficos, Mostrar e "Enviar para a prancha"; abas das vistas abertas e barra de escala
  embaixo). 3D é uma vista como as outras. Embaixo do trilho: tema e manual. Barra de estado fica. Só a moldura muda:
  conta, 3D, vistas, prancha, DXF e IFC não. Etapas: 1 moldura e topo · 2 Entradas e Memória · 3 Gráfica · 4 acabamento.
  A confirmar: engrenagem em 2º (Pró-Viga) ou embaixo (A-PORT). Protótipo clicável das 6 telas (20/10, para ele
  aprovar antes do código): https://claude.ai/artifact/Wjo63e7W4gEk9PZCpzfryd
  ETAPA 1 FEITA e JUNTADA ao main (20/10, o Jose olhou na 5183 e aprovou). Trilho (`ui/Trilho.tsx`), seção
  em `estado/interface.ts` (lembrada; a aba Memória/Quantitativo de antes vira a seção), Início (`ui/TelaInicio.tsx`),
  Configurações e Entradas viraram tela (o modal saiu), lista de entradas só na Memória, Gráfica com as abas de hoje
  e MONTADA escondida (o 3D não perde câmera/corte/Armadura na ida às Entradas), desfazer/refazer no store (passo =
  foto de alteracoes/extras/pranchas/"→"; teclas no mesmo campo < 1,2 s e rajada nas pranchas < 0,4 s viram um passo;
  a janela de Gráficos = um passo, Cancelar não deixa passo; o • compara com o salvo). Cópia separada para obra grande
  na tela: git worktree em `.claude/worktrees/<nome>` com `app/node_modules` como JUNÇÃO para o do main (`mklink /J`)
  e servidor noutra porta — ⚠️ remover a junção (`cmd /c rmdir`) ANTES de apagar a cópia, senão apaga as bibliotecas
  do main. Etapa 2 já saiu quase toda junto; PRÓXIMA: a 3 (o navegador lateral do A-PORT na Gráfica, que o Jose sentiu
  falta ao olhar — vistas e pranchas em árvore + Propriedades, faixa de ferramentas no topo), depois a 4 (acabamento).
  ETAPA 3 FEITA e JUNTADA ao main (21/10 na nuvem, PR #3; o Jose mandou juntar em 22/10 depois de instalar no notebook em C:\Claude\Al-rimo Notebook): `ui/grafica/`
  (SecaoGrafica, Navegador, Encaixes, comandos) e `estado/grafica.ts`. FAIXA no topo da Gráfica com 4 abas (Anotação:
  Anotar; Vista: Vistas — Nova/Duplicar/Renomear/Excluir — e Visibilidade — Mostrar/Gráficos/Enquadrar; Prancha:
  Folhas — Nova/Renomear/Excluir — Adicionar e Enviar; Exportar: SVG/PNG da vista, PDF/DXF das pranchas). NAVEGADOR à
  esquerda (recolhe na faixa fina): pastas 3D, Elevações, Cortes, Plantas, Isométricos, Armação, Pranchas, com a
  escala e a folha ao lado do nome; clique abre/traz para a frente, F2 ou duplo clique renomeia no lugar (folha =
  conteúdo). PROPRIEDADES = o painel do que está na frente (vista: nome, posição/fiada/lado, escala, título, na folha,
  Sobrepor…; folha: o painel de antes da aba Pranchas). ABAS ABERTAS com × (botão do meio também fecha; fechar tudo
  deixa o palco vazio). RODAPÉ: escala + enquadrar (vista) ou zoom (folha) e a dica da ferramenta. Como: quem desenha
  (Desenhos.tsx, TelaDasPranchas.tsx) põe os grupos dele nos ENCAIXES por portal (`GrupoDaFaixa`, `NoEncaixe`); sem a
  Gráfica em volta (o desenho sozinho, os testes) tudo fica na barra dele, como antes. Conta, desenhos, prancha, DXF
  e IFC não mudaram. Ficou para a etapa 4 / conferir com o Jose: o 3D não põe nada na faixa (os botões dele seguem
  na barra do visor); clicar numa vista 3D guardada ("3D (2)") abre o visor mas NÃO volta a câmera dela; as abas
  abertas não vão para o arquivo (como no Revit).
- **SOMBRAS NO CORTE E NA PLANTA (Jose, 20/10 — FEITO no mesmo dia):** regra comum em `desenhos/sombras.ts`
  (fileiras do Pró-Viga, medida de cada perna = a da lista de ferros via `formaDaBarra.trechosNoModelo`, número que
  procura lugar livre). CORTE (`corteLateral.ts` desenharSombrasDoCorte): espera (Padrão e nó), vertical do muro e as
  do contraforte, uma por posição + elemento, à ESQUERDA do aterro (à direita as linhas das chamadas cruzavam), na
  altura de verdade; reta = legenda em pé ao lado; com dobra = medidas nas pernas e legenda embaixo. O nó de cada furo
  do contraforte (C diferente por furo, um N cada) vai JUNTO numa sombra: "N5 a N8 – 20 Ø10 C=441 a 447" e a perna
  deitada "100 a 106" — só quando muda a perna DEITADA (a em pé é o traspasse, cada um com a sua cota). PLANTA
  (`planta.ts` desenharSombrasDaPlanta): HORIZ da canaleta da fiada, embaixo da cota, emenda em fileiras seguidas, a
  dobrada em L uma sombra só por posição com a soma. Camada 'sombras' (DXF SOMBRAS). Prova: `__testes__/sombras.test.ts`
  (varre os 65 muros do gabarito × 2 arranques × 1:25/50/100). A conferir com ele: a faixa de sombras do contraforte
  com nó fica ~2,5 cortes de largura (cada nó tem a largura da sapata); a prancha que já tinha um corte vê o muro
  andar para a direita (a sombra entra na caixa do desenho, à esquerda). Decidido (Jose, 20/10, "sim"): a barra de
  pé com sombra NÃO leva chamada no corte (a sombra já diz tudo); com as sombras desligadas a chamada volta.
- **MURO DE VEDAÇÃO EM CIMA DO ARRIMO, COM VENTO (Jose, 13/11 — PRIORIDADE: dois clientes dele agora "não podem
  ser só arrimo"):** TUDO integrado no Al-rimo ("é mais fácil integrar todos esses cálculos num lugar só do que fazer
  separado e detalhar separado"): muro de cima (cerâmico ou outro), cintas, pilaretes, vento, e o arrimo se adapta
  (contraforte, pilar se precisar). Decisões dele: o PESO do muro de cima entra "pro bem e pro mal" (compressão na
  parede do arrimo e fundação), não só como P_topo da fundação (hoje `P_topo` só entra na Fundação); limites 3,0/4,0
  só para o ARRIMO; vento pela rotina do A-PORT (`Pórtico Estrutural/src/modelo/vento/pressao.ts`, NBR 6123:2023,
  pura: S1, S2 = b·Fr·(z/10)^p, S3 com redutor de vedação 0,92, q = 0,613·Vk²) SÓ PERPENDICULAR ao muro — o A-PORT
  NÃO tem coeficiente de força de muro solto (só Ca de prédio): acrescentar o de "muros e placas" da NBR 6123 (ler
  na norma). Painel do muro de cima = verificação de PAINÉIS (a do painel não armado: NBR 16868-1 Anexo E, caso 13
  com cinta no topo, 18 topo livre), painel a painel entre cintas (topo / meia altura / os dois / nenhuma — "tem
  gente que faz cinta a meia altura"), vale o pior. Pilaretes: verificar também; o All Sec dele
  (`C:\CLAUDE\Projetos\All Sec`, análise de seção NBR 6118: flexão oblíqua, pilar, reforço) pode entrar no Al-rimo
  para seção qualquer. Planilha dele de referência (≈ jan/2026):
  `C:\JB Projetos\02_BIBLIOTECA_E_TEMPLATES\02.3_Planilhas_de_Calculo\Dimensionamento Parede de Vedação.xlsx` —
  conferida 13/11: βf idêntico ao nosso; Mr = W·K·ftk/1,5 com K 1,5 CANCELA o γm (NBR: ftk/2,0 → resistência 2× a
  dela); vento sem coeficiente de força (C = 1); 0,88 fixo = S3 de vedações de 1988; cisalhamento calculado e não
  comparado. Muro típico brasileiro (dele): 2,0 m, pilarete a cada 2,2–2,6 m, cerâmico 11,5, argamassa fraca, V0 35,
  S2 0,88, γm 2,0, C = 1: com cinta no topo Mr/Md 116/108/102 %; topo livre 60/52/45 %; só meia altura ≈ o mesmo
  que só topo; topo + meia ≈ 2×. Em aberto: combinação empuxo × vento (ψ0), coeficiente do muro solto.
  Pilarete: ESCOLHA concreto moldado OU bloco grauteado (Jose, 13/11). Casos de conferência = os dois clientes dele
  (ele manda laudos de sondagem e alturas): casa R — terreno natural, compactado depois com compactador manual;
  casa J — aterro de ARGILA compactada, não é o terreno natural. Muro de contrafortes: o pilarete COINCIDE com o
  contraforte — um por contraforte OU um a cada 2 contrafortes (escolha).
  PLANILHA FEITA 13/11 (branch `muro-de-cima`): entradas na seção "Muro de cima e vento" das Entradas (mc_on,
  h_mc, t_mc, mat_mc, g_mc — peso da alvenaria de vedação DIGITADO, NBR 6120 Tab. 2 —, reb_mc, arg_mc, cin_mc,
  pil_tipo, s_pil, pil_ncf, b_pil, hs_pil, fck_pil, fbk_pil, phi_pil, n_pil, c_pil, vento_on, V0_v, S1_v, cat_v,
  cls_v, S3_v, Cf_dir); aba nova `tools/muro_de_cima.py`. Vento: S2 = b·Fr·(z/10)^p (tabela do A-PORT), z do
  terreno da FRENTE ao topo do muro de cima, q no topo; Cf = 1,2 (NBR 6123:1988 8.1, Tab. 16, muro sobre o
  terreno, vento a 90°: 1,1 com l/h = 1 a 1,2 com l/h ≥ 10 — o 1,2 vale para qualquer comprimento; a norma diz
  que fora do fluxo 2D o OBLÍQUO é pior, 1,5 com a força na ponta — o Jose decidiu só perpendicular; a 2023 não
  foi lida). O arrimo SOMA: P_mc (peso por metro: parede + reboco + diferença do pilarete e das cintas de 20 cm)
  no Nd/M2d, no σsg e na carga do topo da Fundação; Mk_w/Vk_w (por metro, muro de cima + arrimo acima do solo)
  no Md/Vsd do balanço, no Hk/M de tombamento e no MSd da biela; Mk_wcf/Vk_wcf no contraforte (o que tem
  pilarete leva a largura do pilarete inteira). ELS sem vento (ψ2 = 0). ELU: vento CHEIO junto com o empuxo
  (sem ψ0) — confirmar com o Jose. Painéis A (de baixo) e B (de cima, só com cinta a meia altura), caso 13/18,
  l = eixo dos pilaretes. Pilarete: balanço engastado no topo do arrimo, vento da largura inteira; concreto NBR
  6118 flexão simples, bloco grauteado como o contraforte aparente (fpk*, K_cf); emenda no graute do arrimo
  ℓ0t = α0t·ℓb. Cinta do topo do arrimo (contrafortes): parte do vento que desce pela base do painel (½ com
  cinta no topo, ¼ a meia altura, tudo sem cinta) + ½ do arrimo exposto, biapoiada entre contrafortes, somada ao
  As da faixa do empuxo, ≤ uma barra Ø horizontal. Conferido: muro típico (2,0 m, 2,4 m, cerâmico 11,5, S3 0,88,
  C = 1) dá flexão do painel a 92 % (Mr/Md 109 %), como a conta à mão. TIJOLO BAIANO (Jose, 13/11: "bota pro
  calculista considerar a resistência que ele acredita que é coerente"): ftk ⊥, ftk ∥ e fvk do muro de cima são
  entradas opcionais (ftkn_mc_dir, ftkp_mc_dir, fvk_mc_dir); em branco, NBR 16868-1 Tab. 3/4 pela argamassa (padrão
  1,5 a 3,4 → 0,10/0,20, o mesmo da planilha antiga dele). O 1,5 MPa que ele lembrou é a compressão do bloco de
  vedação de furo horizontal (NBR 15270-1, de memória), não a tração na flexão.
  Revisão adversarial 13/11 (2 revisores) — corrigido: o motor do app NÃO tem NOT (usar <> e ISNUMBER()=FALSE);
  o resumo res_mc só aceita "OK…" ou "— (motivo)" (o "—" puro do IFERROR é conta que não fechou e reprova); vento
  ligado sem V0/S1/S3 reprova (chk_dv); dados do muro de cima faltando reprovam (chk_dmc); K do pilarete de bloco
  com K_cf em branco = 2,0; cinta do topo com o Mdxb (borda livre) e um As só para empuxo + vento, na faixa s_ph
  (a mesma seção da canaleta na aba Contrafortes); As do pilarete que não resiste vira texto (o MAX daria o
  mínimo); Nd_ e σsg com o termo novo somado por fora (bit a bit igual sem muro de cima); exportar_motor conta
  muro_de_cima.py na versão; trava no gerador para f-string sem o f ('{k}' literal fazia o Excel recusar abrir).
  res_mc entra nas verificações do balanço e do contraforte. Golden: 5 alvos novos (alvo_mc_*, alvo_vento_sem_mc;
  os sorteios não ligam o muro de cima para não trocar os muros que os testes conhecem pelo nome); motor × Excel
  bate em tudo. PARA O JOSE DECIDIR: ψ0 do vento com o empuxo (hoje cheio); S3 padrão 0,95 (grupo 3) ou 1,00
  (residência); vento oblíquo (1,5 na ponta) fica de fora; ligação do pilarete com o arrimo em BALANÇO (o momento
  do pilarete chega concentrado e o arrimo é verificado pela média por metro; barras do pilarete de 25 cm não caem
  nos furos do bloco); verificar as cintas do próprio muro de cima (hoje não). FALTA: app — 31 testes vermelhos
  (abas.ts, rotulos.ts, figuras.json, termos novos na memória: solo.ts Nd_/Md_, balanco.ts Vsd_, painelEls.ts
  sig_sg, contraforte.ts Mk_cf/Vk_cf/Ma_cf, estabilidade.ts carga no topo/H_k/M_tb, sapata.ts Mw_s), card novo do
  muro de cima e do vento (o veredito do app só lê cards), VALOR_AUTO Cf_dir→Cf_v, ATIVA_SE, Novo; depois
  3D/IFC/quantitativo/desenhos do muro de cima, pilaretes e cintas.
  APP (TELA E MEMÓRIA) FEITO 13/11 no mesmo ramo: aba "Muro de cima e vento" nas Entradas (`estado/abas.ts`,
  id 'murocima', entre Drenagem e Critérios), rótulos, campos que apagam sem muro de cima/vento (concreto só no
  pilarete moldado, fbk só no de bloco), "auto" com número no Cf e nos ftk; figuras FEITAS 15/11 (Fig. 28 a 31, ver
  "FIGURAS E DESENHOS DO MURO DE CIMA"). Memória: termos novos nos cards do arrimo só quando ligados
  (Nd/Md/Vsd/σsg/Mk_cf/Vk_cf/Ma_cf sem vento/carga no topo/Hk/M tomb/MSd da biela) e autor novo
  `memoria/cards/muroDeCima.ts` com 4 cards (vento, muro de cima — peso e painéis A/B —, pilarete, cinta do topo
  do arrimo); card que não se aplica não monta passo; fonte 'NBR 6123' nova no tipo Ref. Planilha publica ftdp_mc,
  ftdn_mc e Asb_cin (limites como célula). Suíte inteira verde (4834), memória conferida contra o Excel nos 5 alvos.
  Visto na tela (5180): exemplo + muro de cima + vento → painel do muro de cima a 128 % (Cf 1,2, S3 0,95, l 2,4,
  cinta no topo) — o muro típico NÃO passa com o coeficiente da norma e S3 0,95 (passava com C 1 e S3 0,88).
  O exemplo já saía "Não passa · 2" antes (As,mín 2,10 > Ø10 c/40 1,96 e deslizamento 1,04) — não é do muro de
  cima. Acréscimo do vento sobre o Mk do empuxo (muro de cima 2 m, Cf 1,2, S3 0,95, Ka 0,4, γ 19, q 2): arrimo
  1,0 m +150 %, 1,6 +52 %, 2,0 +32 %, 2,6 +18 %, 3,0 +13 %. VIRADA DE 90°: ainda NÃO mexida (13/11).
  S3 EM DOIS (Jose, 13/11: "o S3 do muro é esse mesmo… vedação é vedação, estrutura é estrutura"): `S3_v` = 0,88
  (vedação, grupo 4 de 1988) só nos PAINÉIS do muro de cima (q_vv, p_wv, fd_mc); `S3_e` = 1,00 (estrutura) no
  pilarete, no arrimo, no contraforte e na cinta do topo (q_v, p_w). Os dois são entrada.
  3D, VISTAS, IFC E QUANTITATIVO DO MURO DE CIMA FEITOS 13/11 (mesmo ramo): perfis dos tijolos lidos do IFC do
  Jose por `tools/tijolos_do_revit.py` → `app/src/modulacao/tijolos.gerado.json` (arcos com 6 segmentos por quarto,
  como o furo do bloco); `modulacao/muroDeCima.ts` monta: fiadas de 20 cm (a mais perto de h_mc, aviso se
  arredonda), tijolo do Revit mais perto do t_mc (aviso se não é exato), centrado no eixo do arrimo, amarração em
  meia peça, junta de 1 cm, cortado no fim do painel; pilaretes (balanço: pontas + ≤ s_pil; contrafortes: em cima
  do contraforte a cada pil_ncf, pontas sempre), seção b × h centrada, da base ao topo; cinta de concreto de 20 cm
  na fiada do topo e/ou na de meia altura (topo dela na fiada mais perto de h/2), entre os pilaretes. Barras:
  pilarete n_pil por face descendo l0t_pil no arrimo, até 3 cm do topo; estribo (só concreto) Ø do modelo a
  mín(20; b; 12φ) — DEDUÇÃO (NBR 6118 18.4.3); cinta 2 barras corridas a 3 cm das faces (entrada do modelo
  phi_cin_mc). Entradas do modelo novas: phi_cin_mc, phi_est_pil, s_est_pil. Tipos novos: TIJOLO, TIJOLO_CORTADO,
  PILARETE, CINTA_MC (grupo 'murocima'); papéis PIL_LONG, PIL_ESTRIBO, CINTA_MC; classe 'tijolo' com
  COR_DO_TIJOLO #c0673d (não é do Revit do Jose — muda na janela de Gráficos); dims.muroDeCima. IFC: tijolo =
  parte da parede "Muro de cima T1", pilarete = IfcColumn, cinta = IfcBeam, material "Tijolo cerâmico"; aridade
  conferida no ifcopenshell (IFC4). Desenhos: tijolo é alvenaria (pintado pela classe), pilarete e cinta com a
  hachura de concreto; frontal e corte enquadram até o topo do muro de cima; cota "muro de cima" na frontal.
  Quantitativo: tabela "Muro de cima" (tijolo para comprar com os cortados, área, argamassa estimada pela junta,
  concreto e fôrma de pilarete e cinta). Visto na tela (5180): 3D, frontal, corte e quantitativo certos para o
  exemplo + muro de cima. Suíte inteira verde (4827). FALTA: ~~figuras das entradas, planta e armação do
  pilarete na prancha, cintas do muro de cima não verificadas~~ (FEITOS 15/11), a quina (virada de 90°).
  Revisão adversarial do 3D (13/11, 1 revisor) — corrigido: lasca de tijolo no fim do painel (sobra < 5 cm junta
  com a peça de antes em duas metades iguais, CORTE_MINIMO); barra do pilarete só desce no arrimo se cai dentro
  da parede dele, senão nasce no topo + aviso PILARETE_LIGACAO; espaçamento 0 do pilarete/estribo não derruba
  mais o modelo (padrão + aviso); estribo a mín(20; MENOR dimensão; 12φ); cinta a meia altura com nº ímpar de
  fiadas avisa; IFC: a parede "Muro de cima" com Pset próprio (vedação, LoadBearing falso, espessura do tijolo,
  altura do topo do arrimo), pilarete de bloco com material bloco, nome "Pilarete T1 P01"; quantitativo: pilarete
  de bloco sem concreto nem fôrma; desenho do pilarete de bloco com a hachura do graute; Mostrar › Blocos liga o
  muro de cima. Ficou (anotado pelo revisor): ~~frontal não desenha barra do pilarete/cinta; chamada classifica como
  "muro"; isométrico ~5× mais pesado com os furos dos tijolos; barra da cinta termina reta a 3 cm da ponta~~ (todos
  FEITOS em 15/11: a ponta da cinta pela conta; o resto em "FIGURAS E DESENHOS DO MURO DE CIMA").
  PILARETE × ARRIMO (Jose, 13/11 — FEITO no mesmo dia, ver "REGRA DO PILARETE" abaixo): "esses pilares precisam engastar e ter armadura contínua com o
  muro, adentrando no graute, ou seja a posição deles é limitada de acordo com os blocos; eles devem sempre ter no
  mínimo 20 de frente pra isso funcionar". Ou seja: pilarete na grade dos furos do arrimo (x das barras em furo
  grauteado), largura ao longo do muro ≥ 20 cm (lista), barras do pilarete descendo e emendando no graute do arrimo
  (contínuas com a vertical do arrimo). Previsão dele: arrimo ≥ 1 m com 2 m ou mais de alvenaria em cima "só vai
  resistir com contrafortes".
  TESTE DO PILARETE NO BALANÇO (Jose, 13/11: "sem contraforte não tem pra onde correr… faz uns testes com 14"):
  a LIGAÇÃO dentro do arrimo foi conferida como seção b × t de bloco grauteado com as barras do pilarete (o ramo
  "Bloco grauteado" da aba, fbk 8, K 2,0, d = t − 4; DEDUÇÃO — a parede em volta, que espalha o momento, não conta).
  Vento V0 35, cat. III, S3 1,00, Cf 1,2, cinta no topo, 2 Ø10 por face. Muro de cima 2,0 m, pilarete a cada 2,4:
  bloco 14 → 20 de frente NÃO resiste, 40 resiste mas x/d 0,49 (> 0,45), 60 passa (78 %); bloco 19 → 20 passa (55 %;
  a cada 2,6 x/d 0,47), 40 passa. Muro de cima 2,5 m: bloco 14 não passa nem com 60; bloco 19 só com 40 (81–89 %).
  O pilarete de CONCRETO em si (14 × 20) passa folgado (61–74 %): quem manda é a ligação na alvenaria. Arrimo pela
  média por metro (Ø12,5 c/40): 1,0 e 1,6 m passam em 14 e 19; 2,0 m não passa nem sem o muro de cima (x/d e
  flecha). DECIDIDO (Jose, 13/11): "muro de 14 sem contraforte a gente já barra na entrada empilhar muro de
  vedação com pilaretes, o resto vamos implementar o transpasse".
  REGRA DO PILARETE (FEITA 13/11): planilha — b_pil e hs_pil OPCIONAIS (em branco: balanço 20 × t, contrafortes
  t × 25; adotados b_pila/hs_pila); aviso_mc (Entradas, ao lado do mc_on) e chk_ligg ("Ligação: montagem": balanço
  em bloco 14 NÃO, frente < 20 NÃO, pilarete mais grosso que o muro ou além da ponta do contraforte NÃO — vale com
  ou sem vento); seção 5b "Ligação do pilarete no arrimo" (b_lig, h_lig, d_lig, fpk_lig = fpk* do bloco do arrimo,
  Kfd_lig com K_cf, x_lig, xd_lig, As_lig, fvd_lig, tvd_lig → res_lig, que entra no res_mc). COBRIMENTO (Jose,
  13/11: "no pilar a gente raramente põe 4 cm, põe 2,5, 3 no máximo"): c_pil virou o cobrimento NOMINAL (padrão
  2,5, até o estribo; bloco: até a barra); ce_pil = c + 0,5 (estribo Ø5 na conta, só concreto) + Ø/2, e
  ≥ hf_bl + Ø/2 (a barra desce dentro do bloco do arrimo; no balanço, + (t − h)/2). Na haste do contraforte as barras
  de uma face chegam para o miolo grauteado (≤ t/2 − hf − Ø/2 do eixo): com 2,5 cm o 19 passava 5 mm da parede. App: "Sim" do mc_on travado no balanço de 14 (ATIVA_SE;
  se já estava ligado, fica aberto para desligar); memória com a montagem (verif em hs_pila, célula chk_ligg), os
  dados (P_mc, célula chk_dmc), o ce_pil e a seção "Ligação no arrimo" no card do pilarete. 3D
  (`modulacao/muroDeCima.ts` posicoesDosPilaretes/barrasDosPilaretes): barras do pilarete montadas ANTES do graute
  e do furo das canaletas (o furo delas sai grauteado; o fundo da canaleta do topo, furado); no balanço o pilarete
  vai para a coluna de furos mais perto da posição distribuída onde TODAS as barras descem ℓ0t dentro dos furos
  fiada a fiada (folga ≥ 0); se não cabem, as barras da face chegam para o meio de 5 em 5 mm (bloco 19: o furo
  comum às fiadas par e ímpar tem 13 cm, e 20 de frente com o cobrimento pede 12 entre eixos) — a conta não usa essa
  distância. Varredura bloco 19, H 1,0–2,4, s 2,0/2,4, b 20/30: todos encaixam, sem aviso. Com b 30 o pilarete da
  ponta entra até ~25 cm (o muro de cima começa nele).
  PILARETE × CONTRAFORTE NO BLOCO 14 (Jose, 13/11, mesmo teste; ligação = seção 14 × tenr grauteada, d = tenr − 4):
  a LIGAÇÃO funciona — x/d 0,03 a 0,30, As mínimo manda. Única falha: contraforte 34, vão 2,55, pilarete a cada 2
  contrafortes → CISALHAMENTO da ligação (Vd 9,9 > 8,7 kN, sem estribo). Pilarete de concreto 14 × 25 passa até
  muro de 2,0 m a cada 2 contrafortes de 2,55 (73 %); 2,5 m a cada 2 não. Quem manda é o CONTRAFORTE inteiro:
  34 não passa nem sem muro de cima (H 2,6, já sabido); 54 em H 2,6: vão 1,75 passa (pilarete em 1 ou a cada 2),
  vão 2,55 só sem muro de cima (com: x/d 0,90 em todo contraforte; a cada 2 não resiste); 54 em H 3,0: vão 1,75
  com pilarete em todo contraforte (x/d 0,38), a cada 2 x/d 0,78; vão 2,55 não passa nem sem muro de cima.
  COMBINAÇÃO VENTO × EMPUXO (Jose perguntou): o empuxo do solo é PERMANENTE (não reduz); ψ0 só entre as variáveis
  (sobrecarga q e vento): duas combinações (vento principal + ψ0·q; q principal + ψ0·vento, ψ0 vento 0,6 — NBR 8681
  de memória). Hoje os dois cheios (a favor). Decisão dele.
  TRASPASSE DO PILARETE NO CONTRAFORTE FEITO 13/11 (Jose: "ainda falta o transpasse da armadura pros pilaretes"):
  com contrafortes o pilarete fica com a face rente à face aparente do muro (enterrado; no aparente, rente à face do
  solo) e avança sobre a haste, que é toda grauteada: as barras descem ℓ0t (l0t_pil) dentro dela quando caem na
  largura do contraforte. No BALANÇO ainda não descem (aviso PILARETE_LIGACAO) — esperando a regra dos furos.
  FORÇAS NO CONTRAFORTE (Jose, 13/11: "um SVG com o braço de alavanca pra confirmar a posição da LN"): desenho
  `desenhoDasForcasNoContraforte` (memoria/desenhoDaSecaoI.ts) na seção da LN do card de flexão do contraforte —
  de perfil, mesa em cima, blocos comprimidos (mesa e alma no T além da mesa), LN em x, barra em d, z ou os dois braços
  (d − hf/2 e d − 0,4x). Seção do contraforte: cotas do d e do c à direita da mesa.
  BARRA HORIZONTAL EM 2 (Jose, 13/11: "habilita essa opção de duas barras também encostadas em cada face da
  canaleta"; FEITO no ramo `horizontal-duas-faces`, a partir do muro-de-cima): pos_ph ganhou "2 barras (uma em cada
  face)". Planilha: nb_ph; d_ph = t − c; M_ph = máx(Mdx; Mdxe) (cada face leva o maior sinal, como a
  centralizada); ELS horizontal com a 2ª barra (As2 = a_ph a d' = c) — as DUAS hipóteses da LN agora valem também
  na horizontal (nomes lnB1_eh, x1_eh… voltaram; a memória usa '1'/'2' nas duas direções). Modelo: dois U por vão,
  um em cada face (y = c e t − c), as pernas do segundo uma bitola mais para dentro do vão (id "…U01b"). Desenho
  da escolha com as duas barras. Alvos novos no golden: alvo_ph_duas_faces (laterais engastadas) e
  alvo_ph_duas_faces_apoiadas. A opção não entrou no sorteio (trocaria os muros que os testes conhecem).
  TIJOLO NO 3D REALISTA (Jose, 13/11, foto de tijolo baiano: "meio foscos, opacos, porosos e com algumas
  imperfeições"): pele nova 'ceramica' (visor/geracaoDasPeles.ts: mancha de queima, ondulação, grão, poros miúdos,
  lascas de 3–9 mm e pintinhas claras), rugosidade 1 (fosco de todo), variação de tom 16 % de peça para peça, cor
  #b4623a (estiloVisual TIJOLO_REALISTA); entra pela classe 'tijolo' (materialDoAcabamento recebe a classe).
  BLOCOS CERÂMICOS 3D (9, 11,5, 14 e 19): o Jose modela no Revit e exporta em IFC (13/11: "deixa isso comigo").
  CINTAS DO MURO DE CIMA VERIFICADAS (Jose, 15/11: "provavelmente ela sofre flexão no plano e fora do plano… vai dar
  armadura mínima, eu acho. Mas vamos verificar."; FEITO no mesmo dia, ramo `muro-de-cima`): aba Muro de cima e
  vento, seção 9 (no FIM; nenhum nome de antes mudou nos 81 cenários, 83.349 nomes; o res_mc ganhou o res_cmc).
  Entradas novas (seção do muro de cima, logo depois de cin_mc): `phi_cin_mc` (ERA do modelo; lista L5:L8 = 6,3 a
  12,5; arquivo antigo migra de extras para alteracoes, projeto.ts MUDOU_PARA_A_PLANILHA) e `n_cin_mc` (opcional,
  2/4, lista BC5:BC7; em branco = 2, ou 4 quando 2 não passam → `n_cin_a`). `fck_pil` virou "Pilarete e cintas:
  concreto" (a cinta é concreto mesmo com pilarete de bloco; no app acende com cinta). Por cinta k = T (topo) / M
  (meia altura): `on_ck`, carga lateral `wl_ck` = p_w (S3 da ESTRUTURA, como a cinta do topo do arrimo) × `ht_ck`
  (topo: metade do painel de baixo; meia: metade do de baixo + metade do de cima, ou o de cima INTEIRO com topo
  livre), gravidade `wg_ck` = (γc·t + reboco)·0,20 + g_mct·`hm_ck` (alvenaria até a próxima cinta ou o topo),
  `Mdl_ck`/`Mdg_ck` = γf·w·l²/8, `Vdl_ck`/`Vdg_ck` = γf·w·l/2 (l = `l_mc`); flexão NBR 6118 (bloco 0,8x, 0,85fcd)
  `xl_ck`/`xg_ck`, `Aslc_ck`/`Asgc_ck`, necessária `Asln_ck`/`Asgn_ck` = máx(As; `Asm_cmc` = 0,15 %·20·t — o mesmo
  número nas duas direções), `xdl_ck`/`xdg_ck` ≤ 0,45; MRd com as barras adotadas (`mrd_ret`, tags `cml` lateral b =
  20 e `cmg` gravidade b = t) → `MRdl_cmc`, `MRdg_cmc`; interação `ap_ck` = `apl_ck` + `apg_ck` ≤ 1; cortante sem
  estribo `VR1l_cmc`/`VR1g_cmc` (19.4.1, como a sapata); ancoragem no pilarete da ponta `ra_ck` = mín(1; 1,5·Vd/fyd/As
  lateral + gravidade), `lbr_ck` (reta, α 1) ≤ `ldr_cmc` = b_pila − 3 → "Reta"; senão `lbg_ck` (α 0,7) ≤ `ldg_cmc` =
  b_pila − `cg_cmc` − 3φ (perna por dentro do estribo; com 4 barras só se 12φ ≤ h − 6 cm) → "Gancho"; senão "Não
  cabe" → NÃO OK (`anc_ck`). Lugar da barra: eixo a 3 cm da face, ou por dentro da barra do pilarete quando cairia
  nela (`pp1_cmc`, `pp2_cmc`, `sc_cmc` → `ce_cmc`; achado: contrafortes em bloco 14 cortava, 3,0 → 3,07 cm) —
  d lateral `dl_cmc` = t − ce; d de gravidade `dg_cmc` = 10 (2 barras no meio) ou 17 (4). Resumo `res_ck` →
  `res_cmc` → `res_mc`. DEDUÇÕES: biapoiada entre pilaretes; tributária de metade de painel (topo livre: o painel de
  cima inteiro); alvenaria apoiada sem arco e sem a parede de baixo; interação linear; VRd1 de laje; aℓ = 1,5d no
  apoio; concreto = o do pilarete. Números do típico (2,0 m, pilarete 2,4, V0 35, Cf 1,2, S3 1,0, Ø8): t 11,5 só no
  topo → Mdl 0,70 / Mdg 0,75 kN·m, As calc 0,19/0,18 < As,mín 0,35, 2Ø8, MRd 1,78/3,82, interação 0,59, reta;
  t 14 → 0,52; as duas (11,5) → topo 0,21; MEIA altura Mdg 2,56 (0,8 m de alvenaria em cima) não passa com 2 barras
  (d 10) e o automático vai a 4Ø8 (0,58). O "dá armadura mínima" vale para a do topo; a de meia altura pede 4 barras.
  App: entradas na aba Muro de cima e vento (grupo Cintas; apagam sem cinta), card `murocima.cintas`
  (`memoria/cards/muroDeCima.ts`, desenho `memoria/desenhoDaCinta.ts`, MRd em `momentoResistente.ts`
  secoesMRdCintaMc). Modelo (`modulacao/muroDeCima.ts`): n_cin_a barras a ce_cmc, 2 no meio / 4 a 3 cm de cima e
  de baixo; gancho 90° para baixo no pilarete da ponta quando a conta diz; emenda com o ℓb do concreto da cinta
  (`lb_cmc`); o estribo do pilarete que cairia na altura de uma barra da cinta anda o mínimo em z; com gancho, o
  canto dos ganchos do estribo do pilarete da esquerda vai para a face de dentro. `dims.muroDeCima.cintas` (z e
  qual). Prova: `modulacao/cintasDoMuroDeCima.test.ts` (dentro do concreto, sem cortar barra/estribo do pilarete,
  camadas, gancho), `esforcos/cintasEVista.test.ts`. Golden: alvo_cmc_topo_t14, _meia, _duas, _duas_t14 (Ø10),
  _vao_longo (6 m: reprova, auto 4), _sem_vento (4 digitado), _gancho (vão 4,4, Ø6,3, 2 forçadas). A CONFERIR com o
  Jose: aℓ = 1,5d; a tributária do topo livre; concreto único; hook quase nunca resolve (o ℓb,mín de 10 cm manda —
  pilarete estreito vira "Não cabe"). Achado de 15/11, CONSERTADO no mesmo dia: pilarete mais largo que o contraforte
  (b_pil > t) na ponta do trecho saía para fora do muro — ver "FIGURAS E DESENHOS DO MURO DE CIMA".
  VISTA ESFORÇOS, 2ª volta (15/11): cada cinta do muro de cima vira duas barras por vão (lateral deitada, gravidade
  em pé), uso = a interação; o fantasma desenha a sapata pela seção (com o dente, não a caixa cheia); a vista se
  refaz e reenquadra (mesma direção) quando o muro muda de forma (`chaveDoEnquadramento`; o pedido de quadro agora sai
  de DENTRO do Canvas — com a Gráfica escondida o de fora caía antes da cena nova); números que se encobririam se
  apagam pela prioridade (escolhida, mouse, maior uso, MSd antes do MRd — `arrumarRotulos`, também na foto da
  prancha). "Mostrar" por grupo (Jose, 15/11: "dá pra isolar por esforço?"): Parede, Contrafortes, Painéis, Canaletas
  e cinta, Sapata, Dente, Muro de cima — só os que o muro tem, "só" em cada linha, Todos/Nenhum; lembrado com as
  outras escolhas da vista e levado para a prancha (`ocultos` no item); a câmera não pula. `BarraAnalitica.grupo`.
  FIGURAS E DESENHOS DO MURO DE CIMA (15/11; Jose: "vamos resolver também as figuras do muro de cima"; "planta e
  armação do pilarete na prancha — isso é importante"):
  · FIGURAS 28 a 31 (régua comum, só no app, `figs/app/f28…f31`): 28 Muro de cima (corte com reboco e cintas,
    elevação com pilaretes a s_pil, painéis A/B e as setas de tração normal/paralela e do cisalhamento, planta dos
    contrafortes com n_pil·l), 29 Vento no muro (pressão na parte exposta, z_v do terreno da frente ao topo, S1 no
    terreno, S2 nas casas ao longe, S3,v no muro de cima e S3 no arrimo, Cf, V0), 30 Pilarete (planta do de concreto
    com estribo, barras, b/h/c; o de bloco grauteado; elevação da ligação com ℓ0t no graute), 31 Cinta (seção com 2 e
    4 barras, peso e vento só por seta). As 34 entradas da aba mapeadas (`dados/figuras.json`; phi_est_pil e s_est_pil
    com figura no contrato); legenda nova 'tijolo' na applib (o claro, para não confundir com o bloco do arrimo).
  · VISTA "Armação do pilarete" (`desenhos/armacaoDoPilarete.ts`, tipo 'pilarete', 1:20 de partida, pasta Armação do
    navegador; só com muro de cima): por TIPO de pilarete (os iguais juntos: barras no mesmo lugar e a mesma ponta de
    cinta — "P2, P3 — 2 un."; P1, P2… da esquerda para a direita) a elevação do pé do traspasse ao topo (arrimo fino,
    tijolo e cinta dos lados, barras da cinta com o gancho), a faixa dos estribos em pé, as cotas (traspasse, altura,
    b), a seção na meia altura de uma fiada de tijolo (estribo de verdade, barras, b, h, c com o meio cm), a sombra do
    estribo e a da longitudinal; embaixo, as sombras das barras da cinta com o miolo encurtado (pontas de verdade). O
    "Mostrar" tem Blocos (o contexto) e Cotas.
  · PLANTA: a lista da fiada segue nas fiadas do muro de cima ("1ª muro de cima"; `fiadasDaPlanta`, `rotuloDaFiada`);
    nelas a cadeia de cima é a dos PILARETES, a cota t é a do tijolo e a cinta tem sombra. FRONTAL: barras do
    pilarete (longitudinal e estribo) e da cinta, com chamada. Chamadas: elementos novos 'pilarete' e 'cinta'
    (`elementoDaBarra`; a quantidade e o c/ são os do elemento). CORTE: opção "Pilarete" nos cortes de saída quando
    nenhum passa num; a longitudinal do pilarete ganha sombra; com muro de cima, t/d/contraforte sobem para cima dele.
  · ISOMÉTRICO: o tijolo vira a caixa dele (só no isométrico). Medido, muro de 20 m: balanço 30 → 63 ms com muro de
    cima (era 140; as peças quase dobram), contrafortes 67 → 91 ms.
  · PILARETE MAIS LARGO QUE O CONTRAFORTE: `chk_ligg` reprova ("pilarete mais largo que o contraforte: na ponta do
    muro ele passa do fim do muro"); o modelo encosta o da ponta no fim do trecho e as barras que saem da haste caem
    no PILARETE_LIGACAO. Golden alvo_mc_cf_pilarete_largo.
  · Prova: `desenhos/__testes__/armacaoDoPilarete.test.ts` (muros do gabarito com muro de cima + 6 construídos × 1:10,
    1:20, 1:50; DXF pelo ezdxf --estrito), `figuras/mapa.test.ts`. Muros sem muro de cima: SVG das vistas idêntico
    byte a byte ao de antes (conferido em todos os muros do gabarito sem muro de cima, tela e prancha). A CONFERIR com o Jose: o cobrimento da
    seção mede da face ao estribo; a seção só em escala da vista (1:20; quem quer maior põe a vista em 1:10).
- **VIRADA DE 90° (Jose, 13/11: "é o que mais é feito; não adianta calcular o muro só num sentido"):** muro em L com
  a quina. A quina dá rigidez (a perna de retorno apoia a outra, como um contraforte), mas traz empuxo nos dois
  sentidos — "uma verificação a mais". OS DOIS CASOS (um cliente tem o L para dentro, o outro para fora): aterro
  DENTRO do L (as pernas abrem, a quina trabalha à tração — armadura horizontal virando a quina e ancorada) e aterro
  FORA do L (as pernas se empurram, quina comprimida). A FAZER, junto com o muro de cima.
- **RAMOS DO ESTRIBO DO CONTRAFORTE: 2 OU 4 (Jose, 15/11 — FEITO 15/11, no main):** "estribos geralmente têm dois
  ramos, um indo e um voltando… coloca 2 ou 4, 3 ramos não existe; 4 são 2 estribos menores, no Pró-Viga tem um
  modelo quando a viga tem uma base grande". Antes: entrada livre, a conta usava o digitado e o modelo desenhava
  SEMPRE 2. Agora:
  · PLANILHA: `ramos_est` é lista 2 / 4 (Referências BD, `lst_ram`; padrão 2). Contrafortes, fim da seção 6: os
    RAMOS QUE A CONTA USA (`ram_ef`) — 4 só se os dois estribos cabem, senão 2 (o Asw,ef, o Ø necessário e o resumo
    usam `ram_ef`: nunca se conta aço que não se monta). Regra do estribo duplo do Pró-Viga (viewer3d.js): cada um
    com 2/3 da largura do de 2 ramos (eenr − 7, `w4_est`), deslocados ±1/6 (ramos a cada 1/3), ganchos no canto de
    fora. Duas condições (DEDUÇÃO, as medidas do desenho): (1) o gancho de 135° do estribo menor (`pg4_est` =
    (w4 − φ − (1 + √2/2)·r)/(√2/2), r = 2φ do pino 3φ) chega a 5φ ≥ 5 cm (`pgn_est`, NBR 6118 9.4.6.1); (2) as n_cf
    barras cabem no furo comum sem passar sobre os ramos do meio (`nb4_cab`, tabela `mont_n4E`/`mont_n4A` em
    Referências AT21:BA30, calculada pelo app — `secaoDoContraforte.ts` barrasQueCabem com `faixaDosQuatroRamos` =
    (t − 70)/6 − φt/2 mm — e conferida pelo teste, como a das barras que cabem). Verificação nova
    `chk_ram_cf` "Estribo: 4 ramos cabem no contraforte" (NÃO OK — 4 ramos não cabem na largura do contraforte
    (gancho de 2,6 < 5,0 cm | 8 barras e só 6 cabem entre os ramos do meio)), no card de cisalhamento. Números:
    BLOCO 14 NUNCA (largura 7 cm → estribo menor 4,67 cm → gancho 2,7 cm com Ø6,3 e 3,5 com Ø5 < 5 cm); BLOCO 19
    cabe (estribo menor 8,0 cm → gancho 7,4/8,2 cm) com até 15Ø6,3 / 8Ø8 / 6Ø10 / 2Ø12,5 / 2Ø16 / 1Ø20 (enterrado
    e aparente iguais).
  · Antes × depois (89 cenários, 104.842 nomes): mudaram só os 4 sorteios com 4 ramos que não cabem (sorteio11,
    26, 27 no bloco 14 pelo gancho; sorteio14 no 19 com 13Ø10 — Asw,ef 3,93 → 1,96, o 26 passa a reprovar no
    estribo) e os dois "tudo em branco" (o ramos_est virou lista e saiu dos campos livres: abre com 2). O sorteio
    não mudou (já tirava 2 ou 4). Alvos novos `alvo_estribo4_cabe` e `alvo_estribo4_barras_demais`.
  · MODELO (`modulacao/armaduras.ts` estribosDaJunta): com 4, os dois estribos na MESMA junta (no Pró-Viga o 2º
    anda 2φ ao longo da viga; aqui o eixo da peça é a altura e a junta tem 10 mm), encaixados no plano: o 1º é o de
    2 ramos estreitado, o 2º anda uma bitola ao longo do contraforte para a ponta (pernas curtas lado a lado no
    terço do meio, nunca uma sobre a outra; para dentro, a perna da ponta passaria sobre as esperas); os dois são a
    MESMA posição (espelho; `formaDaBarra` lê o estribo também de cabeça para baixo). Barras principais e
    construtivas (e esperas) arrumadas DENTRO da faixa do meio e longe do par em planta, ganchos inclusive
    (`livreDoPar`); as construtivas andam uma bitola (encostam no estribo que anda). Onde um ramo cruza a perna do
    outro (2 pontos por junta) as barras passam uma sobre a outra, como já passam no canto dos ganchos — A CONFERIR
    com o Jose. O aviso ESTRIBO_RAMOS saiu. Arquivo antigo com 3, 6… abre com 2 e o recado diz ("ramos do estribo
    3 → 2", `projeto.ts` ajusteDeLista). Esforços: os estribos da mesma junta somam os ramos (`estribosAoLongo`); o
    teste do cortante ficou estrito (colocado = Asw,ef em todo muro, 2 e 4). Entradas: escolha com desenho (planta
    do contraforte com um ou dois estribos). A Fig. 12 não mudou (o estribo é um retângulo tracejado).
  · Instalador refeito com isto (15/11, 18:30): `instalador/dist/Al-rimo-Setup-0.1.0.exe`, 103,1 MB — NÃO
    instalado; o Jose instala por cima. Não visto na tela (a conferência é dos testes).
  · Prova: `modulacao/estriboQuatroRamos.test.ts` (regra × desenho, par do Pró-Viga, mesma posição, nenhum ramo
    sobre barra/espera/U nos muros do gabarito e em 20 variações), `secaoDoContraforte.test.ts` (tabela mont_n4),
    `esforcos/acoColocado.test.ts`, `barrasAnaliticas.test.ts`, `estado/projeto.test.ts`.
  · ACHADO (não é do 4 ramos, ficou): no bloco 14, o gancho do estribo de 2 ramos de hoje passa a ~3 mm do eixo da
    construtiva do canto (Ø10; alvo_arredcima15_estribos) — a ponta de 135° atravessa a barra no desenho. A
    conferir com o Jose (mover a construtiva para o canto do estribo, como na viga, ou o gancho para o outro canto). DECIDIDO (Jose, 15/11): "não precisa mexer nessa barra, tá de boa" — fica como está.
- **CONTRAFORTE DOBRADO NO APP (16/11, ramo `contraforte-dobrado`; a planilha é o c903f0f; o Jose ainda NÃO viu na
  tela):** "desenha um muro e coloca a distância de contrafortes igual à de juntas". MODELO: `modular.ts`
  trechosComDobrados — cada vão é um PANO (L0 … L1, os gabaritos de ponta) a 1 cm do seguinte; o L1 de um pano e o
  L0 do seguinte são as metades 'a'/'b' do MESMO contraforte (`No.metade`, ids "CF2a"/"CF2b"; peças e barras com o
  mesmo `contraforte`); o trecho continua sendo o da junta de controle (sapata, dreno, terreno contínuos). Vão: o
  eixo a eixo da planilha (2t + 2 cm + k·m) vira o do simples com o mesmo k (`l_pano`); comprimento e vão de
  fechamento pela mesma escolherVaos, com cada pano = vão + t + 1 cm. Fiadas: `montarFiadasDoTrecho` monta pano a
  pano e junta. Barras: por BLOCO n = n_cf/2 quando o calculado é o dobrado (os simples do muro ficam com a
  metade), senão n_cf; ESTRIBO do dobrado (`estribosDoContraforte`): um só no eixo do par, largura 2t + 1 − 7 cm, em
  toda fiada, sempre (mesmo com Asw_c = 0 no calculado de extremidade), ramos = ram_ef quando o calculado é ele (4 =
  os dois de 2/3 cruzando a junta, já funciona — testado forçando), 2 quando é o outro; as barras do dobrado ficam
  longe dos ramos (livreDoPar sem a faixa). U da canaleta e cinta: um U por vão, cada um ancorado na sua metade (como
  na junta). Graute da canaleta do muro corre pela junta de 1 cm entre as metades. `dims.contrafortes[].dobrado`,
  `larguraDoContraforte` (modelo/tipos.ts); vãos sem o "vão" de 1 cm (`vaosDoTrecho`: dreno, barbacã, solo da
  frente); pilarete no eixo do par. "→" no n_cf_dir ímpar (ajuste 'n_cf'). TELA: `larg_cf` em Muro › Contrafortes
  com desenho (um bloco × dois com o estribo), figura = Fig. 12; ramos_est e s_est TRAVADOS em 2 e 20 com o
  dobrado calculado; Ø do estribo aceso com Dobrado. MEMÓRIA: eenr = 2t + 1, n par (2·⌈…/2⌉), As,máx de dois furos,
  n 8% ×2, estribo adotado = ram_ef e s_est_u com NBR 16868-1 3.3 e 12.6 (sem verificação nova), Asw nunca
  dispensado, MRd do outro tipo com As_cfo/bw_cfo, biela da sapata com eenr; seção desenhada com os dois blocos, a
  junta, as barras metade em cada e o estribo. Desenhos: corte padrão do contraforte no eixo do bloco da direita;
  quantitativo (impermeabilização da haste) e IFC (Pset Dobrado) pelo par. Prova: `modulacao/dobrado.test.ts`
  (metade = gabarito de ponta: o mesmo muro com junta em cada vão dá as mesmas peças/barras), modulacao.test
  (sólidos, graute, haste), estriboQuatroRamos, desenhoDaSecaoCf, esforços (colocado = As_cfo/Asw_eo do outro tipo),
  conferência da memória. Muro simples: modelo, desenhos, memória, quantitativo, IFC e esforços IDÊNTICOS (hash, 91
  cenários). ACHADOS DE ANTES (simples, não mexidos): a barra do pilarete que desce no contraforte cruza o ramo do
  estribo do lado do muro (alvo_mc_cf_duas/_meia/_pilarete_largo); com muitas barras no bloco 14 aparente a fila do
  furo do muro encosta no ramo do lado do muro, e no 19×79 aparente a ponta do gancho do estribo cai numa barra da
  fila — no dobrado as barras se afastam dos ramos. A CONFERIR com o Jose: construtivas n_cc em CADA bloco (a
  planilha conta n_cc no contraforte); o graute da canaleta do muro atravessando a junta do par.
  · REVISÃO DE 16/11 (2 revisores adversariais; commit 652b40f). DECISÃO DO JOSE (16/11): "DOIS ESTRIBOS POR FIADA"
    — no dobrado, quando um estribo c/20 não basta, dois estribos sobrepostos (4 ramos, o estribo duplo: 2/3 da largura
    do par, ±1/6, os dois cruzando a junta). Planilha: `pd4_est` (4 pedido ou Asw de 2 ramos c/20 < Asw_c), `ram_ef` =
    4 se cabe (gancho de 135° do menor ≥ 5φ ≥ 5 cm e n/2 ≤ `nb4d_cab` — tabela por BLOCO `mont_n4dE/A`, Referências
    AT31:BA40, calculada pelo app `barrasQueCabemNoDobrado` com estribo Ø6,3), senão NÃO OK com o motivo (`mot4_est`).
    Todo dobrado de bloco 19 com fgk 20 passa a levar 4 ramos (6,23 cm²/m). O OUTRO TIPO entra no veredito (seção 19
    da aba Contrafortes, no fim): `chk_fl_cfo`, `chk_Asm_cfo`, `chk_bie_cfo`, `chk_est_cfo`, `chk_v_cfo`,
    `chk_ram_cfo`, `res_cfo`; o estribo dele `Asw_co`, `ram_o`, `s_o`, `Asw_eo` (o simples da ponta de um muro dobrado
    tem o estribo DELE); com Simples dizem "— (mesma seção do calculado)". Efeito visível: muitos muros dobrados
    reprovam agora pela PONTA (simples, l/2 + balanço, metade das barras) — ex. 19×79 aparente Md 121 > MRd 115;
    `n_cf` ≥ 4 no dobrado (2 por bloco); `bf_a`/`bf_ao` vizinhos do dobrado pelo vão livre real; nota do `bal_cf`
    (entra também como o outro tipo); `n_cc` "em cada bloco" no dobrado (só detalhamento). PILARETE SOBRE O PAR:
    largura do par (`b_pili` = 2t + 1; o digitado vale na ponta, ≤ t), barras metade no furo de cada bloco;
    `chk_ligg` reprova nº ímpar por face e o dobrado em BLOCO 14 (a barra do lado do muro cai na parede do bloco de
    junção — o modelo não a desce e avisa PILARETE_LIGACAO). App: ganchos do estribo do dobrado APARENTE no canto da
    ponta (comprimido) — as barras ficam no furo da conta nas duas metades (`dobradoNoFuroDaConta.test.ts`, aviso
    BARRAS_FORA_DO_FURO); card "Contraforte da ponta / intermediário (dobrado)" (`contraforte.outroTipo`); seção da
    memória pelo arranjo do 3D (`arranjoNoDobrado`; exceção anotada: 14 barras por bloco no aparente ficam a ~1 cm);
    `ramos_est` aceso no dobrado com "→ 4"; JUNTAS DE CONTROLE com vão de fechamento: vãos repartidos pelo
    comprimento e a seta ponto fixo (`arranjarComJuntas`, `juntasEFechamento.test.ts`; muda o muro simples com junta
    e fechamento, de propósito). PENDÊNCIAS ANTIGAS (não mexidas): barra do pilarete atravessando bloco de junção /
    canaleta no contraforte SIMPLES de bloco 14 com muro de cima; estribo simples encostando na construtiva do bloco 14
    (aceito pelo Jose).
- **SAPATA "CURTA DEMAIS PARA ANCORAR NA FACE" (investigado 15/11, nada mudou):** a razão conhecida do teste
  desenho × conta da vista Esforços (`barrasAnaliticas.test.ts`). Todos os muros do gabarito que caem nela são
  `sap_transv` = Estribo (o sorteio não varia) e a envoltória JÁ trata a quina do estribo como ponta dobrada (ℓb,nec
  com α = 0,7, `lbg_s`; NBR 6118 9.4.2.5): não ignora a dobra. Os casos são geometria de sorteio: balanço de 0,5 a
  3 cm (o muro na beira da sapata) com As pedido ≈ 0 (sorteio26: ponta 3 cm, Md 0,06 kN·m/m, As 0,009 cm²/m ×
  Ase 3,93; sorteio04: ponta 3 cm, As 0,004; sorteio19: ponta 20,5 cm, c 5, Ø10, a perna reta acaba a 13 cm da
  face e ℓb,nec = 13,1 cm — chega a 4,58 de 4,62 cm²/m, com Md da ponta 0), ou o muro fora da sapata. Em todos o
  ℓb,mín (máx(0,3ℓb; 10φ; 10 cm)) manda, porque As,calc/As,ef é quase zero. A planilha NÃO confere a ancoragem da
  transversal da sapata (só a dobra da espera, o dente e a perna do U). Para o Jose: com `Reta` a barra termina no
  cobrimento sem gancho — a NBR 6118 22.6.4.1.1 (de memória, conferir) pede a armadura de flexão da sapata de face a
  face terminando em gancho nas duas pontas; o `Estribo` atende pela forma. DECIDIDO (Jose, 15/11): a Reta FICA ("continua sim"); não reabrir.
- **CONTRAFORTE SUBINDO NO LUGAR DO PILARETE (Jose, 15/11, testando o instalado: "depois a gente ataca"):**
  ele notou que há a opção de o contraforte subir pelo muro de cima no lugar do pilarete, "não sei como o cálculo
  trata isso", e que as figuras e o 3D NÃO diferenciam os dois casos. A LEVANTAR antes de mexer: qual entrada é
  essa (pil_tipo "Bloco grauteado"? pil_ncf?), o que a conta faz de diferente (seção, d, ligação) e o que o modelo
  desenha. Só anotado; não iniciado.
- **PLANO "DO MURO PARA A OBRA" (Jose, 15/11 — sessão de arquitetura; implementação depois, etapa a etapa):**
  roteiro em `PLANO_OBRA.md` (raiz): obra com vários trechos (cada trecho = a conta de hoje + posição em planta),
  traçado em polilinha, degraus da base, quina a 90° (a outra perna como contraforte; flexão oblíqua pelo motor do
  All Sec), dente armado, topografia por DXF, sondagens com camadas, corte e aterro, tela reorganizada na ordem da
  obra. Nove decisões do Jose listadas no plano, AINDA NÃO RESPONDIDAS. Nada implementado. Ler o plano antes de
  qualquer uma dessas frentes; etapa que mudar de estado se anota lá.
- **MRd E ESFORÇOS AO LONGO DA PEÇA NA PLANILHA (15/11, 1ª metade da etapa 1b do PLANO_OBRA, ramo `muro-de-cima`):**
  a planilha publica, só com nomes e linhas novas (no fim das abas; perfil do solo nas colunas O–Z; fatias da sapata
  nas colunas H–L), o MRd de cada peça armada com o aço adotado (`MRd_bal`, `MRd_cf`, `MRd_cfo`, `MRd_pvs`/`pve`,
  `MRd_ph`, `MRd_cin`, `MRd_toe`/`heel`, `MRd_den`, `MRd_pil`, `MRd_lig`) com `ap_*` = MSd/MRd e `xM_*`; o resistente
  dos não armados como momento (`MRp_*`, `MRn_*`); M e V ao longo da altura (`perf_*`, vento `vt_*`, pilarete
  `pt_*`) e da ponta/talão (`T_Mk`, `H_Mk`…); o OUTRO contraforte (`Md_cfo`, `Vd_cfo`, `binf_o`, `bm_cfo`); nome em
  todas as verificações da aba Contrafortes e da Fundação (`chk_*_cf`, `chk_fl_s`, `chk_v_s`, `chk_tor_s`…). Tabela
  completa no PLANO_OBRA ("PUBLICADO (15/11)"). Conta = a de As da própria aba DESFEITA (helper `mrd_ret`), limitada
  pelo x que a verificação da aba confere (0,45d; painéis e sapata, que não conferem ductilidade, até 1,25d). Prova:
  zero diferença nos nomes/células de antes (81 cenários), base bit a bit (Vk_, Mk_, Mk_w, Md_cf, Mk_toe… = último
  nó), ida e volta e "MRd ≥ MSd ⇔ verificações OK" sem exceção. A vista "Esforços" no app: item seguinte.
- **VISTA "ESFORÇOS" (Jose, 15/11: "um diagrama em 2D, só que num esquema 3D com barras analíticas… cada barrinha com
  o seu desenho de momento solicitante e momento resistente" — FEITA 15/11, 2ª metade da etapa 1b, ramo
  `muro-de-cima`; o Jose ainda NÃO viu na tela):** pasta "Esforços" no navegador da Gráfica (aba `esforcos`). O muro
  em arame, uma barra por peça que a conta dimensiona: faixa de 1 m do balanço, cada contraforte (extremidade ×
  intermediário pelo `tipo_cf`), faixa vertical no meio de cada vão, cada fiada de canaleta e a cinta do topo em
  cada vão, ponta e talão (uma faixa por trecho), dente, pilaretes e a ligação deles, painéis não armados (balanço,
  subpainel, A/B do muro de cima). MSd cheio e MRd em linha no plano de flexão, do lado TRACIONADO; vermelho onde
  passa (painel sem arranjo que resista: tudo vermelho). Barra ESQUEMÁTICA (só os picos são da conta: painéis,
  canaletas, cinta, ligação) com contorno TRACEJADO — a tela diz pelo traço, sem texto. Escala "Aproveitamento"
  (todo MRd na mesma altura) ou "Valor" (mesma unidade, mesma escala); Valores e Muro (fantasma) ligam e desligam,
  lembrados. Clique: rótulo + valor (MSd, MRd, Uso) e "Memória", que abre o card da peça (`abrirNoCard`). Prancha:
  ~~IMAGEM refeita do ponto de vista; vetor/DXF PENDENTE~~ — SAIU em 15/11 (ver "2ª VERSÃO" abaixo). Memória: seção "Momento
  resistente com a armadura adotada" (`Fas_` → `xas_` → `Mas_` → `xlim_` → `Mlim_` → `MRd_` → uso) nos cards de flexão
  e ftd·W nos não armados, sem verificação nova (veredito igual). Código `app/src/esforcos/`, prova
  `esforcos/barrasAnaliticas.test.ts`. Nomes que cada barra lê, o que é esquemático e as diferenças barra × `chk_*`
  (não são erro: a aba confere As,mín, espaçamento, ductilidade) no PLANO_OBRA, etapa 1b. A conferir com ele: a forma
  ilustrativa do painel vertical (zero a 1/4, pico a 5/8 da altura); o talão com Md negativo usa o MRd da barra de
  baixo; diagramas a 30 % da altura do muro.
- **VISTA "ESFORÇOS", 2ª VERSÃO — O AÇO, COMO NO PRÓ-VIGA (15/11; o Jose viu a 1ª e disse que não era isso: "quando
  falei sobre esforço solicitante e esforço resistente gostaria de visualizar algo nesse sentido" — o gráfico de As
  do Pró-Viga, `proviga-3d-limpo/app/dimensionamento.jsx` AsChart — "o solicitante de uma cor e o resistente
  englobando ele"):** a 1ª versão (MSd azul cheio, MRd em linha branca constante) SAIU. Em cada barra, deitado no
  plano de flexão, as duas faces dos dois lados do eixo: o As NECESSÁRIO em vermelho por dentro e o As COLOCADO em
  verde envolvendo (verde ao fundo, vermelho por cima), vermelho forte onde falta, "não resiste" cheio, contorno
  tracejado de cada posição N, linha tracejada do As,mín, régua (1/3, 2/3, máx, com a unidade) só na barra escolhida
  ou com o mouse, números do necessário e do colocado na seção crítica (botão Valores). Botões Flexão ↔ Cortante;
  Aproveitamento (o colocado na mesma altura) / Valor (mesma escala por unidade). Clique: MSd, MRd, Uso e As
  necessário/colocado na seção crítica. Legenda só com rótulos.
  · PLANILHA PRIMEIRO (nenhum nome de antes mudou: 89 cenários, 101.193 nomes e 261.215 células iguais; 41 nomes
    novos): a conta de As de cada aba refeita nó a nó, com as MESMAS linhas da seção crítica (`cadeia`, `passos_bal`,
    `passos_cf`, `PASSO_ASW` no build_new.py) — na seção crítica bit a bit (teste). Tabela nome → significado no
    PLANO_OBRA, etapa 1b ("2ª VERSÃO"). Decalagem aℓ: NÃO aplicada (nenhuma aba aplica; as barras destes muros só
    param em traspasse/ancoragem).
  · AÇO COLOCADO = GEOMETRIA (`esforcos/acoColocado.ts`, pura): só os trechos de barra do modelo paralelos ao eixo
    e dentro do recorte (faixa por metro com um nº inteiro de espaçamentos e as bordas entre barras; a seção do
    contraforte; a face); cada barra sobe de 0 à área cheia ao longo de ℓb,nec da ponta reta (`lbn_*`) ou dobrada
    (`lbg_*`, α 0,7); ponta que passa do começo da peça (espera na sapata) chega cheia; traspasse = rampas de ℓ0t e a
    soma do par limitada à maior área. Contraforte: principais + as esperas delas. Estribos do contraforte:
    2·área/distância entre dois seguidos. Peças esquemáticas (painel vertical, canaleta, cinta do topo, cintas do
    muro de cima, ligação): o colocado é o As efetivo da planilha, tracejado. Não armados: Md × ftd·W.
  · ACHADOS MODELO × PLANILHA (na seção crítica; o teste exige que cada diferença caia numa razão conhecida):
    balanço e contraforte iguais em todos; dente: o modelo põe MAIS estribo que a conta em 41 de 45 (desvio das
    barras da sapata, já sabido); pilarete com PILARETE_LIGACAO: sem aço ancorado na base (6); sapata: balanço
    curto demais para ancorar na face (13) e sorteios com o muro fora da sapata (13). Cortante do contraforte: ~~o
    modelo desenha 2 ramos~~ desde 15/11 o modelo desenha os ramos da conta (`ram_ef`, 2 ou 4) e o teste é estrito. Envolve × aba: o
    balanço e o contraforte batem sempre; sobram 5 (ponta curta, dente estreito, pilarete sem barra no arrimo).
    O trecho depois da última barra junto da ponta livre (cobrimento: `Diagrama.fimLivre`) não conta como falta.
  · NÃO VAI PARA A PRANCHA (Jose, 15/11: "os esforços a gente não vai mandar pra prancha, não. Eu nunca vi um projeto
    com um diagrama em prancha. Geralmente a gente guarda nas memórias"): saiu o botão, o item da folha, a foto fora
    da tela (`fotoDosEsforcos.ts`) e o parâmetro da conta no desenhista; projeto de antes com o item: o item sai e
    entra no recado de abertura ("prancha: esforcos"). A pendência "Esforços em vetor no DXF" está CANCELADA.
  · VAI PARA A MEMÓRIA (`memoria/desenhoDosEsforcos.ts`, `comDiagramasDosEsforcos`): o mesmo diagrama, chapado em 2D,
    na seção do MRd de cada card de flexão (e no de cortante quando há: balanço, contraforte, sapata, dente,
    pilarete, cintas) — os MESMOS dados da vista e as MESMAS áreas (`esforcos/areas.ts`, usado pela cena 3D e pela
    memória); régua dos desenhos gerados (fundo branco, tema escuro pela .prancheta), tela, impressão e Word (o
    modelo vai junto: `Memoria`, `MemorialImpresso`, `imprimirMemorial`/`exportarWord`). Sem conta nova, veredito
    igual (teste).
  · "MOSTRAR" com o muro de cima em três (Jose, 15/11): "Muro de cima: painéis", "…: cintas", "…: pilaretes" (a
    ligação vai com os pilaretes); o "muroDeCima" guardado antes vira os três (`lerGrupos`).
  · Prova: `esforcos/acoColocado.test.ts` (barras à mão), `esforcos/barrasAnaliticas.test.ts` (gabarito inteiro),
    `esforcos/cintasEVista.test.ts`, `memoria/desenhoDosEsforcos.test.ts`. A CONFERIR com o Jose: a forma
    ilustrativa do painel; o α 0,7 na dobra do estribo da sapata; o vermelho que sobra no topo do balanço com muro
    de cima (o momento do muro de cima chega no topo e a barra do muro acaba 3 cm abaixo — as do pilarete levam).
- **DENTE ARMADO (Jose, 15/11: "a forma de armar é similar à da sapata corrida, porém na vertical, com estribos
  adentrando a sapata corrida e armadura de montagem / mínima no sentido longitudinal do dente; o esforço seria o de
  deslizamento / tombamento" — FEITO 15/11, etapa 1 do `PLANO_OBRA.md`, ramo `muro-de-cima`; o Jose ainda NÃO viu na
  tela; substitui o "dente sem armadura" de 15/10):**
  · PLANILHA, aba Fundação, **seção 11 no FIM da aba** (depois da memória das fatias: nada de cima muda de endereço,
    nenhuma fórmula de cima lê as de lá — conferido: os 781 nomes de antes iguais nos 72 cenários do golden). Por
    metro. Carga = passivo CHEIO na face da frente, sem ÷ 2, sem olhar `pass_on` nem `x_den`, com o `h_fr` sempre
    (o dente nunca recebe mais que isso): `p1_den` = Kp_b·γ·(h_fr + h), `p2_den` = Kp_b·γ·(h_fr + h + h_den),
    `Ek_den`, `Mk_den` = p1·h²/2 + (p2 − p1)·h²/3, `y_den` = Mk/Ek, `Md_den`/`Vd_den` = 1,4·. Seção 100 × b_den,
    `d_den` = b − c − Ø/2; flexão como a ponta/talão (`xln_den`, `xd_den` ≤ 0,45, `As_den`), `Asm_den` = 0,15 %·b·h,
    `Asn_den`; estribo fechado EM PÉ, um ramo por face: `Ab_den`, `s_den` (digitado ou o MAIOR de 20; 15; 12,5; 10;
    7,5; 5 que atende), `Ase_den` → `chk_fl_den`. Cortante na RAIZ (sem descontar d) contra VRd1 (`k_den`, `rho_den`,
    `VRd1_den`) → `chk_v_den`. Ancoragem das pernas na sapata: `lbd_den` = h − c ≥ `lbn_den` = 0,7·ℓb·As,calc/As,ef
    ≥ `lbm_den` (ℓb = `lbphi_c`·Ø) → `chk_anc_den`. Longitudinais POR FACE `nf_den` = máx(2; As de distribuição
    máx(0,9; 20 %·As,ef) × h_den; uma a cada 33 cm) → `n_lden` (critério de secundária de laje no dente: DEDUÇÃO).
    Resumo `res_den` ("OK — estribo Ø8 c/12,5 + 6 Ø6,3 corridas" / "NÃO OK — …" / "— (sem dente)"). Entradas novas
    no fim da seção Fundação das Entradas: `phi_den` (8), `s_den_dir` (opcional), `phi_lden` (6,3).
  · MOMENTO PASSADO À SAPATA (DEDUÇÃO): o momento do dente anda pela sapata do dente até o muro. Dente do lado da
    PONTA (`lado_den`: eixo à frente do eixo do muro) traciona a sapata EM CIMA (alivia a ponta — alívio ignorado);
    do lado do TALÃO ou sob o muro, EMBAIXO. NÃO foi somado ao Md da sapata (mudaria a armadura de todo muro que já
    tem dente, a aula 12.2 inclusive): verificação própria `chk_tr_den` — `Ms_den` = `Mt_den` (Md + Vd·h, até a face
    oposta) + `Mf_den` (o que a sapata já tem tracionando a mesma face) ≤ `MRd_sap` (Ø principal no espaçamento
    adotado; o estribo da sapata põe o mesmo aço nas duas faces). Com a transversal RETA e o dente na ponta não há
    barra em cima: o modelo avisa (DENTE_SEM_BARRA_EM_CIMA).
  · Números: exemplo do app (sapata 0,45) com dente 25 × 25 no centro → p1 21,07 / p2 32,77 kPa, Mk 0,90, Md 1,26
    kN·m/m, Vd 9,4 kN/m, As 0,14 < mín 3,75 → Ø8 c/12,5 (4,02), VRd1 117,7, ancoragem 41,0 ≥ 10,0 cm, 4 Ø6,3,
    MSd 5,5 ≤ MRd 122,6. Com o dente da aula (25 × 50): Md 5,19, Vd 18,0, mesmo estribo, 6 Ø6,3. O As,mín manda
    em dente comum; a conta só aperta em dente fundo e estreito (alvo `alvo_dente_talao_nao_passa`).
  · Golden: nenhum valor antigo mudou; os sorteios já passam pelo dente dos dois lados (7 na ponta, 26 no talão);
    alvos novos `alvo_dente_ponta_digitado` e `alvo_dente_talao_nao_passa` (fora do sorteio).
  · APP: grupo "Armadura do dente" na aba Fundação (apaga sem dente; espaçamento vazio mostra o adotado); Fig. 18
    desenha o estribo e as longitudinais do dente. Modelo (`modulacao/entorno.ts` estriboDoDente/armarDente): estribo
    de ganchos (a forma do da sapata) do cobrimento do fundo do dente ao cobrimento de CIMA da sapata, a cada
    `s_den`, cada um num plano LIVRE (desvia do estribo da sapata, do de torção e das esperas, com uma bitola de
    folga; torção a cada 2–3 cm não deixa plano: fica no meio do vão); longitudinais por dentro, nas duas faces (a de
    baixo no canto, a de cima na raiz), emenda como a da sapata; a longitudinal da SAPATA que cairia em cima de uma
    perna encosta ao lado (só nesse caso a sapata muda). Papéis `DENTE_ESTRIBO`, `DENTE_LONG` (elemento = sapata).
    Dente estreito para o estribo: sem barra, aviso DENTE_ESTREITO. Corte: sai sozinho, com chamada. Armação: faixa
    do estribo do dente, sombra dele com as medidas, pontos na seção e sombra das longitudinais com "(dente)" (com o
    mesmo Ø e C elas têm o mesmo N das da sapata). Lista de ferros/quantitativo: "Dente · estribo", "Dente ·
    longitudinal". IFC: no grupo da sapata. Memória: card `fundacao.dente` (`memoria/cards/dente.ts`) com os dois
    desenhos (`desenhoDasForcasNoDente`, `desenhoDaSecaoDoDente`); 5 verificações no veredito.
  · Prova: `testar.py` TUDO OK (referência da regressão sem mudança), motor × Excel nos 74 cenários, suíte do app
    5461 verdes, tsc limpo; `modulacao/dente.test.ts`, `memoria/dente.test.ts`; planilha entregue regerada. Ficou:
    a chamada/faixa arredonda o espaçamento para cm inteiro (12,5 sai "c/12"; a conta e a memória dizem 12,5); com
    estribo de torção a menos de 6 cm ou transversal a menos de 8 não sobra plano livre e o do dente encosta.
  · CONFIRMADO pelo Jose (15/11: "confirmo o critério do esforço do dente maior dos 2 e armadura mínima"): a
    força de cálculo = o maior entre o passivo cheio e o que falta no deslizamento (S1 abaixo) e o As,mín de 0,15 %
    na largura do dente (é ele que manda em dente comum: Ø8 c/12,5 num dente de 25). Não reabrir sem fonte.
    Seguem como DEDUÇÃO minha, sem pergunta a ele: cortante na raiz sem descontar d; α = 0,7 na ancoragem; longitudinais pelo critério de laje; a
    verificação da sapata no lugar de somar o momento.
  · REVISÃO ADVERSARIAL de 15/11 (2 revisores + juiz) — CORRIGIDA no mesmo dia:
    PLANILHA. (S1, CRITÉRIO ADOTADO em 15/11 e confirmado pelo Jose no mesmo dia — substitui o "passivo cheio é o máximo"): o
    solo da frente de um dente debaixo da sapata está confinado pela pressão de contato, o Rankine de superfície
    livre não é teto. Força de cálculo `Fd_den` = máx(`Fa_den` = 1,4·Ek; `Fb_den` = (FS_desl·H_k − R_at − R_ad)/Lm
    ≥ 0, já de cálculo, sem outro γf); `gov_den` diz quem manda; Vd = Fd, Md = Fd·y (y = Mk/Ek, o braço do
    trapézio). (b) manda praticamente só em muro que já não passa no deslizamento (FS 0,03–0,95 nos cenários);
    exemplo do app (25 × 50, x 0): Fa 18,02 × Fb 8,70 → manda (a), Md 5,19, Vd 18,0, Ø8 c/12,5, como antes.
    Alvo `alvo_dente_deslizamento_manda` (φ'b 20, δ/φ 0,5, dente 25 × 25): Fa 5,76 × Fb 14,84 → (b). Quatro muros
    do gabarito com dente passaram a reprovar o dente por isso (alvo_cob_T_na_alma, _contraforte_nao_ductil,
    _sapata_tensao_talao, sorteio19 — todos com FS ao deslizamento < 0,6). (S2) `pino_den` (3φ/5φ/8φ, Tab. 9.2, o
    pinoEstribo do modelo) e `bmin_den` = 2c + 2φ + pino; `chk_geo_den` "NÃO OK — dente estreito para o estribo:
    mínimo X cm" entra no `res_den`; as outras quatro dizem NÃO OK com d ≤ 0 ("dente sem altura útil, d ≤ 0"; o
    VRd1 de dois negativos dava positivo). O modelo usa a mesma regra (DENTE_ESTREITO). (S3) altura sem largura COM
    `pass_on` = Sim (o E_p conta o passivo pela altura do dente): `chk_geo_den`/`res_den` = "NÃO OK — digitar a
    largura do dente ou zerar a altura"; sem a garantia, largura 0 continua "sem dente" (o "0 = sem dente" das
    Entradas) — muda o res_den de sorteio05 e 06. (S4) espaçamento digitado < 5 cm reprova a flexão. (S5)
    `sap_transv` (Estribo/Reta) VEIO PARA A PLANILHA (fim da seção Fundação das Entradas, lista na validação,
    padrão Estribo): `chk_tr_den` com dente na ponta, Reta e Mk_heel ≤ 0 (a regra do modelo para barra em cima) =
    "NÃO OK — sem armadura em cima da sapata: usar estribo na sapata". O modelo lê do Resultado; arquivo antigo
    (extras.sap_transv) abre com o valor nas alterações (`MUDOU_PARA_A_PLANILHA` em estado/projeto.ts); testes
    trocam pelo `comEntradas` (motor/resultadoDoGabarito.ts). (S6) eco "Dente: armadura (seção 11)" = res_den no
    FIM da lista da seção 9 (só desce o que ninguém lê por endereço). (M2) `lbd_den` = h − c − Ø principal − Ø
    secundária (o ramo de cima do estribo do dente passa logo abaixo da armadura de cima da sapata). Memória: card
    com a seção "Largura do dente para o estribo" (verificação dente.largura), Fa/Fb/Fd em linhas, Md = Fd·y,
    Vd = Fd, aviso com o motivo das reprovações por regra (sem desigualdade escrita); o desenho do passivo ganhou a
    linha da força de cálculo. Nenhum nome de antes mudou em muro sem dente (golden comparado nome a nome com o
    HEAD), fora o res_den de S3. Alvos novos: _deslizamento_manda, _estreito, _sem_d, _sem_largura,
    _largura_vazia, _s_abaixo_de_5, _ponta_reta.
    MODELO (`modulacao/entorno.ts`). (M1) `planosDoDente`: faixas proibidas para o centro (uma bitola de folga, a
    maior, de toda barra de plano do trecho que atravessa a caixa do estribo — transversal/estribo da sapata,
    torção, espera, nó de cachorro — e 3φ entre dois do dente), pontos sem saída (`comSemSaida`: faixa mais larga
    que s − 3φ) também proibidos, e o estribo posto em sequência no livre mais perto do passo, ≤ s do anterior —
    pode dar mais estribo que L/s. Sem ponto livre: encostado na barra (aviso DENTE_APERTADO, um por muro); onde
    nem encostado cabe, pula o feixe de esperas do contraforte (até 40 cm, o vão passa de s ali) ou, com a sapata
    toda cerrada (torção a 2–3 cm), fica rente à barra mais perto. (M2) ganchos no canto de BAIXO do lado do talão
    (dentro do dente, face comprimida); ramo de cima abaixo da camada de cima da sapata; no dente estreito a ponta
    do 2º gancho para antes da longitudinal do outro canto (DENTE_GANCHO diz quanto ficou). (M3) a longitudinal da
    sapata empurrada pela perna não sai do cobrimento (vai para o outro lado) e a emendada deita para o lado sem
    perna; a emendada do dente deita para cima (a do canto dos ganchos pela diagonal). (M4) `Barra.espacamento` (o
    s da conta) no estribo do dente: chamada e faixa dizem "c/12,5" (`textoDoEspacamento`); nas outras famílias o s
    da conta é cm inteiro e o desenhado ≤ ele, o arredondamento não passa. (M5) corte acha o estribo do dente em
    qualquer lugar (tolerância s + 40 cm). (M6) elemento 'dente' na chamada (o N continua o mesmo da barra igual).
    Prova: `modulacao/dente.test.ts` — gabarito com dente + varredura de 96 muros (balanço/contrafortes 14 e 19,
    torção 2–20 cm, dente 15 × 15 a 40 × 60 nas duas pontas e no centro, Ø 5–12,5, s 5–20, Estribo/Reta,
    Padrão/nó, 14 m e 20 m com junta) com distância segmento a segmento. Fig. 18 redesenhada (ganchos embaixo, do
    lado do talão; ramo de cima abaixo da longitudinal de cima). Ficou: a quantidade de estribos do dente no modelo
    pode passar a da conta (até ~10 % no exemplo).
- **Revisão adversarial de 15/10 (3 revisores, 16 achados) — CORRIGIDA em 16/10** (`pranchas/__testes__/revisao16.test.ts`
  prova cada um): `Prancha.direita()` é a caixa de REFERÊNCIA (anotação arrastada não empurra a coluna das chamadas
  nem a seção da armação); a armação tem PARTES com origem própria (`RegiaoDoDesenho`: 'secao' e 'estribo:N…'; a
  cota/texto criados nelas guardam `regiao` e contam da origem dela — muro mais comprido ou outra escala e a cota
  continua na seção); texto repetido: chave dita pelo desenho onde ele sabe a diferença (`OpcoesTexto.chave` /
  `chave` da cota: as sombras por face e pedaço, as camadas da seção por N e altura) e, nas de chave pela ordem
  ("#n"), o ajuste guarda o lugar (`AnotacaoPosta.ref`, vale a até 30 px — a herdeira da chave fica automática);
  reescrever em BRANCO esconde a automática e apaga a criada (a seleção volta ao desenho); material a 100 % sai do
  SVG, das primitivas (DXF) e da captura, mas o lugar fica na caixa; materiais que faltavam no 2D (retângulo atrás
  da seção do bloco, barbacã/tubo, linha do terreno); legenda do quadro com as cores da VISTA FRONTAL e o desenho
  que pinta com outras cores leva a legenda dele; borda vermelha olha anotação movida e criada; isométrico e 3D não
  publicam anotação editável; recado de abertura conta desenho de folha desconhecido (`lerPranchas(v, perdidos)`).
  Janela de gráficos: Cancelar devolve só o que ELA mexeu (o Mostrar mexido na aba fica), Esc só com o foco nela ou
  em lugar nenhum, outro botão Gráficos só troca a vista (não regrava), "Aplicar às outras vistas" copia só o que a
  janela da vista mostra (`camposDaJanela`), "Restaurar padrão" do 3D leva as bitolas, Configurações tem o restaurar
  geral e fecham ao abrir a janela, janela do 3D mostra também a hachura e o traço do aço (o 3D em vetor da prancha
  usa). 3D: a linha "Alvenaria" multiplica a transparência de todo bloco; a 100 % não pega clique (barra também),
  perde o traço e não faz sombra. Guardado: `alrimo.graficos.v2` (lê a v1 uma vez, nunca a escreve; restaurar
  esquece as duas). Camadas: "aterro" → 'terreno' (cor da terra), C1/JC → 'eixos', legendas da sombra → 'sombras';
  texto solto editável = camadas textos/eixos/sombras/terreno.
  Conferência das correções (4º revisor, 16/10 à tarde) — corrigido também: o arquivo guarda `regiao` (cota e texto
  criados), `ref` e `original` (reabrir/F5 jogava a cota da seção na elevação); `ref` em MM DO MURO (px ÷ S, vale
  em qualquer escala), refeito a cada mexida e guardado em todo ajuste de chave pela ordem; `original` em todo
  ajuste: na chave dita pelo desenho (sem o texto), muro mudou o texto ("36 Ø10" → "54 Ø10") e o reescrito/esconder
  caem, o lugar fica; "aterro" e C1/C2 com chave própria (únicos: o ajuste não depende do lugar); as fileiras de
  sombra e as faixas da armação também são partes (`sombra:…`, `faixa:…`) e, com duas partes encostadas, vale a menor;
  "Aplicar às outras vistas" copia só os MATERIAIS que a janela mostra (`GRUPOS_DE_MATERIAIS` ∩ `MATERIAIS_DA_VISTA`);
  o 3D em vetor da prancha multiplica a "Alvenaria" como o visor; a legenda do quadro sai da vista que pinta os
  blocos NA FOLHA (frontal › planta › isométrico › 3D; `legendaPorVista`); a janela de gráficos nasce com o foco.
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
