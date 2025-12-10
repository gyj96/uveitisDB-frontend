# Backend bundle placeholder

将编译好的后端可执行文件、`config.yaml`、`nssm.exe`、安装/卸载批处理脚本等放在此目录下，Electron 打包时会把整个 `backend` 目录一并打包进安装包，并由 `installer.nsh` 通过 nssm 注册为 Windows 服务。
