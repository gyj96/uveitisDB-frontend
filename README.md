# gyj 葡萄膜炎临床数据库前端 (Electron + Vue 3 + Element Plus)

## 开发

```bash
cd frontend
npm install
npm run dev   # 自动拉起 Vite + Electron 窗口，无需浏览器
```

## 打包

将编译好的后端可执行文件、`config.yaml`、`nssm.exe` 及安装/卸载脚本放入 `frontend/backend/` 后执行：

```bash
npm run build:win   # 生成 Windows 安装包，安装后自动用 nssm 注册/自启后端服务
```

`build:mac` 与 `build:linux` 同理。
