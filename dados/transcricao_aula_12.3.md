# Transcrição — Aula 12.3 "Aplicação: muro de arrimo com contrafortes" (Prof. Matheus Carini)

Ordem cronológica conforme lista de imagens.

## 5803a8ff-image.png
Slide (enunciado do exercício).

- Título: "Dimensione o muro de arrimo"
- ⇒ Blocos cerâmicos: f_bk = 10 MPa
- ⇒ Solo: K_a = 0,4 e γ = 20 kN/m³
- Unidade dos desenhos: [cm]
- Esboço 1 (corte vertical): muro com espessura 14 (cota no topo, entre setas), altura 260 (cota vertical do topo da parede até o topo da sapata). Solo (marrom) à esquerda/atrás no nível do topo; sapata (cinza, trapezoidal no topo) na base, com solo dos dois lados. A parede aparece como duas faixas verticais (linha interna dividindo a espessura).
- Esboço 2 (planta / seção horizontal): parede horizontal (mesa) com espessura 14 (cota vertical à direita: "14"), com dois contrafortes (nervuras) projetando-se para baixo (para o lado do solo, envolvidos em marrom). Largura do contraforte: 14 (cota no topo à esquerda). Altura total da seção (mesa + contraforte): 59 (cota vertical à esquerda, do topo da mesa à extremidade do contraforte). Distância entre eixos dos contrafortes: 150. Forma da seção = mesa com nervuras (tipo T / "π").

## 4e618a5e-image.png
Slide teórico "Tensões nos solos".

- ⇒ Tensão vertical total: σ_v = Σ γz + q
- ⇒ Pressão neutra / pressão da água / poropressão: u = γ_w z_w
- ⇒ Tensões efetivas:
  - σ'_v = σ_v − u
  - σ'_h = σ_h − u
  - σ'_h = K σ'_v
- ⇒ Tensão horizontal total: σ_h = σ'_h + u = K(Σ γz + q − u) + u
- Legenda (à direita):
  - K: coeficiente de empuxo
  - q: sobrecarga
  - u: poropressão
  - z: profundidade
  - z_w: profundidade do nível da água
  - γ: peso específico do solo
  - γ_w = 10 kN/m³: peso específico da água
  - σ'_h: tensão horizontal efetiva
  - σ'_v: tensão vertical efetiva
  - σ_h: tensão horizontal total
  - σ_v: tensão vertical total

## fe68e10d-image.png
Caderno (manuscrito) — cálculo do empuxo.

- "Empuxo:"
- Topo: σ'_v = 0 kN/m²        σ'_ha = 0 kN/m²
- Base: σ'_v = 20 . 2,60 = 52 kN/m²        σ'_ha = 0,4 . 52 = 20,8 kN/m²

## e53de5c8-image.png
Slide "Modelos estruturais" ⇒ "Com contrafortes / enrijecedores".

- Desenho 3D (à esquerda): muro longo com contrafortes (enrijecedores) verticais espaçados; altura h (cota vertical), vão entre contrafortes l (cota horizontal).
- "Painel" (à direita): três esquemas de painel retangular h × l (altura h, largura l), com borda superior tracejada (livre):
  1. Painel com carga triangular em vermelho: σ_h,topo no topo e σ_h,base na base (carga crescendo com a profundidade); bordas laterais e inferior em linha cheia.
  2. Painel com faixas cinza nas laterais (esquerda e direita) e na base (indicando apoios/engastes nas laterais e na base), topo tracejado.
  3. Painel com faixa cinza na lateral direita e na base (e linha cheia na lateral esquerda), topo tracejado.
- "Contraforte intermediário" (embaixo): barra vertical engastada na base (hachura), com carga triangular distribuída em vermelho: no topo "σ_h,topo l", na base "σ_h,base l".

## 284e6ffd-image.png
Caderno (manuscrito) — modelos de painel e contraforte + verificação de esbeltez. Cabeçalho do vídeo: "Curso de Cálculo de Alvenaria Estrutural — Muros de Arrimo, Piscinas e Reservatórios | 12.3. Aplicação: muro de arrimo com contrafortes" (ID: 92108968).

- Esquerda, título "Painel" (parcialmente encoberto): painel retangular, largura 1,50 m (cota azul no topo), altura 2,60 m (cota azul à direita), topo tracejado (borda livre), base engastada (hachura). Carga triangular vermelha à esquerda, zero no topo, 20,8 kN/m² na base.
- Direita, título "Contraforte" (parcialmente encoberto): barra vertical engastada na base (hachura), altura 2,60 m (cota azul), carga triangular vermelha zero no topo e na base: 20,8 . 1,50 = 31,2 kN/m.
- "Esbeltez:"
  - e_enr = 14 cm
  - l_enr = 150 cm
  - t_enr = 59 cm
  - (chave) → δ = 1,371
  - t ≈ 14 cm
