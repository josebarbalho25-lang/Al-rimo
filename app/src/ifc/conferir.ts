/*
  CONFERÊNCIA RÁPIDA DO TEXTO IFC — sem Python, roda no navegador e no teste. Não substitui o validador
  (tools/validar_ifc.py, ifcopenshell: esquema + regras WHERE + geometria); pega o que dá para pegar lendo o
  texto, e é o que o selo do Pró-Viga fazia (lá faltou e passaram 495 violações):
    · uma entidade por linha, sintaxe #n=TIPO(...);
    · toda referência #n aponta para uma entidade que existe;
    · nenhum caractere fora do ASCII imprimível (acento tem de vir em \X2\);
    · GUID com 22 caracteres do alfabeto IFC, 1º em 0..3, sem repetição;
    · nº de argumentos de cada classe = o do esquema IFC4 (tabela tirada do ifcopenshell 0.8.5) — no Pró-Viga a
      IfcReinforcingBar tinha 13 em vez de 14 e os valores escorregavam de posição sem ninguém ver;
    · medida "positiva" > 0 e quantidade ≥ 0 (regras WR1/WR21 do esquema).
*/

/** Nº de atributos por classe no IFC4 (ifcopenshell 0.8.5, schema_by_name('IFC4')). Só as classes que o app escreve. */
export const ARIDADE: Record<string, number> = {
  IFCPROJECT: 9, IFCSITE: 14, IFCBUILDING: 12, IFCBUILDINGSTOREY: 10, IFCWALL: 9, IFCFOOTING: 9, IFCFOOTINGTYPE: 10,
  IFCBUILDINGELEMENTPART: 9, IFCBUILDINGELEMENTPARTTYPE: 10, IFCREINFORCINGBAR: 14, IFCREINFORCINGBARTYPE: 16,
  IFCBUILDINGELEMENTPROXY: 9, IFCBUILDINGELEMENTPROXYTYPE: 10, IFCCOVERING: 9, IFCCOVERINGTYPE: 10, IFCPIPESEGMENT: 9,
  IFCPIPESEGMENTTYPE: 10, IFCRELAGGREGATES: 6, IFCRELCONTAINEDINSPATIALSTRUCTURE: 6, IFCRELDEFINESBYTYPE: 6,
  IFCRELDEFINESBYPROPERTIES: 6, IFCRELASSOCIATESMATERIAL: 6, IFCPROPERTYSET: 5, IFCELEMENTQUANTITY: 6,
  IFCPROPERTYSINGLEVALUE: 4, IFCQUANTITYLENGTH: 5, IFCQUANTITYAREA: 5, IFCQUANTITYVOLUME: 5, IFCQUANTITYCOUNT: 5,
  IFCQUANTITYWEIGHT: 5, IFCMATERIAL: 3, IFCMATERIALPROPERTIES: 4, IFCOWNERHISTORY: 8, IFCPERSON: 8, IFCORGANIZATION: 5,
  IFCPERSONANDORGANIZATION: 3, IFCAPPLICATION: 4, IFCSIUNIT: 4, IFCUNITASSIGNMENT: 1, IFCGEOMETRICREPRESENTATIONCONTEXT: 6,
  IFCGEOMETRICREPRESENTATIONSUBCONTEXT: 10, IFCLOCALPLACEMENT: 2, IFCAXIS2PLACEMENT3D: 3, IFCCARTESIANPOINT: 1,
  IFCDIRECTION: 1, IFCCARTESIANPOINTLIST2D: 1, IFCCARTESIANPOINTLIST3D: 1, IFCINDEXEDPOLYCURVE: 3,
  IFCARBITRARYCLOSEDPROFILEDEF: 3, IFCARBITRARYPROFILEDEFWITHVOIDS: 4, IFCEXTRUDEDAREASOLID: 4, IFCSWEPTDISKSOLID: 5,
  IFCBOOLEANRESULT: 3,
  IFCSHAPEREPRESENTATION: 4, IFCPRODUCTDEFINITIONSHAPE: 3, IFCREPRESENTATIONMAP: 2, IFCMAPPEDITEM: 2,
  IFCCARTESIANTRANSFORMATIONOPERATOR3D: 5, IFCSTYLEDITEM: 3, IFCSURFACESTYLE: 3, IFCSURFACESTYLESHADING: 2, IFCCOLOURRGB: 4,
};

