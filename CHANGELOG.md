# 变更记录

本文件记录框架层的变化（不含业务代码）。版本号与 `package.json` 保持一致，由 `APP_CONSTANTS` 一致性用例守护。

## Unreleased

### 配置源改为 `.env`（取代下方 `config.json` 相关条目）

- **新增 `.env` 项目配置**：仓库根目录 `.env`（打包后 `resources/.env`）成为唯一配置来源；`src/main/utils/env.ts` 负责解析（BOM / 注释 / `export` / 引号 / 行内注释）与路径解析（`ELECTRON_ENV_FILE` 覆盖），`src/shared/config/from-env.ts` 负责映射与校验，非法值 warning 后回退默认值
- **新增 `.env.example`**：仓库只跟踪模板，本地复制为 `.env`；`.gitignore` 忽略 `.env` / `.env.*` 但显式放行 `!.env.example`；`scripts/ensure-env.mjs` 在 `install` / `dev` / `build` 时自动补齐本地 `.env`
- **移除 `config.json` 持久化**：`ConfigModule` 改为启动时读取 `.env`，删除 `saveConfig` / `updateConfig` / `setValue` / 写队列 / `configPath`、`src/shared/config/schema.ts`、`src/main/utils/early-config.ts` 及对应测试
- **移除 `config:update`**：`constants` / `types` / `ipc.manager` / preload 白名单同步删除；渲染进程只能通过 `config:get` 读取
- **窗口状态不再持久化**：删除 resize/move 防抖落盘与 `createWindowStateSnapshot`，窗口尺寸/位置改由 `.env` 的 `WINDOW_*` 决定
- **托盘通知改为会话内状态**：默认本次运行只提示一次；`TRAY_BALLOON_NOTIFICATION_ENABLED=true` 时每次提示；移除 `tray.hasShownFirstTimeNotice`
- **设置页只读**：`ConfigPanel` 只展示主题、语言、开发者工具与沙箱状态，并提示编辑 `.env` 后重启
- **开发体验**：`electron:dev` 监听根目录 `.env`，保存后自动重启 Electron
- **打包**：`extraResources` 把 `.env` 复制到安装包 `resources/.env`
- **测试**：`smoke` / `e2e` 改用临时 `.env` + `ELECTRON_ENV_FILE`；e2e 覆盖「首启配置生效 → 设置页只读 → 改 `.env` → 重启尺寸/主题/语言生效」；新增 `env.test.ts` 与 `from-env.test.ts`
- **配置健壮性**：启动日志按 `.env` 是否存在判断（空模板不再误报 not found）；引号值支持行内注释（`THEME="dark" # 深色`）；`npm install` 与 `npm run dev` 也会补齐本地 `.env`
- 下方「配置 schema」「配置并发写」「`config.json` 的 `version`」条目随 `config.json` 一并失效，仅留作历史记录

### Added

- **主题**：`theme` 支持 `light / dark / auto`，颜色收敛为 CSS 变量（`src/renderer/styles/theme.css`），`auto` 跟随系统配色变化
- **多语言**：`language` 支持 `zh-CN / en-US`，渲染端 `useI18n()`、主进程 `getMessages()` 共用 `src/shared/i18n`；托盘菜单与通知也走同一份文案
- **错误边界**：`AppErrorBoundary` 捕获页面级异常，展示错误信息与重新加载入口，不再整页白屏
- **404 兜底**：新增 `NotFoundView` 与 catch-all 路由
- **主进程热重启**：`electron:dev` 改为 `scripts/dev.mjs`，监听 `src/main`、`src/preload`、`src/shared`，改动后自动重建并重启 Electron
- **真机冒烟**：`scripts/smoke.mjs` / `npm run smoke`，用临时 userData 启动真实 Electron，校验配置与日志落盘
- **真实交互 e2e**：`scripts/e2e.mjs` / `npm run e2e`，通过渲染进程远程调试端口驱动界面，覆盖「打开配置 → 改主题 → 保存 → 切语言 → 校验落盘与主题生效」；CI 双平台各跑一次
- **CI 双平台**：ubuntu（xvfb）+ windows 矩阵，CI 中执行冒烟与 e2e
- **支持平台收口**：官方支持 Windows 10+ 与 Linux，macOS 明确不发布、不验证
- **Linux 打包**：`build.linux` 增加 AppImage + deb 目标（`category` / `maintainer` / `synopsis`）与 `npm run electron:build-linux`；Linux 包需在 Linux 上构建
- **Linux 出包流水线**：新增 `.github/workflows/package-linux.yml`，推送 main 或打 `v*` tag 时在 ubuntu runner 上产出 AppImage + deb 并上传 artifact（尚未实跑，首次推送后验证）
- **组件测试**：jsdom + `@vue/test-utils`，覆盖 Modal、ConfigPanel、AppErrorBoundary、theme、i18n
- **覆盖率基线**：接入 `@vitest/coverage-v8` 并设阈值防倒退
- **提交钩子**：`prepare` 自动安装 pre-commit 钩子，跑五项门禁；`SKIP_GATES=1` 可跳过
- **插件文档**：`docs/插件开发.md` 与 `docs/examples/hello-module.cjs`，说明能力边界与安全清单
- **运行时锁定**：`engines`、`packageManager`、`.nvmrc`
- **userData 覆盖**：支持 `ELECTRON_USER_DATA_DIR`，便于便携模式与 CI 隔离
- **渲染端异常上报**：新增 `log:report` 通道与 `renderer/utils/report`，`errorHandler`、`unhandledrejection`、`AppErrorBoundary`、`useSystemInfo` 的异常写进 `main.log`；通道自带级别白名单、2000 字符截断与 10 秒 50 条限流
- **启动耗时打点**：`Startup completed` 记录 `ready` / `modules` / `ipc` / `window` / `total` 分段耗时
- **应用菜单**：基于原生 role 的菜单（菜单文字跟随系统语言），macOS 保留 `appMenu`
- **主进程单测**：为 `ConfigModule`、`IpcManager`、`app-logger` 补 electron mock 用例，覆盖率 35% → 48%

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
- **配置保存报 `An object could not be cloned.`**：Vue 的 ref/reactive 是 Proxy，无法被 IPC 的结构化克隆复制。配置更新与日志上报现在先在渲染进程转成纯数据再 `invoke`；失败提示也从原始英文异常改成可读文案并写入日志
- **`assets/icon.png` 是改了扩展名的 ICO**：与 `icon.ico` 字节完全相同，Windows 不受影响，但 Linux 打包要求真 PNG。已重采样为 512×512 真 PNG（正式发布建议换成设计稿导出的 512/1024 版本）
- **Linux 托盘图标不可见却仍拦截关窗**：原逻辑只看 `icon.ico` 是否存在，Linux 上 `nativeImage` 可能解不出 ICO，得到空图像 → 托盘不可见，但窗口仍被 `hide()`。现在按 ico → png 顺序取第一个能解码的；全部不可用时按托盘不可用处理，允许直接关窗
- **ConfigPanel 无障碍**：`label` 补 `for`/`id` 关联，保存失败提示补 `aria-live="polite"`
- **`config.json` 的 `version` 不再过期**：原先只在首次写默认值时取自 `app.getVersion()`，升级应用后一直是旧值；现在每次加载都刷新（`version` 是应用元数据，不是用户配置）
- **冒烟脚本的日志竞态**：`smoke` 只等 `config.json` 与 `main.log` 文件出现就断言「Main window created」，但配置文件早于建窗日志、日志又是异步落盘，Windows CI 首跑因此失败。改为轮询到目标日志行真正出现，失败时输出日志末尾

