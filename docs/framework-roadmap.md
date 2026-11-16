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

### 自动更新：明确不做

这是框架的**非目标**，不是「以后再说」：

- 不引入 `electron-updater`，不实现检查更新、下载、安装引导
- 不提供更新源、发布渠道、签名与灰度能力
- `features.autoUpdate` 开关已随之移除——留着它只会让人误以为框架支持自动更新
- 打包配置保持 `publish: null` 与 `nsis.differentialPackage: false`，产物里不会出现 `latest.yml` 与 `.blockmap`

确实需要更新能力的项目，请在自己的应用层实现（例如把版本信息放进一个业务接口，由业务侧决定怎么发版），框架不参与。

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
- 代码签名与发布由使用方负责（第 14 节）

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

- `features.analytics` 仍无消费方（autoUpdate 已在第 13 节移除）
- 代码签名与发布由使用方负责（第 14 节）
- 渲染端日志上报暂未做持久化队列，网络/通道异常时会静默丢弃（可接受）
- 菜单文案依赖系统语言，尚未跟随应用内 `language` 配置

## 13. 决策记录：自动更新明确不做（2026-11-07）

维护者确认：**框架不做自动更新**。这不是待办事项，而是非目标。

因此本轮做了三件事：

1. **移除 `features.autoUpdate`**：类型、默认值、schema、配置面板、中英文案一起删掉。保留一个永远不生效的开关，只会让使用者误以为框架支持自动更新
2. **文档改为明确表述**：README 的打包章节与定位、路线图原有的「接口预留 + 接入步骤」全部改写成「明确不做」，不再给出接入指引
3. **打包配置保持关闭**：`publish: null` 与 `nsis.differentialPackage: false` 不变，产物不含 `latest.yml` / `.blockmap`

需要更新能力的项目请在自己的应用层实现，框架不参与版本检查、下载与安装。

### 验证结果

- `typecheck` / `lint` / `format:check` / `test`（104 个用例）/ `build` / `smoke` 全绿
- 旧配置里的 `features.autoUpdate` 会在加载时按未知键裁剪（首次裁剪有 `.bak` 备份），不再进入运行时

## 14. 决策记录：代码签名不做，交给使用方（2026-11-07）

维护者确认：**框架不做代码签名**。签名、公证、分发属于每个开发者/团队的发布环节，
框架不该替使用者绑定证书与发布渠道。

因此：

- `package.json` 与构建脚本**不提供**任何 `certificateFile` / `certificatePassword` / 公证配置，也不读取签名相关环境变量
- 文档写明签名由使用方负责：需要签名的项目自行配置 electron-builder 的 `win.certificateFile`（或通过 `CSC_LINK` 环境变量）与 macOS 公证流程
- `.gitignore` 增加 `*.pfx` / `*.p12` / `.env`，避免证书与本地配置被误提交
- 未签名构建在 Windows 上会被 SmartScreen 提示、macOS 上会被 Gatekeeper 拦截，这是使用方的发布决策，不是框架缺陷

### 验证结果

- 构建配置无签名相关字段（`grep` 确认 `package.json` 只有 `appId` / `icon` / `nsis` 等基础项）
- `typecheck` / `lint` / `format:check` / `test`（104 个用例）/ `build` / `smoke` 全绿

## 15. 决策记录：移除 `features.analytics`（2026-11-07）

`features.analytics` 是初版脚手架留下的三个占位开关之一（另两个是 `developerTools` 与已移除的 `autoUpdate`）。
它在配置面板里显示为「数据统计」，能勾能存，但**全仓没有任何代码读取它**——勾了不生效。

框架没有遥测后端、没有埋点 SDK，也不应该替使用者决定收集什么数据。所以按与自动更新相同的处理原则：

- **删除** `features.analytics`：类型、默认值、schema、配置面板、中英文案、用例一并移除
- **改用 recipe 承载扩展价值**：README 新增「新增一个功能开关」，五步写清怎么加自己的 flag（类型 → 默认值 → schema → 面板 → 消费），并说明框架不内置遥测
- 旧配置里的该字段会按未知键裁剪（首次裁剪留 `.bak`）

