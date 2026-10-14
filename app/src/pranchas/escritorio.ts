/*
  OS DADOS DO ESCRITÓRIO (Jose, 14/10: "o carimbo do escritório guardado no app") — empresa, responsável, CREA e a
  logomarca, preenchidos uma vez e usados em todo projeto. Ficam na máquina (localStorage), não no arquivo do muro:
  o mesmo muro aberto por outro escritório sai com o carimbo DELE.

  A logo entra sempre como PNG: o DXF só vincula imagem de bitmap (SVG não abre como imagem no CAD), então a logo
  em SVG ou JPG é desenhada num canvas e guardada em PNG já na hora de subir.
*/
import { create } from 'zustand';
import { guardar, lembrar } from '@/estado/lembrete';
import type { DadosDoEscritorio } from './tipos';

const CHAVE = 'alrimo.escritorio.v1';

export const ESCRITORIO_EM_BRANCO: DadosDoEscritorio = { empresa: '', responsavel: '', crea: '', contato: '', logo: null, logoLargura: 34 };

function ehEscritorio(x: unknown): x is DadosDoEscritorio {
  const o = x as Record<string, unknown> | null;
  return !!o && typeof o === 'object' && typeof o.empresa === 'string' && typeof o.responsavel === 'string' && typeof o.crea === 'string';
}

interface EstadoDoEscritorio {
  dados: DadosDoEscritorio;
  mudar: (parcial: Partial<DadosDoEscritorio>) => void;
}

export const useEscritorio = create<EstadoDoEscritorio>()((set, get) => ({
  dados: { ...ESCRITORIO_EM_BRANCO, ...lembrar<DadosDoEscritorio | null>(CHAVE, null, (x): x is DadosDoEscritorio | null => x === null || ehEscritorio(x)) },
  mudar(parcial) {
    const dados = { ...get().dados, ...parcial };
    set({ dados });
    guardar(CHAVE, dados);
  },
}));

/** Lê um arquivo de imagem e devolve um PNG (data URL) de no máximo `lado` px no lado maior. */
export function logoEmPng(arquivo: File, lado = 800): Promise<string> {
  return new Promise((ok, falha) => {
    const leitor = new FileReader();
    leitor.onerror = () => falha(new Error('não foi possível ler a imagem'));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => falha(new Error('imagem inválida'));
      img.onload = () => {
        const k = Math.min(1, lado / Math.max(img.naturalWidth || lado, img.naturalHeight || lado));
        const w = Math.max(1, Math.round((img.naturalWidth || lado) * k));
        const h = Math.max(1, Math.round((img.naturalHeight || lado) * k));
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d');
        if (!g) return falha(new Error('sem canvas'));
        g.drawImage(img, 0, 0, w, h);
        ok(c.toDataURL('image/png'));
      };
      img.src = String(leitor.result);
    };
    leitor.readAsDataURL(arquivo);
  });
}
