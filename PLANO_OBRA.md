# Al-rimo — do "muro" para a "obra"

Plano de arquitetura (sessão de 15/11/2026). Este arquivo é o roteiro das próximas etapas: a **Parte 1** é para o
José (o que o software vai fazer e o que ele precisa decidir); a **Parte 2** é para quem for implementar (uma etapa
por sessão, cada uma com a sua prova). Regra do caderno vale aqui: etapa que mudar de estado se anota neste arquivo.

---

# PARTE 1 — Para o José

## A ideia em uma frase

Hoje o Al-rimo calcula **um muro reto, de altura constante, em terreno plano**. O destino é calcular **a obra**:
um terreno de verdade, com o caminho do muro desenhado em planta, dividido em trechos de alturas diferentes, com
quina, sondagem e volume de corte e aterro.

## O que NÃO muda (é o que protege tudo o que já foi validado)

- **Cada trecho continua sendo um muro como o de hoje**, calculado pela mesma planilha, com a mesma memória.
  A obra é uma fila de muros que você já sabe conferir. Um trecho com 2,0 m de solo é a conta de hoje com 2,0 m.
- **Muro simples continua simples.** Quem quer um muro reto de 6 m não vê terreno nem sondagem: é uma obra de um
  trecho só, igual a hoje.
- **A planilha continua sendo o lugar da conta.** Só sai dela o que não cabe em Excel (uma exceção, ver decisão 1).

## Como fica o trabalho no software (o fluxo)

A barra lateral passa a seguir a ordem em que a obra acontece:

1. **Início** — abrir, salvar, exportar.
2. **Implantação** — tela nova, uma planta só, com quatro passos na faixa de cima, da esquerda para a direita:
   - **Topografia** — carrega o DXF do topógrafo como fundo e monta a superfície do terreno.
   - **Sondagens** — marca os furos na planta e lança as camadas de cada laudo.
   - **Traçado** — desenha o caminho do muro (polilinha), diz de que lado fica a terra e onde ficam as divisões.
   - **Terraplenagem** — os platôs (nível acabado de cada lado do muro) e o volume de corte e aterro.
   Embaixo da planta fica o **perfil ao longo do muro**: o muro "esticado" numa linha, mostrando o terreno natural,
   o terreno acabado, o topo do muro e os degraus da base. É por ele que se escolhe o trecho para mexer.
3. **Muros** — as entradas por figuras de hoje, com duas camadas: **"Vale para a obra"** (bloco, materiais,
   critérios — digita uma vez) e **"Deste trecho"** (alturas, sapata, armadura). Campo mexido só no trecho fica
   marcado.
4. **Memória** — abre com o **resumo da obra** (uma linha por trecho, quem passa e quem não passa) e desce para a
   memória do trecho escolhido, igual à de hoje.
5. **Quantitativo** — total da obra e por trecho; corte e aterro entram aqui.
6. **Gráfica** — como hoje, com vistas novas: planta geral, elevação desenvolvida (o muro esticado, com os degraus),
   corte de cada trecho.
7. **Configurações.**

## As peças novas, uma a uma

### Traçado do muro
Polilinha em planta, desenhada com o mouse ou digitando comprimento e ângulo, como no CAD. O comprimento de cada
lance "gruda" no módulo do bloco. Em cada ponto do caminho você marca o que ele é:
- **junta** (os dois lados são muros independentes);
- **degrau** (a base muda de nível — sempre em múltiplo de 20 cm, para as fiadas dos dois lados casarem);
- **quina** (só a 90°: muro amarrado virando o canto).
O software **propõe os degraus sozinho** a partir do terreno (você dá o comprimento mínimo de trecho e o quanto a
sapata tem de ficar enterrada) e você ajusta.

### Topografia
O DXF entra como fundo. O software olha camada por camada e separa sozinho o que conseguir:
- **curva de nível que já vem com a cota** dentro do desenho → pronta;
- **ponto que já vem com a cota** → pronto;
- **ponto com o número escrito ao lado** (o caso mais comum de levantamento simples) → ele casa cada número com o
  ponto mais perto e te mostra colorido por altura; o que ficar estranho (um ponto 3 m acima dos vizinhos) acende
  para você conferir;
- **curva sem cota** → ferramenta de "cerca": você risca uma linha cruzando várias curvas, diz a cota da primeira
  e de quanto em quanto elas sobem, e ele numera todas de uma vez.
Sempre dá para acrescentar, corrigir ou apagar ponto na mão, ou colar uma tabela X, Y, cota do Excel.
**Sem DXF também funciona:** dá para lançar só a cota do terreno em alguns pontos ao longo do muro (obra pequena
quase nunca tem levantamento) — e esse jeito simples fica pronto antes do DXF.
Com os pontos, o software estica uma "lona" de triângulos (é o que o Revit faz) e ela vira o sólido do terreno.

### Sondagens
Cada furo: posição (clicando ou por X/Y), cota da boca (sai do terreno), camadas (profundidade, tipo de solo, cor),
SPT metro a metro e nível d'água. Para ligar um furo no outro, você dá o **mesmo nome** à mesma camada em cada laudo
("Argila mole", "Silte arenoso"). Com um furo, as camadas saem deitadas; com dois, interpoladas em linha; com três
ou mais, cada contato entre camadas vira uma superfície. Aparece no 3D e nos cortes com as cores, sempre marcado
como **inferido**. Para o cálculo, a sondagem **sugere** (em verde, como as tabelas de hoje) o SPT na base da
sapata e o tipo de solo de cada trecho — quem digita é você.

### Corte e aterro
Você desenha a área de cada platô e dá o nível; a borda desce em talude até encontrar o terreno natural. O volume
sai pela diferença entre o terreno natural e o acabado, medido em quadradinhos (malha fina): m³ de corte, m³ de
aterro, com fator de empolamento. A vala da sapata e do dreno sai separada. No 3D, corte e aterro pintados.

### Quina a 90°
A quina é **um contraforte que vem de graça**: a outra perna do muro segura esta.
- **Terra por dentro do L** — a outra perna está do lado do solo: trabalha como o contraforte **enterrado** de hoje
  (tração na ligação, armadura horizontal virando o canto e ancorada).
- **Terra por fora do L** — a outra perna está do lado livre: trabalha como o contraforte **aparente** de hoje
  (comprimido).
Ou seja, a maior parte da conta já existe e já está validada; o que é novo é (a) a amarração dos blocos no canto,
(b) a armadura virando o canto, (c) a sapata no canto e (d) o canto em si recebendo momento das duas pernas ao
mesmo tempo — a **flexão oblíqua**, que é onde entra o motor do All Sec. O pilarete de canto do muro de cima usa
o mesmo motor.