### Removed

- **7 个无调用方的公开 API**：`WindowManager.createWindow/closeWindow/getWindow/getAllWindows`（框架只建主窗口）、`ModuleManager.registerModule/unregisterModule/listModules`、`IpcManager.unregisterHandler`——留着会让人误以为支持多窗口
- **`renderer/stores/app.store.ts`**：与 `features.developerTools` 同名的会话级状态，合并为首页局部状态，语义改为「调试工具」
- **`features.autoUpdate`**：自动更新是明确的非目标，保留这个永远不生效的开关会误导使用者；类型、默认值、schema、配置面板与中英文案一并移除。旧配置里的该字段会按未知键裁剪（有 `.bak` 备份），打包配置保持 `publish: null`
- **`features.analytics`**：新框架不内置遥测/埋点，这个勾了也不生效的开关同样移除；需要业务级开关的按 README 的「新增一个功能开关」recipe 自己加。旧配置里的该字段按未知键裁剪

### Security

- **移除 `file:read` / `file:write`**：这两个通道能写进 `userData/modules`，而该目录会在下次启动时被执行，等于给渲染进程留下「写插件 → 重启生效」的持久化提权链。框架不再提供通用文件读写通道
- **生产态收起 DevTools**：默认菜单里的「开发者工具」会让打包后的用户打开 DevTools 改状态、读内存数据；现在菜单项与 F12 / Ctrl+Shift+I / Cmd+Alt+I 都受 `features.developerTools` 控制，`devtools-opened` 还有兜底关闭
- **配置原型键**：拒绝 `__proto__`、`constructor`、`prototype`
- **日志上报限流**：`log:report` 只接受声明过的级别，消息截断 2000 字符，10 秒最多 50 条

### Docs

- README 重写为框架使用指南，补充主题/语言、插件、热重启、冒烟与门禁说明
- 路线图新增第 9、10、11、12 节，记录各轮改动与验证结果
- 明确两个非目标：**自动更新不做**（第 13 节）、**代码签名不做**（第 14 节，交给使用方）
- `.gitignore` 增加证书与本地环境文件（`*.pfx` / `*.p12` / `.env` 等），避免误提交
- **新增[架构说明](docs/架构.md)**：分层与依赖方向、一次 IPC 的完整链路、启动顺序、配置/日志/安全模型、扩展点对照表、关键取舍、门禁分工
- **重写[API 实现示例](docs/API实现示例.md)**：旧版仍在使用已删除的 `BaseIpcHandler`、IPC 信封、`file:read`、`user.service`；新版按当前契约（参数元组 + 白名单 + `toPlain`）走完"类型 → 模块 → handler → 注册 → preload → store → 组件 → 文案 → 测试 → 验证"9 步，并给出常见坑对照表
- **重写[功能详解](docs/框架功能详解.md)**：从 433 行散文改为"功能索引 + 源码位置"（含 IPC 通道表、配置项与消费方对照、与旧版差异），顺带纠正"支持 macOS""文件处理器""多窗口支持"等过时描述
- **重写[使用指南](docs/框架使用指南.md)**：聚焦"五分钟跑起来 + 常见任务 + 调试 + 打包 + 真实 FAQ"，补上 `ELECTRON_RUN_AS_NODE`、Proxy 克隆、schema 拒绝、托盘缺失等实际踩过的坑
- README 的文档区改为"想知道什么 → 看哪份"的对照表
