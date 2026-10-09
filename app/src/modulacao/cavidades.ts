/*
  CAVIDADES — os vazios que levam graute, fiada a fiada: furos dos blocos e o miolo das canaletas.

  Servem a três perguntas, todas pela MESMA conta (distância com sinal à borda do furo):
    1. a barra vertical cai dentro de um furo em toda fiada que ela atravessa? (senão, ela é puxada para dentro e
       o desenho avisa que o d mudou);
    2. qual é o cobrimento de graute entre a barra e a parede do bloco? (aviso abaixo de 15 mm — ABCP);
    3. quais furos levam graute no grauteamento parcial (os que têm barra).
*/
import { H_FIADA } from './catalogo';
import { distanciaAoFuro } from './perfis';

export interface Cavidade {
  tipo: 'furo' | 'canaleta';
  cx: number; cy: number;     // centro, global (mm)
  a: number; b: number;       // meias-medidas em X e em Y
  r: number;                  // raio dos cantos
  peca: number;               // índice da peça hospedeira em Modelo.pecas
  furo: number;               // índice do furo na geometria da hospedeira (−1 na canaleta)
  grauteada: boolean;
}

/** Cavidades de um trecho, por fiada, ordenadas por xmin (busca binária). */
export class MapaDeCavidades {
  private porFiada: Cavidade[][];
  private maiorA = 0;

  constructor(nFiadas: number) {
    this.porFiada = Array.from({ length: nFiadas }, () => []);
  }

  add(i: number, c: Cavidade): void {
    this.porFiada[i].push(c);
    this.maiorA = Math.max(this.maiorA, c.a);
  }

  ordenar(): void {
    for (const f of this.porFiada) f.sort((u, v) => u.cx - u.a - (v.cx - v.a) || u.cy - v.cy);
  }

  fiada(i: number): readonly Cavidade[] {
    return this.porFiada[i] ?? [];
  }

  get nFiadas(): number {
    return this.porFiada.length;
  }

  /** A cavidade que melhor contém o ponto (mais para dentro) na fiada i, e a distância com sinal à borda. */
  achar(i: number, x: number, y: number): { cav: Cavidade; d: number } | null {
    const f = this.porFiada[i];
    if (!f || !f.length) return null;
    // primeira cavidade com xmin > x
    let lo = 0;
    let hi = f.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (f[mid].cx - f[mid].a <= x) lo = mid + 1;
      else hi = mid;
    }
    let melhor: { cav: Cavidade; d: number } | null = null;
    for (let k = lo - 1; k >= 0; k--) {
      const c = f[k];
      if (c.cx - c.a < x - 2 * this.maiorA) break;
      if (x > c.cx + c.a || y < c.cy - c.b || y > c.cy + c.b) continue;
      const d = distanciaAoFuro(x - c.cx, y - c.cy, c.a, c.b, c.r);
      if (!melhor || d < melhor.d - 1e-9) melhor = { cav: c, d };
    }
    return melhor && melhor.d <= 1e-6 ? melhor : null;
  }

  /** Fiadas atravessadas por um trecho vertical [z0, z1]. */
  fiadasEntre(z0: number, z1: number): number[] {
    const out: number[] = [];
    const n = this.porFiada.length;
    for (let i = Math.max(0, Math.floor(z0 / H_FIADA)); i < n && i * H_FIADA < z1 - 1e-6; i++) {
      if ((i + 1) * H_FIADA > z0 + 1e-6) out.push(i);
    }
    return out;
  }

  /**
   * Menor folga (mm) entre a superfície da barra e a parede do furo, nas fiadas atravessadas.
   * −Infinity se em alguma fiada o centro da barra não cai em cavidade nenhuma.
   */
  folga(x: number, y: number, raio: number, z0: number, z1: number): number {
    let f = Infinity;
    for (const i of this.fiadasEntre(z0, z1)) {
      const a = this.achar(i, x, y);
      if (!a) return -Infinity;
      f = Math.min(f, -a.d - raio);
    }
    return f;
  }

  /** Marca como grauteadas as cavidades que a barra atravessa. */
  marcar(x: number, y: number, z0: number, z1: number): void {
    for (const i of this.fiadasEntre(z0, z1)) {
      const a = this.achar(i, x, y);
      if (a) a.cav.grauteada = true;
    }
  }
}