### Dente armado
Estribo vertical fechado entrando na sapata + barras corridas de montagem, como você descreveu. O esforço: o
empurrão do solo na frente do dente (o passivo), aplicado a 2/3 da altura, dobrando o dente como um balanço
pendurado na sapata.

## Decisões que são suas

Marquei a minha recomendação em cada uma. Nenhuma trava o começo: as etapas 1 e 2 não dependem delas.

1. **Conta fora da planilha na quina.** A flexão oblíqua não cabe em Excel. Proposta: essa verificação (e só ela)
   é feita pelo motor do All Sec dentro do app, e a memória mostra a seção, as barras, a linha neutra e uma
   conferência "numa direção só" que tem de bater com a planilha. *Recomendo aceitar.*
2. **Quanto aproveitar da quina.** *Recomendo:* no muro em balanço, **não contar o ganho** (cada perna calculada
   como hoje) e só verificar e armar o canto; no muro de contrafortes, a quina **substitui o contraforte da ponta**.
3. **Ângulo.** *Recomendo:* quina amarrada só a 90°; qualquer outro ângulo é junta (dois muros independentes).
4. **Degrau da base.** *Recomendo:* todo degrau é junta, sempre em múltiplo de 20 cm. (A sapata de baixo ao lado
   da de cima pede a regra de fundações em níveis diferentes da NBR 6122 — conferir o item na norma.)
5. **Solo variando dentro do trecho.** *Recomendo:* o trecho é calculado com a **maior** altura de solo que ele
   pega.
6. **Terreno subindo atrás do muro** (talude acima do topo). A planilha hoje é Rankine com terrapleno horizontal.
   *Recomendo:* 1ª versão só com platô horizontal atrás do muro; talude vira aviso ("fora da conta"). Colocar o
   talude na conta é uma etapa de planilha à parte, com fonte.
7. **Dente.** *Recomendo:* armar para o passivo **cheio** (sem dividir por 2): o dente nunca recebe mais que isso.
8. **Produto.** Tudo isso entra no Al-rimo de R$ 100, ou vira uma versão maior ("obra") e o de R$ 100 fica no muro
   simples? Não muda a arquitetura (o muro simples é a obra de um trecho), só o que cada licença libera.
9. **Ordem.** Coloquei a quina antes da topografia por causa dos dois clientes. Se a prioridade for outra, as
   etapas 4 e 6–8 trocam de lugar sem prejuízo.

## O que pode atrapalhar lá na frente (em português de obra)

- **A etapa 2 é a fundação da casa.** Trocar "um muro" por "vários trechos" mexe no alicerce do programa. Se for
  feita com pressa, tudo o que vem depois nasce torto. É a etapa para o modelo mais forte e com revisão dobrada.
- **Topografia de DXF é obra de reforma, não obra nova:** cada topógrafo entrega de um jeito. O plano é acertar os
  quatro jeitos mais comuns e deixar o resto na mão. Vai precisar de **arquivos reais seus** para testar.
- **Camada de solo entre furos é chute educado.** O software desenha; o laudo não garante. Por isso fica como
  sugestão, nunca entra sozinho na conta.
- **Três softwares usando as mesmas peças** (desenho de linha, leitura de DXF, motor de seção). Por enquanto a peça
  é copiada com carimbo de origem; quando doer manter três cópias, vira uma caixa de ferramentas comum.

---

# PARTE 2 — Para quem implementa

Leia antes: `CLAUDE.md` (o caderno), este arquivo inteiro, e os contratos `app/src/motor/tipos.ts`,
`app/src/modelo/tipos.ts`, `app/src/estado/store.ts`, `app/src/estado/projeto.ts`.
Com o José: português do Brasil, sem vocabulário de software; ele decide comportamento, não desenho interno.

## Fatos medidos no código (15/11/2026)

- `app/src`: 283 arquivos, 62 mil linhas, 82 arquivos de teste (suíte ~4.830 testes).
- **Muro único em todo lugar:** `EstadoDoApp` tem um `alteracoes`, um `extras`, um `modelo` (`store.ts:70-143`);
  o arquivo é um muro (`projeto.ts:72-75`, `VERSAO_DO_ARQUIVO = 2`).
- **O motor é puro:** `calcular(alteracoes): Resultado` (`motor/index.ts:28`), planilha compilada uma vez, cada
  chamada com o seu estado — pode rodar N vezes. Custo: dezenas de ms por conta cheia; `contaCom()` roda até 5
  voltas para assentar as listas (`store.ts:243-285`).
- **O gerador é determinístico:** `gerarModelo(r, extras): Modelo` (`modulacao/gerar.ts:34`), em coordenadas
  locais — X ao longo do muro (0 = ponta esquerda vista da face aparente), Y da face aparente para o solo,
  Z para cima com 0 no topo da sapata, mm. `giro` das peças só em múltiplos de 90°.
- **Trechos de hoje** = pedaços iguais entre juntas de controle (`modular.ts:186-256`), mesma seção e mesmo nível.
- **Terreno de hoje** = prisma plano extrudado em X (`entorno.ts:420-467`).
- **Consumidores** (visor, ifc, quantitativo, desenhos, pranchas) recebem um `Modelo`; `memoria` recebe um
  `Resultado`. Cortes e projeções só em planos dos eixos (`desenhos/geometria.ts:139-249`).
- **Não existe no Al-rimo:** leitura de DXF, desenho interativo de linha, triangulação, booleana de polígono.
- **Existe pronto fora:**
  - A-PORT (`C:\CLAUDE\Projetos\Pórtico Estrutural`): leitor de DXF `src/importar/dxfParaTracos.ts` (lib `dxf`
    ^5.3.1; lê LINE/ARC/CIRCLE/LWPOLYLINE/INSERT; **pula TEXT/MTEXT e não trata POINT** — a topografia precisa dos
    dois), fundo importado com camadas (`modelo/tipos/importado.ts`, `visor/Importados.tsx`), Delaunay com
    restrições puro (`src/modelo/triangulacao.ts`, 178 linhas), `geometria2d.ts` (interseção, offset de um traço,
    aparar), `lancamento/entradaTeclado.ts` (distância, @dx,dy, polar), vento puro (`modelo/vento/pressao.ts`),
    desfazer genérico por patches (immer).
  - All Sec (`C:\CLAUDE\Projetos\All Sec`): motor puro `src/motor/**` — `verificar(s, N, Mx, My)` devolve
    fator = |MSd|/|MRd|, plano de deformação e domínio; seção poligonal livre com furos, barras como pontos com
    área; pilar com esbeltez (`pilar/`). ~12 ms por verificação. Validado contra SECC, P-Calc, SAP2000, OpenSees.
    **Limite:** a integração do concreto é parábola-retângulo em forma fechada (`flexao/integrar.ts`); trocar
    `sigmaCd` é um campo, mas o **bloco retangular 0,8x da alvenaria não é plugável sem mexer no código**.
    Sem ELS. Lógica de desenho **já desacoplada do A-PORT**: `src/ui/desenho/ima.ts` (ímã, 324), `rastreio.ts`,
    `teclado.ts`, `construir.ts`, `vista.ts` — pegar daqui, não do A-PORT.

