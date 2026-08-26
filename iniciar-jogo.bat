@echo off
setlocal
set "PHP_DIR=%~dp0..\..\bin\php"
set "PHP_EXE="
for /r "%PHP_DIR%" %%F in (php.exe) do if not defined PHP_EXE set "PHP_EXE=%%F"
if not defined PHP_EXE (
  echo PHP do Laragon nao foi encontrado.
  echo Inicie o Apache pelo Laragon ou verifique a pasta bin\php.
  pause
  exit /b 1
)
start "Conta e Combate" http://127.0.0.1:8088/
"%PHP_EXE%" -S 127.0.0.1:8088 -t "%~dp0"