### 验证结果

- 全仓 `grep analytics` 无残留（除路线图历史记录）
- `FeatureFlags` 现在只剩 `developerTools` 一个真实开关
- `typecheck` / `lint` / `format:check` / `test` / `build` / `smoke` 全绿

## 16. 支持平台收口与真实交互 e2e（2026-11-07）

维护者确认：**只在 Windows 与 Linux 发布**。因此 macOS 不再作为验证目标，同时补上第五轮评审里
指出的唯一硬缺口——单元测试与启动冒烟之间缺少「真实交互」这一层。

### 平台支持矩阵

- **Windows 10+**：官方支持。托盘、气泡通知、AppUserModelId、NSIS 安装包均实测
- **Linux（现代桌面）**：官方支持。无状态栏环境下托盘建不起来时会允许直接关窗；CI 已配置 xvfb 下的冒烟与 e2e，但**尚未推送执行**，AppImage/deb 出包也未实测
- **macOS**：不发布、不验证。代码保留 `appMenu` 等分支，属 best-effort，README 已标明

### 真实交互 e2e

新增 `scripts/e2e.mjs` / `npm run e2e`，通过渲染进程的远程调试端口（CDP）驱动界面：

1. 等待应用挂载，确认没有落进错误边界
2. 点开配置面板
3. 改主题为 dark → 点保存 → 轮询 `config.json` 确认落盘 → 确认面板无错误提示
4. 切换语言为 en-US → 保存 → 确认落盘、界面文案变成英文
5. 确认 `<html data-theme="dark">` 真的生效

CI 在 ubuntu（xvfb）与 windows 各跑一次。

**为什么必须有它**：上一轮那个 `An object could not be cloned.` 是 Vue Proxy 与 IPC 结构化克隆冲突，
被我 mock 掉 `invoke` 的 100 多条单测全部放过了——只有真实链路能发现。

### 验证结果

- 本地 `npm run e2e` 一次通过（配置保存、主题应用、语言切换全链路）
- `typecheck` / `lint` / `format:check` / `test`（105 用例）/ `build` / `smoke` / `e2e` 全绿
- README 增加「环境要求与支持平台」矩阵，并说明 macOS 不在发布目标内

## 17. Linux 打包能力补齐（2026-11-07）

确认「只在 Windows 与 Linux 发布」之后，回头检查打包配置，发现两处硬伤：

1. **`build` 里只有 `win` 段**：`electron-builder` 没有 Linux 目标配置，也没有对应脚本，
   Linux 包只能靠临时命令行拼参数
2. **`assets/icon.png` 其实是 ICO**：与 `icon.ico` 字节完全相同（头 `00 00 01 00`），
   只是改了扩展名。Windows 用 `.ico` 所以没暴露；Linux 打包要求真正的 PNG，且建议 ≥512×512

### 改动

- `build.linux` 增加 `AppImage` + `deb` 目标、`category`、`maintainer`、`synopsis`，图标指向 `assets/icon.png`
- 新增 `npm run electron:build-linux`
- 用 Pillow 把 ICO 里的 256×256 图像重采样成 **512×512 真 PNG**（头 `89 50 4E 47`），
  替换掉那个伪装成 PNG 的 ICO；README 注明正式发布前建议换成设计稿导出的 512/1024 PNG
- README 打包章节补平台差异表：Windows 用 NSIS + `.ico`；Linux 用 AppImage/deb + PNG，
  且 **Linux 包必须在 Linux 上打**（依赖 `dpkg` / `fpm`）

### 验证结果

- `assets/icon.png` 头字节确认为 PNG，尺寸 512×512
- `electron-builder` 解析 `package.json` 配置通过（本机因网络超时卡在下载 Electron 二进制，
  未跑完整打包；Linux 产物的最终验证需在 Linux 或 CI 上做）
- 其余门禁：`typecheck` / `lint` / `format:check` / `test` / `build` / `smoke` / `e2e` 全绿

