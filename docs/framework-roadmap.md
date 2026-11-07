# Electron + Vue3 框架补齐路线

> 基于 2026-11 的全仓审查（安全修复已合入 `9c5dacf`）。本文件描述"还缺什么、按什么顺序补、每步如何验收"。

## 1. 现状判定

安全底线已具备：preload 通道白名单、文件读写限定 `userData`、`sandbox: true`、IPC 返回类型。
但项目仍属于"可运行示例"，不是"框架"，缺四层能力：

| 层次 | 缺口 |
|---|---|
| 工程化 | 无测试、无 lint、无 CI、无 typecheck 脚本、无提交门禁 |
| 核心能力 | 无路由、配置双数据源、模块系统只有壳、主题/i18n/功能开关空转、窗口状态不持久化 |
| 架构收敛 | IPC 信封抽象无效、shared 混入 electron、工具函数重复、死组件与死方法 |
| 交付链路 | 无日志/异常体系、无自动更新、无 CSP/导航防护、打包冗余、无签名 |

## 2. 目标与验收判据

**可维护**：任何改动都能被 `typecheck + lint + test + build` 四道门在本地和 CI 拦住。
**可复用**：新增页面、模块、配置项都有明确落点，不需要改框架内核。
**可交付**：具备日志、错误上报、更新与安装包产出能力。

## 3. 分阶段计划

### Phase 1 — 工程化门禁（本次实施）

- 增加脚本：`typecheck`、`lint`、`lint:fix`、`format`、`test`、`test:watch`
- 引入 ESLint 10（flat config，TS + Vue essential 规则）与 Prettier
- 引入 Vitest 5，落地首批单元测试：
  - `isPathInside` 路径守卫（含 `..foo` 回归用例）
  - `shared/utils/helpers` 的 `deepMerge`、`formatDate`、`validateEmail`
- 增加 GitHub Actions CI：`npm ci → typecheck → lint → test → build`
- 清理上一轮评审的 P2：路径前缀误判、未使用导入/方法、文件末尾换行

**验收**：以下命令全部通过，且 CI 与本地一致。

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

### Phase 2 — 架构收敛与核心能力

1. **配置单一数据源**：删除渲染端 `localStorage` 副本，统一走 `config:get/update` + Pinia
2. **路由骨架**：引入 `vue-router`，定义页面目录与窗口内路由约定
3. **窗口状态持久化**：读写 `window.x/y/width/height/maximized`
4. **模块系统契约化**：定义 `Module` 生命周期、动态加载/卸载、失败隔离
5. **日志与全局异常**：主进程统一 logger，渲染端 `app.config.errorHandler`，预留崩溃上报接口
6. **清理死代码**：`Table.vue`、`Message.vue`、`message.ts`、`useAppConfig`、`useWindowControl`，以及重复工具函数

**验收**：配置文件只有一处写入路径；新增页面/模块只需按约定放文件，不改内核。

### Phase 3 — 开发者体验与交付基线

1. 安全收尾：生产 CSP、`setWindowOpenHandler`、`will-navigate`、权限请求处理、IPC sender 校验（已完成）
2. 开发体验：修复启动竞态、精简脚本、明确主进程调试方式、补充目录约定
3. 打包洁净度：移除 `node_modules/**/*` 全量打包、`.env` 出包、精简冗余打包脚本
4. 文档：README 快速开始、页面/IPC/模块 recipes、架构说明

**验收**：按 README 能独立完成开发、测试与打包，新增页面/IPC/模块不需要改框架内核。

> 明确不做：自动更新。本项目的定位是快速开发框架，不绑定具体的发布渠道与更新源。

## 4. 本次明确不做

- 不引入 UI 组件库，不重做界面
- 不做自动更新、代码签名与多平台发布（框架不绑定具体发布渠道）

## 5. 风险与约束

- 仓库当前无测试基线，首批测试只覆盖纯函数，不引入 jsdom/组件测试，避免一次性铺开
- ESLint 采用 `vue/flat/essential`，不启用全套格式规则，避免产生与功能无关的全仓格式化 diff
- Prettier 只提供命令，不纳入 CI，待后续统一格式化时再启用

## 6. Phase 1 实施记录（2026-11-06）

