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

Phase 3 剩余：自动更新（需要更新源与签名策略）、打包发布（多平台/签名/体积优化）、架构与发布文档。