## 18. 文档补齐（2026-11-07）

第五轮评审指出"缺架构文档"，且两份老文档已经和代码脱节——照着写会直接报错。本轮把文档按
"读者带着什么问题来"重新分工。

### 新增

- **`docs/架构.md`**：讲"为什么"。分层与单向依赖、一条 IPC 的完整链路与三层契约、启动顺序及其
  原因、配置三层结构与迁移、日志/插件/安全模型（含威胁假设与已知边界）、扩展点对照表、
  十个关键取舍、各道门禁能挡住什么。

### 重写

- **`docs/API实现示例.md`**：旧版 8 步流程全是过时 API（`BaseIpcHandler`、`handleAsync`、
  `IpcResponse`、`user.service`、`file:read`）。新版按当前契约走完 9 步：
  类型/通道 → 模块 → 注册 → handler → 通道注册 → preload 白名单 → store（含 `toPlain`）
  → 组件（主题变量 + i18n）→ 文案 → 测试 → 验证清单，并附 8 条常见坑对照表。
- **`docs/框架功能详解.md`**：从 433 行散文改成"功能索引 + 源码位置"，补 IPC 通道表
  （参数/返回/说明）、配置项与消费方对照表、"与旧版本的差异"（明确列出已删除的 6 项能力）。
  同时纠正旧文里"支持 macOS""文件处理器""多窗口支持""CPU/磁盘信息"等与代码不符的描述。
- **`docs/框架使用指南.md`**：聚焦"五分钟跑起来 / 常见任务 / 调试 / 打包 / 真实 FAQ"，
  补上这几个实际踩过的坑：`ELECTRON_RUN_AS_NODE`、Proxy 克隆、schema 拒绝未知键、
  托盘缺失、Linux 打包限制。

### 一致性

- README 的文档区改为"想知道什么 → 看哪份"对照表，并链接新增的架构文档
- 文档里所有命令、路径、配置键都对照当前代码校验过（`grep` 掉 `BaseIpcHandler` /
  `file:read` / `analytics` 等已删概念，仅路线图历史记录保留）

### 验证结果

- 文档中的命令与 `package.json` scripts 逐条比对一致
- 文档中的配置键与 `shared/config/schema.ts` 一致
- `format:check` / `typecheck` / `lint` / `test`（105 用例）/ `build` / `smoke` / `e2e` 全绿

## 19. 第六轮：托盘边界、共享层解耦、一致性守卫（2026-11-08）

又一轮复查，找到三个"平时不会炸、但会在特定平台或下次改动时炸"的点。

### 修掉 Linux 托盘的真实缺陷

原逻辑是「`icon.ico` 文件存在就用它」。Linux 上 `nativeImage` 可能解不出 ICO（文件明明在），
得到空图像 → 托盘图标不可见；但 `close` 依然 `preventDefault()` + `hide()`。
结果：窗口被藏起来、托盘又看不到，用户只能杀进程。这个组合在 CI 的 xvfb 里测不出来。

- 新增 `pickDecodableImage`：按 ico → png 顺序取**第一个能解码出非空图像**的候选
- 全部候选不可用（含解码抛错）时按「托盘不可用」处理：记 warn、返回 false，close 不再拦截
- 5 条用例覆盖回退链

### 抽两个纯函数出来测

- `isDevtoolsShortcut`：F12 / Ctrl+Shift+I / Cmd+Alt+I 三种组合 + 近似组合不误伤（4 条用例）
- 这两块逻辑原来埋在 390 行的 `window.manager` 里，没有任何测试

### 共享层不再依赖 electron

`shared/utils/index.ts` 一直 import 着 `dialog` / `app`：渲染端从 `@shared/utils` 根导入会在
构建期失败，文档里只能写"别引根路径"。本轮删掉三个依赖 electron 的函数与一个死函数
（`getUserDataPath` / `selectFile` / `selectDirectory` / `formatBytes`，全部无调用方），
`shared/` 下已无 electron 依赖。

