# -*- coding: utf-8 -*-
"""validar_dxf.py — confere um .dxf gerado pelo app Al-rimo (modo prancha) com o ezdxf.

    python -I tools/validar_dxf.py arquivo.dxf [--estrito] [--json]
    python -I tools/validar_dxf.py pranchas.zip [--estrito] [--json]

  .dxf       lê com o ezdxf, roda doc.audit() e, separado, ezdxf.recover.readfile (o leitor que conserta);
  .zip       confere o pacote que o app baixa: CRC de cada arquivo (zipfile.testzip), nomes, e valida cada .dxf
             de dentro; cada imagem que um DXF referencia (IMAGEDEF) tem de estar no zip, no caminho relativo;
  --estrito  conserto do ezdxf também reprova (não só erro). O app usa este modo: um arquivo que o ezdxf precisou
             consertar é um arquivo que o AutoCAD pode recusar;
  --json     imprime o relatório em JSON (UTF-8) para o teste do app ler. O relatório traz também a tabela de
             camadas (cor e espessura), os textos como o CAD os mostra (página 1252 e \\U+XXXX já decodificados
             pelo recover) e quantos MTEXT têm máscara de fundo.

Sai com código 0 se não houver erro, 1 se houver, 2 se nem abrir o arquivo.
Rodar SEMPRE com `python -I` (não carrega módulo da pasta atual nem da pasta do arquivo).

Por que o ezdxf é a régua: o AutoCAD recusa DXF com handle torto ou dono errado e não diz onde; o audit do ezdxf
aponta a entidade. O recover lê "como o AutoCAD faria" e lista o que teve de remendar — remendo é defeito nosso.
Os avisos do registro (logging) do ezdxf durante a leitura também entram no relatório.
"""
import sys, os, io, json, logging, tempfile, zipfile, shutil

sys.stdout.reconfigure(encoding='utf-8')   # no Windows o padrão é cp1252: "Ø10" quebraria o JSON lido pelo Node

try:
    import ezdxf
    from ezdxf import recover
except ImportError:  # sem ezdxf não há o que conferir — o teste do app pula com aviso
    print(json.dumps({'erro_fatal': 'ezdxf não instalado (pip install ezdxf)'}) if '--json' in sys.argv
          else 'ezdxf não instalado (pip install ezdxf)')
    sys.exit(2)


class _Coletor(logging.Handler):
    """Guarda o que o ezdxf avisa no registro enquanto lê (ex.: 'invalid handle', 'unknown entity')."""

    def __init__(self):
        super().__init__(level=logging.WARNING)
        self.msgs = []

    def emit(self, record):
        self.msgs.append(f'{record.levelname}: {record.getMessage()}')


def _texto(entrada):
    """Mensagem de erro/conserto do Auditor em texto (code + message + entidade)."""
    ent = getattr(entrada, 'entity', None)
    alvo = ''
    if ent is not None:
        try:
            alvo = f' [{ent.dxftype()} #{ent.dxf.handle}]'
        except Exception:  # entidade já destruída pelo conserto
            alvo = ''
    return f'{entrada.code}: {entrada.message}{alvo}'


def _textos(doc):
    """Os textos como o CAD os mostra (o recover já decodificou a página 1252 e o \\U+XXXX): TEXT, MTEXT (sem os
    códigos de formatação), ATTRIB e ATTDEF, no desenho e nos blocos."""
    out = []
    lugares = [doc.modelspace()] + [b for b in doc.blocks if not b.name.startswith('*')]
    for lugar in lugares:
        for e in lugar:
            t = e.dxftype()
            if t == 'MTEXT':
                out.append(e.plain_text())
            elif t in ('TEXT', 'ATTDEF'):
                out.append(e.dxf.text)
            if t == 'INSERT':
                out += [a.dxf.text for a in e.attribs]
    return out


