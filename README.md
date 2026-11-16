# Electron + Vue3 快速开发框架

一个用于**快速搭建桌面应用**的脚手架：克隆后即可开发，不需要先补基础设施。框架提供主进程 / 预加载 / 渲染进程分层、类型安全 IPC、配置与窗口状态、路由、模块系统、日志、质量门禁和安全默认值；业务本身由使用方在其上叠加。

> 定位：快速开发框架，不是完整业务应用。框架**不做自动更新**（明确的非目标），也不绑定发布渠道或具体 UI 组件库。

## 核心特性

- **三进程分层**：`main` / `preload` / `renderer` / `shared`，职责清晰
- **类型安全 IPC**：通道白名单 + `IpcInvokeMap` 参数/返回类型 + 编译期白名单完整性断言 + sender 来源校验
- **单一配置源**：主进程落盘 `userData/config.json`（schema 校验 + 原子写），渲染端通过 Pinia store 读写
- **主题与语言**：`theme`（light/dark/auto，跟随系统）与 `language`（zh-CN/en-US）由配置驱动，颜色走 CSS 变量
- **窗口状态持久化**：位置、尺寸、最大化状态自动保存与恢复，离屏坐标自动丢弃
- **路由骨架**：`vue-router` 4 + hash 模式 + 404 兜底，打包后 `file://` 可直接工作
- **错误边界**：页面级异常被 `AppErrorBoundary` 兜住，不整页白屏
- **模块系统**：核心模块可通过 `ipcHandlers()` 声明自己的 IPC 通道；`userData/modules` 下的 CommonJS 模块可动态加载，单个模块启动失败不影响启动
- **日志与异常**：主进程异步文件日志（退出前刷盘，按 5 MB 轮转保留 3 份）+ **渲染端异常经 `log:report` 上报并限流** + 启动耗时分段打点
- **开发体验**：`electron:dev` 支持主进程/preload 热重启，渲染进程走 Vite HMR
- **质量门禁**：`typecheck` / `lint` / `format:check` / `test`（含覆盖率阈值）/ `build`，本地钩子与 CI 同一套，CI 另有真机冒烟
- **安全默认**：`sandbox` 默认开启（可在 `config.json` 的 `security.sandboxEnabled` 关闭）、CSP、导航拦截、权限默认拒绝、不提供通用文件读写通道、生产态收起 DevTools

## 技术栈

| 类别        | 选型                            |
| ----------- | ------------------------------- |
| 运行时      | Electron 45                     |
| 前端        | Vue 3.5 + TypeScript 5.9        |
| 构建        | Vite 8 + electron-builder 26    |
| 状态 / 路由 | Pinia 4 + Vue Router 4          |
| 测试 / 规范 | Vitest 5 + ESLint 10 + Prettier |

## 环境要求与支持平台

- Node.js **>= 22.12**（Vite 8 要求，`package.json` 的 `engines` 与 `.nvmrc` 已锁定）
- npm >= 10

| 平台              | 状态        | 说明                                                                                                                                                       |
| ----------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows 10+       | ✅ 官方支持 | 托盘、通知、AppUserModelId、NSIS 安装包均实测；Electron 45 起不支持 Win7/8/8.1                                                                             |
| Linux（现代桌面） | ✅ 官方支持 | Ubuntu 24.04 x64 实机验证：启动、渲染、`theme: auto` 跟随系统深色、系统信息 IPC、i18n；CI 已产出 AppImage + deb 并通过 `dpkg-deb` 校验。托盘关闭行为待实测 |
| macOS             | ⚠️ 未验证   | 代码保留了 `appMenu` 等分支，但没有实机验证，不作为发布目标                                                                                                |

CI 在 ubuntu（xvfb）与 windows 两个平台各跑一遍：typecheck / lint / format / 覆盖率 / build / 启动冒烟 / e2e。
2026-11-15 首跑结果：**ubuntu 全绿**（含 smoke 与 e2e）；windows 前五步全绿，仅 `Smoke test` 因日志竞态失败，
该竞态已修复，待推送后复跑。

## 快速开始

```bash
npm install
npm run electron:dev
```

`electron:dev` 会构建主进程、启动 Vite、等 `5173` 就绪后再拉起 Electron；之后 `src/main`、`src/preload`、`src/shared` 的改动会**自动重建主进程并重启 Electron**，渲染进程仍然走 Vite 热更新。