### 防止默认值与 schema 漂移

两份手写清单最容易出现"加了配置项忘了加白名单"，表现为运行时写入被拒、单测却全绿。
新增两条一致性用例：默认配置不得包含 schema 之外的键；默认配置本身必须能通过 schema 校验。

### 验证结果

- `test` 105 → **116 用例**；`typecheck` / `lint` / `format:check` / `build` / `smoke` / `e2e` 全绿
- 托盘修复无法在本机（Windows 能解码 ICO）复现原缺陷，靠纯函数用例覆盖回退链

## 20. Linux 实机验证（2026-11-15）

第一次在真实 Linux 上跑起来：Ubuntu 24.04 x64（内核 6.14）虚拟机，安装包用 Windows 交叉打出的
`tar.gz`，解压 + `chmod +x` + SUID 沙箱后启动。

### 已验证

| 项           | 结果                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------- |
| 二进制启动   | ✅ 窗口正常显示，无崩溃                                                                      |
| 界面渲染     | ✅ 首页卡片、四个功能块、按钮布局正常                                                        |
| 主题         | ✅ 配置为 `auto` 时跟随系统深色模式，`data-theme` 生效                                       |
| 系统信息 IPC | ✅ 返回真实数据（`platform: linux`、`arch: x64`、`release: 6.14.0-36-generic`、用户 `sumu`） |
| i18n         | ✅ 中文文案正常                                                                              |
| 引导流程     | ✅ 首次运行自动创建 `~/.config/electron-vue3-demo/` 下的配置与日志                           |

### 仍未验证

- **AppImage / deb 出包**：Windows 上下不来（AppImage 需要建符号链接 → `EPERM`；deb 需要 Linux 的 `fpm` → `ENOENT`），
  只能在 Linux 上 `npm run electron:build-linux`
- **托盘关闭行为**：待点关闭按钮确认（这正是第 19 轮 ico→png 回退修复要覆盖的场景）

### 附带产出

- 修正了 build 配置里缺 `desktopName` / `syncDesktopName` 导致的 Linux 窗口关联告警
- 记录了一条可复用的交付路径：只有 Windows 时用 `electron-builder --linux tar.gz` 验证应用本体，
  安装包留给 Linux 或 CI
- 新增 `Package (Linux)` 工作流（`.github/workflows/package-linux.yml`）：推送 `main` 或打 `v*` tag 时，
  在 ubuntu runner 上产出 AppImage + deb 并以 artifact 上传。**同样尚未实跑**，首次推送后才会验证。

### 为什么不在 VM 里出包

验证用的 Ubuntu 虚拟机没有 Node 环境，安装 Node 22 + `npm ci` + 打包工具链需要额外下载约 1 GB。
既然仓库有 GitHub 远端，把出包交给 ubuntu runner 更划算：零环境成本、可重复、产物带 artifact 保留 14 天。

## 21. 第七轮：清死代码、合概念、补测试（2026-11-15）

按「还剩下什么」的审计结果执行，原则是**删代码优先于加代码**。

### 删掉 7 个无调用方的公开 API

审计确认这些方法定义了、甚至有测试，但没有任何业务调用方——留着会让人以为框架支持多窗口：

- `WindowManager.createWindow` / `closeWindow` / `getWindow` / `getAllWindows` 与 `windows` 映射
- `ModuleManager.registerModule` / `unregisterModule` / `listModules`（`ModuleRegistry` 内部能力保留）
- `IpcManager.unregisterHandler`（原先只有测试在调用）

### 合并两个"开发者模式"

`app.store.isDeveloperMode`（会话级）与 `features.developerTools`（持久化）同名不同义。删掉 `app.store`，
首页那个演示面板改成页内局部 `ref`，语义改为「调试工具」；i18n 键同步为
`home.debugTools` / `hideDebugTools` / `debugHint`。

### 三处小修

