# 仓库协作约定（AGENTS.md）

> 接手项目或交接给他人时，先读 `docs/交接.md`（含当前状态、未验证项、已知陷阱与下一步优先级）。

## Git：改动前后都要落在本地仓库

- **改动前**：工作区必须是干净的。有未提交内容就先提交（或 `git stash`），不要把上一轮的改动和新改动混在一个提交里。
- **改动后**：立即提交到本地仓库，不要留着未提交的改动。一次改动 = 至少一个提交。
- **只提交到本地**：默认不 `git push`，除非明确要求。
- **提交粒度**：按语义拆分（code / docs / chore 分开），不要把所有东西塞进一个提交。
- **提交信息**：Conventional Commits 前缀（`feat` / `fix` / `refactor` / `chore` / `docs` / `perf` / `test`），首行中文摘要，正文说清「改了什么、为什么、怎么验证」。

## 提交前必须全绿

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

任何一道门禁失败就不要提交，先修好再提交。

`prepare` 脚本会自动安装 pre-commit 钩子，提交时跑同一套门禁；确实需要跳过时用 `SKIP_GATES=1 git commit ...`。

CI 额外在 ubuntu（xvfb）与 windows 上各跑一次 `npm run smoke`（启动真实 Electron 校验配置与日志）与 `npm run e2e`（驱动界面走真实 IPC 链路）。

- 改到主进程启动链路时，本地也跑一遍 `npm run smoke`
- 改到渲染端交互、IPC 契约或跨进程传参时，**必须**在本地跑一遍 `npm run e2e`：单测会把 `invoke` mock 掉，序列化/白名单这类问题只有真实链路能暴露

## 发布范围

官方只发布 **Windows 10+ 与 Linux**。macOS 不发布、不验证，相关分支（`appMenu` 等）属 best-effort，不要以此为理由引入新依赖。

## 其他约定

- `dist/`、`dist-electron/`、`dist-app*/` 是构建产物，已在 `.gitignore` 中，不要提交。
- 新增 IPC 通道要同时改 `constants` / `types` / `ipc.manager` / `preload` 白名单（漏加白名单会直接 typecheck 失败）。
- 改动涉及行为约定（脚本、配置项、安全默认）时，同步更新 `README.md` 与 `docs/framework-roadmap.md`。
- 主进程启动链路（模块初始化 → 配置注入 → IPC 注册 → 建窗）顺序不可随意调整。