/**
 * Argumentos (índice base 0) que o esquema exige > 0 (IfcPositiveLengthMeasure, regra WR1) e quantidades que exigem
 * ≥ 0 (regra WR21 das IfcQuantity*). O validador do ifcopenshell só pega isso com --regras, e um zero só já
 * reprova o arquivo inteiro — aconteceu: s_adot = 0 da conta virou VerticalBarPitch 0 (sorteio18 do gabarito).
 */
const POSITIVOS: Record<string, number[]> = {
  IFCEXTRUDEDAREASOLID: [3],          // Depth
  IFCSWEPTDISKSOLID: [1],             // Radius
  IFCREINFORCINGBARTYPE: [10, 12],    // NominalDiameter, BarLength
  IFCREINFORCINGBAR: [9, 11],         // idem, na ocorrência (o app grava $: deprecado no IFC4)
};
const NAO_NEGATIVOS: Record<string, number[]> = {
  IFCQUANTITYLENGTH: [3], IFCQUANTITYAREA: [3], IFCQUANTITYVOLUME: [3], IFCQUANTITYWEIGHT: [3], IFCQUANTITYCOUNT: [3],
};

/** Classes que herdam de IfcRoot (1º argumento é o GlobalId). */
const RAIZ = new Set([
  'IFCPROJECT', 'IFCSITE', 'IFCBUILDING', 'IFCBUILDINGSTOREY', 'IFCWALL', 'IFCFOOTING', 'IFCFOOTINGTYPE',
  'IFCBUILDINGELEMENTPART', 'IFCBUILDINGELEMENTPARTTYPE', 'IFCREINFORCINGBAR', 'IFCREINFORCINGBARTYPE',
  'IFCBUILDINGELEMENTPROXY', 'IFCBUILDINGELEMENTPROXYTYPE', 'IFCCOVERING', 'IFCCOVERINGTYPE', 'IFCPIPESEGMENT',
  'IFCPIPESEGMENTTYPE', 'IFCRELAGGREGATES', 'IFCRELCONTAINEDINSPATIALSTRUCTURE', 'IFCRELDEFINESBYTYPE',
  'IFCRELDEFINESBYPROPERTIES', 'IFCRELASSOCIATESMATERIAL', 'IFCPROPERTYSET', 'IFCELEMENTQUANTITY',
]);

export interface Entidade { id: number; tipo: string; args: string[] }

/** Separa os argumentos do nível de cima, respeitando texto entre aspas ('' é aspa escapada) e parênteses. */
export function separarArgs(s: string): string[] {
  const out: string[] = [];
  let nivel = 0, ini = 0, emTexto = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (emTexto) {
      if (c === "'") {
        if (s[i + 1] === "'") i++;
        else emTexto = false;
      }
      continue;
    }
    if (c === "'") emTexto = true;
    else if (c === '(') nivel++;
    else if (c === ')') nivel--;
    else if (c === ',' && nivel === 0) { out.push(s.slice(ini, i)); ini = i + 1; }
  }
  if (s.length) out.push(s.slice(ini));
  return out;
}

/** Desfaz o \X2\...\X0\ e o '' de um texto STEP ('...' com as aspas). */
export function decodificar(lit: string): string {
  if (!lit.startsWith("'")) return lit;
  const s = lit.slice(1, -1).replace(/''/g, "'");
  return s
    .replace(/\\X2\\([0-9A-F]+)\\X0\\/g, (_, h: string) => String.fromCharCode(...(h.match(/..../g) ?? []).map((x) => parseInt(x, 16))))
    .replace(/\\X4\\([0-9A-F]+)\\X0\\/g, (_, h: string) => String.fromCodePoint(...(h.match(/......../g) ?? []).map((x) => parseInt(x, 16))))
    .replace(/\\\\/g, '\\');
}