> **启动报 `Cannot read properties of undefined (reading 'requestSingleInstanceLock')`**：当前终端把 `ELECTRON_RUN_AS_NODE=1` 传给了子进程（VS Code 等 Electron 系终端常见），Electron 会被当成普通 Node 执行。`electron:dev` 已主动清除该变量；直接 `npm run electron:start` 时如遇到，PowerShell `$env:ELECTRON_RUN_AS_NODE=''`，cmd `set ELECTRON_RUN_AS_NODE=`。

> **`electron:dev` 启动后 Electron 立刻退出（退出码 21）**：单实例锁没有拿到。开发态使用独立 userData（`node_modules/.cache/electron-dev-user-data`），不会和正式包、其它克隆互相占用；Windows 上残留或只读的 `lockfile` 会在启动前自动清理。若仍失败，终端会打印 `probe` 和 `main.log` 尾部：
>
> - `probe=held`：同一 userData 下已有实例（常见是关窗后缩到托盘），先从托盘退出
> - `probe=unavailable`：`lockfile` 无法删除/创建，检查 userData 权限或安全软件
> - `probe=skipped`：Linux/macOS 不做 lockfile 清理，通常是已有实例

> **外置盘上 Electron 以 `0x80000003` 退出**：部分外置盘/非系统盘路径下 Chromium 沙箱无法初始化，`main.log` 可能为空。`electron:dev` 首次遇到该退出码会自动加 `--no-sandbox` 重试一次，仅影响开发态；生产构建仍启用沙箱。
>
> **想永久关闭沙箱**：编辑 `userData/config.json`，设置 `"security": { "sandboxEnabled": false }` 后重启。开发态路径是 `node_modules/.cache/electron-dev-user-data/config.json`；外置盘首次启动可以先让 dev 自动降级跑起来，再改这个文件。该开关只从本地配置文件读取，设置页/渲染进程不能修改；关闭会降低安全性，只建议在外置盘等沙箱无法启动的环境使用。

### 常用命令

```bash
npm run dev              # 仅启动 Vite
npm run electron:dev     # 构建主进程 + 启动开发环境（主进程热重启）
npm run build            # 构建主进程与渲染进程
npm run electron:build   # 构建并生成解包应用（dist-app）
npm run electron:build-win  # 构建 Windows 安装包
npm run electron:start   # 直接启动已构建的应用
npm run typecheck        # vue-tsc 类型检查
npm run lint             # ESLint
npm run format           # Prettier 格式化
npm run format:check     # Prettier 校验（不写文件）
npm test                 # Vitest
npm run test:coverage    # Vitest + 覆盖率阈值
npm run smoke            # 真机冒烟：启动 Electron 校验配置与日志落盘
npm run e2e              # 真实交互 e2e：改配置、切语言，并重启验证窗口状态恢复
```

`npm install` 会通过 `prepare` 自动安装 pre-commit 钩子，提交时依次跑 typecheck / lint / format:check / test / build；确实要跳过时用 `SKIP_GATES=1 git commit ...`。

> `smoke` 与 `e2e` 会真的启动 Electron 窗口，本地跑完会自动关闭；`e2e` 通过渲染进程的远程调试端口驱动界面，所以 CLI 环境（CI / 无桌面）需要 `xvfb-run`。

## 目录结构

```
src/
├── main/                     # 主进程
│   ├── index.ts              # 入口：单实例锁、进程级异常
│   ├── app.ts                # 启动序列与生命周期（顺序不可随意调整）
│   ├── ipc/                  # IPC 处理器与 sender 校验
│   ├── ipc-manager/          # 通道注册与管理
│   ├── managers/             # 窗口、模块注册表、模块加载器、窗口状态
│   ├── modules/              # 核心模块（配置）
│   └── utils/                # 主进程工具（Logger）
├── preload/                  # contextBridge 暴露的安全 API（通道白名单）
├── renderer/                 # 渲染进程
│   ├── router/               # 路由表（hash 模式 + 404 兜底）
│   ├── views/                # 页面
│   ├── components/           # 组件（含 Modal、AppErrorBoundary）
│   ├── composables/          # 组合式函数（配置、系统信息、i18n）
│   ├── stores/               # Pinia（配置、应用状态）
│   ├── theme/                # 主题解析与应用
│   ├── styles/               # 全局样式与主题变量
│   └── env.d.ts              # window.electronAPI 类型声明
└── shared/                   # 跨进程共享
    ├── config/               # 默认值与配置 schema（唯一来源）
    ├── constants/            # IPC 通道常量
    ├── i18n/                 # 中英文案（主进程与渲染进程共用）
    ├── types/                # IPC/配置类型契约
    └── utils/                # 纯函数工具与路径守卫
scripts/                      # 仓库脚本（钩子安装、开发启动器、冒烟）
docs/                         # 文档与实施记录
```