- t_e = 1,371 . 14 = 19,19 cm
- λ = 2 . 260 / 19,19 = 27,1    "OK para alvenaria armada" (em azul)

## f887793b-image.png
Planilha Excel — aba/tela "Dados" (cálculo do coeficiente δ de enrijecedores).

- Bloco "Dados":
  - Enrijecedor:
    - eenr = 14,0 cm
    - lenr = 150,0 cm
    - tenr = 59,0 cm
  - Parede:
    - t = 14 cm (célula selecionada)
- Relações:
  - lenr/eenr = 10,714
  - tenr/t = 4,214
- Coeficiente:
  - δ = 1,371
- Tabela (lenr/eenr nas linhas × tenr/t nas colunas 1, 2, 3):
  | lenr/eenr | 1 | 2 | 3 |
  |---|---|---|---|
  | 6 | 1,0 | 1,4 | 2,0 |
  | 8 | 1,0 | 1,3 | 1,7 |
  | 10 | 1,0 | 1,2 | 1,4 |
  | 15 | 1,0 | 1,1 | 1,2 |
  | 20 | 1,0 | 1,0 | 1,0 |
- Tabelas auxiliares de interpolação (à direita, parcialmente cortadas):
  - lenr/eenr | 3 (coluna cortada) : 10 → 1,4 (cortado "1,4"); 15 → 1,2 (cortado "1,2")
  - lenr/eenr | tenr/t = 4,21(cortado) : 10 → 1,40 (cortado); 15 → 1,20 (cortado)
  - lenr/eenr | tenr/t = 4,21(cortado) : 10,714 → 1,37 (cortado)
- Desenho: planta da parede de blocos com dois enrijecedores (contrafortes) em T; cotas e_enr (largura do enrijecedor), t (espessura da parede), t_enr (profundidade total do enrijecedor, incluindo a parede), l_enr (distância entre enrijecedores, eixo a eixo).
- Rodapé: "Alvenaria Estrutural — Matheus Roman Carini".

## edc2484e-image.png
Slide "Espessura efetiva (ABNT NBR 16868-1, 2020)".

- ⇒ Paredes
  - ↳ Sem enrijecedores: t_e = t
  - ↳ Com enrijecedores regularmente espaçados: t_e = δ t
- Citação (à direita): "A espessura efetiva **é utilizada apenas para o cálculo do índice de esbeltez da parede** e não pode ser utilizada para o cálculo da área da seção resistente quando a parede apresentar enrijecedores."
- Tabela "Valores de δ" (l_enr/e_enr nas linhas × t_enr/t nas colunas):
  | l_enr/e_enr | t_enr/t = 1 | 2 | 3 |
  |---|---|---|---|
  | 6 | 1,0 | 1,4 | 2,0 |
  | 8 | 1,0 | 1,3 | 1,7 |
  | 10 | 1,0 | 1,2 | 1,4 |
  | 15 | 1,0 | 1,1 | 1,2 |
  | 20 ou mais | 1,0 | 1,0 | 1,0 |
  - Nota: "Interpolar para valores intermediários"
- Desenho: planta de parede de blocos com dois enrijecedores em T; cotas e_enr, t, t_enr, l_enr.
- Legenda:
  - t_e: espessura efetiva
  - δ: coeficiente
  - l_enr: espaçamento entre os eixos de enrijecedores adjacentes
  - e_enr: espessura dos enrijecedores
  - t_enr: comprimento dos enrijecedores
  - t: espessura da parede sem revestimentos (linha parcialmente cortada)

## 20d104b3-image.png
Caderno (manuscrito) — "Projeto do enrijecedor" (título parcialmente encoberto pelo cabeçalho do vídeo).

- "Geometria"
- Esboço 1: seção T (laranja). Mesa com largura 86,7 (cota no topo), espessura da mesa marcada "I 14" à direita (cota de 14, lida como "↕14" (?)). Alma com largura 14 (cota com setas). Altura total 59 (cota azul à esquerda).
  - f_pk = 6,0 MPa
- "OU"
- Esboço 2: seção retangular (laranja) largura 14 (setas azuis), altura 59 (cota azul).
  - f_pk = 9,6 MPa
- Linha seguinte cortada no rodapé (ilegível; início de palavra manuscrita).

## a3a08811-image.png
Slide "Largura colaborante / efetiva (ABNT NBR 16868-1, 2020)".

- ⇒ Painéis de contraventamento
  - Desenho esquerdo: parede com "Flanges" dos dois lados da "Alma"; cotas b_f, t, b_f (flange de cada lado + espessura t da alma); espessura t indicada à direita.
  - Desenho direito: "Flange" de um lado só da "Alma"; cota b_f; espessura t.
  - b_f ≤ 6t
