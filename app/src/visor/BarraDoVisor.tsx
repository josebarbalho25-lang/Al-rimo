// ═══════════════════════════════════════════════════════════════════════════
//  visor/BarraDoVisor.tsx — a barra de baixo do visor: só ícone, dica curta
// ---------------------------------------------------------------------------
//  Molde: a barra da vista do A-PORT (`ui/BarraDaVista.tsx`, canto de baixo
//  do palco). Vistas · Enquadrar · Mostrar/ocultar · Armadura · Corte ·
//  Estilo (Cores, Realista, Opaco) · Foto.
//  Mostrar/ocultar abre uma lista de GRUPOS com o nome de cada um (rótulo +
//  controle): sete ícones inventados para Graute, Drenagem, Terreno... seriam
//  sete adivinhações.
//  O ESTILO são três botões lado a lado, um aceso: trocar é um clique, e o
//  Jose compara um estilo com o outro indo e voltando — num menu seriam dois.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { VistaNomeada } from './enquadrar';
import { ESTILOS_VISUAIS, type EstiloVisual } from './estiloVisual';
import {
  IconeCamadas,
  IconeCorte,
  IconeEnquadrar,
  IconeEstiloCores,
  IconeEstiloOpaco,
  IconeEstiloRealista,
  IconeFoto,
  IconeFrente,
  IconeIso,
  IconeLateral,
  IconeArmadura,
  IconeTopo,
} from './icones';
import { CATEGORIAS, type Categoria } from './lotes';

const ICONE_DO_ESTILO: Record<EstiloVisual, () => ReactNode> = {
  cores: () => <IconeEstiloCores />,
  realista: () => <IconeEstiloRealista />,
  opaco: () => <IconeEstiloOpaco />,
};

function Botao({ titulo, on, desligado, aoClicar, acao, children }: { titulo: string; on?: boolean; desligado?: boolean; aoClicar: () => void; acao: string; children: ReactNode }) {
  return (
    <button type="button" className={`v3-btn${on ? ' on' : ''}`} title={titulo} aria-label={titulo} aria-pressed={on} disabled={desligado} data-acao={acao} onClick={aoClicar}>
      {children}
    </button>
  );
}

const Fio = () => <span className="v3-fio" />;

export interface PropsDaBarra {
  aoVista: (v: VistaNomeada) => void;
  aoEnquadrar: () => void;
  ocultas: ReadonlySet<Categoria>;
  /** Grupos que existem neste muro (balanço não tem contraforte): os outros ficam apagados na lista. */
  presentes: ReadonlySet<Categoria>;
  aoAlternar: (c: Categoria) => void;
  armadura: boolean;
  aoArmadura: () => void;
  corte: boolean;
  aoCorte: () => void;
  aoFoto: () => void;
  estilo: EstiloVisual;
  aoEstilo: (e: EstiloVisual) => void;
  /** O controle do corte (campo + régua), que aparece ao lado quando o corte está ligado. */
  extra?: ReactNode;
}

export function BarraDoVisor(p: PropsDaBarra) {
  const [menu, setMenu] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  // Clique fora fecha a lista (não há nada a perder nela).
  useEffect(() => {
    if (!menu) return;
    const fora = (e: PointerEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setMenu(false);
    };
    window.addEventListener('pointerdown', fora, true);
    return () => window.removeEventListener('pointerdown', fora, true);
  }, [menu]);

  const algumaOculta = CATEGORIAS.some((c) => p.presentes.has(c.id) && p.ocultas.has(c.id));

  return (
    <div className="v3-barra" onPointerDown={(e) => e.stopPropagation()}>
      <Botao titulo="Frente" acao="frente" aoClicar={() => p.aoVista('frente')}>
        <IconeFrente />
      </Botao>
      <Botao titulo="Lateral" acao="lateral" aoClicar={() => p.aoVista('lateral')}>
        <IconeLateral />
      </Botao>
      <Botao titulo="Topo" acao="topo" aoClicar={() => p.aoVista('topo')}>
        <IconeTopo />
      </Botao>
      <Botao titulo="Isométrica" acao="iso" aoClicar={() => p.aoVista('iso')}>
        <IconeIso />
      </Botao>
      <Fio />
      <Botao titulo="Enquadrar" acao="enquadrar" aoClicar={p.aoEnquadrar}>
        <IconeEnquadrar />
      </Botao>
      <Fio />
      <div className="v3-menu-ancora" ref={caixa}>
        <Botao titulo="Mostrar/ocultar" acao="camadas" on={menu || algumaOculta} aoClicar={() => setMenu((m) => !m)}>
          <IconeCamadas />
        </Botao>
        {menu && (
          <div className="v3-menu" role="menu">
            {CATEGORIAS.map((c) => {
              const existe = p.presentes.has(c.id);
              return (
                <label key={c.id} className={`v3-menu-linha${existe ? '' : ' apagada'}`}>
                  <input type="checkbox" disabled={!existe} checked={existe && !p.ocultas.has(c.id)} onChange={() => p.aoAlternar(c.id)} data-categoria={c.id} />
                  <span>{c.rotulo}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
      <Botao titulo="Armadura" acao="armadura" on={p.armadura} aoClicar={p.aoArmadura}>
        <IconeArmadura />
      </Botao>
      <Botao titulo="Corte" acao="corte" on={p.corte} aoClicar={p.aoCorte}>
        <IconeCorte />
      </Botao>
      {p.extra}
      <Fio />
      {ESTILOS_VISUAIS.map((e) => (
        <Botao key={e.id} titulo={`Estilo: ${e.rotulo}`} acao={`estilo-${e.id}`} on={p.estilo === e.id} aoClicar={() => p.aoEstilo(e.id)}>
          {ICONE_DO_ESTILO[e.id]()}
        </Botao>
      ))}
      <Fio />
      <Botao titulo="Foto (PNG)" acao="foto" aoClicar={p.aoFoto}>
        <IconeFoto />
      </Botao>
    </div>
  );
}