## 开发约定

### 基于框架新建应用

先把应用身份改成自己的，否则会和其它应用共用 userData 和单实例锁：

- `package.json` 的 `name`
- `build.productName`、`build.appId`
- `build.linux.desktopName`
- `APP_CONSTANTS.APP_ID` / `NAME`

这些值决定 `%APPDATA%` 下的 userData 目录，以及 Windows 的任务栏 / 通知身份。

### 新增页面

1. 在 `src/renderer/views/` 新建页面组件
2. 在 `src/renderer/router/routes.ts` 注册懒加载路由

```ts
// routes.ts
{
  path: '/about',
  name: 'about',
  component: () => import('../views/AboutView.vue'),
}
```

### 新增 IPC 通道

以 `demo:hello` 为例，四处改动缺一不可：

1. `src/shared/constants/index.ts`：加入 `IPC_CHANNELS`
2. `src/shared/types/index.ts`：在 `IpcInvokeMap` 声明 `{ args: [...], returns: T }`（参数与返回值都参与类型校验）
3. 在所属**核心模块**里实现 `ipcHandlers()`，返回 `{ channel, handler }`；`IpcManager` 只做聚合与 sender 校验，不再硬编码业务通道
4. `src/preload/index.ts`：把通道加入白名单（必须内联，不能从共享模块导入）。白名单与 `IpcChannel` 的一致性有编译期断言兜底，漏加会直接 `typecheck` 失败，不会拖到运行时

模块贡献点的类型从 `IpcInvokeMap` 推导：通道名、实参元组与返回值都会校验；重复通道会在启动时直接抛错。`userData/modules` 下的插件不参与收集，避免覆盖核心通道。

渲染端调用：`window.electronAPI.invoke('demo:hello', arg)`，参数与返回值都自动获得类型；传错实参形状会在编译期报错。

> 框架**不提供**通用文件读写通道：`userData/modules` 会在启动时被执行，若能任意写文件就等于给渲染进程留了持久化提权链。需要落盘时，请在自己的模块里用 Node API 实现，并把路径限制在 `userData` 下的专用子目录。

### 新增用户模块

在用户数据目录的 `modules/` 下放置 CommonJS 模块即可被动态加载，完整约定见[插件开发](docs/插件开发.md)：

```js
// userData/modules/hello.cjs
module.exports = {
  name: 'HelloModule',
  version: '1.0.0',
  description: '示例模块',
  async init() {
    console.log('HelloModule initialized');
  },
  async destroy() {
    // 清理资源
  },
};
```

- 核心模块初始化失败会中断启动；用户模块失败只隔离自身
- 用户模块不会被收集 IPC 贡献；需要新增渲染进程可调用的通道时，按上面的核心模块流程改源码
- 模块运行在主进程，拥有主进程权限；只保证 `electron` 与 Node 内置模块可用，**不能 require 第三方依赖**（打包时排除了 `node_modules`）
- 默认可执行外部代码属于插件的固有风险，生产环境请自行校验模块来源

### 主题与语言

```ts
await configStore.updateConfig({ theme: 'dark' }); // light / dark / auto
await configStore.updateConfig({ language: 'en-US' }); // zh-CN / en-US
```

- `theme`：`applyTheme` 只切换 `<html data-theme>`，颜色全部来自 `src/renderer/styles/theme.css` 的 CSS 变量；`auto` 会跟随系统配色变化
- `language`：渲染端用 `useI18n()`，主进程用 `getMessages(locale)`，两边共用 `src/shared/i18n` 的同一份文案
- 新增语言：在 `src/shared/i18n` 加一份 `AppMessages`，再补进 `SUPPORTED_LOCALES`；`schema` 会自动放行
- 新增主题色：只改 `theme.css` 里的变量，不要在组件里写死颜色

### 新增一个功能开关

框架内置两个开关：`features.developerTools`（功能开关）和 `security.sandboxEnabled`（启动安全开关）。前者按下面的五步加自己的功能开关；后者只从 `config.json` 读取，不走 `config:update`，也不要在设置页暴露——否则渲染进程被 XSS 后可以关掉下一次启动的沙箱。