- ⇒ Seções com enrijecedores e flexão no plano do elemento
  - Desenho: seção T (cinza) com b_m (largura da mesa, topo), h_f (espessura da mesa), b_f (aba de cada lado, esquerda e direita), d (altura útil, do topo ao ponto vermelho — armadura — na alma).
  - b_f ≤ 6t
  - b_m ≤ (altura da parede)/3
  - h_f ≤ 0,5d

## 8f6b80d5-image.png
Planilha Excel — tabela de resistências por tipo de bloco (fbk, fa, fgk, fpk/fbk, fpk*/fpk, fpk, fpk*, μ).

Colunas: Tipo de Bloco | fbk (MPa) | fa (MPa) | fgk (MPa) | fpk/fbk | fpk*/fpk | fpk (MPa) | fpk* (MPa) | μ

Bloco vazado de concreto conforme NBR 6136 (ref. 14 x 39 cm):
| fbk | fa | fgk | fpk/fbk | fpk*/fpk | fpk | fpk* | μ |
|---|---|---|---|---|---|---|---|
| 3 | 4 | 15 | 0,80 | 2,00 | 2,4 | 4,8 | (vazio) |
| 4 | 4 | 15 | 0,80 | 2,00 | 3,2 | 6,4 | (vazio) |
| 6 | 6 | 15 | 0,75 | 1,75 | 4,5 | 7,9 | 76% |
| 8 | 6 | 20 | 0,75 | 1,75 | 6,0 | 10,5 | 24% |
| 10 | 8 | 20 | 0,70 | 1,75 | 7,0 | 12,3 | 2% |
| 12 | 8 | 25 | 0,70 | 1,60 | 8,4 | 13,4 | 0% |
| 14 | 12 | 25 | 0,70 | 1,60 | 9,8 | 15,7 | 0% |
| 16 | 12 | 30 | 0,65 | 1,60 | 10,4 | 16,6 | 0% |
| 18 | 14 | 30 | 0,65 | 1,60 | 11,7 | 18,7 | 0% |
| 20 | 14 | 35 | 0,60 | 1,60 | 12,0 | 19,2 | 0% |
| 22 | 18 | 35 | 0,55 | 1,60 | 12,1 | 19,4 | 0% |
| 24 | 18 | 40 | 0,55 | 1,60 | 13,2 | 21,1 | 0% |

Bloco cerâmico de parede vazada conforme NBR 15270-1 (ref. 14 x 29 cm):
| fbk | fa | fgk | fpk/fbk | fpk*/fpk | fpk | fpk* | μ |
|---|---|---|---|---|---|---|---|
| 4 | 4 | 15 | 0,50 | 1,60 | 2,0 | 3,2 | (vazio) |
| 6 | 6 | 15 | 0,50 | 1,60 | 3,0 | 4,8 | (vazio) |
| 8 | 6 | 20 | 0,50 | 1,60 | 4,0 | 6,4 | (vazio) |
| 10 | 8 | 25 | 0,45 | 1,60 | 4,5 | 7,2 | 96% |
| 12 | 8 | 25 | 0,45 | 1,60 | 5,4 | 8,6 | 53% |

Bloco cerâmico de parede maciça conforme NBR 15270-1 (ref. 14 x 29 cm):
| fbk | fa | fgk | fpk/fbk | fpk*/fpk | fpk | fpk* | μ |
|---|---|---|---|---|---|---|---|
| 10 | 8 | 20 | 0,60 | 1,60 | 6,0 | 9,6 (célula selecionada) | 31% |
| 14 | 12 | 25 | 0,60 | 1,60 | 8,4 | 13,4 | 0% |
| 18 | 15 | 30 | 0,60 | 1,60 | 10,8 | 17,3 | 0% |

(Cores: vermelho = linhas sem μ; amarelo = μ > 0; verde = μ = 0%.)

## 8cabc5db-image.png
Slide "Tensão na armadura tracionada (ABNT NBR 16868-1, 2020)".

- ⇒ Bloco de concreto
  - ↳ Todos os diâmetros: f_sd = f_yd
- ⇒ Bloco ou tijolo cerâmico, vazado em contato com o graute com faces lisas
  - ↳ Barras de 10 mm: f_sd = f_yd
  - ↳ Barras de 12,5 mm: f_sd = 0,75 f_yd   (destacado em azul)
  - ↳ Barras de 16 mm ou superior: f_sd = 0,50 f_yd   (destacado em azul)
- ⇒ Bloco cerâmico, vazado em contato com o graute com faces com ranhuras
  - ↳ Todos os diâmetros: f_sd = f_yd