def validar_dxf(caminho, nome=None):
    """Relatório de um arquivo .dxf: erros, consertos, avisos, contagem por tipo, imagens referenciadas, camadas
    (cor e espessura) e os textos lidos como o CAD os mostra."""
    rel = {'arquivo': nome or os.path.basename(caminho), 'erros': [], 'consertos': [], 'avisos': [],
           'versao': None, 'codepage': None, 'entidades': {}, 'imagens': [], 'blocos': {}, 'camadas': {},
           'textos': [], 'mascaras': 0}
    coletor = _Coletor()
    log = logging.getLogger('ezdxf')
    log.addHandler(coletor)
    try:
        try:
            doc = ezdxf.readfile(caminho)
        except Exception as ex:  # o leitor normal não abriu: o recover diz o que tem
            rel['erros'].append(f'ezdxf.readfile falhou: {type(ex).__name__}: {ex}')
            doc = None
        if doc is not None:
            rel['versao'] = doc.dxfversion
            rel['codepage'] = doc.header.get('$DWGCODEPAGE')
            rel['camadas'] = {L.dxf.name: {'cor': L.dxf.color, 'espessura': L.dxf.get('lineweight')} for L in doc.layers}
            aud = doc.audit()
            rel['erros'] += [_texto(e) for e in aud.errors]
            rel['consertos'] += [_texto(f) for f in aud.fixes]
            for e in doc.modelspace():
                rel['entidades'][e.dxftype()] = rel['entidades'].get(e.dxftype(), 0) + 1
            for b in doc.blocks:
                if b.name.startswith('*'):
                    continue
                c = {}
                for e in b:
                    c[e.dxftype()] = c.get(e.dxftype(), 0) + 1
                rel['blocos'][b.name] = c
            for d in doc.objects.query('IMAGEDEF'):
                rel['imagens'].append({'arquivo': d.dxf.filename,
                                       'pixels': [int(d.dxf.image_size.x), int(d.dxf.image_size.y)]})
        try:
            doc2, aud2 = recover.readfile(caminho)
            rel['erros'] += ['recover: ' + _texto(e) for e in aud2.errors]
            rel['consertos'] += ['recover: ' + _texto(f) for f in aud2.fixes]
            rel['textos'] = _textos(doc2)
            rel['mascaras'] = sum(1 for e in doc2.modelspace().query('MTEXT') if e.dxf.get('bg_fill', 0))
        except Exception as ex:
            rel['erros'].append(f'recover.readfile falhou: {type(ex).__name__}: {ex}')
    finally:
        log.removeHandler(coletor)
    rel['avisos'] = coletor.msgs
    return rel


def validar_zip(caminho):
    """O pacote baixado: CRC, nomes, cada DXF validado e cada imagem referenciada presente."""
    rel = {'zip': os.path.basename(caminho), 'erros': [], 'nomes': [], 'arquivos': [], 'dxf': []}
    try:
        z = zipfile.ZipFile(caminho)
    except Exception as ex:
        rel['erros'].append(f'zip ilegível: {type(ex).__name__}: {ex}')
        return rel
    with z:
        rel['nomes'] = z.namelist()
        rel['arquivos'] = [{'nome': i.filename, 'tamanho': i.file_size, 'crc': i.CRC, 'metodo': i.compress_type}
                           for i in z.infolist()]
        ruim = z.testzip()   # relê cada arquivo e confere o CRC32 gravado
        if ruim is not None:
            rel['erros'].append(f'CRC errado em {ruim}')
        pasta = tempfile.mkdtemp(prefix='alrimo_dxf_')
        try:
            for nome in rel['nomes']:
                if not nome.lower().endswith('.dxf'):
                    continue
                destino = os.path.join(pasta, os.path.basename(nome))
                with open(destino, 'wb') as f:
                    f.write(z.read(nome))
                r = validar_dxf(destino, nome)
                base = os.path.dirname(nome)
                for img in r['imagens']:
                    alvo = os.path.normpath(os.path.join(base, img['arquivo'])).replace('\\', '/')
                    if alvo not in rel['nomes']:
                        r['erros'].append(f'imagem {img["arquivo"]} não está no zip (procurada em {alvo})')
                rel['dxf'].append(r)
        finally:
            shutil.rmtree(pasta, ignore_errors=True)
    return rel


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    estrito = '--estrito' in sys.argv
    em_json = '--json' in sys.argv
    if len(args) != 1:
        print(__doc__)
        sys.exit(2)
    caminho = args[0]
    if not os.path.exists(caminho):
        print(json.dumps({'erro_fatal': f'não achei {caminho}'}) if em_json else f'não achei {caminho}')
        sys.exit(2)

    if caminho.lower().endswith('.zip'):
        rel = validar_zip(caminho)
        relatorios = rel['dxf']
    else:
        rel = validar_dxf(caminho)
        relatorios = [rel]

    reprova = bool(rel['erros']) or any(r['erros'] for r in relatorios)
    if estrito:
        reprova = reprova or any(r['consertos'] for r in relatorios)
    rel['ok'] = not reprova

    if em_json:
        print(json.dumps(rel, ensure_ascii=False, indent=1))
    else:
        if 'zip' in rel:
            print(f'{rel["zip"]}: {len(rel["nomes"])} arquivos, CRC ' + ('ok' if not rel['erros'] else 'ERRADO'))
            for e in rel['erros']:
                print('  ERRO', e)
        for r in relatorios:
            print(f'{r["arquivo"]} ({r["versao"]}): ' + ', '.join(f'{k} {v}' for k, v in sorted(r['entidades'].items())))
            for e in r['erros']:
                print('  ERRO', e)
            for f in r['consertos']:
                print('  CONSERTO', f)
            for a in r['avisos']:
                print('  AVISO', a)
        print('OK' if rel['ok'] else 'REPROVADO')
    sys.exit(0 if rel['ok'] else 1)


if __name__ == '__main__':
    main()
