@echo off
setlocal EnableExtensions DisableDelayedExpansion

title HP App LanceDB - Start + Install

cd /d "%~dp0"

:: ==========================================================
:: START.BAT UNIFICADO PARA WINDOWS - APP NEXT.JS + LANCEDB
:: Puerto: 3000
::
:: Este arranque esta ajustado para package.json con:
:: - Next.js en puerto 3000
:: - LanceDB en Windows usando LANCEDB_PLATFORM=win32-x64-msvc
:: - Prisma 6.19.3 usando npx --yes prisma@6.19.3
::
:: Flujo:
:: - Verifica/instala Node.js LTS si hace falta.
:: - Verifica npm.
:: - Crea .env y .env.local si no existen.
:: - Instala dependencias si no existe node_modules.
:: - Crea carpetas locales utiles para datos.
:: - Ejecuta Prisma si existe prisma\schema.prisma.
:: - Si el servidor ya esta activo, abre el navegador.
:: - Si no esta activo, inicia la app y abre el navegador.
:: ==========================================================

set "PORT=3000"
set "APP_URL=http://localhost:%PORT%"
set "LOGFILE=start-log.txt"
set "LANCEDB_PLATFORM=win32-x64-msvc"
set "PRISMA_VERSION=6.19.3"
set "ERRORS=0"

> "%LOGFILE%" echo =========================================
>> "%LOGFILE%" echo HP App LanceDB Windows unified start/install log
>> "%LOGFILE%" echo Fecha: %date% %time%
>> "%LOGFILE%" echo Puerto: %PORT%
>> "%LOGFILE%" echo APP_URL: %APP_URL%
>> "%LOGFILE%" echo LANCEDB_PLATFORM: %LANCEDB_PLATFORM%
>> "%LOGFILE%" echo PRISMA_VERSION: %PRISMA_VERSION%
>> "%LOGFILE%" echo =========================================
>> "%LOGFILE%" echo.

cls
echo ==========================================================
echo              HP APP LANCEDB - START + INSTALL
echo ==========================================================
echo.
echo Carpeta del proyecto:
echo %CD%
echo.
echo URL de la app:
echo %APP_URL%
echo.
echo Plataforma LanceDB:
echo %LANCEDB_PLATFORM%
echo.
echo Log:
echo %LOGFILE%
echo ==========================================================
echo.

if not exist "package.json" (
  echo [ERROR] No se encontro package.json en esta carpeta.
  echo [ERROR] No se encontro package.json en esta carpeta. >> "%LOGFILE%"
  echo Copia este start.bat dentro de la raiz del proyecto.
  echo.
  pause
  exit /b 1
)

call :RefreshPathSafe
call :CheckOrInstallNode
if errorlevel 1 goto :fatal

call :CheckNpm
if errorlevel 1 goto :fatal

call :PrintVersions

call :CheckServerRunning
if "%SERVER_RUNNING%"=="1" (
  echo.
  echo ==========================================================
  echo [OK] La app ya parece estar ejecutandose en:
  echo %APP_URL%
  echo.
  echo Abriendo navegador...
  echo ==========================================================
  echo [OK] Servidor ya activo en %APP_URL% >> "%LOGFILE%"
  start "" "%APP_URL%"
  echo.
  echo Puedes cerrar esta ventana.
  pause
  exit /b 0
)

call :EnsureEnvFiles
call :EnsureLocalFolders
call :InstallDependenciesIfNeeded
if errorlevel 1 goto :fatal

call :PreparePrismaIfNeeded
if errorlevel 1 goto :fatal

call :OpenBrowserSoon

echo.
echo ==========================================================
echo Iniciando servidor de desarrollo...
echo URL local: %APP_URL%
echo LanceDB: %LANCEDB_PLATFORM%
echo.
echo Para detener el servidor usa CTRL + C.
echo ==========================================================
echo.
echo [INFO] Ejecutando npm run dev:windows >> "%LOGFILE%"

call npm run dev:windows
set "EXITCODE=%ERRORLEVEL%"

echo.
echo ==========================================================
echo Servidor detenido. Codigo de salida: %EXITCODE%
echo ==========================================================
echo Servidor detenido. Codigo de salida: %EXITCODE% >> "%LOGFILE%"
pause
exit /b %EXITCODE%