- Desenho: bloco com dois furos com bordas ranhuradas (cotas 3 e 10, 10 mm) e furos pequenos centrais.
- Texto: "Ranhuras de pelo menos 3 mm de profundidade e 10 mm de largura, espaçadas não mais que 10 mm, continuamente distribuídas ao longo do perímetro."

## e41742dc-image.png
Planilha Excel — aba "Dados" (dimensionamento à flexão da seção T do enrijecedor).

- Geometria:
  - bm = 86,7 cm
  - bw = 14,0 cm
  - hf = 14,0 cm
  - h = 59,0 cm
  - d = 52,0 cm
  - d' = 5,0 cm
- Solicitação:
  - Md = 4921,0 kNcm
- Resistências:
  - fpk = 0,600 kN/cm²
  - fyk = 37,5 kN/cm² (célula com marcador verde de comentário)
- Compressão na Flexão:
  - K = 1,0
- Resist. de Projeto:
  - Kfd = 0,210 kN/cm²
  - fsd = 32,61 kN/cm²
- Forças:
  - Cmw = 16,13 kN
  - Cmf = 83,77 kN
  - Ts = 99,91 kN
  - Cs = 0,00 kN
- Equilíbrio:
  - ΣFx = 0,00
  - ΣM-Md = 0,00
- Linha Neutra:
  - x = 6,86 cm
  - x23 = 12,00 cm
  - xduc = 23,40 cm
  - Domínio 2
- Momento Fletor (cortado no rodapé):
  - Md,duc = 11965,0 kNcm (?) (linha parcialmente cortada)
- Deformações:
  - ε1 = 10,00 ‰
  - ε2 = 0,41 ‰
  - εc = 1,52 ‰
- Tensões:
  - σ1 = 32,61 kN/cm²
  - σ2 = 8,65 kN/cm²
- Armaduras:
  - As1 = 3,06 cm² (célula selecionada)
  - As2 = 0,00 cm²
- Armadura Mínima:
  - As1 = 1,09 cm²
- Caixa: "Armadura Simples"
- Tabela "Armadu[ras]" (cortada à direita) — Bitola (mm) | coluna "1":
  - Ø6,3 → 0,31 (vermelho)
  - Ø8,0 → 0,50 (vermelho)
  - Ø10,0 → 0,79 (vermelho)
  - Ø12,5 → 1,23 (vermelho)
  - Ø16,0 → 2,01 (vermelho)
  - Ø20,0 → 3,14 (verde)
  - Ø22,0 → 3,80 (verde)
  - Ø25,0 → 4,91 (verde)
- "Armadura Ad[otada]" (cortado) = 20 (verde)
- Botão (cortado): "Dimensionam[ento] Armadura Si[mples]"

## 5ff33afa-image.png
Planilha Excel — aba "Dados" (mesma planilha de flexão da seção T, outro conjunto de entradas: fyk = 50 e K = 0,5).

- Geometria:
  - bm = 86,7 cm
  - bw = 14,0 cm
  - hf = 14,0 cm
  - h = 59,0 cm
  - d = 52,0 cm
  - d' = 5,0 cm
- Solicitação:
  - Md = 4921,0 kNcm
- Resistências:
  - fpk = 0,600 kN/cm²
  - fyk = 50,0 kN/cm² (célula selecionada)
- Compressão na Flexão:
  - K = 0,5
- Resist. de Projeto:
  - Kfd = 0,105 kN/cm²
  - fsd = 43,48 kN/cm²
- Forças:
  - Cmw = 1,42 kN
  - Cmf = 7,36 kN
  - Ts = 21,10 kN
  - Cs = 0,00 kN
- Equilíbrio:
  - ΣFx = -12,32
  - ΣM-Md = -4468,66
- Linha Neutra:
  - x = 1,21 cm
  - x23 = 12,00 cm
  - xduc = 23,40 cm
  - Domínio 2
- Momento Fletor:
  - Md,duc = 5982,5 kNcm
- Deformações:
  - ε1 = 10,00 ‰
  - ε2 = -0,75 ‰
  - εc = 0,24 ‰
- Tensões:
  - σ1 = 43,48 kN/cm²
  - σ2 = -15,69 kN/cm²
- Armaduras:
  - As1 = 0,49 cm²
  - As2 = 0,00 cm²
- Armadura Mínima:
  - As1 = 1,09 cm²