## Os cinco princípios

1. **Trecho = a conta de hoje.** Um trecho é um par (entradas, modelo) exatamente como o muro atual. Nada na
   planilha sabe que existe obra. O que a obra faz é **preparar as entradas** de cada trecho (altura de solo,
   aterro da frente, comprimento, SPT sugerido) e **posicionar o modelo** dele no mundo.
2. **Herança em duas camadas.** `entradas do trecho = comum da obra ⊕ sobreposição do trecho ⊕ derivadas do
   terreno`. As derivadas (H_solo pelo perfil, h_fr, L pelo traçado) entram como **sugestão que o projetista
   aceita** ou como valor travado ao traçado (só o comprimento). Regra do José: julgamento de engenharia é
   entrada, não automático.
3. **Modelo local + pose.** `gerarModelo` não muda de sistema de eixos. Cada trecho ganha uma `Pose` (origem XY em
   mm da obra, ângulo em planta livre, cota Z do topo da sapata). Quem consome aplica a pose por fora: grupo no
   three, `IfcLocalPlacement` no IFC. Desenhos 2D continuam por trecho, no sistema local.
4. **Superfícies são funções z(x, y).** Terreno natural, terreno acabado e cada contato de camada de solo são TINs
   com a mesma interface (`cotaEm(x, y)`, `perfilAoLongo(polilinha)`). Volume = soma em malha regular da
   diferença entre duas superfícies. **Nada de booleana de sólidos** — é o caminho que quebra.
5. **Peça emprestada tem carimbo.** Código vindo do A-PORT ou do All Sec entra em `app/src/emprestado/<origem>/`
   com cabeçalho (repositório, commit, data) e os testes dele junto; um script lista o que divergiu da origem.
   Correção se faz na origem e se recopia. (Pacote comum entre os três repositórios: só quando a cópia doer.)

## Contrato novo (`app/src/obra/tipos.ts`) — rascunho

```ts
/** Tudo em mm e graus, no sistema da obra (origem local: ver `origem`). */
interface Obra {
  /** Ponto do DXF que virou (0,0,0): topografia em UTM tem coordenada de milhões e o three perde precisão. */
  origem: { x: number; y: number; z: number; unidadeDoDxf: 'm' | 'cm' | 'mm' }
  comum: { alteracoes: Alteracoes; extras: Record<string, Valor> }
  trechos: Trecho[]                 // ordem ao longo do traçado
  tracado: Tracado
  terreno?: Terreno
  sondagens?: Sondagem[]
  terraplenagem?: Terraplenagem
  pranchas: PranchasDoProjeto
}
interface Trecho {
  id: string                        // UUID: semente dos GUIDs do IFC deste trecho
  nome: string                      // "T1", editável
  alteracoes: Alteracoes            // só o que difere do comum
  extras: Record<string, Valor>
  lance: { deNo: string; ateNo: string }   // nós do traçado
  cotaDaBase: number                // Z do topo da sapata na obra
  aceitas: Record<string, Valor>    // sugestões do terreno/sondagem que o projetista aceitou (auditável)
}
interface Tracado {
  nos: { id: string; x: number; y: number; tipo: 'ponta' | 'junta' | 'degrau' | 'quina' | 'passagem' }[]
  ladoDoSolo: 'esquerda' | 'direita'       // em relação ao sentido do traçado
}
interface Terreno {
  fundos: FundoDxf[]                // camadas do DXF como referência (traços), com visível/cor
  pontos: { id: string; x: number; y: number; z: number; origem: 'dxf' | 'texto' | 'curva' | 'mao' }[]
  quebras: { pontos: string[] }[]   // linhas obrigatórias da triangulação (curvas de nível, cristas)
  limite?: { x: number; y: number }[]
}
interface Sondagem {
  id: string; nome: string; x: number; y: number; cotaDaBoca?: number
  camadas: { camada: string; ate: number }[]        // `camada` = id em Obra.camadasDeSolo; `ate` = profundidade
  spt: { prof: number; n: number }[]; nivelDagua?: number
}
interface Terraplenagem {
  platos: { id: string; contorno: { x: number; y: number }[]; cota: number; talude: number /* H:V */ }[]
  malha: number                     // lado do quadradinho do volume, mm
  empolamento: number
}
```

Derivados (nunca gravados): `resultado` e `modelo` por trecho, `Pose` por trecho, superfícies, volumes.
Arquivo: `.alrimo` versão 3 = a `Obra`. Versão 2 abre como obra de um trecho reto, sem terreno, com o `id` do
arquivo virando o `id` do trecho (os GUIDs do IFC de muros já entregues não mudam). Seguir a política de
`projeto.ts:50-54` (campo novo sem subir versão) daqui para frente.

## Etapas

Cada etapa é uma sessão (ou poucas) num ramo próprio, entra no main só com a prova passando e o José tendo visto
na tela. **Antes da etapa 2: o ramo `muro-de-cima` precisa estar no main** — reforma do alicerce com ramo comprido
aberto dá conflito em tudo.

### Etapa 0 — Fechar o que está aberto
- Juntar `muro-de-cima` e `horizontal-duas-faces` ao main (pendências deles ficam anotadas no caderno).
- Faxina já decidida em 13/10: **dividir o gerador da planilha por aba** (prova: `spec_planilha.json` e golden
  idênticos). Fazer agora — as etapas 1 e 4 acrescentam planilha.