:CheckOrInstallNode
echo ==========================================================
echo [1/7] Verificando Node.js...
echo ==========================================================
echo [1/7] Verificando Node.js... >> "%LOGFILE%"

where node >nul 2>&1
if not errorlevel 1 (
  echo [OK] Node.js detectado.
  echo [OK] Node.js detectado. >> "%LOGFILE%"
  echo.
  exit /b 0
)

echo [ADVERTENCIA] Node.js no esta instalado o no esta en PATH.
echo [ADVERTENCIA] Node.js no esta instalado o no esta en PATH. >> "%LOGFILE%"

where winget >nul 2>&1
if errorlevel 1 (
  echo [ERROR] No se encontro winget. Instala Node.js LTS manualmente.
  echo [ERROR] No se encontro winget. Instala Node.js LTS manualmente. >> "%LOGFILE%"
  echo Descarga Node.js LTS desde el sitio oficial y vuelve a ejecutar este archivo.
  echo.
  exit /b 1
)

echo Instalando Node.js LTS con winget...
echo Instalando Node.js LTS con winget... >> "%LOGFILE%"
winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements >> "%LOGFILE%" 2>&1

call :RefreshPathSafe

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js se instalo, pero aun no aparece en PATH.
  echo [ERROR] Node.js se instalo, pero aun no aparece en PATH. >> "%LOGFILE%"
  echo Cierra esta ventana, abre una nueva y vuelve a ejecutar start.bat.
  echo.
  exit /b 1
)

echo [OK] Node.js instalado/detectado.
echo [OK] Node.js instalado/detectado. >> "%LOGFILE%"
echo.
exit /b 0


:CheckNpm
echo ==========================================================
echo [2/7] Verificando npm...
echo ==========================================================
echo [2/7] Verificando npm... >> "%LOGFILE%"

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm no esta disponible.
  echo [ERROR] npm no esta disponible. >> "%LOGFILE%"
  echo Reinstala Node.js LTS o revisa el PATH.
  echo.
  exit /b 1
)

echo [OK] npm detectado.
echo [OK] npm detectado. >> "%LOGFILE%"
echo.
exit /b 0


:PrintVersions
echo Versiones detectadas:
call node -v
call npm -v
echo.
echo Versiones detectadas: >> "%LOGFILE%"
call node -v >> "%LOGFILE%" 2>&1
call npm -v >> "%LOGFILE%" 2>&1
echo. >> "%LOGFILE%"
exit /b 0


:CheckServerRunning
set "SERVER_RUNNING=0"
set "SERVER_PID="

echo ==========================================================
echo [3/7] Verificando si el servidor ya esta activo...
echo ==========================================================
echo [3/7] Verificando servidor en %APP_URL% >> "%LOGFILE%"

for /f "tokens=5" %%A in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  set "SERVER_RUNNING=1"
  set "SERVER_PID=%%A"
  goto :server_checked
)

:server_checked
if "%SERVER_RUNNING%"=="1" (
  echo [OK] Puerto %PORT% activo. PID: %SERVER_PID%
  echo [OK] Puerto %PORT% activo. PID: %SERVER_PID% >> "%LOGFILE%"
) else (
  echo [INFO] No hay servidor activo en el puerto %PORT%.
  echo [INFO] No hay servidor activo en el puerto %PORT%. >> "%LOGFILE%"
)
echo.
exit /b 0


:EnsureEnvFiles
echo ==========================================================
echo [4/7] Verificando archivos de entorno...
echo ==========================================================
echo [4/7] Verificando archivos de entorno... >> "%LOGFILE%"

if not exist ".env.local" (
  echo [INFO] Creando .env.local base...
  echo [INFO] Creando .env.local base... >> "%LOGFILE%"
  (
    echo # Archivo generado por start.bat
    echo # Ajusta estos valores si tu app usa autenticacion, base de datos externa o APIs.
    echo DATABASE_URL=file:./prisma/dev.db
    echo NEXTAUTH_URL=%APP_URL%
    echo NEXTAUTH_SECRET=change-me-local-dev-secret
    echo LANCEDB_PLATFORM=%LANCEDB_PLATFORM%
  ) > ".env.local"
) else (
  echo [OK] .env.local ya existe. No se modifica.
  echo [OK] .env.local ya existe. No se modifica. >> "%LOGFILE%"
)