- Caixa: "Armadura Simples"
- Tabela "Armadura T[...]" (cortada) — Bitola (mm) | Nú[mero de barras] 1 | 2 (coluna 2 cortada):
  - Ø6,3 → 0,31 (vermelho) | 0,(cortado) (vermelho)
  - Ø8,0 → 0,50 (vermelho) | 1,(cortado) (vermelho)
  - Ø10,0 → 0,79 (vermelho) | 1,(cortado) (verde)
  - Ø12,5 → 1,23 (verde) | 2,(cortado)
  - Ø16,0 → 2,01 (verde) | 4,(cortado)
  - Ø20,0 → 3,14 (verde) | 6,(cortado)
  - Ø22,0 → 3,80 (verde) | 7,(cortado)
  - Ø25,0 → 4,91 (verde) | 9,(cortado)
- "Armadura Adota[da]" = "20 Ø2…" (cortado à direita)
- Botão (cortado): "Dimensionamen[to] Armadura Simpl[es]"
- Barra do vídeo: tempo 12:04 (?) / 01:12:26 (?)

## 243eb0cf-image.png
Slide "Armadura máxima" ⇒ Blocos cerâmicos (A_s,máx = 4% A_graute).

| Dimensões (cm) | f_bk (MPa) | Bloco | Área graute* (cm²) | A_s,max (cm²) | Nº máx. barras 10 mm | 12,5 mm | 16,0 mm |
|---|---|---|---|---|---|---|---|
| 11,5 x 29 | 4,0 | (figura) | 32 | 1,28 | 1 | 1 | 0 |
| 14 x 29 | 7,0 | (figura) | 47 | 1,88 | 2 | 1 | 0 |
| 14 x 29 | 10,0 | (figura) | 87 | 3,48 | 4 | 2 | 1 |
| 14 x 29 | 15,0 | (figura) | 84 | 3,36 | 4 | 2 | 1 |
| 14 x 29 | 18,0 | (figura) | 69 | 2,76 | 3 | 2 | 1 |
| 19 x 29 | 7,0 | (figura) | 99 | 3,96 | 5 | 3 | 1 |

- Nota: "* em azul" (área do graute indicada em azul nas figuras dos blocos).

## 77ecf631-image.png
Caderno (manuscrito) — "Dimensionamento à flexão" (título parcialmente encoberto).

- Msd = 1,4 . 35,15 = 49,21 kNm = 4921 kNcm
- bm = 86,7 cm
- hf = 14 cm
- h = 59 cm
- d = 59 − 7 = 52 cm
- fpk = 6,0 MPa
- fyk = 50 kN/cm² → As = 2,30 cm²    3Ø10 (vermelho)
- fyk = 37,5 kN/cm² → As = 3,06 cm²    3Ø12,5 (vermelho)
- fyk = 25 kN/cm² → As = 4,60 cm²    2Ø20 (vermelho)

## d09c51ee-image.png
Caderno (manuscrito) — "Esforço cortante".

- ρ = 2,36 / (14 . 52) = 0,003241
- f_vk = 0,35 + 17,5 . 0,003241 = 0,407 MPa
- f_vd = 0,407 / 2 = 0,203 MPa = 0,0203 kN/cm²
- V_sd = 1,4 . 40,56 = 56,78 kN
- τ_vd = 56,78 / (14 . 52) = 0,078 kN/cm²        f_vd = 0,0203 kN/cm²

## 7931b969-image.png
Caderno (manuscrito) — "Esforço cortante" (versão anterior/parcial da mesma página).

- ρ = 2,36 / (14 . 52) = 0,003241
- f_vk = 0,35 + 17,5 . 0,003241 = 0,407 MPa

## b0708d9a-image.png
Slide "Cisalhamento" — "Alvenaria armada sem armadura de cisalhamento (ABNT NBR 16868-1, 2020)".

- ⇒ Solicitação: τ_vd = V_Sd / (b d)
  - τ_vd: tensão tangencial solicitante de cálculo
  - V_Sd: esforço cortante solicitante de cálculo
  - b: largura da alma
  - d: altura útil (distância da face comprimida até o centróide da armadura tracionada)
- Desenhos: (1) seção vertical de parede/viga de largura b, altura útil d, armadura A_s (ponto vermelho) embaixo, V_Sd vertical (seta vermelha) no topo; (2) planta de parede com flanges (enrijecedores) nas extremidades, V_Sd horizontal (seta vermelha) aplicado na alma, espessura b, comprimento d, armaduras (pontos) nos furos grauteados (azuis) à esquerda.
- ⇒ Resistência
  - ↳ No caso de cisalhamento em juntas horizontais, é possível empregar a expressão de alvenaria não armada
  - ↳ Na flexão com armaduras envoltas por graute e perpendiculares ao plano de cisalhamento
    - f_vk = 0,35 + 17,5ρ ≤ 0,7 MPa
    - ρ = A_s / (bd) ≤ 2%
    - ρ: taxa geométrica de armadura
    - A_s: área da armadura principal de flexão
    - b: largura da seção transversal
    - d: altura útil da seção transversal
