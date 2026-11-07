# Electron + Vue3 框架补齐路线

> 基于 2026-11 的全仓审查（安全修复已合入 `9c5dacf`）。本文件描述"还缺什么、按什么顺序补、每步如何验收"。

## 1. 现状判定

安全底线已具备：preload 通道白名单、文件读写限定 `userData`、`sandbox: true`、IPC 返回类型。
但项目仍属于"可运行示例"，不是"框架"，缺四层能力：

| 层次     | 缺口                                                                           |
| -------- | ------------------------------------------------------------------------------ |
| 工程化   | 无测试、无 lint、无 CI、无 typecheck 脚本、无提交门禁                          |
| 核心能力 | 无路由、配置双数据源、模块系统只有壳、主题/i18n/功能开关空转、窗口状态不持久化 |
| 架构收敛 | IPC 信封抽象无效、shared 混入 electron、工具函数重复、死组件与死方法           |
| 交付链路 | 无日志/异常体系、无自动更新、无 CSP/导航防护、打包冗余、无签名                 |

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

## 10. 第二轮优化实施记录（2026-11-07）

按「还有哪些可优化的地方」的复查结果做的第二批收敛，重点是攻击面、类型契约完整度与门禁机械化。

### 安全：移除一条提权链

1. **删除 `file:read` / `file:write`**（`FileHandler` 一并移除）。这两个通道在渲染端没有任何消费方，却能往 `userData/modules` 写 `.cjs`；而该目录会在下次启动时被 `createRequire` 执行，等于「写插件 → 重启生效」的持久化 RCE，属于白送的攻击面
2. **配置写入加 schema 校验**（`src/shared/config/schema.ts`）。`config:update` 之前把任意 JSON 直接 `deepMerge`：未知键永久驻留（现有 `config.json` 里就有 `network.*`、`window.opacity`）、错误类型进入运行时、`__proto__` 可改写原型。现在未知键 / 类型不符 / 非法枚举 / 原型键一律报错；加载时先备份 `config.json.bak` 再裁剪

### 类型与运行时

3. **IPC 参数也纳入契约**：`IpcInvokeMap` 由「只声明返回值」改为 `{ args, returns }`，`invoke` 变元组签名，`invoke('config:update', 123)` 这类错误在编译期失败
4. **托盘不可用时允许关窗**：原先托盘创建失败仍会 `hide()`，窗口消失且无入口唤回；`setupTray()` 现在返回是否可用
5. **退出流程加 3 秒超时**：模块 `destroy()` 卡住时不再导致应用永远退不出去
6. **日志改异步串行队列 + `flush()`**：`appendFileSync` 会阻塞主进程；`uncaughtException` 与退出流程先刷盘再退出
7. **Modal 补齐键盘可达性**：ESC 关闭、Tab 焦点陷阱、焦点归还、滚动锁、`role="dialog"` / `aria-modal`；`closable=false` 时不再渲染无效的关闭按钮

### 工程化

8. **门禁机械化**：新增 `format:check`、`scripts/install-hooks.mjs`（`prepare` 自动安装 pre-commit 钩子，跑五项门禁，`SKIP_GATES=1` 可跳过）；CI 增加格式校验并改用 `test:coverage`
9. **覆盖率从「未知」变「有基线」**：接入 `@vitest/coverage-v8`，实测 statements 29.77% / branches 37.19% / functions 20% / lines 30.05%，阈值取略低于基线的值防止倒退
10. **锁定运行时**：`engines`（node >=22.12 / npm >=10）、`packageManager`、`.nvmrc`
11. **全仓 Prettier 对齐**：一次性格式化 26 个文件（纯格式），之后由 `format:check` 防漂移
12. **产物拆 vendor 块**：`manualChunks` 把 vue / vue-router / pinia 拆出（Vite 8 要求函数形式），业务改动不再让框架层 hash 变化
13. **文档收口**：`docments/` 目录拼写错误且与 `docs/` 重叠，合并到 `docs/`；README 与两份详细文档同步更新（移除文件通道说明、schema 校验、五项门禁、覆盖率基线）

### 验证结果

- `typecheck` / `lint` / `format:check` / `test`（50 个用例，较上轮 +13）/ `build` 全绿
- `test:coverage` 通过阈值；vendor 拆分后产物为 `index 4.53 kB` + `HomeView 7.93 kB` + `vendor 99.62 kB`
- pre-commit 钩子经 `git hook run pre-commit` 实测可执行并通过
- 配置 schema 新增 10 条用例（未知键、嵌套未知键、类型、枚举、`__proto__`、裁剪）

### 尚未处理（下一轮候选）

- 24 处 `console.*` 仍未接入 `Logger`；渲染端异常未上报主进程
- `theme` / `language` / `analytics` / `autoUpdate` 仍无消费方
- 组件层无测试（无 jsdom），覆盖率 30% 主要来自纯函数与主进程逻辑
- 主进程热重启未接入；CI 仍是单平台、不启动真实 Electron

## 11. 第三轮：补齐「合格快速开发框架」的短板（2026-11-07）

上一轮遗留的候选逐项处理，并补上框架该有但一直缺的东西。

### 配置不再空转

1. **主题接线**：新增 `styles/theme.css`（CSS 变量）与 `renderer/theme`；`light / dark / auto` 真正生效，`auto` 跟随系统配色；组件里的硬编码色值全部换成变量
2. **多语言接线**：新增 `shared/i18n`（zh-CN / en-US），渲染端 `useI18n()`、主进程 `getMessages()` 共用同一份文案，托盘菜单与通知也随配置切换；schema 把 `language` 收紧为枚举