if not exist ".env" (
  echo [INFO] Creando .env base...
  echo [INFO] Creando .env base... >> "%LOGFILE%"
  (
    echo DATABASE_URL=file:./prisma/dev.db
    echo LANCEDB_PLATFORM=%LANCEDB_PLATFORM%
  ) > ".env"
) else (
  echo [OK] .env ya existe. No se modifica.
  echo [OK] .env ya existe. No se modifica. >> "%LOGFILE%"
)

echo.
exit /b 0


:EnsureLocalFolders
echo ==========================================================
echo [5/7] Verificando carpetas locales...
echo ==========================================================
echo [5/7] Verificando carpetas locales... >> "%LOGFILE%"

if not exist "data" mkdir "data" >nul 2>&1
if not exist "data\lancedb" mkdir "data\lancedb" >nul 2>&1
if not exist "uploads" mkdir "uploads" >nul 2>&1
if not exist "storage" mkdir "storage" >nul 2>&1

echo [OK] Carpetas locales verificadas.
echo [OK] Carpetas locales verificadas. >> "%LOGFILE%"
echo.
exit /b 0


:InstallDependenciesIfNeeded
echo ==========================================================
echo [6/7] Verificando dependencias...
echo ==========================================================
echo [6/7] Verificando dependencias... >> "%LOGFILE%"

if exist "node_modules" (
  echo [OK] node_modules existe. Saltando npm install.
  echo [OK] node_modules existe. Saltando npm install. >> "%LOGFILE%"
  echo.
  exit /b 0
)

echo [INFO] node_modules no existe. Instalando dependencias con npm...
echo [INFO] Esto puede tardar varios minutos.
echo [INFO] npm install >> "%LOGFILE%"

call npm install
if errorlevel 1 (
  echo [ERROR] Fallo npm install.
  echo [ERROR] Fallo npm install. >> "%LOGFILE%"
  echo Revisa el archivo %LOGFILE%.
  echo.
  exit /b 1
)

echo [OK] Dependencias instaladas.
echo [OK] Dependencias instaladas. >> "%LOGFILE%"
echo.
exit /b 0


:PreparePrismaIfNeeded
echo ==========================================================
echo [7/7] Verificando Prisma...
echo ==========================================================
echo [7/7] Verificando Prisma... >> "%LOGFILE%"

if not exist "prisma\schema.prisma" (
  echo [INFO] No se encontro prisma\schema.prisma. Se omite Prisma.
  echo [INFO] No se encontro prisma\schema.prisma. Se omite Prisma. >> "%LOGFILE%"
  echo.
  exit /b 0
)

echo [INFO] Prisma detectado. Generando cliente con Prisma %PRISMA_VERSION%...
echo [INFO] npx --yes prisma@%PRISMA_VERSION% generate >> "%LOGFILE%"
call npx --yes prisma@%PRISMA_VERSION% generate
if errorlevel 1 (
  echo [ERROR] Fallo npx prisma generate.
  echo [ERROR] Fallo npx prisma generate. >> "%LOGFILE%"
  echo.
  exit /b 1
)

echo [INFO] Aplicando esquema de Prisma a la base local...
echo [INFO] npx --yes prisma@%PRISMA_VERSION% db push >> "%LOGFILE%"
call npx --yes prisma@%PRISMA_VERSION% db push
if errorlevel 1 (
  echo [ERROR] Fallo npx prisma db push.
  echo [ERROR] Fallo npx prisma db push. >> "%LOGFILE%"
  echo.
  exit /b 1
)

echo [OK] Prisma preparado correctamente.
echo [OK] Prisma preparado correctamente. >> "%LOGFILE%"
echo.
exit /b 0


:OpenBrowserSoon
echo [INFO] El navegador se abrira automaticamente en unos segundos...
echo [INFO] Abriendo navegador automatico en %APP_URL% >> "%LOGFILE%"

start "Abrir HP App LanceDB" cmd /c "timeout /t 5 /nobreak >nul && start "" "%APP_URL%""

exit /b 0


:RefreshPathSafe
set "PATH=%ProgramFiles%\nodejs;%SystemRoot%\system32;%SystemRoot%;%SystemRoot%\System32\Wbem;%PATH%"
exit /b 0


:fatal
echo.
echo ==========================================================
echo ERROR: No se pudo preparar o iniciar la app.
echo Revisa el archivo:
echo %LOGFILE%
echo ==========================================================
echo.
pause
exit /b 1