export function lerStep(texto: string): { entidades: Map<number, Entidade>; erros: string[] } {
  const erros: string[] = [];
  const entidades = new Map<number, Entidade>();
  const ini = texto.indexOf('\nDATA;\n');
  const fim = texto.lastIndexOf('\nENDSEC;');
  if (ini < 0 || fim < ini) return { entidades, erros: ['sem seção DATA'] };
  const linhas = texto.slice(ini + 7, fim).split('\n');
  for (const l of linhas) {
    const m = /^#(\d+)=([A-Z0-9]+)\((.*)\);$/.exec(l);
    if (!m) { erros.push('linha fora do padrão: ' + l.slice(0, 80)); continue; }
    const id = Number(m[1]);
    if (entidades.has(id)) erros.push('#' + id + ' repetido');
    entidades.set(id, { id, tipo: m[2], args: separarArgs(m[3]) });
  }
  return { entidades, erros };
}

export interface Conferencia { erros: string[]; contagem: Record<string, number>; entidades: number }

export function conferirStep(texto: string): Conferencia {
  const { entidades, erros } = lerStep(texto);
  const contagem: Record<string, number> = {};
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    if (c !== 10 && (c < 0x20 || c > 0x7e)) {
      erros.push(`caractere fora do ASCII na posição ${i} (U+${c.toString(16).toUpperCase().padStart(4, '0')})`);
      break;
    }
  }
  const guids = new Set<string>();
  for (const e of entidades.values()) {
    contagem[e.tipo] = (contagem[e.tipo] ?? 0) + 1;
    const n = ARIDADE[e.tipo];
    if (n === undefined) erros.push(`#${e.id} ${e.tipo}: classe fora da tabela de aridade`);
    else if (e.args.length !== n) erros.push(`#${e.id} ${e.tipo}: ${e.args.length} argumentos, o IFC4 tem ${n}`);
    // referências: tira o texto entre aspas antes de procurar #n
    const semTexto = e.args.join(',').replace(/'(?:[^']|'')*'/g, "''");
    for (const r of semTexto.matchAll(/#(\d+)/g)) {
      if (!entidades.has(Number(r[1]))) erros.push(`#${e.id} ${e.tipo}: aponta para #${r[1]}, que não existe`);
    }
    for (const i of POSITIVOS[e.tipo] ?? []) {
      const a = e.args[i];
      if (a !== undefined && a !== '$' && !(Number(a) > 0)) erros.push(`#${e.id} ${e.tipo}: argumento ${i + 1} tem de ser > 0 (${a})`);
    }
    for (const i of NAO_NEGATIVOS[e.tipo] ?? []) {
      const a = e.args[i];
      if (a !== undefined && a !== '$' && !(Number(a) >= 0)) erros.push(`#${e.id} ${e.tipo}: valor negativo (${a})`);
    }
    for (const m of semTexto.matchAll(/IFCPOSITIVE(?:LENGTH|RATIO|PLANEANGLE)MEASURE\(([^)]*)\)/g)) {
      if (!(Number(m[1]) > 0)) erros.push(`#${e.id} ${e.tipo}: medida positiva com ${m[1]}`);
    }
    if (RAIZ.has(e.tipo)) {
      const g = decodificar(e.args[0]);
      if (!/^[0-3][0-9A-Za-z_$]{21}$/.test(g)) erros.push(`#${e.id} ${e.tipo}: GUID fora do padrão: ${g}`);
      if (guids.has(g)) erros.push(`#${e.id} ${e.tipo}: GUID repetido: ${g}`);
      guids.add(g);
    }
  }
  return { erros, contagem, entidades: entidades.size };
}

/** Só a seção DATA (o cabeçalho leva a hora da exportação). */
export function secaoData(texto: string): string {
  const i = texto.indexOf('\nDATA;\n');
  return i < 0 ? '' : texto.slice(i);
}
