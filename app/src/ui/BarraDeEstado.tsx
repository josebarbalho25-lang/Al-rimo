// ═══════════════════════════════════════════════════════════════════════════
//  ui/BarraDeEstado.tsx — o rodapé: o veredito, o recado e onde se está
// ---------------------------------------------------------------------------
//  À esquerda, o VEREDITO numa palavra: "Passa" ou "Não passa · 3". UM campo
//  curto, e não uma faixa de cartões — no Pró-Viga o Jose chamou a faixa de
//  veredictos de "spam de anúncio". Clicar leva à memória.
//  No meio, o recado de ação ("Salvo em…"), que vive uns segundos; recado ruim
//  se pinta de ruim (RECADO_RUIM), nunca na cor de "salvo".
//  À direita: tipo de muro e bloco; a versão da conta só quando o arquivo
//  aberto foi salvo com outra (o código da versão, "81137a03", não diz nada a
//  quem projeta — fica no pairar do tipo de muro, para quem for dar suporte).
//  O que está errado aparece como alarme e some sozinho quando se resolve.
// ═══════════════════════════════════════════════════════════════════════════

import { VERSAO_DESCONHECIDA } from '@/estado/projeto';
import { ehRuim } from '@/estado/recadoRuim';
import { leitorDoEstado, useApp, VERSAO_DA_CONTA } from '@/estado/store';

export function BarraDeEstado() {
  const erroConta = useApp((s) => s.erroConta);
  const erroModelo = useApp((s) => s.erroModelo);
  const veredito = useApp((s) => s.veredito);
  const recado = useApp((s) => s.recado);
  const escolherAba = useApp((s) => s.escolherAba);

  return (
    <footer className="statusbar">
      {erroConta ? (
        <span className="situacao naoPassa" title={erroConta}>
          Erro na conta
        </span>
      ) : (
        veredito && (
          <button
            className={`situacao ${veredito.passa ? 'passa' : 'naoPassa'}`}
            title="Memória"
            onClick={() => escolherAba('memoria')}
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

      <span className="campo-estado" style={{ color: ehRuim(recado) ? 'var(--warn)' : 'var(--ok)' }}>
        {recado ?? ''}
      </span>

      <span className="direita">
        <AvisosDoModelo />
        <TipoEBloco />
        <VersaoDaConta />
      </span>
    </footer>
  );
}

/** Os avisos que a modulação deixou no modelo: o número na barra, os textos no pairar. */
function AvisosDoModelo() {
  const avisos = useApp((s) => s.modelo?.avisos);
  if (!avisos?.length) return null;
  return (
    <span className="campo-estado aviso" title={avisos.map((a) => a.texto).join('\n')}>
      <span className="valor">{avisos.length}</span> {avisos.length === 1 ? 'aviso' : 'avisos'}
    </span>
  );
}

/**
 * Tipo de muro e família do bloco. A família só acende em aviso se o encaixe
 * do contraforte nela for PROVISÓRIO (sem modelo do Revit do Jose) — hoje
 * nenhuma: a 14x39 e a 19x39 seguem os gabaritos dele.
 */
function TipoEBloco() {
  // Lidos das ENTRADAS, não do resultado: a barra tem de dizer o que foi pedido
  // mesmo quando a conta está com erro.
  const tipoMuro = useApp((s) => String(leitorDoEstado(s)('Tipo_muro') ?? ''));
  const t = useApp((s) => leitorDoEstado(s)('t_bloco'));
  const familia = useApp((s) => s.modelo?.familia ?? null);

  // Só a família 39 (o comprimento do bloco é fixo na planilha): sem modelo, o nome sai da espessura.
  const nomeFamilia = familia?.nome ?? (t != null ? `${t}x39` : '');
  const provisoria = !!familia?.provisoria && tipoMuro === 'Contrafortes';

  return (
    <span className="campo-estado">
      <span className="valor" title={`Conta ${VERSAO_DA_CONTA.slice(0, 8)}`}>
        {tipoMuro}
      </span>
      {nomeFamilia && (
        <span
          className={`valor${provisoria ? ' aviso' : ''}`}
          title={provisoria ? 'Encaixe do contraforte provisório nesta família' : undefined}
        >
          · bloco {nomeFamilia}
        </span>
      )}
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
