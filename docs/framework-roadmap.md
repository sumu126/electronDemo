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

### Phase 3 — 交付能力

1. 安全收尾：生产 CSP、`setWindowOpenHandler`、`will-navigate`、权限请求处理、IPC sender 校验
2. 自动更新：接入 `electron-updater`，与 `features.autoUpdate` 联动
3. 打包发布：移除 `node_modules/**/*` 全量打包、`.env` 出包、asar 优化、Windows 签名、mac/linux target
4. 文档与发布：架构说明、ADR、CHANGELOG、CONTRIBUTING、示例模板

**验收**：能产出一个可安装、可升级、可追踪日志的 Windows 安装包。

## 4. 本次明确不做

- 不引入 UI 组件库，不重做界面
- 不做自动更新与签名（依赖发布链路，放在 Phase 3）
- 不做多平台打包
- 不一次性重构配置双源（放在 Phase 2，避免与门禁建设混在一起）

## 5. 风险与约束

- 仓库当前无测试基线，首批测试只覆盖纯函数，不引入 jsdom/组件测试，避免一次性铺开
- ESLint 采用 `vue/flat/essential`，不启用全套格式规则，避免产生与功能无关的全仓格式化 diff
- Prettier 只提供命令，不纳入 CI，待后续统一格式化时再启用

## 6. Phase 1 实施记录（2026-11-06）

已完成：质量脚本、ESLint 10（flat config）、Prettier、Vitest 5（9 个用例）、GitHub Actions CI，以及路径守卫 `..foo` 误判、未使用导入/方法等 P2 清理。

验证结果：`typecheck`、`lint`、`test`（2 文件 / 9 用例）、`build`、Electron 隔离冒烟全部通过。