1. `src/shared/types/index.ts`：在 `FeatureFlags` 加字段
2. `src/shared/config/defaults.ts`：给默认值（主进程与渲染进程共用这一份）
3. `src/shared/config/schema.ts`：加 `'boolean'` 白名单（漏加会被拒绝写入）
4. `src/renderer/components/ConfigPanel.vue`：加复选框，`handleFeatureToggle('yourFlag', ...)`
5. 消费：主进程 `configModule.getValue<boolean>('features.yourFlag')`，渲染端 `configStore.config.features.yourFlag`

文案在 `src/shared/i18n` 补中英文两条即可。

> 框架**不内置遥测/埋点**：采集什么数据、是否上报、上报到哪，都由应用层自己决定。需要"数据统计"开关的话，按上面的 recipe 加一个属于你业务的 flag。

### 配置

```ts
const configStore = useConfigStore();
await configStore.ensureLoaded();
configStore.config; // 当前配置
await configStore.updateConfig({ theme: 'dark' });
```

- 默认值统一在 `src/shared/config/defaults.ts`
- 结构契约在 `src/shared/config/schema.ts`：`config:update` 只接受 schema 内的键与合法类型，未知键、错误类型、`__proto__` 之类原型键一律拒绝并返回带键路径的错误
- 渲染端不再使用 `localStorage`
- 主进程落盘位置：`userData/config.json`（串行化 + 临时文件 rename 原子写入）
- 旧版本残留的未知键会在加载时裁剪，首次裁剪前备份到 `config.json.bak`
- 窗口标题取自配置的 `appName`，构建脚本不再改写 `index.html`
- `features.developerTools` 控制开发态启动时是否自动打开 DevTools
- `security.sandboxEnabled` 默认 `true`。设为 `false` 时，主进程会在 `app.whenReady` 之前加 `--no-sandbox`，**重启生效**；该键只从 `userData/config.json` 读取，`config:update` 会丢弃它，渲染进程无法修改
- 主进程支持 `ELECTRON_USER_DATA_DIR` 覆盖 userData 目录（便携模式与 CI 冒烟用）

### 窗口状态

无需额外代码，框架自动保存/恢复 `window.width/height/x/y/maximized`；显示器变化导致的离屏坐标会被丢弃。

### 日志

- 主进程日志：`userData/logs/main.log`，异步串行写入（不阻塞事件循环）
- 单文件超过 5 MB 时轮转为 `main.log.1`…`main.log.3`，最旧的丢弃；退出前 `flush()` 语义不变
- 退出与崩溃路径会先 `flush()` 再退出，崩溃原因不会停在缓冲区
- `uncaughtException` / `unhandledRejection` 会记录后兜底
- **渲染端异常也会进同一个文件**：`errorHandler`、`unhandledrejection`、`AppErrorBoundary`、`useSystemInfo` 都走 `log:report`，带 `[renderer]` 前缀
- 上报通道自我约束：级别白名单、单条截断 2000 字符、10 秒 50 条滑动窗口限流
- 启动会记录分段耗时（`Startup completed`）：`ready` / `modules` / `ipc` / `window` / `total` 单位毫秒

```ts
import { reportError, reportInfo } from '@/utils/report';

reportInfo('user opened settings');
reportError('save failed', error, { module: 'SettingsView' });
```

## 质量门禁

提交前保持以下命令全绿；pre-commit 钩子（`npm install` 自动安装）与 CI（`.github/workflows/ci.yml`）执行同一套：

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

CI 额外做三件事（已在 2026-11-15 首跑，ubuntu 全绿）：

- 用 `npm run test:coverage` 跑覆盖率阈值（当前基线：statements 72% / branches 72% / functions 67% / lines 72%）
- 在 **ubuntu（xvfb）与 windows** 两个平台各跑一次 `npm run smoke`，真正启动 Electron 并校验配置与日志落盘——避免「门禁全绿但应用起不来」
- 两个平台各跑一次 `npm run e2e`：驱动界面点开配置面板、改主题、切语言，再重启一次验证窗口状态与配置恢复（单测 mock 掉 `invoke` 之后，序列化错误这类问题只有真实链路能暴露）

## 打包

```bash
npm run electron:build         # 当前平台解包产物：dist-app/<platform>-unpacked
npm run electron:build-win     # Windows 安装包（NSIS）
npm run electron:build-linux   # Linux 包（AppImage + deb），需在 Linux 上执行
```

平台差异：

| 平台    | 产物           | 说明                                                                                                           |
| ------- | -------------- | -------------------------------------------------------------------------------------------------------------- |
| Windows | NSIS 安装包    | 用 `assets/icon.ico`；可在 Windows 上直接打                                                                    |
| Linux   | AppImage + deb | 用 `assets/icon.png`（512×512 PNG）；**必须在 Linux 上打**，AppImage/deb 依赖 Linux 工具链（`dpkg`、`fpm` 等） |

