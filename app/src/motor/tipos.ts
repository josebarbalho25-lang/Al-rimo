/*
  O CONTRATO DO MOTOR — o que o resto do app enxerga da conta.

  A conta do app É a planilha: `planilha.gerada.json` (exportado por tools/exportar_motor.py a partir do
  build_new.py) traz todas as células — constantes e fórmulas — e os nomes definidos. O avaliador de fórmulas
  (motor/excel/) calcula como o Excel calcularia. Ninguém fora do motor recalcula nada: memória, 3D, desenhos,
  quantitativo e IFC LEEM daqui pelo nome definido (o mesmo nome que o Jose vê na planilha).
*/

/** Erro de fórmula do Excel (#DIV/0!, #VALOR!, #N/D...). Viaja como valor, como no Excel. */
export interface ErroExcel {
  readonly erro: '#DIV/0!' | '#VALUE!' | '#N/A' | '#NUM!' | '#REF!' | '#NAME?' | '#NULL!';
}

/** Valor de uma célula. `null` = célula vazia. */
export type Valor = number | string | boolean | null | ErroExcel;

/** Uma entrada da aba Entradas, como o formulário do app a mostra. */
export interface EntradaMeta {
  nome: string;            // nome definido (H_muro, t_bloco...)
  rotulo: string;          // coluna A
  padrao: Valor;           // valor de fábrica (exemplo da aula 12.2)
  unidade: string;         // coluna C
  nota: string;            // coluna D — NÃO vai para a tela como texto (regra do Jose); no máximo dica ao pairar
  figura: string | null;   // 'Fig. 12' → figs/fig12_*.svg
  opcoes: Valor[] | null;  // lista da validação de dados (combo); null = campo livre (ou lista dependente, abaixo)
  /**
   * Lista que DEPENDE de outra entrada (a altura do tipo de muro; o vão, o contraforte e os espaçamentos do bloco):
   * o intervalo da aba Referências cujas células são fórmula ('Referências!AK5:AK21'). As opções são as células
   * desse intervalo no Resultado atual, sem as vazias e sem "—". Ausente = lista fixa (`opcoes`) ou campo livre.
   */
  opcoesRef?: string;
  formato: string;         // formato numérico do Excel ('0.00', '0', 'General')
  secao: string;           // faixa da aba Entradas em que a linha está (Geometria, Solo e cargas...)
  ref: string;             // 'Entradas!B6'
}

/** O arquivo exportado da planilha. */
export interface PlanilhaExportada {
  versao: string;                       // hash do gerador: muda quando a conta muda
  abas: string[];
  nomes: Record<string, string>;        // nome → 'Aba!B6' ou 'Aba!L5:L10'
  entradas: EntradaMeta[];
  celulas: Record<string, Valor | string>;  // 'Aba!B6' → constante, ou fórmula começando com '='
}

/** O que o usuário mudou em relação ao padrão, por nome definido. `null` = deixar em branco (opcional). */
export type Alteracoes = Record<string, Valor>;

/** O resultado de uma conta: leitura por nome definido ou por endereço. */
export interface Resultado {
  /** Valor de um nome definido de célula única. Lança erro se o nome não existir (nome errado é defeito, não "—"). */
  v(nome: string): Valor;
  /** Número do nome, ou null se for texto, vazio, "—" ou erro. */
  num(nome: string): number | null;
  /** Valor por endereço: 'Contrafortes!B40'. */
  cel(ref: string): Valor;
  /** As alterações que geraram este resultado. */
  readonly alteracoes: Alteracoes;
}
