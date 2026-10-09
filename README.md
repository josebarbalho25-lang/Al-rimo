# Al-rimo

Muro de arrimo em alvenaria estrutural (bloco de concreto): balanço, contrafortes e sapata corrida.
Detalhes do projeto, decisões e convenções: **CLAUDE.md**.

## Instalar (Windows)

1. Python 3.11 ou mais novo: `pip install -r requirements.txt`
2. LibreOffice (só para `testar.py` e `varredura.py`, que recalculam a planilha sem o Excel).
3. Opcional, para redesenhar figuras: `pip install playwright` e `python -m playwright install chromium`.

## Usar

- `python tools/gerar.py` → gera as duas planilhas em `planilha/`.
- `python tools/testar.py` → confere os números das aulas 12.2 e 12.3 e se algo mudou.
- `python tools/varredura.py 20` → 20 cenários aleatórios procurando erro de fórmula.

As planilhas são geradas pelo código: mudanças feitas direto no Excel se perdem na próxima geração.
Peça a mudança ao Claude, que ajusta o gerador.
