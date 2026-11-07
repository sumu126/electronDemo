# Electron + Vue3 快速开发框架

一个用于**快速搭建桌面应用**的脚手架：克隆后即可开发，不需要先补基础设施。框架提供主进程 / 预加载 / 渲染进程分层、类型安全 IPC、配置与窗口状态、路由、模块系统、日志、质量门禁和安全默认值；业务本身由使用方在其上叠加。

> 定位：快速开发框架，不是完整业务应用。框架不绑定自动更新、发布渠道或具体 UI 组件库。

## 核心特性

- **三进程分层**：`main` / `preload` / `renderer` / `shared`，职责清晰
- **类型安全 IPC**：通道白名单 + `IpcInvokeMap` 参数/返回类型 + 编译期白名单完整性断言 + sender 来源校验
- **单一配置源**：主进程落盘 `userData/config.json`（schema 校验 + 原子写），渲染端通过 Pinia store 读写
- **窗口状态持久化**：位置、尺寸、最大化状态自动保存与恢复，离屏坐标自动丢弃
- **路由骨架**：`vue-router` 4 + hash 模式，打包后 `file://` 可直接工作
- **模块系统**：`userData/modules` 下的 CommonJS 模块可动态加载，单个模块失败不影响启动
- **日志与异常**：主进程异步文件日志（退出前刷盘）+ 全局异常兜底
- **质量门禁**：`typecheck` / `lint` / `format:check` / `test`（含覆盖率阈值）/ `build`，本地钩子与 CI 同一套
- **安全默认**：`sandbox: true`、CSP、导航拦截、权限默认拒绝、不提供通用文件读写通道

## 技术栈

| 类别        | 选型                            |
| ----------- | ------------------------------- |
| 运行时      | Electron 45                     |
| 前端        | Vue 3.5 + TypeScript 5.9        |
| 构建        | Vite 8 + electron-builder 26    |
| 状态 / 路由 | Pinia 4 + Vue Router 4          |
| 测试 / 规范 | Vitest 5 + ESLint 10 + Prettier |

## 环境要求

- Node.js **>= 22.12**（Vite 8 要求，`package.json` 的 `engines` 与 `.nvmrc` 已锁定）
- npm >= 10
- Windows 10+（Electron 45 已不支持 Windows 7/8/8.1；macOS/Linux 需自行验证）

## 快速开始

```bash
npm install
npm run electron:dev
```

`electron:dev` 会先构建主进程，再并行启动 Vite 与 Electron，并用 `wait-on` 等待 `5173` 就绪，避免固定延时导致的启动竞态。

> 渲染进程由 Vite 热更新；修改主进程或 preload 后需要重新执行 `electron:dev`（当前未接主进程热重启）。

> **启动报 `Cannot read properties of undefined (reading 'requestSingleInstanceLock')`**：当前终端把 `ELECTRON_RUN_AS_NODE=1` 传给了子进程（VS Code 等 Electron 系终端常见），Electron 会被当成普通 Node 执行。启动前清掉该变量即可：PowerShell `$env:ELECTRON_RUN_AS_NODE=''`，cmd `set ELECTRON_RUN_AS_NODE=`。

### 常用命令

```bash
npm run dev              # 仅启动 Vite
npm run electron:dev     # 构建主进程 + 启动 Electron 开发环境
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
```

`npm install` 会通过 `prepare` 自动安装 pre-commit 钩子，提交时依次跑 typecheck / lint / format:check / test / build；确实要跳过时用 `SKIP_GATES=1 git commit ...`。

## 目录结构

```
src/
├── main/                     # 主进程
│   ├── index.ts              # 应用入口、生命周期、全局异常
│   ├── ipc/                  # IPC 处理器与 sender 校验
│   ├── ipc-manager/          # 通道注册与管理
│   ├── managers/             # 窗口、模块注册表、模块加载器、窗口状态
│   ├── modules/              # 核心模块（配置）
│   └── utils/                # 主进程工具（Logger）
├── preload/                  # contextBridge 暴露的安全 API（通道白名单）
├── renderer/                 # 渲染进程
│   ├── router/               # 路由表（hash 模式）
│   ├── views/                # 页面
│   ├── components/           # 组件
│   ├── composables/          # 组合式函数
│   ├── stores/               # Pinia（配置、应用状态）
│   └── env.d.ts              # window.electronAPI 类型声明
└── shared/                   # 跨进程共享
    ├── config/               # 默认值与配置 schema（唯一来源）
    ├── constants/            # IPC 通道常量
    ├── types/                # IPC/配置类型契约
    └── utils/                # 纯函数工具与路径守卫
scripts/                      # 仓库脚本（钩子安装）
docs/                         # 文档与实施记录
```

