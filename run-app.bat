@echo off
REM One-click launcher for Windows: runs hidden Node launcher that manages backend & frontend lifecycle
cd /d "%~dp0"

REM Launch the VBScript shim which starts the Node launcher with hidden windows
wscript.exe "%~dp0scripts\launcher.vbs"

REM Optional: keep the batch file window open until the launcher exits
echo Launcher started. Closing this window will NOT stop the service.
pause > nul