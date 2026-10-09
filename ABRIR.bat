@echo off
rem Abre o Al-rimo no navegador (servidor local na porta 5180; fechar esta janela fecha o app).
cd /d "%~dp0app"
start "" http://localhost:5180
npm run dev
