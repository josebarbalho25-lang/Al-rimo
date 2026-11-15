// ═══════════════════════════════════════════════════════════════════════════
//  ui/BarraDeEstado.tsx — o rodapé: o veredito, o recado e onde se está
// ---------------------------------------------------------------------------
//  À esquerda, o VEREDITO numa palavra: "Passa" ou "Não passa · 3". UM campo
//  curto, e não uma faixa de cartões — no Pró-Viga o Jose chamou a faixa de
//  veredictos de "spam de anúncio". Clicar leva à memória.
//  No meio, o recado de ação ("Salvo em…"), que vive uns segundos; recado ruim
//  se pinta de ruim (RECADO_RUIM), nunca na cor de "salvo".
//  À direita: os avisos ("2 avisos" — os da planilha, como c' > 0, e os da
//  modulação; o texto no pairar); a versão da conta só quando o arquivo aberto
//  foi salvo com outra (o código da versão, "81137a03", não diz nada a quem
//  projeta — fica no pairar da ficha, para quem for dar suporte).
//  O que está errado aparece como alarme e some sozinho quando se resolve.
//
//  15/11 — A BARRA DO PRÓ-VIGA (a `barra-estado` dele, junto com o Início):
//  depois do veredito, "● Salvo · arquivo" (ou o recado da vez, que tem a
//  prioridade); no meio a FICHA do muro em pares rótulo/valor — rótulo em caixa
//  alta e cinza, valor em fonte de número ("MURO Balanço · bloco 19×39  ALTURA
//  muro 1,60 · solo 1,60 m…"); à direita os avisos e "● CALCULADO 17:30:45", a
//  hora da última conta que fechou. A ficha QUEBRA de linha e a segunda linha
//  fica escondida: em janela estreita o par que não cabe some inteiro, nunca
//  pela metade (a ordem é a prioridade) — a regra do Pró-Viga.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import { textosDosAvisos } from '@/estado/avisosDaPlanilha';
import { VERSAO_DESCONHECIDA } from '@/estado/projeto';
import { ehRuim } from '@/estado/recadoRuim';
import { resumoDoMuro } from '@/estado/resumoDoMuro';
import { leitorDoEstado, useApp, VERSAO_DA_CONTA } from '@/estado/store';
import { useInterface } from '@/estado/interface';

export function BarraDeEstado() {
  const erroConta = useApp((s) => s.erroConta);
  const erroModelo = useApp((s) => s.erroModelo);
  const veredito = useApp((s) => s.veredito);
  const recado = useApp((s) => s.recado);
  const faltando = useApp((s) => s.faltando);
  const abrirNoCampo = useInterface((s) => s.abrirNoCampo);
  const irPara = useInterface((s) => s.irPara);

  return (
    <footer className="statusbar">
      {/* muro novo com dado em branco: sem veredito (a conta não fecha), o que falta e o caminho até ele */}
      {faltando.length > 0 && !erroConta ? (
        <button className="situacao falta" title="Entradas" onClick={() => abrirNoCampo(faltando[0])}>
          {faltando.length === 1 ? 'Falta 1 dado' : `Faltam ${faltando.length} dados`}
        </button>
      ) : erroConta ? (
        <span className="situacao naoPassa" title={erroConta}>
          Erro na conta
        </span>
      ) : (
        veredito && (
          <button
            className={`situacao ${veredito.passa ? 'passa' : 'naoPassa'}`}
            title="Memória"
            onClick={() => irPara('memoria')}
          >
            {veredito.passa ? 'Passa' : `Não passa · ${veredito.falhas}`}
          </button>
        )
      )}

      {erroModelo && (
        <span className="campo-estado alarme" title={erroModelo}>
          Modelo não gerado
        </span>
      )}

      {recado ? (
        <span className="campo-estado" style={{ color: ehRuim(recado) ? 'var(--warn)' : 'var(--ok)' }}>
          {recado}
        </span>
      ) : (
        <EstadoDoArquivo />
      )}

      <Ficha />

      <span className="direita">
        <Avisos />
        <VersaoDaConta />
        <HoraDaConta />
      </span>
    </footer>
  );
}

