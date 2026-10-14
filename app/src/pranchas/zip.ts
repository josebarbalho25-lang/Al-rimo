/*
  ZIP — o pacote que o app baixa: as pranchas .dxf e a pasta imagens/ (a foto do 3D vai VINCULADA no DXF, como o
  CAD faz: o arquivo da imagem tem de ir junto, no caminho relativo que o DXF aponta).

  Por que escrito aqui e não uma biblioteca: o ZIP sem compressão ("store") é um formato pequeno e fechado —
  cabeçalho local + dados + diretório central + fim — e o DXF/PNG não ganham o bastante comprimindo para justificar
  dependência nova. O CRC32 é o da tabela de sempre (polinômio 0xEDB88320, o do PKZIP).

  Nome de arquivo em UTF-8 (bit 11 ligado): "Prancha 01 — Formas.dxf" abre com o acento certo no Windows e no Mac.
*/

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(dados: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < dados.length; i++) c = TABELA_CRC[(c ^ dados[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Data e hora no formato do MS-DOS que o ZIP guarda (resolução de 2 s; ano a partir de 1980). */
function dataDos(d: Date): { hora: number; dia: number } {
  const ano = Math.max(1980, d.getFullYear());
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    dia: ((ano - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/**
 * Empacota os arquivos num .zip sem compressão. `nome` é o caminho dentro do zip, com barra normal
 * ("imagens/foto.png"); texto vai em UTF-8. `data` = carimbo de data de todos os arquivos (padrão: agora).
 */
export function zipar(arquivos: { nome: string; dados: Uint8Array | string }[], data: Date = new Date()): Uint8Array {
  const utf8 = new TextEncoder();
  const { hora, dia } = dataDos(data);
  const locais: Uint8Array[] = [];
  const centrais: Uint8Array[] = [];
  let deslocamento = 0;

  for (const a of arquivos) {
    const nome = utf8.encode(a.nome.replace(/\\/g, '/'));
    const dados = typeof a.dados === 'string' ? utf8.encode(a.dados) : a.dados;
    const crc = crc32(dados);

    const local = new Uint8Array(30 + nome.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);   // assinatura do cabeçalho local
    l.setUint16(4, 20, true);           // versão mínima para extrair (2.0)
    l.setUint16(6, 0x0800, true);       // bit 11: nome em UTF-8
    l.setUint16(8, 0, true);            // método 0 = store (sem compressão)
    l.setUint16(10, hora, true);
    l.setUint16(12, dia, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, dados.length, true); // tamanho comprimido = tamanho real (store)
    l.setUint32(22, dados.length, true);
    l.setUint16(26, nome.length, true);
    l.setUint16(28, 0, true);           // sem campo extra
    local.set(nome, 30);

    const central = new Uint8Array(46 + nome.length);
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);   // assinatura do diretório central
    c.setUint16(4, 20, true);           // feito por: versão 2.0 (MS-DOS)
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, hora, true);
    c.setUint16(14, dia, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, dados.length, true);
    c.setUint32(24, dados.length, true);
    c.setUint16(28, nome.length, true);
    // 30: extra, 32: comentário, 34: disco, 36: atributos internos, 38: atributos externos — tudo zero
    c.setUint32(42, deslocamento, true); // onde está o cabeçalho local deste arquivo
    central.set(nome, 46);

    locais.push(local, dados);
    centrais.push(central);
    deslocamento += local.length + dados.length;
  }

  const tamCentral = centrais.reduce((s, x) => s + x.length, 0);
  const fim = new Uint8Array(22);
  const f = new DataView(fim.buffer);
  f.setUint32(0, 0x06054b50, true);     // assinatura do fim do diretório central
  f.setUint16(8, arquivos.length, true); // registros neste disco
  f.setUint16(10, arquivos.length, true);
  f.setUint32(12, tamCentral, true);
  f.setUint32(16, deslocamento, true);   // onde começa o diretório central

  const total = new Uint8Array(deslocamento + tamCentral + fim.length);
  let p = 0;
  for (const parte of [...locais, ...centrais, fim]) {
    total.set(parte, p);
    p += parte.length;
  }
  return total;
}

/** Os bytes de um data URL ("data:image/png;base64,…" ou o texto cru de um "data:image/svg+xml,…"). */
export function dataUrlParaBytes(u: string): Uint8Array {
  const m = /^data:([^,]*?),(.*)$/s.exec(u);
  if (!m) throw new Error('data URL inválido');
  const [, cabecalho, corpo] = m;
  if (/;base64$/i.test(cabecalho)) {
    const bin = atob(corpo.replace(/\s+/g, ''));
    const b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b;
  }
  return new TextEncoder().encode(decodeURIComponent(corpo));
}
