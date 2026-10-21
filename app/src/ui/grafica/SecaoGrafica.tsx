// ═══════════════════════════════════════════════════════════════════════════
//  ui/grafica/SecaoGrafica.tsx — a seção Gráfica, no molde do A-PORT
// ---------------------------------------------------------------------------
//  Etapa 3 da moldura (Jose, 20/10; protótipo: claude.ai/artifact/Wjo63e7W4gEk9PZCpzfryd):
//  a FAIXA de ferramentas em cima (Anotação, Vista, Prancha, Exportar), o
//  NAVEGADOR à esquerda (vistas e pranchas em árvore, e as Propriedades), as
//  ABAS das vistas abertas sobre o palco e o RODAPÉ com a escala embaixo.
//  Só a moldura muda: o desenho, o 3D, a folha, o DXF e a conta são os mesmos
//  de antes, e os botões deles vêm por encaixe (estado/grafica.ts).
//
//  O que é do projeto e não de um desenho (criar, duplicar, renomear e
//  excluir vistas e folhas) mora aqui, na faixa; o que depende do desenho que
//  está aberto (a Cota armada, o zoom, a seleção na folha) quem põe é ele.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { useApp } from '@/estado/store';
import { chaveDaAberta, FAIXAS, useEncaixes, useGrafica, type Aberta, type IdFaixa } from '@/estado/grafica';
import { NOMES_DO_CONTEUDO, acharVista } from '@/pranchas/vistas';
import { ICONE_DA_ABA, Palco } from '@/ui/Palco';
import { IconeFechar, IconeGrafica } from '@/ui/icones';
import { BotaoDaFaixa, ICONES } from './Encaixes';
import { criarFolha, criarVista, duplicar, eh2D, excluir, excluirFolha, fechar, trazer, useFrente, vistaGravada } from './comandos';
import { PainelDaGrafica } from './Navegador';