- ConfigPanel 的 `label` 补 `for`/`id` 关联，错误提示补 `aria-live="polite"`
- `useSystemInfo` 从 `ref<any>` 收紧为 `ref<SystemInfo | null>`，catch 分支用 `unknown`
- `config.json` 的 `version` 每次加载都用 `app.getVersion()` 刷新（它是应用元数据，不是用户配置）

### 补测试

- **窗口决策抽成纯函数**（`managers/window-policy.ts`）：关闭判定（退出中/托盘不可用 → 真关闭）、
  加载目标（开发态 URL vs 打包 `resources/dist/index.html`）、窗口状态快照；6 条用例
- **插件加载集成测试**（`module.manager.test.ts`）：临时 userData + 真实 `.cjs` +
  主进程那段 `createRequire`，覆盖 init/destroy、`__frameworkLogger` 暴露、坏模块隔离、
  工厂/default 导出、目录缺失；4 条用例
- 覆盖率 statements 49.58% → **53.17%**，阈值上调到 51/54/48/51

### 验证结果

- `test` 116 → **126 用例**；`typecheck` / `lint` / `format:check` / `build` / `smoke` / `e2e` 全绿
- 覆盖率：statements 53.17% / branches 56.35% / functions 50.22% / lines 53.76%

### 仍未处理

- `window.manager` 的托盘菜单接线、状态防抖计时器、真实窗口事件（纯逻辑已覆盖）
- 应用菜单文案跟随系统语言，未跟随应用内 `language`

## 22. 对外开放前夜：外人克隆验证与 CI 首跑（2026-11-15）

维护者把 69 个提交推到了 `github.com/sumu126/electronDemo`（公开仓库），工作流第一次真正执行。

### 外人克隆验证（本地）

模拟外部使用者：把**已提交的内容**克隆到临时目录，从零走一遍。

```
git clone → npm ci（501 包，17s）→ build → typecheck → lint → test（126）→ smoke → e2e
```

**全部通过**，且 `npm ci` 后工作区干净（`prepare` 安装钩子不产生改动）。

这次验证抓到一个真实缺陷：**冒烟脚本的日志竞态**。它只等 `config.json` 与 `logs/main.log`
两个文件出现，而 `config.json` 在 ConfigModule 加载阶段就写了，早于建窗日志；日志又是异步落盘，
于是检查早了一拍。以前没暴露是因为本机跑得慢、恰好赶上。已改为轮询到目标日志行真正出现，
失败时打印日志末尾（`584f220`）。

### CI 首跑结果（fc139e8）

| 工作流          | 平台           | 结果                                                                      |
| --------------- | -------------- | ------------------------------------------------------------------------- |
| CI              | ubuntu-latest  | ✅ 全绿：typecheck / lint / format / coverage / build / smoke(xvfb) / e2e |
| CI              | windows-latest | ⚠️ 前五步全绿，`Smoke test (Windows)` 失败 —— 即上述竞态，修复待推送      |
| Package (Linux) | ubuntu-latest  | ✅ 成功产出 AppImage + deb，`dpkg-deb -I/-c` 校验通过                     |

**Linux 出包这条线到此闭环**：不再是"配置就绪未实测"，而是 CI 实际构建过、产物可下载。

### 结论

- 用来开发应用：可以，Windows 与 Linux 都有实机证据
- 对外开放：可以，剩下的只是把竞态修复推上去让 windows job 复跑

## 23. 第八轮：平台毛刺、类型对齐与日志轮转（2026-11-16）

按交接文档的 P0-2 / P0-3 / P0-4 执行，全部是"平时不炸、特定平台或长期运行才炸"的小口子。

### 平台与安全

1. **窗口图标按平台选择**：Linux 优先 `icon.png`，其余平台优先 `icon.ico`，复用 `pickDecodableImage` 的"解不出图就换下一个"逻辑（`window-policy.ts` / `window.manager.ts`）
2. **首帧背景跟随主题**：`backgroundColor` 由配置 `theme` 与 `nativeTheme.shouldUseDarkColors` 解析，取 `theme.css` 的 `--color-bg`（`#f5f5f5` / `#16181d`），深色启动不再闪白
3. **补齐 `setPermissionCheckHandler`**：与 `setPermissionRequestHandler` 一起默认拒绝，避免只走同步查询的 API 拿到放行结果
4. **CSP 收紧**：增加 `object-src 'none'` 与 `base-uri 'none'`（`frame-ancestors` 在 `<meta>` 里会被忽略，未添加）