## 开发约定

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
3. `src/main/ipc-manager/ipc.manager.ts`：注册 handler
4. `src/preload/index.ts`：把通道加入白名单（必须内联，不能从共享模块导入）。白名单与 `IpcChannel` 的一致性有编译期断言兜底，漏加会直接 `typecheck` 失败，不会拖到运行时

渲染端调用：`window.electronAPI.invoke('demo:hello', arg)`，参数与返回值都自动获得类型；传错实参形状会在编译期报错。

> 框架**不提供**通用文件读写通道：`userData/modules` 会在启动时被执行，若能任意写文件就等于给渲染进程留了持久化提权链。需要落盘时，请在自己的模块里用 Node API 实现，并把路径限制在 `userData` 下的专用子目录。

### 新增用户模块

在用户数据目录的 `modules/` 下放置 CommonJS 模块即可被动态加载：

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
- 默认可执行外部代码属于插件的固有风险，生产环境请自行校验模块来源

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

### 窗口状态

无需额外代码，框架自动保存/恢复 `window.width/height/x/y/maximized`；显示器变化导致的离屏坐标会被丢弃。

### 日志

- 主进程日志：`userData/logs/main.log`，异步串行写入（不阻塞事件循环）
- 退出与崩溃路径会先 `flush()` 再退出，崩溃原因不会停在缓冲区
- `uncaughtException` / `unhandledRejection` 会记录后兜底
- 渲染端已设置 `app.config.errorHandler` 与 `unhandledrejection`

## 质量门禁

提交前保持以下命令全绿；pre-commit 钩子（`npm install` 自动安装）与 CI（`.github/workflows/ci.yml`）执行同一套：

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

CI 用 `npm run test:coverage`，覆盖率阈值在当前基线（statements 27% / branches 34% / functions 18% / lines 27%）之上，防止倒退。

## 打包

```bash
npm run electron:build       # 解包产物：dist-app/win-unpacked
npm run electron:build-win   # Windows 安装包：dist-app
```

- 主进程与 preload 输出到 `dist-electron`
- 渲染产物通过 `extraResources` 进入安装包的 `resources/dist`
- 打包配置位于 `package.json` 的 `build` 字段
- 默认关闭自动更新：`publish: null` 且 `nsis.differentialPackage: false`，产物不含 `latest.yml` 与 `.blockmap`；接入方式见[路线图](docs/framework-roadmap.md#自动更新当前不做接口预留)

## 安全默认

- `nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`
- preload 只暴露白名单通道，已移除任意 `send` / `on`
- IPC 校验 sender 来源：开发态按 origin 精确比对 `http://localhost:5173`，打包后只接受 `file://` 且拒绝带主机的 file URL（防 `localhost:5173.evil.com` 这类前缀伪装）；主窗口与 `createWindow` 创建的子窗口都施加导航守卫
- **不提供通用文件读写通道**：它能写进 `userData/modules`，与动态模块加载叠加等于给渲染进程留了持久化提权链
- 配置写入走 schema 白名单校验，拒绝未知键、错误类型与原型键
- CSP 禁止 `unsafe-eval`；HMR 的 `ws://localhost:5173` 只在开发态注入，生产 CSP 为 `connect-src 'self'`；站外导航与 `window.open` 默认拦截
- Web 权限请求默认拒绝
- 托盘创建失败时不会隐藏窗口（避免窗口消失且无法唤回）；退出时模块清理最长等 3 秒

## 文档

- [补齐路线与实施记录](docs/framework-roadmap.md)
- [框架功能详解](docs/框架功能详解.md)
- [使用指南](docs/框架使用指南.md)
- [从页面到后端功能 API 实现示例](docs/API实现示例.md)

## License

MIT
