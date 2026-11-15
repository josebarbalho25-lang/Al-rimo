@echo off
chcp 65001 >nul
title Al-rimo - montar o instalador
rem ==========================================================================
rem  Monta o instalador do Al-rimo (Windows). Dois cliques e espera.
rem  1. instala as ferramentas na primeira vez (app\ e instalador\)
rem  2. monta o app (o mesmo do navegador) e o programa, e fecha o .exe
rem  Sai em instalador\dist\Al-rimo-Setup-VERSAO.exe
rem ==========================================================================
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Falta o Node.js nesta maquina: https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist "app\node_modules" (
  echo Instalando as bibliotecas do app ^(so na primeira vez^)...
  pushd app
  call npm install --no-audit --no-fund || goto erro
  popd
)
if not exist "instalador\node_modules" (
  echo Instalando as ferramentas do instalador ^(so na primeira vez^)...
  pushd instalador
  call npm install --no-audit --no-fund || goto erro
  popd
)

pushd instalador
call npm run dist || goto erro
popd

echo.
echo   Pronto. O instalador esta na pasta:
echo   %~dp0instalador\dist
echo.
explorer "%~dp0instalador\dist"
pause
exit /b 0

:erro
popd 2>nul
echo.
echo   Deu erro - a mensagem esta acima. Nada foi apagado.
echo.
pause
exit /b 1