已完成：质量脚本、ESLint 10（flat config）、Prettier、Vitest 5（9 个用例）、GitHub Actions CI，以及路径守卫 `..foo` 误判、未使用导入/方法等 P2 清理。

验证结果：`typecheck`、`lint`、`test`（2 文件 / 9 用例）、`build`、Electron 隔离冒烟全部通过。

## 7. Phase 2 实施记录（2026-11-06）

已完成第一项：**配置单一数据源**。

- 新增 `src/shared/config/defaults.ts`，主进程与渲染进程共用同一份默认配置
- 新增 `src/renderer/stores/config.store.ts`，渲染进程所有配置读写统一走 `config:get/update`
- 删除 localStorage 版 `src/renderer/services/config.service.ts`
- `ConfigModule.updateConfig` 改为深合并，修复局部更新覆盖同级字段的问题
- 窗口状态持久化：启动时读取 `config.window`，移动/缩放/最大化后防抖写回，关闭时立即落盘，离屏位置自动丢弃
- 路由骨架：引入 `vue-router` 4，使用 hash 模式兼容打包后的 `file://`；页面统一放 `views/`，`App.vue` 收敛为 `RouterView`，首页懒加载
- 模块系统契约化：抽出 `Module` 接口与 `ModuleRegistry`（生命周期/失败隔离/卸载），新增 `userData/modules` 目录加载器；核心模块失败中断启动，用户模块失败只隔离自身
- 日志与全局异常：主进程统一文件日志（`userData/logs/main.log`），捕获 `uncaughtException` / `unhandledRejection`；渲染端增加 `app.config.errorHandler` 与 `unhandledrejection` 兜底

验证结果：32 个用例通过；Electron 隔离启动后自动生成 `userData/config.json` 与 `logs/main.log`；预置 1000×700 / (100,100) 的窗口状态可被正确恢复并在关闭时写回；路由正常挂载；`userData/modules` 下的 `hello.cjs` 可动态加载并初始化。

### 死代码清理

- 删除未使用的 `Table.vue`、`Message.vue`、`renderer/utils/message.ts`、`renderer/utils/index.ts`
- 移除未接线的 `useAppConfig`、`useWindowControl` 与 app store 中的冗余字段
- 删除未实现、无消费方的 IPC 通道常量
- 移除未使用依赖 `@vueuse/core`、`execa`

Phase 2 已完成。Phase 3 待启动：安全收尾（CSP / 导航拦截 / 权限）、自动更新、打包发布与文档。

## 8. Phase 3 实施记录（2026-11-06）

已完成安全收尾：

- `index.html` 增加 CSP（`script-src 'self'`、禁止 `unsafe-eval`，开发态放行 Vite WebSocket）
- 窗口增加 `setWindowOpenHandler`（仅 https 外链交给系统浏览器）与 `will-navigate` 白名单
- `session.setPermissionRequestHandler` 默认拒绝所有 Web 权限
- IPC 增加 sender 来源校验（开发态只信任 `http://localhost:5173`，打包后只信任 `file://`）

验证结果：34 个用例通过；Electron 冒烟无 CSP 拦截、无 IPC 拦截、无渲染错误，开发态原有的 Electron CSP 警告消失。

### 开发者体验与交付基线

- `electron:dev` 改用 `wait-on` 探测端口，移除固定 3 秒延时与 `delay-electron.js`
- 托盘通知开关从 `.env` 收敛到 `config.json` 的 `tray.balloonNotificationEnabled`，删除 `.env` 与 dotenv 依赖
- 打包 `files` 移除全量 `node_modules` 与 `.env`；修正 electron-builder 26 不接受的 `win.publisherName`；构建脚本加 `--publish never`
- 关闭自动更新产物：`publish: null` + `nsis.differentialPackage: false`，安装包不再生成 `latest.yml` 与 `.blockmap`
- README 重写为框架使用指南，补充页面 / IPC / 模块 / 配置 recipes

验证结果：34 个用例通过；`npm run build` 与 Electron 冒烟通过；electron-builder 配置 schema 校验通过；临时输出目录实打包成功，产物仅含安装包，无更新元数据。

Phase 3 剩余：清理 `dist-app` 占用后复跑正式打包；可选实现主进程热重启。

### 自动更新：当前不做，接口预留

