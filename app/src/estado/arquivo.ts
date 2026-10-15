// ═══════════════════════════════════════════════════════════════════════════
//  estado/arquivo.ts — a conversa com o disco
// ---------------------------------------------------------------------------
//  Dois caminhos, e o app escolhe sozinho:
//   · navegador com a janela de arquivo do sistema (Chrome/Edge): abre e salva
//     NO MESMO arquivo, como programa de desktop — Ctrl+S grava por cima;
//   · os outros: abrir pelo seletor de arquivo e salvar como DOWNLOAD (cada
//     Salvar baixa uma cópia, que é o que o navegador permite).
//  O resto do app não sabe qual dos dois foi usado.
// ═══════════════════════════════════════════════════════════════════════════

/* A janela de arquivo do sistema (File System Access) ainda não está nos tipos
   do TypeScript; só o pedaço que usamos. */
interface AlcaDeArquivo {
  name: string;
  getFile(): Promise<File>;
  isSameEntry?(outra: AlcaDeArquivo): Promise<boolean>;
  createWritable(): Promise<{ write(d: Blob | string): Promise<void>; close(): Promise<void> }>;
}
interface TipoDeArquivo {
  description: string;
  accept: Record<string, string[]>;
}
interface JanelaComArquivos {
  showOpenFilePicker?: (o: { types: TipoDeArquivo[]; multiple?: boolean }) => Promise<AlcaDeArquivo[]>;
  showSaveFilePicker?: (o: { suggestedName: string; types: TipoDeArquivo[] }) => Promise<AlcaDeArquivo>;
}

export type Alca = AlcaDeArquivo;

const TIPO_ALRIMO: TipoDeArquivo = { description: 'Muro do Al-rimo', accept: { 'application/json': ['.alrimo'] } };

const janela = () => window as unknown as JanelaComArquivos;

/** O usuário fechou a janela de arquivo — não é erro, é desistência. */
export function foiCancelado(e: unknown): boolean {
  return e instanceof DOMException && (e.name === 'AbortError' || e.name === 'NotAllowedError');
}

export async function abrirDoDisco(): Promise<{ texto: string; nome: string; alca: Alca | null } | null> {
  const w = janela();
  if (w.showOpenFilePicker) {
    const [alca] = await w.showOpenFilePicker({ types: [TIPO_ALRIMO], multiple: false });
    if (!alca) return null;
    const f = await alca.getFile();
    return { texto: await f.text(), nome: f.name, alca };
  }
  const f = await escolherPeloSeletor('.alrimo,application/json');
  return f ? { texto: await f.text(), nome: f.name, alca: null } : null;
}

/** O destino escolhido é o arquivo que está aberto? Pela alça quando o navegador sabe dizer; senão, pelo nome. */
async function mesmoArquivo(destino: AlcaDeArquivo, aberto: { alca: Alca | null; nome: string | null }): Promise<boolean> {
  if (aberto.alca?.isSameEntry) {
    try {
      return await aberto.alca.isSameEntry(destino);
    } catch {
      // alça velha (arquivo movido ou apagado): o nome decide
    }
  }
  return aberto.nome !== null && destino.name === aberto.nome;
}

/**
 * Grava. Com alça, por cima do mesmo arquivo; sem, pergunta onde (ou baixa). O texto só é montado depois de escolhido
 * o destino: `montar(mesmoArquivo)` diz se ele é o arquivo aberto (`aberto`) — a identidade do muro depende de ONDE ele
 * vai, não da tecla (acoesDeArquivo.ts, salvarProjeto). No download o navegador escolhe o nome; o sugerido é o do
 * arquivo aberto, então vale como o mesmo.
 */
export async function salvarNoDisco(
  montar: (mesmoArquivo: boolean) => string,
  nomeSugerido: string,
  alca: Alca | null,
  aberto: { alca: Alca | null; nome: string | null },
): Promise<{ nome: string; alca: Alca | null }> {
  const w = janela();
  let destino = alca;
  let mesmo = alca !== null;
  if (!destino && w.showSaveFilePicker) {
    destino = await w.showSaveFilePicker({ suggestedName: nomeSugerido, types: [TIPO_ALRIMO] });
    mesmo = await mesmoArquivo(destino, aberto);
  }
  if (destino) {
    const texto = montar(mesmo);
    const s = await destino.createWritable();
    await s.write(texto);
    await s.close();
    return { nome: destino.name, alca: destino };
  }
  baixar(montar(aberto.nome !== null && nomeSugerido === aberto.nome), nomeSugerido, 'application/json');
  return { nome: nomeSugerido, alca: null };
}

/** Entrega um arquivo como download (IFC, ou o .alrimo onde não há janela de arquivo). */
export function baixar(conteudo: string, nome: string, tipo: string): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // O navegador precisa da URL viva até o download começar.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function escolherPeloSeletor(aceita: string): Promise<File | null> {
  return new Promise((resolver) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = aceita;
    input.onchange = () => resolver(input.files?.[0] ?? null);
    // Fechar o seletor sem escolher: o evento `cancel` existe nos navegadores atuais.
    input.addEventListener('cancel', () => resolver(null));
    input.click();
  });
}