### 类型与运维

5. **`AppConfig.language` 由 `string` 收紧为 `Locale`**，与 schema 枚举对齐；`ConfigPanel` 的赋值同步收窄
6. **日志按大小轮转**：`Logger` 超过 5 MB 切分，保留 `main.log.1`…`main.log.3`，轮转判断放在串行队列内；`flush()` 与退出刷盘语义不变

### 死代码

7. **清理 `shared/utils/helpers.ts`**：删除仅测试引用的 11 个函数（`deepClone`、`generateId`、`formatDate`、`validateEmail`、`validatePhone`、`objectToQueryString`、`camelToKebab`、`kebabToCamel`、`capitalize`、`throttle`、`debounce`），只保留生产代码使用的 `deepMerge`

### 验证结果

- `typecheck` / `lint` / `format:check` / `test:coverage` / `build` / `smoke` / `e2e` 全绿
- 用例 126 → **128**（窗口策略 +3、日志轮转 +1、helpers -2）
- 覆盖率 statements 53.17% → **55.68%**，branches 56.35% → **60.77%**，functions 50.22% → **53.91%**，lines 53.76% → **56.10%**；阈值保持 51/54/48/51
- 真机冒烟与 e2e 在 Windows 上通过；Linux 侧的图标回退只由纯函数用例覆盖

### 仍未处理

- **P0-1 未动**：IPC 注册仍是内核硬编码，模块没有贡献点（第九轮已补上，见第 24 节）
- 主进程启动链路与窗口事件仍无测试；e2e 仍只有一条主流程

## 24. 第九轮：IPC 模块贡献点（2026-11-16）

把"新增通道必须改 `ipc.manager.ts`"改成"模块声明自己提供哪些通道，内核只做聚合"。
这是交接文档里最后一个架构级缺口。

### 改动

1. **新增 `main/ipc/ipc-contribution.ts`**：`IpcHandlerContribution` 由 `IpcInvokeMap` 映射出每个通道的
   `{ channel, handler }`，handler 的通道名、实参元组与返回值同时受类型约束
2. **`Module` 增加可选 `ipcHandlers()`**：核心模块可以声明自己提供的通道
3. **`ConfigModule` 迁移为第一个贡献点**：自行声明 `config:get` / `config:update`，`ConfigHandler` 只保留适配层
4. **`IpcManager` 删除 config 硬编码**：只保留 ping / system / window / log 内核通道，新增模块通道聚合
5. **重复通道拦截**：`registerHandler` 发现重复直接抛错，模块不能静默覆盖核心通道
6. **信任边界**：`ModuleManager` 只收集 `loadCoreModules()` 注册的核心模块；`userData/modules` 插件不参与

### 边界（没有变）

- 新增通道仍要改 `constants` / `types` / `preload` 三处；preload 白名单是编译期安全边界，不能动态化
- 插件仍不能给渲染进程新增可调用通道
- 没有引入 DI、事件总线或装饰器

### 验证结果

- `typecheck` / `lint` / `format:check` / `test:coverage` / `build` / `smoke` / `e2e` 全绿
- 用例 128 → **131**（IpcManager +2、ConfigModule +1、ModuleManager +1，替换 1 条旧用例）
- 覆盖率 statements **55.79%** / branches **60.77%** / functions **53.42%** / lines **56.16%**
- e2e 首次运行时断言通过但 Windows 临时目录清理报 `EBUSY`，已给清理加 5 次重试（`88964e8`），复跑通过

### 仍未处理

- 主进程启动链路与窗口事件仍无测试
- e2e 仍只有一条主流程（配置保存 / 主题 / 语言），缺"重启后窗口状态恢复"