- Se τ_vd ≤ f_vd ⇒ dispensa armadura de cisalhamento
- Se τ_vd > f_vd ⇒ necessita de armadura de cisalhamento

## ddf720db-image.png
Planilha Excel — aba "Dados" (cisalhamento: "Sem Armadura de Cisalhamento" / "Com Armadura de Cisalhamento").

- Dados — Geometria:
  - bw = 14,0 cm
  - d = 52,0 cm
- Dados — Solicitação:
  - Vsd = 56,8 kN
- Dados — Armadura:
  - As = 2,36 cm²
- Dados — Materiais:
  - fgk = 1,5 kN/cm²
  - fpk = 0,480 kN/cm²
  - fywk = 50,0 kN/cm²
- Sem Armadura de Cisalhamento:
  - Resistências: fvk = 0,407 MPa; fvd = 0,203 MPa
  - Solicitação: τvd = 0,780 MPa
  - Verificação: τvd = 0,780 MPa; fvd = 0,203 MPa; Vsd = 56,8 kN; Vrd = 14,8 kN
  - Resultado (vermelho, célula selecionada): "Precisa de Estribos"
- Com Armadura de Cisalhamento:
  - Alvenaria: Va = 14,81 kN
  - Bielas Comprimidas: Vrd2 = 46,70 kN → "Aumentar Seção" (vermelho)
  - Armadura Mínima para Vigas: ρ = 0,070%; Asw/s = 0,98 cm²/m; Vsw = 16,62 kN; Vrd3 = 31,42 kN
  - Bielas Tracionadas: Asw/s = 2,48 cm²/m

## 95d7c50e-image.png
Slide "Cisalhamento" — "Alvenaria armada com armadura de cisalhamento".

- ⇒ Comportamento semelhante ao concreto armado
- ⇒ Analogia da treliça de Mörsch e Ritter
- Desenho: viga biapoiada com carga distribuída (setas para baixo), estribos inclinados (azul) e bielas comprimidas (tracejado laranja); ângulos α (estribo) e β (biela); indicações BC, BT, DC, DT.
- Estribos verticais: α = 90°
- Bielas comprimidas: V_Sd ≤ V_Rd2   (destacado em azul)
- Bielas tracionadas: V_Sd ≤ V_Rd3 = V_a + V_s
- Legenda:
  - BC: banzo comprimido
  - BT: banzo tracionada
  - DC: diagonal comprimida
  - DT: diagonal tracionada

## e2fa3418-image.png
Caderno (manuscrito) — continuação do cisalhamento.

- V_a = 0,0203 . 14 . 52 = 14,78 kN
- f_vd2 = √9,6 / 2 = 1,55 MPa = 0,155 kN/cm²

## a9622539-image.png
Slide "Alvenaria armada com armadura de cisalhamento".

- ⇒ Parcela absorvida pela alvenaria
  - V_a = f_vd b d   (destacado em azul)
  - f_vd = f_vk / γ_m
  - f_vk = 0,35 + 17,5ρ ≤ 0,7 MPa   (setas: "Efeito de pino da armadura longitudinal" apontando para 17,5ρ; "Valores sempre em MPa")
  - ρ = A_s / (bd) ≤ 2%
- ⇒ Bielas comprimidas
  - V_Sd ≤ V_Rd2 = V_a + 0,4 b d f_vd2
  - f_vd2 = √f_pk / γ_m   ("Valores sempre em MPa")
- Se V_sd ≤ V_Rd2 ⇒ bielas em boas condições
- Se V_sd > V_Rd2 ⇒ aumentar a seção ou armadura longitudinal

## a931cabc-image.png
Caderno (manuscrito) — bielas comprimidas.

- V_a = 0,0203 . 14 . 52 = 14,78 kN
- f_vd2 = √9,6 / 2 = 1,55 MPa = 0,155 kN/cm²
- V_Rd2 = 14,78 + 0,4 . 14 . 52 . 0,155 = 59,92 kN
- V_sd = 56,78 kN < V_Rd2 = 59,92 kN    "bielas comprimidas em boas condições" (em azul)

## 385fd8d6-image.png
Planilha Excel — aba "Dados" (cisalhamento), agora com fpk = 0,960 kN/cm².

- Dados — Geometria: bw = 14,0 cm; d = 52,0 cm
- Dados — Solicitação: Vsd = 56,8 kN
- Dados — Armadura: As = 2,36 cm²
- Dados — Materiais: fgk = 1,5 kN/cm²; fpk = 0,960 kN/cm²; fywk = 50,0 kN/cm²
- Sem Armadura de Cisalhamento:
  - Resistências: fvk = 0,407 MPa; fvd = 0,203 MPa
  - Solicitação: τvd = 0,780 MPa
  - Verificação: τvd = 0,780 MPa; fvd = 0,203 MPa; Vsd = 56,8 kN; Vrd = 14,8 kN → "Precisa de Estribos" (vermelho)