### Etapa 1 — Dente armado (pequena, independente; boa para começar) — **FEITA em 15/11** (ramo `muro-de-cima`)
> Feita como descrito abaixo, com estas diferenças (detalhe no caderno, item "DENTE ARMADO"): a seção nova é a
> **11, no fim da aba Fundação** (depois da memória das fatias, para nada de cima mudar de endereço); o braço da
> resultante sai do trapézio p1–p2 (`y_den` = Mk/Ek, entre h/2 e 2h/3), não fixo em 2/3; o momento da raiz **não é
> somado** ao Md da sapata — virou verificação própria (`chk_tr_den`: Md + Vd·h + o que a sapata já tem na mesma
> face ≤ MRd com a armadura adotada), para a armadura de quem já tem dente não mudar; só o espaçamento do estribo é
> opcional (os dois Ø têm padrão); a quantidade das longitudinais sai da conta. O José ainda não viu na tela.
- **Planilha primeiro** (`tools/fundacao.py`, seção nova depois da biela): Ep de cálculo = passivo cheio na
  altura do dente (decisão 7), braço 2/3·h_den a partir da face de baixo da sapata; Md e Vd na raiz; seção
  100 × b_den; flexão NBR 6118 com As,mín; cortante por VRd1 (sem estribo de cortante); ancoragem das pernas na
  sapata (ℓb no concreto, `lbphi_c`); o momento da raiz somado à seção da sapata onde o dente nasce. Tração na
  face do dente voltada para a **ponta** (o solo da frente empurra o dente para trás). Tudo com nome definido
  (`*_den`), `IFERROR`, resumo `res_den` entrando nas verificações da fundação. Entradas: Ø e espaçamento do
  estribo do dente, Ø da longitudinal (opcionais, com automático).
- **Modelo** (`modulacao/barras.ts`, `entorno.ts`): estribo fechado vertical (a forma do estribo real que já
  existe), subindo até o cobrimento de cima da sapata; longitudinais nos cantos com o traspasse de `lbphi_c`.
  Papéis novos `DENTE_ESTRIBO`, `DENTE_LONG`.
- **Consumidores:** corte, armação da sapata (sombra do estribo do dente), lista de ferros, quantitativo, IFC.
- **Memória:** card `fundacao.dente` com desenho gerado (a força, o braço, a seção) no padrão dos desenhos da sapata.
- **Prova:** `testar.py`, `exportar_motor.py` + `golden.py` + `npx vitest run`; nenhum muro sem dente muda um
  bit; `barrasEmPecaSolida` limpo com dente em todas as posições de `x_den`.