> 手上只有 Windows 时怎么办：可以交叉打出 **`tar.gz`**（`npx electron-builder --linux tar.gz`），解压后 `chmod +x` 即可运行——它验证不了安装包，但能验证应用本体。AppImage 需要建符号链接（Windows 要开发者模式），deb 需要 Linux 的 `fpm`，两者在 Windows 上都出不来。
>
> 不想在本地装 Linux 环境：推送到 GitHub 后，`Package (Linux)` 工作流会在 ubuntu runner 上自动产出 AppImage + deb，并作为 artifact 上传（保留 14 天）。

- 主进程与 preload 输出到 `dist-electron`
- 渲染产物通过 `extraResources` 进入安装包的 `resources/dist`
- 打包配置位于 `package.json` 的 `build` 字段（`win` / `linux` 两段）
- Linux 的 `deb` 需要维护者信息，配置里用 `build.linux.maintainer`；换成你自己的团队即可
- 图标要求：Windows 用 `.ico`，Linux 用**真正的 PNG**（≥512×512）。`assets/icon.png` 目前是从 256×256 的 ICO 放大而来，正式发布前建议换成设计稿导出的 512/1024 PNG
- **不做自动更新**（明确的非目标）：`publish: null` 且 `nsis.differentialPackage: false`，产物不含 `latest.yml` 与 `.blockmap`；也不提供更新源与安装引导，详见[路线图](docs/framework-roadmap.md#自动更新明确不做)
- **不做代码签名**（明确的非目标）：框架不提供证书配置、签名脚本与公证流程。签名、分发、SmartScreen / Gatekeeper 处理都归使用方，按各自证书与发布渠道处理；证书文件不要提交到仓库（`.gitignore` 已忽略 `*.pfx` / `*.p12`）

## 安全默认

- `nodeIntegration: false`、`contextIsolation: true`、`sandbox` 默认开启（由 `security.sandboxEnabled` 控制）
- preload 只暴露白名单通道，已移除任意 `send` / `on`
- IPC 校验 sender 来源：开发态按 origin 精确比对 `http://localhost:5173`，打包后只接受 `file://` 且拒绝带主机的 file URL（防 `localhost:5173.evil.com` 这类前缀伪装）；导航守卫与 DevTools 守卫对所有创建的窗口生效（框架目前只建主窗口，多窗口 API 已按"无人使用"移除）
- **不提供通用文件读写通道**：它能写进 `userData/modules`，与动态模块加载叠加等于给渲染进程留了持久化提权链
- 配置写入走 schema 白名单校验，拒绝未知键、错误类型与原型键
- **生产态收起 DevTools**：除非 `features.developerTools` 为 true，否则菜单里没有「开发者工具」项，F12 / Ctrl+Shift+I / Cmd+Alt+I 也被拦截
- 渲染端日志上报有级别白名单、长度截断与限流，避免被异常循环刷爆日志
- CSP 禁止 `unsafe-eval`，并显式关闭 `object-src` 与 `base-uri`；HMR 的 `ws://localhost:5173` 只在开发态注入，生产 CSP 为 `connect-src 'self'`；站外导航与 `window.open` 默认拦截
- Web 权限请求与权限查询默认拒绝（`setPermissionRequestHandler` + `setPermissionCheckHandler`）
- 窗口首帧背景与窗口图标按主题/平台选择：深色主题启动不闪白，Linux 优先使用可解码的 PNG 图标
- 托盘创建失败时不会隐藏窗口（避免窗口消失且无法唤回）；退出时模块清理最长等 3 秒

## 文档

| 想知道                                               | 看                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| 怎么跑起来、常见任务（加页面/通道/配置项/语言/图标） | [使用指南](docs/框架使用指南.md)                                |
| 为什么这么分层、一次 IPC 怎么走、扩展点在哪          | [架构说明](docs/架构.md)                                        |
| 每项能力对应哪块源码、IPC 与配置项清单               | [功能详解](docs/框架功能详解.md)                                |
| 抄一个完整功能（用户管理，含测试）                   | [API 实现示例](docs/API实现示例.md)                             |
| 写插件 / 插件能力边界                                | [插件开发](docs/插件开发.md)                                    |
| 接手这个项目 / 交接给别人                            | [交接文档](docs/交接.md)                                        |
| 改了什么、为什么这么改                               | [路线图](docs/framework-roadmap.md) · [CHANGELOG](CHANGELOG.md) |

## License

MIT