- Com Armadura de Cisalhamento:
  - Alvenaria: Va = 14,81 kN
  - Bielas Comprimidas (selecionado): Vrd2 = 59,92 kN → "Ok!" (verde)
  - Armadura Mínima para Vigas: ρ = 0,070%; Asw/s = 0,98 cm²/m; Vsw = 16,62 kN; Vrd3 = 31,42 kN
  - Bielas Tracionadas: Asw/s = 2,48 cm²/m
- Tabela (à direita, cortada) — s | 5 cm | 6 cm (cortado):
  - Ø5,0 → 3,93 | 3,2(cortado)
  - Ø6,3 → 6,23 | 5,2(cortado)
  - Ø8,0 → 10,05 | 8,3(cortado)
  - Ø10,0 → 15,71 | 13,0(cortado)
  - Ø12,5 → 24,54 | 20,4(cortado)
- "Armadura Míni[ma]" = Ø5… (cortado)
- "Armadura Adot[ada]" = Ø5… (cortado)

## f963d579-image.png
Caderno (manuscrito) — armadura de cisalhamento (estribos).

- V_sd = 56,78 kN < V_Rd2 = 59,92 kN    "bielas comprimidas em boas condições" (em azul)
- A_sw/s = (56,78 − 14,78) / (0,75 . 43,48 . 52) = 0,0248 cm²/cm (?) = 2,48 cm²/m
- (A_sw/s)_mín = (0,084/100) . 14 = 0,0118 cm²/cm = 1,18 cm²/m
- Esboço (à direita): retângulo vermelho (estribo) com dois pontos azuis nas laterais (dois ramos).
- "Adotando estribos de dois ramos c/20 cm"
- A_sw/s = (2 . π . Ø²/4) / 0,20 = 2,48 cm²/m
- Ø = √(0,20 . 4 . 2,48 / 2π) = 0,56 cm

## b18e0815-image.png
Caderno (manuscrito) — esboço do detalhamento da seção do enrijecedor.

- Esboço esquerdo: seção T (contorno laranja: mesa no topo, alma descendo). Dentro da alma, estribo vermelho retangular.
  - No topo do estribo, 2 barras (círculos): "2Ø10 (construtiva)"
  - Estribo: "Ø6,3"
  - Na base do estribo, 3 barras: "3Ø10"
- Esboço direito: estribo isolado (retângulo vermelho, com gancho no canto superior direito): altura 50 (azul), largura 7 (azul).

## b80bb86e-image.png
Caderno (manuscrito) — "Momento de fissuração" (dados da seção e propriedades).

- Esboço: seção T (laranja). Mesa largura 86,7 (cota no topo, parcialmente encoberta); espessura da mesa "I 14" (cota de 14 à direita); altura total 59 (cota azul à esquerda); alma largura 14 (setas azuis). Eixo "x" (seta verde) na face superior da mesa. Linhas verdes verticais dividindo a mesa nas abas (lado esquerdo e direito da alma); ponto verde no centróide da aba direita e ponto verde no centróide da alma.
- f_pk = 6,0 MPa
- E_m = 600 . 6 = 3600 MPa
- E_s = 210 000 MPa
- m = 210000 / 3600 = 58,33
- "Momento de fissuração"
- Argamassa: f_a = 8,0 MPa → f_tk = 0,25 MPa = 0,025 kN/cm²
- y_CG = [(86,7 − 14) . 14 . 14/2 + 14 . 59 . 59/2] / [(86,7 − 14) . 14 + 14 . 59] = 31491,6 / 1843,6 = 17,08 cm

## 5f05febb-image.png
Caderno (manuscrito) — inércia equivalente (Estádio II).

- M_a = 3515 kNcm > M_r = 290,5 cm (unidade escrita assim) → Estádio II
- I_eq = (290,5/3515)³ . 487105 + [1 − (290,5/3515)³] . 269726 = 269849 cm⁴
- 86,7 . l_eq³ / 12 = 269849
- l_eq = ³√(12 . 269849 / 86,7) = 33,43 cm

## d403eb81-image.png
Caderno (manuscrito) — "Projeto do painel".

- "Projeto do painel"
- "Solicitações"
- "Tabela de Libânio"
- Esboço: painel retangular, largura 1,50 m (cota azul no topo), altura 2,60 m (cota azul à direita); topo tracejado (borda livre); base engastada (hachura). Carga triangular vermelha à esquerda, zero no topo e 20,8 kN/m² na base. (Laterais em linha cheia.)

