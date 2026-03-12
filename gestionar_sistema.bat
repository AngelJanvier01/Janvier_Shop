@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Janvier Shop - Gestor del Sistema

set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"
set "BACKEND_DIR=%ROOT_DIR%\backend"
set "APP_PORT=3000"
set "LISTEN_STATES=LISTENING ESCUCHANDO"

call :header
call :check_prereqs || goto :finish

if not exist "%BACKEND_DIR%\package.json" (
    echo [ERROR] No se encontro "%BACKEND_DIR%\package.json".
    echo Ejecuta este .bat desde la raiz del repo Janvier_Shop.
    goto :finish
)

echo [1/3] Instalando o actualizando dependencias del backend...
pushd "%BACKEND_DIR%"
call npm install
if errorlevel 1 (
    echo [ERROR] Fallo "npm install".
    popd
    goto :finish
)
popd

set /p "RUN_UPDATE=Quieres ejecutar tambien 'npm update'? (s/N): "
if /I "%RUN_UPDATE%"=="s" (
    echo [2/3] Ejecutando update de paquetes...
    pushd "%BACKEND_DIR%"
    call npm update
    if errorlevel 1 (
        echo [AVISO] "npm update" reporto errores. Se continuara con el sistema.
    )
    popd
) else (
    echo [2/3] Omitido npm update.
)

set /p "START_NOW=Quieres iniciar el sistema ahora? (S/n): "
if /I "%START_NOW%"=="n" goto :finish_ok

echo [3/3] Iniciando backend...
call :start_server
if errorlevel 1 goto :finish

echo.
echo Sistema disponible en:
echo   - http://localhost:%APP_PORT%
echo   - http://localhost:%APP_PORT%/admin.html       ^(login admin^)
echo   - http://localhost:%APP_PORT%/admin-panel.html ^(requiere sesion^)
echo.

:menu
echo [MENU]
echo   1^) Abrir sitio en navegador
echo   2^) Ver estado del servidor
echo   3^) Detener sistema y salir
echo   4^) Salir y dejar sistema corriendo
set /p "OPT=Elige una opcion [1-4]: "

if "%OPT%"=="1" (
    start "" "http://localhost:%APP_PORT%"
    goto :menu
)
if "%OPT%"=="2" (
    call :show_status
    goto :menu
)
if "%OPT%"=="3" (
    call :stop_server
    goto :finish_ok
)
if "%OPT%"=="4" goto :finish_ok

echo Opcion invalida.
goto :menu

:check_prereqs
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js no esta instalado o no esta en PATH.
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm no esta disponible en PATH.
    exit /b 1
)

exit /b 0

:start_server
set "SERVER_PID="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%APP_PORT%" ^| findstr /I "%LISTEN_STATES%"') do (
    set "SERVER_PID=%%P"
)

if defined SERVER_PID (
    echo [OK] Ya hay un servidor escuchando en puerto %APP_PORT% ^(PID !SERVER_PID!^).
    exit /b 0
)

pushd "%BACKEND_DIR%"
start "Janvier Backend" /min cmd /c "node app.js"
popd

set "BOOT_STATUS=FAIL"
for /L %%I in (1,1,15) do (
    if /I "!BOOT_STATUS!" NEQ "OK" (
        set "SERVER_PID="
        for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%APP_PORT%" ^| findstr /I "%LISTEN_STATES%"') do (
            set "SERVER_PID=%%P"
        )
        if defined SERVER_PID (
            set "BOOT_STATUS=OK"
        ) else (
            timeout /t 1 >nul
        )
    )
)

if /I "!BOOT_STATUS!" NEQ "OK" (
    echo [ERROR] El servidor no responde en http://localhost:%APP_PORT%.
    echo Revisa la consola del backend o intenta iniciar de nuevo.
    exit /b 1
)

set "SERVER_PID="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%APP_PORT%" ^| findstr /I "%LISTEN_STATES%"') do (
    set "SERVER_PID=%%P"
)

if defined SERVER_PID (
    echo [OK] Backend iniciado. PID: !SERVER_PID!
) else (
    echo [OK] Backend iniciado.
)
exit /b 0

:show_status
set "API_STATUS=NO DISPONIBLE"

set "SERVER_PID="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%APP_PORT%" ^| findstr /I "%LISTEN_STATES%"') do (
    set "SERVER_PID=%%P"
)

if defined SERVER_PID (
    set "API_STATUS=ACTIVO"
    echo PID detectado en puerto %APP_PORT%: !SERVER_PID!
) else (
    echo PID detectado en puerto %APP_PORT%: ^(ninguno^)
)

echo Estado API: %API_STATUS%
echo URL: http://localhost:%APP_PORT%
exit /b 0

:stop_server
set "STOPPED=0"
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%APP_PORT%" ^| findstr /I "%LISTEN_STATES%"') do (
    taskkill /PID %%P /T /F >nul 2>&1
    if not errorlevel 1 set "STOPPED=1"
)

if "!STOPPED!"=="1" (
    echo [OK] Sistema detenido.
) else (
    echo [AVISO] No habia procesos activos en el puerto %APP_PORT%.
)
exit /b 0

:header
echo ============================================================
echo              JANVIER SHOP - GESTOR DEL SISTEMA
echo ============================================================
echo.
exit /b 0

:finish_ok
echo.
echo Proceso finalizado.
goto :end

:finish
echo.
echo Proceso finalizado con errores.
goto :end

:end
echo.
pause
endlocal