/** "● Salvo · Muro A.alrimo" — com alteração, só o nome, apagado (o • está no cabeçalho). Muro sem arquivo: nada. */
function EstadoDoArquivo() {
  const arquivo = useApp((s) => s.arquivo);
  const sujo = useApp((s) => s.sujo);
  if (!arquivo) return null;
  return (
    <span className="campo-estado arquivo" title={arquivo}>
      {sujo ? (
        arquivo
      ) : (
        <>
          <span className="ponto" />
          Salvo · {arquivo}
        </>
      )}
    </span>
  );
}

/** A ficha do muro, lida das ENTRADAS: a barra diz o que foi pedido mesmo com a conta em erro. */
function Ficha() {
  const alteracoes = useApp((s) => s.alteracoes);
  const extras = useApp((s) => s.extras);
  const modelo = useApp((s) => s.modelo);
  const resultado = useApp((s) => s.resultado);
  const pares = useMemo(() => {
    const ler = leitorDoEstado({ alteracoes, extras });
    // o comprimento e o eixo a eixo do muro DESENHADO (a conta usa o ajustado, como os *_adot da planilha)
    const L = modelo?.ajustes.find((a) => a.nome === 'L_total')?.para;
    const comprimento = typeof L === 'number' ? L : (ler('L_total') as number | null);
    return resumoDoMuro(ler, { comprimento: typeof comprimento === 'number' ? comprimento : null, vaoDosContrafortes: resultado?.num('l_cf_adot') ?? null });
  }, [alteracoes, extras, modelo, resultado]);
  return (
    <span className="ficha" title={`Conta ${VERSAO_DA_CONTA.slice(0, 8)}`}>
      {pares.map((p) => (
        <span key={p.k} className="par">
          <span className="k">{p.k}</span>
          <span className="valor">{p.v}</span>
        </span>
      ))}
    </span>
  );
}

/** "● CALCULADO 17:30:45": a hora da última conta que fechou (a de antes fica enquanto a nova estiver com erro). */
function HoraDaConta() {
  const resultado = useApp((s) => s.resultado);
  const erroConta = useApp((s) => s.erroConta);
  const [hora, setHora] = useState<Date | null>(() => (resultado && !erroConta ? new Date() : null));
  useEffect(() => {
    if (resultado && !erroConta) setHora(new Date());
  }, [resultado, erroConta]);
  if (!hora) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    <span className="par hora">
      <span className="ponto" />
      <span className="k">Calculado</span>
      <span className="valor">{`${p(hora.getHours())}:${p(hora.getMinutes())}:${p(hora.getSeconds())}`}</span>
    </span>
  );
}

/** Os avisos da conta (planilha) e os que a modulação deixou no modelo: o número na barra, os textos no pairar. */
function Avisos() {
  const daConta = useApp((s) => s.avisosDaConta);
  const doModelo = useApp((s) => s.modelo?.avisos);
  // Cada seletor devolve a referência guardada no estado; a lista juntada nasce aqui, só quando uma das duas muda
  // (juntar dentro do seletor faria um array novo a cada leitura e o React redesenharia sem parar).
  const avisos = useMemo(() => textosDosAvisos(daConta, doModelo), [daConta, doModelo]);
  if (!avisos.length) return null;
  return (
    <span className="campo-estado aviso" title={avisos.join('\n')}>
      <span className="valor">{avisos.length}</span> {avisos.length === 1 ? 'aviso' : 'avisos'}
    </span>
  );
}

/** Só aparece quando importa: o arquivo foi salvo com outra conta, e o mesmo muro pode dar outro número. */
function VersaoDaConta() {
  const doArquivo = useApp((s) => s.contaDoArquivo);
  if (!doArquivo) return null;
  const doArquivoCurta = doArquivo === VERSAO_DESCONHECIDA ? doArquivo : doArquivo.slice(0, 8);
  return (
    <span className="campo-estado aviso" title={`Arquivo: conta ${doArquivoCurta} · hoje: conta ${VERSAO_DA_CONTA.slice(0, 8)}`}>
      Outra versão da conta
    </span>
  );
}