## bd2bcda7-image.png
Caderno (manuscrito) — "Dimensionamento à flexão" do painel.

- "Dimensionamento à flexão"
- "Adotando armaduras excêntricas simétricas"
- Esboço 1 (canto superior direito): planta de bloco (laranja) com dois furos; no furo da esquerda, duas barras (pontos vermelhos), uma junto a cada face; cota "5" (azul) com setas na lateral, indicando posição da barra a 5 a partir da face.
- Esboço 2: canaleta em U (laranja) com duas barras (pontos vermelhos) no fundo; cota "5" (azul) horizontal com setas embaixo.
- d = 14 − 5 = 9 cm
- "Flexão vertical"
- M_sd = 518,3 kNcm/m
- f_pk,líq (?) = 0,6/0,48 = 1,25 kN/cm²
- K = 1,0
- b_m = 15 cm
- M_d = 77,7 kNcm

## 86270e0d-image.png
Planilha Excel — aba "Dados" (flexão do painel, faixa b_m = 15 cm, seção com armadura excêntrica).

- Geometria:
  - bm = 15,0 cm
  - bw = 13,6 cm
  - hf = 2,2 cm
  - h = 14,0 cm
  - d = 9,0 cm
  - d' = 5,0 cm
- Solicitação:
  - Md = 77,7 kNcm (marcador verde de comentário)
- Resistências:
  - fpk = 1,250 kN/cm² (marcador verde de comentário)
  - fyk = 50,0 kN/cm²
- Compressão na Flexão:
  - K = 1,0
- Resist. de Projeto:
  - Kfd = 0,438 kN/cm²
  - fsd = 43,48 kN/cm²
- Forças:
  - Cmw = 8,51 kN
  - Cmf = 0,88 kN
  - Ts = 9,38 kN
  - Cs = 0,00 kN
- Equilíbrio (selecionado):
  - ΣFx = 0,00
  - ΣM-Md = 0,00
- Linha Neutra:
  - x = 1,79 cm
  - x23 = 2,08 cm
  - xduc = 4,05 cm
  - Domínio 2
- Momento Fletor:
  - Md,duc = 152,9 kNcm
- Deformações:
  - ε1 = 10,00 ‰
  - ε2 = -4,45 ‰
  - εc = 2,48 ‰
- Tensões:
  - σ1 = 43,48 kN/cm²
  - σ2 = -43,48 kN/cm²
- Armaduras:
  - As1 = 0,22 cm²
  - As2 = 0,00 cm²
- Armadura Mínima:
  - As1 = 0,18 cm²
- Caixa: "Armadura Simples"
- Tabela "Armadura[s]" (cortada) — Bitola (mm) | N[úmero] 1 | 2 (coluna 2 cortada; todas as células verdes):
  - Ø6,3 → 0,31 | 0(cortado)
  - Ø8,0 → 0,50 | 1(cortado)
  - Ø10,0 → 0,79 | 1(cortado)
  - Ø12,5 → 1,23 | 2(cortado)
  - Ø16,0 → 2,01 | 4(cortado)
  - Ø20,0 → 3,14 | 6(cortado)
  - Ø22,0 → 3,80 | 7(cortado)
  - Ø25,0 → 4,91 | 9(cortado)
- "Armadura Ado[tada]" = "20 Ø…" (cortado)
- Botão (cortado): "Dimensioname[nto] Armadura Simp[les]"

## fceec1e1-image.png
Caderno (manuscrito) — flexão vertical do painel para várias larguras de faixa b_m.

- b_m = 15 cm; M_d = 77,7 kNcm } A_s1 = 0,22 cm²; A_s,mín = 0,15% . 15 . 9 = 0,20 cm²    → Ø6,3 c/15 cm (vermelho)
- b_m = 30 cm; M_d = 155,5 kNcm } A_s1 = 0,43 cm²; A_s,mín = 0,15% . 30 . 9 = 0,40 cm²    → Ø8,0 c/30 cm (vermelho)
- b_m = 45 cm; M_d = 233,2 kNcm (?) } A_s1 = 0,65 cm²; A_s,mín = 0,15% . 45 . 9 = 0,61 cm²    → Ø10 c/45 cm (vermelho)
- b_m = 60 cm; M_d = 311 kNcm } A_s1 = (em branco)

## 5aa83ac1-image.png
Caderno (manuscrito) — "Flexão horizontal" do painel.

- M_sd = 265,1 kNcm/m
- f_pk,líq (?) = 1,25 kN/cm²
- K = 0,5
- b_m = 20 cm; M_d = 53 kNcm } A_s1 = 0,15 cm²; A_s,mín = 0,15% . 20 . 9 = 0,27 cm²
