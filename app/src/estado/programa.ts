// ═══════════════════════════════════════════════════════════════════════════
//  estado/programa.ts — a ponte com o programa instalado (instalador/)
// ---------------------------------------------------------------------------
//  O mesmo app roda no navegador e dentro do programa instalado (Electron). No
//  programa, o preload (instalador/preload.js) põe `window.alrimoPrograma`:
//  disco pelos diálogos do Windows, PDF direto em arquivo, arquivo .alrimo
//  aberto com duplo clique. No navegador ela não existe e tudo segue pelo
//  caminho de sempre — quem chama pergunta `ponteDoPrograma()` e decide.
// ═══════════════════════════════════════════════════════════════════════════

/** Um .alrimo lido do disco pelo programa. */
export interface ArquivoDoPrograma {
  caminho: string;
  nome: string;
  texto: string;
}

export interface PonteDoPrograma {
  /** Diálogo "Abrir" do Windows. null = desistiu. */
  abrirProjeto(): Promise<ArquivoDoPrograma | null>;
  /** Diálogo "Salvar como" do Windows (só escolhe; quem grava é gravarArquivo). null = desistiu. */
  escolherDestino(nomeSugerido: string): Promise<{ caminho: string; nome: string } | null>;
  lerArquivo(caminho: string): Promise<string>;
  gravarArquivo(caminho: string, texto: string): Promise<void>;
  /** A página como está agora (com o CSS de impressão) vira PDF em arquivo; o programa abre o PDF depois. */
  gravarPdf(nomeSugerido: string): Promise<{ caminho: string } | null>;
  aoAbrirArquivo(cb: (a: ArquivoDoPrograma) => void): void;
  pronto(): void;
  informarEstado(e: { sujo: boolean; titulo: string }): void;
  aoPedirSalvarEFechar(cb: () => void): void;
  fechar(): void;
}

export function ponteDoPrograma(): PonteDoPrograma | null {
  const g = globalThis as { alrimoPrograma?: PonteDoPrograma };
  return g.alrimoPrograma ?? null;
}

/** O usuário desistiu no diálogo do Windows: o mesmo erro que o navegador dá, para o resto do app tratar igual. */
export function desistencia(): DOMException {
  return new DOMException('O usuário desistiu', 'AbortError');
}