框架不承接发布渠道，因此默认关闭自动更新。真正接入时按以下顺序改，不需要动框架内核：

1. 安装依赖：`npm i electron-updater`
2. `package.json` 的 `build.publish` 从 `null` 改为实际渠道（示例：`{ "provider": "github", "owner": "...", "repo": "..." }`）
3. 移除 `build.nsis.differentialPackage: false`，恢复增量更新能力
4. 构建脚本去掉 `--publish never`（`electron:build` / `electron:build-win`）
5. 主进程新增 updater 模块，读取已有的 `features.autoUpdate` 开关决定是否 `checkForUpdatesAndNotify()`

`AppConfig.features.autoUpdate` 已在类型与默认配置中预留，接上第 5 步即可生效。

## 9. 优化轮次实施记录（2026-11-07）

针对全仓复查发现的问题做的一轮"不改变对外约定"的收敛，共 9 处：

### 安全正确性

1. **sender 来源校验改为按 origin 精确比对**（`src/main/ipc/sender.ts`）。原实现用 `startsWith`，`http://localhost:5173.evil.com`、`http://localhost:5173@evil.com`、`http://localhost:51730` 都能通过；打包态 `file://` 前缀也不校验主机。现改为解析 URL 后比对 origin，并拒绝带主机的 file URL；新增 3 条回归用例
2. **子窗口补齐导航守卫**（`WindowManager.createWindow`）。原先只有主窗口注册 `will-navigate` / `setWindowOpenHandler`，多窗口 API 一旦被使用，安全假设会静默失效
3. **生产 CSP 不再放行 HMR WebSocket**。`ws://localhost:5173` 改由 `vite.config.mts` 的 `dev-csp-websocket` 插件在开发态注入，构建产物为 `connect-src 'self'`

### 可靠性与体验

4. **配置落盘改为串行化 + 原子写**（`ConfigModule.saveConfig`）。窗口状态防抖与 `setValue` 并发时不再互相覆盖，进程中途退出也不会留下半截 `config.json`
5. **窗口首帧就绪后再显示**（`show: false` + `ready-to-show`），消除启动白屏闪烁；增加 `did-fail-load` 兜底，加载失败时窗口仍然可见
6. **Windows 设置 AppUserModelId**，任务栏身份与托盘气泡通知才可靠

### 工程化

7. **preload 白名单增加编译期完整性断言**：新增 `IpcChannel` 却漏加白名单时 `typecheck` 直接失败（`Type 'true' is not assignable to type 'never'`），不再等到运行时 `Blocked IPC channel`
8. **typecheck 覆盖配置文件**：`tsconfig.json` 的 `include` 加入 `vite.config.mts`、`vitest.config.mts`，`moduleResolution` 由 `node` 升级为 `bundler`（旧设置下 Vite 8 的 ESM 类型无法解析）；删除从未被引用的 `tsconfig.node.json`
9. **构建脚本不再改写源文件**：移除 `build.mjs` 里对 `index.html` 的标题热改（原先每次构建都会弄脏工作区，且 `productName` 取错了层级）；窗口标题改由渲染进程按配置 `appName` 设置

### 验证结果

- `typecheck` / `lint` / `test`（37 个用例，较上轮 +3）/ `build` 全绿
- 白名单断言做了反向验证：临时新增 `demo:hello` 通道，`typecheck` 如期报错，还原后恢复通过
- 开发态 CSP 含 `ws://localhost:5173`，产物 CSP 不含，均已实测
- 真机启动冒烟：主进程日志正常、`config.json` 原子写入无 `.tmp` 残留、无 IPC 拦截、无未捕获异常
- 已知环境坑：在带 `ELECTRON_RUN_AS_NODE=1` 的终端里启动会报 `requestSingleInstanceLock` 未定义，README 已补排查说明

### 尚未处理（下一轮候选）

- 插件系统在生产包内无法 `require` 第三方依赖（`files` 排除了 `node_modules`），需在文档声明或提供依赖注入约定
- 24 处 `console.*` 未接入 `Logger`，渲染端异常未上报主进程
- `theme` / `language` / `analytics` / `autoUpdate` 四个配置项仍无消费方
- `IpcResponse` 信封在 handler 内拆包后不再跨进程，属可删抽象
- CI 未覆盖 Windows 与真实 Electron 启动
