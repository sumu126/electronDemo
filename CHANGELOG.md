# 变更记录

本文件记录框架层的变化（不含业务代码）。版本号与 `package.json` 保持一致，由 `APP_CONSTANTS` 一致性用例守护。

## Unreleased

### Added

- **主题**：`theme` 支持 `light / dark / auto`，颜色收敛为 CSS 变量（`src/renderer/styles/theme.css`），`auto` 跟随系统配色变化
- **多语言**：`language` 支持 `zh-CN / en-US`，渲染端 `useI18n()`、主进程 `getMessages()` 共用 `src/shared/i18n`；托盘菜单与通知也走同一份文案
- **错误边界**：`AppErrorBoundary` 捕获页面级异常，展示错误信息与重新加载入口，不再整页白屏
- **404 兜底**：新增 `NotFoundView` 与 catch-all 路由
- **主进程热重启**：`electron:dev` 改为 `scripts/dev.mjs`，监听 `src/main`、`src/preload`、`src/shared`，改动后自动重建并重启 Electron
- **真机冒烟**：`scripts/smoke.mjs` / `npm run smoke`，用临时 userData 启动真实 Electron，校验配置与日志落盘
- **CI 双平台**：ubuntu（xvfb）+ windows 矩阵，CI 中执行冒烟
- **组件测试**：jsdom + `@vue/test-utils`，覆盖 Modal、ConfigPanel、AppErrorBoundary、theme、i18n
- **覆盖率基线**：接入 `@vitest/coverage-v8` 并设阈值防倒退
- **提交钩子**：`prepare` 自动安装 pre-commit 钩子，跑五项门禁；`SKIP_GATES=1` 可跳过
- **插件文档**：`docs/插件开发.md` 与 `docs/examples/hello-module.cjs`，说明能力边界与安全清单
- **运行时锁定**：`engines`、`packageManager`、`.nvmrc`
- **userData 覆盖**：支持 `ELECTRON_USER_DATA_DIR`，便于便携模式与 CI 隔离

### Changed

- **IPC 契约**：`IpcInvokeMap` 由「只声明返回值」改为 `{ args, returns }`，`invoke` 变元组签名，错误参数在编译期失败；`IPC_CHANNELS` 加 `as const`
- **配置 schema**：`config:update` 只接受白名单键与合法类型；加载时裁剪未知键并备份 `config.json.bak`
- **日志**：主进程统一走 `getLogger()`（此前模块注册表等 11 处只打控制台）；写入改为异步串行队列 + 退出前 `flush()`
- **构建**：主进程改用 SSR 构建，修复 `process.env` 被 Vite 替换成 `{}`；渲染产物拆出 vendor 块；构建不再改写 `index.html`
- **文档目录**：`docments/` 拼写错误且与 `docs/` 重叠，合并到 `docs/`
- **门禁**：新增 `format:check`；全仓应用 Prettier；`.gitattributes` 统一 LF
- **依赖**：移除 `concurrently`、`wait-on`，新增 `@vitest/coverage-v8`、`jsdom`、`@vue/test-utils`

### Fixed

- **IPC sender 校验**：`startsWith` 前缀匹配可被 `localhost:5173.evil.com`、`@evil.com`、`51730` 绕过，改为按 `URL.origin` 精确比对；打包态拒绝带主机的 `file://`
- **子窗口守卫**：`createWindow` 创建的子窗口此前没有导航/外链守卫
- **配置并发写**：窗口状态防抖与 `setValue` 可能互相覆盖，改为串行化 + 临时文件 rename 原子写
- **托盘失败**：托盘创建失败仍会隐藏窗口，导致窗口消失且无法唤回
- **退出卡死**：模块 `destroy()` 卡住会让应用永远退不出去，现为 3 秒超时兜底
- **Modal 可达性**：补 ESC 关闭、Tab 焦点陷阱、焦点归还、滚动锁、`role="dialog"`；`closable=false` 时不再渲染无效关闭按钮
- **生产 CSP**：`ws://localhost:5173` 只在开发态注入
- **Windows 通知**：补 `AppUserModelId`
- **启动体验**：`show: false` + `ready-to-show`，消除白屏闪烁；`did-fail-load` 兜底显示

### Security

- **移除 `file:read` / `file:write`**：这两个通道能写进 `userData/modules`，而该目录会在下次启动时被执行，等于给渲染进程留下「写插件 → 重启生效」的持久化提权链。框架不再提供通用文件读写通道
- **配置原型键**：拒绝 `__proto__`、`constructor`、`prototype`

### Docs

- README 重写为框架使用指南，补充主题/语言、插件、热重启、冒烟与门禁说明
- 路线图新增第 9、10、11 节，记录各轮改动与验证结果
