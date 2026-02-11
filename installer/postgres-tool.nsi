; Postgres Code Query Tool - Windows Installer
; This script is invoked by scripts/package-installer.cjs

!ifndef APP_NAME
  !define APP_NAME "Postgres Code Query Tool"
!endif

!ifndef APP_ID
  !define APP_ID "PostgresCodeQueryTool"
!endif

!ifndef APP_VERSION
  !define APP_VERSION "0.0.0"
!endif

!ifndef SOURCE_DIR
  !define SOURCE_DIR "..\release"
!endif

!ifndef INSTALLER_OUTPUT
  !define INSTALLER_OUTPUT "..\release\postgres-code-query-tool-setup.exe"
!endif

Unicode true
Name "${APP_NAME}"
OutFile "${INSTALLER_OUTPUT}"
InstallDir "$PROGRAMFILES64\${APP_ID}"
InstallDirRegKey HKCU "Software\${APP_ID}" "InstallDir"
RequestExecutionLevel admin
SetCompress auto
SetCompressor lzma

Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Section "Install"
  ; Kill existing process before installing to avoid "Can't write" error
  DetailPrint "Stopping existing service..."
  nsExec::Exec 'taskkill /F /IM postgres-tool.exe /T'
  Sleep 1000

  SetOutPath "$INSTDIR"
  File /r "${SOURCE_DIR}\*.*"

  ; Allow regular users to modify files inside installation directory (settings.json, logs, etc.)
  nsExec::Exec 'icacls "$INSTDIR" /grant *S-1-5-32-545:(OI)(CI)M'
  Pop $0

  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  ; Main app shortcuts with custom icon
  CreateShortCut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\start-hidden.vbs" "" "$INSTDIR\icons\app.ico"
  CreateShortCut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\start-hidden.vbs" "" "$INSTDIR\icons\app.ico"

  ; Stop service shortcut (no custom icon)
  CreateShortCut "$SMPROGRAMS\${APP_NAME}\Stop Service.lnk" "$INSTDIR\stop.bat"

  WriteRegStr HKCU "Software\${APP_ID}" "InstallDir" "$INSTDIR"

  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "Publisher" "Local Deployment"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "UninstallString" "$\"$INSTDIR\uninstall.exe$\""
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "NoRepair" 1

  WriteUninstaller "$INSTDIR\uninstall.exe"
SectionEnd

Section "Uninstall"
  IfFileExists "$INSTDIR\stop.bat" 0 +3
    MessageBox MB_OKCANCEL "Остановить запущенный сервис?" IDOK +2
    ExecWait '"$INSTDIR\stop.bat"'

  Delete "$DESKTOP\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\Stop Service.lnk"
  RMDir "$SMPROGRAMS\${APP_NAME}"

  Delete "$INSTDIR\uninstall.exe"
  RMDir /r "$INSTDIR"

  DeleteRegKey HKCU "Software\${APP_ID}"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}"
SectionEnd
