!include "FileFunc.nsh"
!include "LogicLib.nsh"

!macro customInstall
  DetailPrint "注册后端服务..."
  StrCpy $0 "$INSTDIR\\backend"
  StrCpy $1 "$INSTDIR\\backend\\gyj-backend.exe"
  StrCpy $2 "$INSTDIR\\backend\\nssm.exe"
  ${IfThen} ${FileExists} "$2" ${|} ${Do}
    ExecWait '"$2" install "gyj-uveitis-service" "$1" "-config" "$0\\config.yaml"'
    ExecWait '"$2" set "gyj-uveitis-service" AppDirectory "$0"'
    ExecWait '"$2" start "gyj-uveitis-service"'
  ${DoElse}
    DetailPrint "未找到nssm.exe，略过服务安装"
  ${Do}
!macroend

!macro customUnInstall
  DetailPrint "停止并删除后端服务..."
  StrCpy $2 "$INSTDIR\\backend\\nssm.exe"
  ${IfThen} ${FileExists} "$2" ${|} ${Do}
    ExecWait '"$2" stop "gyj-uveitis-service"'
    ExecWait '"$2" remove "gyj-uveitis-service" confirm'
  ${DoElse}
    DetailPrint "未找到nssm.exe"
  ${Do}
!macroend