export function SecaoGrafica({ escondida }: { escondida: boolean }) {
  const frente = useFrente();
  const abrir = useGrafica((s) => s.abrir);
  const podar = useGrafica((s) => s.podar);
  const pranchas = useApp((s) => s.pranchas);

  // o que vem para a frente por outro caminho (o Início abrindo as pranchas, o arquivo aberto) ganha a aba dele
  const chave = frente ? chaveDaAberta(frente) : null;
  useEffect(() => {
    if (frente) abrir(frente);
  }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps
  // vista excluída, folha apagada, outro muro aberto: a aba do que não existe mais fecha
  useEffect(() => {
    podar((a) => existe(a));
  }, [pranchas, podar]);

  return (
    <div className="secao-grafica" hidden={escondida}>
      <Faixa />
      <div className="grafica-corpo">
        <PainelDaGrafica />
        <section className="grafica-palco">
          <AbasAbertas />
          {frente ? <Palco aba={frente.aba} /> : <PalcoVazio />}
          <RodapeDaGrafica />
        </section>
      </div>
    </div>
  );
}

/** A aba ainda aponta para algo que existe? */
function existe(a: Aberta): boolean {
  const p = useApp.getState().pranchas;
  // sem folha nenhuma a aba das pranchas fica (é nela que se cria a primeira)
  if (a.aba === 'pranchas') return a.id === null ? p.folhas.length === 0 : p.folhas.some((f) => f.id === a.id);
  if (eh2D(a.aba)) return !!a.id && !!acharVista(p, a.id);
  return true;
}

// ── a faixa ────────────────────────────────────────────────────────────────

function Faixa() {
  const faixa = useGrafica((s) => s.faixa);
  const escolher = useGrafica((s) => s.escolherFaixa);
  const publicar = useEncaixes((s) => s.publicar);
  return (
    <div className="faixa">
      <div className="faixa-abas" role="tablist" aria-label="Faixa de ferramentas">
        {FAIXAS.map((f) => (
          <button key={f.id} type="button" role="tab" aria-selected={f.id === faixa} className={`faixa-aba${f.id === faixa ? ' on' : ''}`} onClick={() => escolher(f.id)}>
            {f.nome}
          </button>
        ))}
      </div>
      {FAIXAS.map((f) => (
        // todas montadas (as escondidas também): os botões que o desenho pôs lá não caem a cada troca de aba
        <div key={f.id} className="faixa-painel" role="tabpanel" hidden={f.id !== faixa}>
          <GruposDoProjeto faixa={f.id} />
          <div className="faixa-encaixe" ref={(el) => publicar(f.id, el)} />
        </div>
      ))}
    </div>
  );
}

/** Os grupos que são do projeto, não do desenho aberto. */
function GruposDoProjeto({ faixa }: { faixa: IdFaixa }) {
  const frente = useFrente();
  useApp((s) => s.pranchas); // a vista que passou a existir (gravada) acende o Excluir
  const renomear = useGrafica((s) => s.renomear);
  const verPainel = useGrafica((s) => s.verPainel);
  const pedirNome = (id: string) => {
    verPainel('navegador');
    renomear(id);
  };
  if (faixa === 'vista') {
    const tipo = frente && eh2D(frente.aba) ? frente.aba : null;
    const id = tipo ? frente!.id : null;
    return (
      <Grupo nome="Vistas">
        <BotaoDaFaixa nome="Nova" dica={tipo ? `Nova vista: ${NOMES_DO_CONTEUDO[tipo]}` : 'Nova vista'} desenho={ICONES.nova} desligado={!tipo} aoClicar={() => tipo && criarVista(tipo)} />
        <BotaoDaFaixa nome="Duplicar" dica="Duplicar com as anotações" desenho={ICONES.duplicar} desligado={!id} aoClicar={() => id && duplicar(id)} />
        <BotaoDaFaixa nome="Renomear" dica="Renomear  ·  F2 no navegador" desenho={ICONES.renomear} desligado={!id} aoClicar={() => id && pedirNome(id)} />
        <BotaoDaFaixa nome="Excluir" desenho={ICONES.excluir} desligado={!id || !vistaGravada(id)} aoClicar={() => id && excluir(id)} />
      </Grupo>
    );
  }
  if (faixa === 'prancha') {
    const folha = frente?.aba === 'pranchas' ? frente.id : null;
    return (
      <Grupo nome="Folhas">
        <BotaoDaFaixa nome="Nova folha" desenho={ICONES.folha} aoClicar={criarFolha} />
        <BotaoDaFaixa nome="Renomear" dica="Conteúdo da folha  ·  F2 no navegador" desenho={ICONES.renomear} desligado={!folha} aoClicar={() => folha && pedirNome(folha)} />
        <BotaoDaFaixa nome="Excluir" dica="Excluir folha" desenho={ICONES.excluir} desligado={!folha} aoClicar={() => folha && excluirFolha(folha)} />
      </Grupo>
    );
  }
  return null;
}

function Grupo({ nome, children }: { nome: string; children: React.ReactNode }) {
  return (
    <div className="faixa-grupo" data-grupo={nome}>
      <div className="faixa-botoes">{children}</div>
      <span className="faixa-grupo-nome">{nome}</span>
    </div>
  );
}

// ── as abas abertas ────────────────────────────────────────────────────────

/** O nome da aba: a vista ("Corte A"), a folha ("01 · Contrafortes") ou o 3D. */
function nomeDaAberta(a: Aberta): string {
  const p = useApp.getState().pranchas;
  if (a.aba === 'pranchas') {
    const i = p.folhas.findIndex((f) => f.id === a.id);
    const f = p.folhas[i];
    return f ? `${String(i + 1).padStart(2, '0')}${f.conteudo ? ` · ${f.conteudo}` : ''}` : 'Prancha';
  }
  if (a.id) return acharVista(p, a.id)?.nome ?? '';
  return '3D';
}

function AbasAbertas() {
  const abertas = useGrafica((s) => s.abertas);
  useApp((s) => s.pranchas); // nome novo da vista ou da folha
  const frente = useFrente();
  const chaveDaFrente = frente ? chaveDaAberta(frente) : null;
  return (
    <div className="abas-vista" role="tablist" aria-label="Vistas abertas">
      {abertas.map((a) => {
        const k = chaveDaAberta(a);
        const on = k === chaveDaFrente;
        const I = ICONE_DA_ABA[a.aba];
        const nome = nomeDaAberta(a);
        return (
          <div
            key={k} role="tab" tabIndex={0} aria-selected={on} className={`aba-vista${on ? ' on' : ''}`} title={nome}
            onClick={() => trazer(a)}
            onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); fechar(a); } }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trazer(a); }
            }}
          >
            <I />
            <span className="aba-nome">{nome}</span>
            <button
              type="button" className="aba-fechar" aria-label={`Fechar ${nome}`} title="Fechar"
              onClick={(e) => { e.stopPropagation(); fechar(a); }}
            >
              <IconeFechar tamanho={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function PalcoVazio() {
  return (
    <main className="palco" role="tabpanel">
      <div className="marcador-de-lugar">
        <IconeGrafica tamanho={56} />
      </div>
    </main>
  );
}

function RodapeDaGrafica() {
  const publicar = useEncaixes((s) => s.publicar);
  return <div className="grafica-rodape" ref={(el) => publicar('rodape', el)} />;
}
