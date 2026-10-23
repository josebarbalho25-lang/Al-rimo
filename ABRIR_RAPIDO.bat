@echo off
rem Abre o Al-rimo na velocidade do programa instalado (porta 5185; fechar esta janela fecha o app).
rem O ABRIR.bat sobe o modo de teste, que se atualiza sozinho a cada mudanca no codigo mas faz toda conta de tela
rem duas vezes de proposito (soltar uma cota: ~115 ms la, ~25 ms aqui). Este monta a versao de producao do codigo
rem de agora; mudanca feita depois so entra fechando e abrindo de novo.
rem Outra porta e outro "endereco": o ultimo muro do ABRIR.bat nao vem junto, abrir o arquivo pelo Abrir.
cd /d "%~dp0app"
echo Montando a versao de producao (leva alguns segundos)...
call npx vite build --logLevel error
if errorlevel 1 (
  echo.
  echo Nao deu para montar o app. Avise o Claude com o erro acima.
  pause
  exit /b 1
)
start "" http://localhost:5185
call npx vite preview --port 5185 --strictPort