### 稳定性与骨架

3. **错误边界**：`AppErrorBoundary` 用 `onErrorCaptured` 兜住页面异常，提供重新加载入口
4. **404 兜底**：`NotFoundView` + catch-all 路由，兜底路由固定注册在最后（用例守护顺序）

### 开发体验与交付

5. **主进程热重启**：`scripts/dev.mjs` 监听 `src/main`、`src/preload`、`src/shared`，改动后防抖重建并重启 Electron；构建失败保留旧进程；Windows 用 `taskkill` 收整棵进程树；移除不再需要的 `concurrently` / `wait-on`
6. **真机冒烟**：`scripts/smoke.mjs` 用临时 userData 启动真实 Electron，校验 `config.json` 落盘、`main.log` 出现 `Main window created`、无 uncaught / 被拦截的 IPC
7. **CI 双平台**：ubuntu（xvfb）+ windows 矩阵，两个平台都跑冒烟；移除 `ELECTRON_SKIP_BINARY_DOWNLOAD`
8. **组件测试**：vitest 接入 `@vitejs/plugin-vue` + jsdom + `@vue/test-utils`，覆盖 Modal、ConfigPanel、AppErrorBoundary、theme、i18n；覆盖率 29.77% → 35.63%，阈值上调到 33/40/26/33
9. **换行统一**：新增 `.gitattributes`（`* text=auto eol=lf`）。Windows 上 `git checkout` 会把工作区写成 CRLF，此前会让 `format:check` 无故失败
10. **插件文档**：新增 `docs/插件开发.md` 与 `docs/examples/hello-module.cjs`，写清能力边界（只能 require electron 与 Node 内置）、日志入口、IPC 自查与安全清单；`globalThis.__frameworkLogger` 供插件写入 `main.log`

### 顺带修掉的坑

11. **`process.env` 在打包后失效**：Vite 的非 SSR 构建会把 `process.env` 替换成 `{}`，主进程里任何环境变量都是 `undefined` 且不报错。主进程改用 `build.ssr: true` 后恢复
12. **`ELECTRON_USER_DATA_DIR` 支持**：用于 CI 冒烟与便携模式隔离真实用户数据

### 验证结果

- `typecheck` / `lint` / `format:check` / `test`（74 个用例，较上轮 +24）/ `test:coverage` / `build` 全绿
- 主进程热重启实测：改动 `src/shared` 下文件后 8 秒内完成重建（约 30ms）与 Electron 重启，日志连续
- `npm run smoke` 本地通过（exit 0），临时目录正确回收
- 组件测试 24 条；覆盖率达 35.63% / 43.03% / 28.63% / 36.02%

### 尚未处理（下一轮候选）

- `features.analytics` / `features.autoUpdate` 仍无消费方（前者缺埋点方案，后者明确不做）
- 渲染端异常仍未上报主进程日志
- 主进程热重启只重建不保留窗口状态（重启即重新建窗，属预期）
- 打包产物尚未接代码签名与多平台发布

## 12. 第四轮：可观测性与生产态收口（2026-11-07）

上一轮留下的「渲染端异常未上报」与主进程零测试优先处理，同时补上生产态一个被忽略的口子。

### 可观测性

1. **渲染端异常上报**：新增 `log:report` 通道与 `renderer/utils/report`，`errorHandler`、`unhandledrejection`、`AppErrorBoundary`、`useSystemInfo` 的异常写进 `main.log`。通道对渲染进程开放，因此自身必须设防：级别白名单、单条截断 2000 字符、10 秒 50 条滑动窗口限流（丢弃时每 50 条告警一次）
2. **启动耗时打点**：`Startup completed` 记录 `ready` / `modules` / `ipc` / `window` / `total` 分段耗时，冒烟脚本会断言这条日志存在

### 生产态收口

3. **DevTools 受配置控制**：未设置应用菜单时 Electron 用默认菜单，View 里有 Toggle Developer Tools，打包后的用户按 Alt 就能打开 DevTools。现在菜单由 `features.developerTools` 决定是否包含该项，并拦截 F12 / Ctrl+Shift+I / Cmd+Alt+I，`devtools-opened` 兜底关闭
4. **最小可用应用菜单**：`menu.manager` 基于原生 role 构建，菜单文字跟随系统语言；macOS 保留 `appMenu` 以免系统快捷键失效

### 测试

5. **主进程关键模块单测**：`ConfigModule`（默认值、未知键裁剪 + .bak、非法更新不落盘、深合并、setValue 校验、并发串行、原子写、损坏回退）、`IpcManager`（全通道注册、来源拦截、透传、注销、缺依赖抛错）、`app-logger`（回退与切换）
6. **覆盖率**：statements 35.44% → 48.09%，阈值升至 46/45/42/46

### 验证结果

- `typecheck` / `lint` / `format:check` / `test`（104 个用例，较上轮 +30）/ `test:coverage` / `build` / `smoke` 全绿
- 冒烟新增断言：`main.log` 必须包含 `Startup completed`
- 主进程覆盖率从 0 提升到实测 48%，配置与 IPC 两条核心链路有安全网

### 尚未处理（下一轮候选）

- `features.analytics` / `features.autoUpdate` 仍无消费方
- 打包产物尚未接代码签名与多平台发布
- 渲染端日志上报暂未做持久化队列，网络/通道异常时会静默丢弃（可接受）
- 菜单文案依赖系统语言，尚未跟随应用内 `language` 配置