### Etapa 1b — Diagrama de momentos em barras (pedido do José, 15/11) — **FEITA em 15/11** (ramo `muro-de-cima`)
> App: `app/src/esforcos/` — `barrasAnaliticas.ts` (pura: lê os nomes da tabela abaixo, só troca unidade, interpola
> entre nós e decide o lado), `cenaDosEsforcos.ts` (three: eixo, MSd cheio, contorno cheio na barra de verdade e
> TRACEJADO na esquemática, linha do MRd, vermelho além do MRd; `semMRd` = tudo vermelho), `VistaDeEsforcos.tsx`
> (câmera, cubo e mouse do visor; Aproveitamento/Valor, Valores, Muro em fantasma; clique → rótulo + valor e botão
> Memória, que abre o card — `useInterface.abrirNoCard`), `fotoDosEsforcos.ts` (imagem fora da tela para a prancha,
> cores de papel, fundo transparente; item `{ tipo: 'esforcos' }` no `ConteudoDoItem`, refeito como a foto do
> Realista — o desenhista recebeu a conta). Vista registrada como aba `esforcos` (pasta "Esforços" no navegador).
> Barras: balanço (`perf_Md` + `vt_Md` acima do solo, base + `M2d_us` = `Md_`, × `MRd_bal`); contraforte (este tipo
> `perf_Mdc`/`vt_Mdc`/`MRd_cf`, o outro `perf_Mdo`/`vt_Mdo`/`MRd_cfo`, extremidade × intermediário por `tipo_cf`);
> faixa vertical do painel (`Mdyei_p` na base, `M_pve` no vão, × `MRd_pvs`/`MRd_pve`, ESQUEMÁTICA); canaleta de cada
> fiada (`Mdx_p` no vão, `Mdxe_p` no apoio se > 0, × `MRd_ph`; o lado do apoio só tem MRd com barra centralizada ou
> 2 barras, ESQUEMÁTICA); cinta do topo (`Msd_cin` × `MRd_cin`, kN·m na faixa, ESQUEMÁTICA); painel não armado e
> subpainel (`Mpar`/`Mnor` × `MRp_pan`/`MRn_pan`; `_sp`), painéis A/B (`Mpa_p*`/`Mno_p*` × `MRp_p*`/`MRn_p*`),
> ESQUEMÁTICOS; ponta e talão (`T_e`/`T_Md`, `H_e`/`H_Md`, M = 0 na borda livre, × `MRd_toe`/`MRd_heel`; talão com
> Md negativo × `MRd_toe` — a mesma barra de baixo); dente (`p1_den`, `p2_den` integrados ao longo do dente e
> escalados para `Md_den` na raiz, × `MRd_den`); pilarete (`pt_y`/`pt_Md` × `MRd_pil`) e a ligação (`Md_pil` ×
> `MRd_lig` no traspasse `l0t_pil`, ESQUEMÁTICA). Memória: seção "Momento resistente com a armadura adotada" (cadeia
> `Fas_ → xas_ → Mas_ → xlim_ → Mlim_ → MRf_/MRd_ → ap_`) nos cards de flexão de cada peça e ftd·W nos não armados
> (`memoria/cards/momentoResistente.ts`), sem `verif`. Prova `esforcos/barrasAnaliticas.test.ts` (todos os
> cenários do gabarito).
> **PENDENTE:** a prancha leva IMAGEM (vetor e DXF ficam para depois); com a obra (etapa 2), uma malha por trecho na
> pose dele; a forma esquemática do painel vertical (zero a 1/4 da altura, pico a 5/8) é ilustrativa — a planilha
> não publica onde fica o pico; o dente sem conta (φ' da base em branco) não desenha barra. Diferenças
> barra × `chk_*` da aba que NÃO são erro (a aba confere mais que MSd ≤ MRd: As,mín, espaçamento, ductilidade):
> `chk_resiste`/`chk_res_cf` OK com a barra vermelha quando reprova ductilidade ou As (combinação conferida no teste);
> `chk_ph`, `chk_pvs`, `chk_fl_s`, `chk_fl_den` NÃO OK com a barra azul (As,mín, s < 5 cm etc.). O José ainda não viu
> na tela.
"Um diagrama 2D num esquema 3D com barras analíticas: as barras representando os contrafortes, as canaletas…
cada barrinha com o seu desenho de momento solicitante e momento resistente."
- **O que é:** vista nova na Gráfica ("Esforços"): o muro em arame — uma barra para cada peça que a conta
  dimensiona — e, rebatido no plano de flexão de cada barra, o diagrama de MSd (preenchido) com a linha de MRd por
  cima. Onde MSd passa de MRd, vermelho. Valor escrito nos picos. Gira como o 3D; clicar na barra leva ao card da
  memória dela.
- **Barras:** balanço → faixa vertical de 1 m; contraforte → uma barra vertical por contraforte (o de ponta e o
  do meio com a sua largura de influência); painel entre contrafortes → uma faixa vertical no meio do vão e uma
  barra horizontal em cada fiada de canaleta da conta (vão e apoios); cinta do topo; sapata → ponta e talão em
  balanço a partir da face do muro; dente; pilarete e cinta do muro de cima.
- **De onde vêm os números (nada de conta nova):** MSd ao longo da altura sai do perfil de 40 fatias que a
  planilha já tem (balanço e contraforte); MRd é o momento resistente da seção com a armadura adotada (degrau onde
  a armadura muda; zona de traspasse com a menor). **Limite a dizer na tela pelo traço, não por texto:** o painel
  é calculado por tabela de placa, não por barras — os picos (vão, apoio, borda) são os da conta; a forma entre
  eles é esquemática (traço fino/tracejado). Se a planilha não publica o MRd de alguma peça como célula, publicar
  (nome definido) antes — a tela não calcula.
- **Levantado em 15/11 (a planilha NÃO publica o que o diagrama precisa — é a 1ª metade da etapa):**
  nenhuma peça armada tem MRd de ELU como célula (as abas só comparam As,ef ≥ As,calc e x/d); o `Mr_` do ELS é
  momento de fissuração por faixa, não serve. Não há M ao longo da barra: o perfil de 40 fatias
  (`Solo e Empuxo` linhas 44–84; coluna L = M da fatia em torno da BASE, característico, por metro) e as 20
  fatias da ponta/talão (`T_dM`, `H_dM`, em torno da face) só dão o total.
- **PUBLICADO (15/11)** — só nomes e linhas novas, no fim de cada aba ou à direita do que se lê por endereço;
  todo nome que já existia ficou igual nos 81 cenários do gabarito (67.311 nomes e 149.769 células, zero
  diferença). MRd = a conta de As da própria aba DESFEITA com o aço adotado (F = As,ef·fsd = C → x → M = F·z),
  sem iteração, limitada pelo x que a verificação da aba confere (0,45d; onde a aba não confere ductilidade, o fim
  da conta, 1,25d). Ida e volta (o As da aba no MRd = As,ef) e "MRd ≥ MSd ⇔ verificações OK" conferidos nos 81
  cenários, sem exceção. Helper do gerador: `mrd_ret` (build_new.py); linhas de apoio de cada peça
  `Fas_*` (força no aço), `xas_*` (x com As,ef), `Mas_*`, `xlim_*`, `Mlim_*`, `MRf_*` (MRd na largura da conta, kN·cm).

  | Peça | MRd (unid.) | x no MRd | MSd que pareia | MSd/MRd | γf |
  |---|---|---|---|---|---|
  | Balanço, faixa 1 m (mesa/T real) | `MRd_bal` kN·m/m | `xM_bal` | `Md_` | `ap_bal` | já em `Md_` (γf·(Mk+Mk vento) + `M2d_us`; `Md_dec` = a soma, = `Md_`) |
  | Contraforte, este tipo (T/ret.) | `MRd_cf` kN·m | `xM_cf` | `Md_cf` | `ap_cf` | já em `Md_cf` |
  | Contraforte, o outro tipo (bm dele) | `MRd_cfo` kN·m | `xM_cfo` | `Md_cfo` (`Vd_cfo`, `binf_o`, `bm_cfo`, `tipo_cfo`) | `ap_cfo` | γf·`Mk_cfo` |
  | Contraforte, cortante | `VRd_cf` = mín(Vrd3; Vrd2) kN | — | `Vd_cf`, `Vd_cfo` | `apV_cf`, `apV_cfo` | já |
  | Painel vertical, barra do solo / de fora | `MRd_pvs` / `MRd_pve` kN·cm/m (iguais: mesma barra e d) | `xM_pv` | `M_pvs` / `M_pve` | `ap_pvs` / `ap_pve` | já (Libânio com γf) |
  | Painel horizontal (todas as canaletas) | `MRd_ph` kN·cm/m (`MRf_ph` na faixa s) | `xM_ph` | `M_ph` | `ap_ph` | já |
  | Canaleta do topo (cinta) | `MRd_cin` kN·cm na faixa s_ph | `xM_ph` | `Msd_cin` = Md_cin + Mde_cin | `ap_cin` | já |
  | Ponta / talão da sapata | `MRd_toe` / `MRd_heel` kN·m/m (talão 0 sem barra em cima, `sup_s`) | `xM_s` | `Md_ts` / `Md_hs` | `ap_toe` / `ap_heel` (`apV_s` = VSd/VRd1) | 1,4 FIXO (seção 7) |
  | Dente | `MRd_den` kN·m/m | `xM_den` | `Md_den` | `ap_den` | já |
  | Pilarete / ligação no arrimo | `MRd_pil` / `MRd_lig` kN·m | `xM_pil` / `xM_lig` | `Md_pil` | `ap_pil` / `ap_lig` | já |
  | Painel não armado do balanço | `MRp_pan` / `MRn_pan` kN·m/m (ftd·W) | — | `Mpar` / `Mnor` | `ap_ppan` / `ap_npan` | já (fd) |
  | Subpainel entre contrafortes | `MRp_sp` / `MRn_sp` kN·cm/m (`ftdp_sp`, `ftdn_sp` nomeados) | — | `Mpar_sp` / `Mnor_sp` | `ap_psp` / `ap_nsp` | já |
  | Painéis A/B do muro de cima | `MRp_pA`, `MRn_pA`, `MRp_pB`, `MRn_pB` kN·m/m | — | `Mpa_p*` / `Mno_p*` | `ap_ppA`… | já |

  **Ao longo da peça** (intervalos nomeados; nó 0 em cima/na ponta livre, base/face por último — exceto onde dito):
  perfil do solo (Solo e Empuxo O–Z, 41 nós, z = `perf_z`, y acima da base = `perf_y`): `perf_V`, `perf_M`
  (característicos, por metro; na base = `Vk_`, `Mk_` bit a bit), vento `perf_Mw` (balanço), `perf_Mwc` (este
  contraforte), `perf_Mwo` (o outro); de cálculo `perf_Md`/`perf_Vd` (balanço; + `M2d_us` só na base = `Md_`),
  `perf_Mdc`/`perf_Vdc` (= `Md_cf`/`Vd_cf` na base), `perf_Mdo`/`perf_Vdo` (o outro). Vento na altura inteira do
  muro (aba Muro de cima e vento, 11 nós do topo do muro à base): `vt_y`, `vt_Mw`/`vt_Vw`, `vt_Mc`/`vt_Vc`,
  `vt_Mo`/`vt_Vo`, de cálculo `vt_Md`, `vt_Mdc`, `vt_Mdo` (na base = `Mk_w`, `Mk_wcf`, `Mk_wcfo`) — acima do solo é
  a única carga; fórmula: y ≤ h solo → Vk_w·(h solo + h livre/2 − y); y > h solo → p_w·(h solo + h livre − y)²/2
  (contraforte: F_wpc·(h muro + h mc/2 − y) + o do arrimo exposto). Pilarete (11 nós do topo do muro de cima à
  base dele): `pt_y`, `pt_Mk`, `pt_Vk`, `pt_Md`, `pt_Vd` (na base = `Mk_pil`, `Md_pil`). Sapata (colunas H–L das
  fatias, 20 linhas; ponta: linha 1 = face; talão: linha 20 = face; a ponta livre, M = 0, não tem linha):
  `T_e`/`H_e` (distância da seção à face), `T_Mk`/`H_Mk` (na face = `Mk_toe`/`Mk_heel` bit a bit), `T_Vk`/`H_Vk`,
  de cálculo ×1,4 `T_Md`/`H_Md`, `T_Vd`/`H_Vd` (sem o máx(0; …) do Md da seção 7).
  **Vereditos com nome** (antes só rótulo): Contrafortes `chk_esb_cf`, `chk_hf_cf`, `chk_res_cf`, `chk_duc_cf`,
  `chk_As_cf`, `chk_Asx_cf`, `chk_bie_cf`, `chk_est_cf`, `chk_estj_cf`, `chk_els_cf`, `chk_gam_p`, `chk_pvs`,
  `chk_pve`, `chk_pvx`, `chk_ph`, `chk_spp`, `chk_spn`, `chk_spd`, `chk_els_p`, `chk_ab_p`, `chk_pos_p`,
  `chk_mc_cf`; Fundação `chk_fl_s` (flexão), `chk_v_s` (cortante), `chk_tor_s` e `chk_he_s` (torção),
  `chk_apoio_s`, `chk_cf_s`, `chk_tomb`, `chk_comp_s`, `chk_den_in`, `chk_den_s`.
  **A saber na tela:** os painéis (vertical, horizontal, canaleta do topo) e a sapata não têm verificação de
  ductilidade na planilha — o MRd deles é o da conta até x = 1,25d (o `xM_*` mostra o x); ponta e talão com a
  MESMA barra (o As principal é um só). Momento por canaleta não existe (um `M_ph` para todas): todas as barras horizontais levam o mesmo diagrama;
  posições das canaletas vêm do modelo. Leitura de intervalo no app: padrão de `memoria/desenhoDaSapata.ts:336`.
  Registro da vista: `estado/ligacoes.ts:45`, `store.ts:55`, `ui/Palco.tsx:29/42`, `ui/grafica/Navegador.tsx:47`,
  `integracao.tsx:38`; 3D em vetor da prancha: `desenhos/vista3d.ts:416`.
- **Como:** `app/src/esforcos/` — `barrasAnaliticas.ts` (pura: Resultado + Modelo → lista de barras com eixo,
  plano do diagrama e pontos MSd/MRd) e a vista em three reaproveitando o visor (linhas e faixas, sem sólidos;
  o muro em fantasma opcional). Vai para a prancha como o 3D em vetor. Com a obra (etapa 2 em diante), uma malha
  por trecho, na pose dele.
- **Prova:** cada pico do diagrama igual à célula da planilha nos alvos do golden; barra reprovada = verificação
  reprovada na memória (mesmo veredito).

### Etapa 2 — A obra com vários trechos (o alicerce; modelo mais forte + revisão adversarial)
Objetivo: trocar "um muro" por "obra com N trechos" **sem mudar nada do que se vê com N = 1**.
- `app/src/obra/`: `tipos.ts` (contrato acima), `entradasDoTrecho.ts` (a herança comum ⊕ trecho), `poses.ts`.
- `estado/store.ts`: `obra` no lugar de `alteracoes/extras`; `porTrecho: Record<id, {resultado, modelo, veredito,
  faltando, ajustesDeLista, erro…}>`; `trechoAtivo`. Seletores `useTrechoAtivo()` devolvem exatamente a forma que
  a tela de hoje consome — as telas de entradas, memória, desenhos e pranchas continuam lendo "o muro" (o ativo).
- Recalcular só o trecho mexido; mexida no `comum` recalcula todos. Guardar por chave das entradas resolvidas
  (dois trechos iguais = uma conta).
- Desfazer: a foto passa a ser da `obra` inteira (considerar trocar a foto por patches do immer, como o A-PORT,
  se a obra ficar pesada com terreno — medir antes).
- `projeto.ts`: versão 3 + leitura da 2.
- Veredito da obra = pior trecho; barra de estado diz qual.
- Tela nesta etapa: só um seletor de trecho discreto e "Duplicar trecho" (para poder testar N > 1 com trechos
  soltos, ainda sem traçado).
- **Prova:** suíte inteira verde sem tocar em gabarito; golden intocado; arquivo v2 de cada exemplo abre e
  resalva; IFC do exemplo com os mesmos GUIDs de antes; teste novo de obra com 3 trechos diferentes (cada um bate
  com o muro avulso equivalente, célula a célula).

### Etapa 3 — Implantação: traçado em planta e muro posicionado
- **Emprestar** do All Sec a lógica de desenho (`ima.ts`, `rastreio.ts`, `teclado.ts`, `construir.ts`, `vista.ts`)
  e do A-PORT `geometria2d.ts`. Polilinha livre é coisa nova (lá "polígono" é regular): cadeia de segmentos com
  nós compartilhados.
- **Tela** `ui/implantacao/`: palco em three com câmera ortográfica de topo (a mesma cena serve ao 3D da obra;
  DXF grande em SVG não aguenta). Faixa com os quatro passos; nesta etapa só **Traçado**: desenhar, mover nó,
  inserir/remover nó, tipo do nó, lado do solo, inverter sentido. Linha de comando na barra de estado ("clique o
  próximo ponto ou digite o comprimento"). Sem texto explicativo na tela.
- **Regras do traçado:** comprimento de cada lance preso ao módulo (o `L_total` modular que a conta já usa — some
  a entrada `L_total` quando há traçado: o comprimento é o do lance); `junta_cada` continua valendo dentro do
  trecho; nó `quina` só aceita 90° (por ora vira duas pontas encostadas — a amarração é a etapa 4); outros
  ângulos = `junta`.
- **Pose** de cada trecho a partir do lance e do lado do solo (o local Y aponta para o solo: lado do solo à
  esquerda do sentido inverte o X local — conferir a regra "X = 0 é a ponta esquerda vista da face aparente").
- **Consumidores com pose:** visor (um grupo por trecho; seleção e Armadura por trecho), IFC (um `IfcSite`, um
  agrupamento por trecho com o seu placement; GUID pela identidade do trecho), quantitativo (soma + por trecho).
- **Desenhos novos:** planta geral da obra (traçado, trechos numerados, juntas, eixo do corte de cada trecho) e
  **elevação desenvolvida** (as frontais dos trechos lado a lado na ordem do traçado). `PedidoDeVista` ganha
  `trecho` (padrão: o ativo) e os dois tipos novos; registrar onde o levantamento apontou (`TIPOS_2D`,
  `NOMES_DO_CONTEUDO`, `ESCALA_INICIAL`, `ID_DE_FABRICA`, `PASTAS_2D`, `TipoDeVista`).
- **Trilho:** seção nova "Implantação"; "Entradas" vira "Muros" com as duas camadas (comum × trecho) e a marca de
  campo sobreposto. Muro simples ("Novo") nasce com um trecho reto e sem passar pela Implantação.
- **Prova:** obra em U de três trechos com junta: cada peça no lugar (teste de caixa envolvente por trecho), IFC
  no validador, nenhuma interpenetração entre trechos vizinhos, quantitativo = soma dos avulsos.

### Etapa 4 — Quina a 90° (prioridade dos dois clientes; depende das decisões 1–3)
Em duas metades, a geometria antes da conta.
- **4a · Montagem:** amarração de canto na modulação (linha nova na tabela de encaixes; bloco 19: canto fecha no
  módulo de 20; bloco 14: canto com o bloco de 34 — **o José modela o gabarito no Revit**, como fez com os
  contrafortes, e o teste-selo confere peça a peça); furos do canto grauteados; barra horizontal das canaletas
  virando o canto (em L para os dois lados, ancoragem conferida como a perna do U); sapata do canto (união das
  duas, sem contar concreto e solo duas vezes; armadura das duas direções cruzando); muro de cima e pilarete de
  canto. Terra por dentro × por fora muda de que lado fica o talão no canto.
- **4b · Conta:** *planilha* — a quina como contraforte: seleção "ponta do trecho = quina" troca o contraforte de
  ponta pela outra perna (enterrado se a terra está por dentro do L, aparente se por fora), com o comprimento
  colaborante limitado (ponto de partida: os limites de mesa que a planilha já usa, 6t e h/3 — **dedução, levar ao
  José com fonte**); armadura horizontal de ligação para a reação do painel no canto (tração na terra por dentro).
  No balanço (decisão 2): pernas calculadas como hoje + verificação do canto. *Motor complementar*
  (`app/src/secao/`, emprestado do All Sec): canto em L sob N + Mx + My. Exige **antes, no All Sec**: lei de
  alvenaria no integrador (bloco retangular 0,8x, fd por região — alma grauteada fpk*, mesa fpk vazado —,
  encurtamento último da NBR 16868-1, **conferir na norma**), validada reproduzindo, em flexão reta, o Mr da
  planilha do Al-rimo (balanço e contraforte) dentro de 1 %. Só então copiar com carimbo.
  Pilarete de concreto de canto: `verificar` do All Sec direto (uso nativo), vento nas duas direções.
- **Memória:** card da quina com a seção desenhada, barras, linha neutra inclinada, fator; e a linha de
  conferência "em uma direção" contra a célula da planilha.
- **Prova:** gabarito do Revit; flexão reta All Sec × planilha; casos da quina nos dois sentidos da terra; os dois
  muros dos clientes (Rodrigo e Joames) como casos de conferência assim que os dados chegarem.

### Etapa 5 — Níveis: degraus e perfil ao longo do muro (ainda sem DXF)
- Terreno mínimo: pontos cotados digitados/colados (tabela X, Y, Z) ou **cota do terreno por estaca ao longo do
  traçado** (natural e acabado, dos dois lados do muro). Já usa o contrato `Terreno` (pontos + TIN simples).
- `obra/perfil.ts`: perfil desenvolvido — natural, acabado atrás, acabado na frente, topo do muro, base de cada
  trecho.
- Tela: faixa do perfil embaixo da planta (clicar escolhe o trecho; arrastar a base ou o topo em passos de 20).
- **Proposta automática de degraus:** parâmetros = comprimento mínimo de trecho (módulo), degrau (múltiplo de
  20), embutimento mínimo da sapata, altura máxima (3,0 / 4,0). Devolve nós `degrau` e `cotaDaBase`; o projetista
  edita. Topo do muro: nivelado ou acompanhando.
- Derivadas por trecho (sugestões a aceitar): `H_solo` = maior altura de solo no trecho (decisão 5), `h_fr` = menor
  aterro da frente no trecho, `H_muro` na fiada.
- Encontro em degrau: junta (decisão 4); aviso quando a sapata de cima cai dentro da linha de influência da de
  baixo (NBR 6122, fundações em cotas diferentes — **conferir o item e os ângulos na norma antes de escrever**).
- Terreno do 3D por trecho passa a ler o perfil (hoje é prisma plano): `entorno.ts terreno` recebe as cotas nas
  duas pontas do trecho.
- **Prova:** terreno em rampa conhecida → degraus e H_solo previstos à mão; fiadas dos dois lados de cada degrau
  casando; elevação desenvolvida com os degraus.

### Etapa 6 — Topografia por DXF
- **Leitor** (`app/src/topografia/lerDxf.ts`, sobre o leitor emprestado do A-PORT, lib `dxf`): além dos traços do
  fundo, extrair POINT (com Z), TEXT/MTEXT (posição + texto), elevação de LWPOLYLINE (código 38) e Z dos vértices
  de POLYLINE 3D, INSERT com atributos (bloco de ponto de estação total com a cota no atributo), 3DFACE (TIN que
  já vem pronta). Unidade por `$INSUNITS` ou perguntada. Escolha da origem local na importação.
- **Classificação por camada** (pura, testável): `curvas com cota` / `pontos com cota` / `textos numéricos` /
  `TIN pronta` / `referência`. Casamento texto → ponto: número dentro do intervalo plausível, marcador mais perto
  dentro de um raio (ponto, cruz, círculo, inserção de bloco), um para um; sobra vira lista de pendência.
- **Ferramentas:** cerca (numerar curvas em sequência), dar cota a uma curva, ponto à mão, apagar, colar tabela.
  Conferência: pontos coloridos por cota; destoante acende (cota fora da faixa dos vizinhos na triangulação).
- **Superfície** (`topografia/superficie.ts`): Delaunay com restrições (emprestado do A-PORT) — curvas de nível
  simplificadas (Douglas–Peucker, tolerância como parâmetro) entram como linhas de quebra. **Medir a triangulação
  do A-PORT com 20–50 mil pontos**; se não aguentar, trocar por `delaunator` + `cdt2d` atrás da mesma interface.
  Defeito conhecido a tratar depois: triângulo plano com os três vértices na mesma curva.
  Interface: `cotaEm`, `perfilAoLongo`, `recortar(limite)`. Índice espacial para consulta.
- **3D:** sólido do terreno (superfície + saia até uma cota de fundo), curvas geradas da própria superfície para
  conferir contra as do DXF.
- **Arquivo:** o fundo guarda só as camadas ligadas; avisar tamanho.
- **Prova:** quatro DXF de exemplo construídos (curvas com cota; pontos 3D; pontos + texto; curvas sem cota +
  cerca) e **pelo menos dois reais do José**; superfície de plano inclinado reproduz a cota em qualquer ponto;
  tempo de importação e de triangulação medidos na produção (`ABRIR_RAPIDO.bat`).

### Etapa 7 — Sondagens e camadas de solo
- Cadastro de camadas da obra (nome, tipo de solo, cor — hachuras do corte já existentes como opção).
- Furo: tabela de camadas e de SPT, NA; posição por clique ou X/Y; boca pela superfície.
- `sondagem/camadas.ts`: para cada contato entre camadas, uma superfície — 1 furo: plano horizontal; 2: plano
  interpolado na linha dos furos; ≥ 3: TIN dos furos, extrapolado plano para fora. Camada ausente num furo =
  espessura zero ali. Contatos nunca se cruzam (a de baixo é limitada pela de cima).
- **Saídas:** corte de cada trecho e elevação desenvolvida com as camadas e o NA; 3D com as camadas nas faces
  cortadas do sólido do terreno; perfil do furo desenhado (o boletim) como vista para a prancha.
- **Sugestões por trecho** (verdes, aceitar = gravar em `aceitas`): SPT médio na faixa abaixo da cota da base
  (critério de faixa como entrada), tipo de solo na base (liga com as tabelas de argila/areia que a planilha já
  tem), posição do NA em relação à base.
- **Prova:** três furos com contatos em plano conhecido; furo único; camada que some; sugestão × conta à mão.

### Etapa 8 — Corte e aterro
- Platô = polígono + cota + talude da borda; superfície acabada = natural modificada pelos platôs e pela faixa do
  muro (atrás: cota do aterro do trecho; na frente: cota do terreno da frente).
- `terraplenagem/volume.ts`: malha regular (padrão 25 cm, entrada), prisma por célula, corte e aterro separados,
  por platô e total; empolamento; escavação da sapata/dente/dreno do muro à parte (sai do modelo).
- 3D: superfície acabada com mapa corte/aterro; linha de encontro (off-set) na planta.
- Quantitativo: tabela "Movimento de terra"; vai para a prancha como as outras tabelas.
- **Prova:** plano × plano (volume exato à mão), cunha, platô em terreno inclinado; convergência com a malha
  (25 cm × 10 cm < 1 %).

### Etapa 9 — Acabamento da tela e das pranchas
- Resumo da obra na Memória; memorial único (rosto + resumo + um capítulo por trecho, trechos iguais agrupados).
- Pranchas: planta de implantação com topografia, elevação desenvolvida cotada, quadro de trechos, perfis de
  sondagem; DXF com camadas novas (`TOPOGRAFIA`, `SONDAGEM`, `TRACADO`…) em `camadasDxf.ts`.
- Entradas por figuras: figuras das entradas novas na régua comum (`figs/app/applib.py`).
- Passada de ergonomia com o José na tela: ordem dos passos, o que some no muro simples, atalhos.

## Dependências entre etapas

```
0 ─► 1 (dente)
0 ─► 2 (obra) ─► 3 (traçado) ─► 4 (quina)
                           └─► 5 (níveis) ─► 6 (DXF) ─► 7 (sondagem)
                                                   └─► 8 (corte/aterro)
tudo ─► 9
```
A lei de alvenaria no All Sec (pré-requisito da 4b) é uma sessão no repositório do All Sec e pode correr em
paralelo com a 2 e a 3.

## Riscos e como cada um é contido

| Risco | Contenção |
|---|---|
| Etapa 2 quebrar o que está validado | Critério único: N = 1 idêntico (suíte, golden, GUIDs). Sem tela nova junto. |
| Custo de conta com muitos trechos | Conta por trecho com chave das entradas; só o mexido recalcula; medir obra de 20 trechos na produção. |
| DXF de topografia fora do padrão | Classificação mostra o que entendeu antes de aceitar; tudo editável à mão; caminho sem DXF sempre disponível. |
| Coordenada UTM estourando a precisão do 3D | Origem local obrigatória na importação (`Obra.origem`); tudo guardado relativo. |
| Quina "aproveitada" sem fonte | Comprimento colaborante e hipótese de apoio marcados como dedução; decisão 2 mantém o balanço conservador. |
| Flexão oblíqua fora da planilha | Conferência em flexão reta contra a célula; motor com os oráculos do All Sec copiados junto. |
| Três cópias da mesma peça divergindo | Carimbo de origem + script de divergência; correção sempre na origem. |
| Camada de solo inferida tratada como dado | Sempre "inferido" no desenho; só entra na conta por sugestão aceita e registrada. |

## Fora deste plano (anotado para não se perder)

- Talude atrás do muro na conta (decisão 6) — etapa de planilha com fonte.
- Traçado curvo; quina fora de 90° amarrada.
- Muro em mais de uma fila (patamares) e estabilidade global do talude.
- Sapata sobre molas / elementos finitos (ramo `sapata-molas`, referência).
- Pacote comum entre A-PORT, All Sec e Al-rimo.
