# 从页面到主进程：一个完整功能示例

以「用户管理」为例，把一个功能从类型定义一路做到测试与验证。**代码与当前框架一致**（无 `BaseIpcHandler`、无 IPC 信封、无通用文件通道）。

## 0. 全链路

```
renderer 页面/组件
  → store（Pinia）→ toPlain() → window.electronAPI.invoke('user:list')
  → preload 白名单（运行时闸门）
  → ipcMain.handle → sender 来源校验 → UserHandler
  → UserModule（业务逻辑）
  → 纯数据返回 → 结构化克隆回渲染进程
```

改动落在 **9 个位置**，下面逐条给出。

---

## 1. 定义类型与通道

**`src/shared/types/index.ts`** —— 参数与返回值都声明在这里：

```ts
// 业务类型
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

// 挂到 IPC 契约上
export interface IpcInvokeMap {
  // …已有通道
  'user:list': { args: []; returns: User[] };
  'user:create': { args: [input: { name: string; email: string }]; returns: User };
}
```

**`src/shared/constants/index.ts`**：

```ts
export const IPC_CHANNELS = {
  // …已有通道
  USER_LIST: 'user:list',
  USER_CREATE: 'user:create',
} as const;
```

> `as const` 很关键：通道值要保留字面量类型，`IpcManager` 才能用 `IpcChannel` 约束住注册处。

---

## 2. 主进程模块（业务逻辑）

**`src/main/modules/user.module.ts`**：

```ts
import type { Module } from '../managers/module.types';
import type { User } from '@shared/types';

export class UserModule implements Module {
  public readonly name = 'UserModule';
  public readonly version = '1.0.0';
  public readonly description = '用户数据';

  private users: User[] = [];
  private nextId = 1;

  public async init(): Promise<void> {
    this.users = [
      { id: '1', name: '张三', email: 'zhangsan@example.com', createdAt: new Date().toISOString() },
    ];
  }

  public list(): User[] {
    // 返回副本，避免调用方改内部状态
    return this.users.map((user) => ({ ...user }));
  }

  public create(input: { name: string; email: string }): User {
    const user: User = {
      id: String(this.nextId++),
      name: input.name,
      email: input.email,
      createdAt: new Date().toISOString(),
    };

    this.users.push(user);
    return { ...user };
  }
}
```

模块只做业务，不碰 IPC、不碰窗口。这样它能被单测直接实例化。

---

## 3. 注册模块

**`src/main/managers/module.manager.ts`**：

```ts
private async loadCoreModules(): Promise<void> {
  getLogger().info('Loading core modules...');

  const configModule = new ConfigModule();
  const userModule = new UserModule();
  // 只有这里注册的核心模块会被收集 IPC 贡献
  this.coreModules.push(configModule, userModule);

  await this.registry.register(configModule, { required: true });
  await this.registry.register(userModule, { required: true }); // 核心模块：失败即中断启动
}
```

想要「失败隔离」（初始化失败只影响自己），就不要传 `{ required: true }`。

---

## 4. IPC 处理器

**`src/main/ipc/user.handler.ts`**（普通类，不需要继承任何基类）：

```ts
import type { IpcMainInvokeEvent } from 'electron';
import type { User } from '@shared/types';
import { UserModule } from '../modules/user.module';

export class UserHandler {
  constructor(private readonly users: UserModule) {}

  async list(_event: IpcMainInvokeEvent): Promise<User[]> {
    return this.users.list();
  }

  async create(_event: IpcMainInvokeEvent, input: { name: string; email: string }): Promise<User> {
    // 入参来自渲染进程，类型不可信：业务校验放这里
    const name = String(input?.name ?? '').trim();
    const email = String(input?.email ?? '').trim();

    if (!name) {
      throw new Error('user.name 不能为空');
    }
    if (!email.includes('@')) {
      throw new Error('user.email 格式不正确');
    }

    return this.users.create({ name, email });
  }
}
```

抛错就够了：Electron 会把 `message` 交给渲染端的 rejected promise，不需要包 `{ success: false }`。

---

## 5. 声明通道（模块贡献点）

`IpcManager` 只做聚合，不在内核里写业务通道。通道由模块自己声明：

**`src/main/modules/user.module.ts`**：

```ts
import { UserHandler } from '../ipc/user.handler';
import type { IpcHandlerContribution } from '../ipc/ipc-contribution';

export class UserModule implements Module {
  // …init 与业务方法

  ipcHandlers(): IpcHandlerContribution[] {
    const handler = new UserHandler(this);

    return [
      { channel: 'user:list', handler: (event) => handler.list(event) },
      { channel: 'user:create', handler: (event, input) => handler.create(event, input) },
    ];
  }
}
```

`IpcManager.registerHandler` 已内置 sender 来源校验与重复通道检测，不需要自己写。
只有 `loadCoreModules()` 注册的核心模块会被收集；`userData/modules` 下的插件不参与，避免覆盖核心通道。

---

## 6. 暴露给渲染进程

**`src/preload/index.ts`** —— 注意这是**内联白名单**，不能从 shared import：

```ts
const ALLOWED_CHANNELS = [
  'ping',
  'system:info',
  'config:get',
  'log:report',
  'user:list', // 新增
  'user:create', // 新增
  'window:minimize',
  'window:maximize',
  'window:close',
] as const satisfies readonly IpcChannel[];
```

**漏加会直接 `typecheck` 失败**（文件里有完整性断言），不会拖到运行时才报 `Blocked IPC channel`。

---

## 7. 渲染端 store

**`src/renderer/stores/user.store.ts`**：

```ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { User } from '@shared/types';
import { toPlain } from '../utils/plain';
import { reportError } from '../utils/report';

export const useUserStore = defineStore('user', () => {
  const users = ref<User[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const load = async (): Promise<void> => {
    loading.value = true;
    error.value = null;

    try {
      users.value = await window.electronAPI.invoke('user:list');
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载用户失败';
      reportError('Failed to load users', err);
    } finally {
      loading.value = false;
    }
  };

  const create = async (input: { name: string; email: string }): Promise<void> => {
    try {
      // 复杂对象先转纯数据：Vue 的 Proxy 无法被 IPC 结构化克隆
      await window.electronAPI.invoke('user:create', toPlain(input));
      await load();
    } catch (err) {
      error.value = err instanceof Error ? err.message : '创建用户失败';
      reportError('Failed to create user', err);
    }
  };

  return { users, loading, error, load, create };
});
```

---

## 8. 页面组件

**`src/renderer/views/UserView.vue`**（要点齐全版）：

```vue
<template>
  <div class="user-view">
    <h1>{{ t.user.title }}</h1>

    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <form class="user-form" @submit.prevent="submit">
      <input v-model="form.name" :placeholder="t.user.name" />
      <input v-model="form.email" :placeholder="t.user.email" />
      <button type="submit" :disabled="loading">{{ t.user.create }}</button>
    </form>

    <ul class="user-list">
      <li v-for="user in users" :key="user.id">{{ user.name }} · {{ user.email }}</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from '../composables/useI18n';
import { useUserStore } from '../stores/user.store';

const { t } = useI18n();
const store = useUserStore();
const { users, loading, error } = storeToRefs(store);

const form = reactive({ name: '', email: '' });

const submit = async () => {
  await store.create({ name: form.name, email: form.email });
  form.name = '';
  form.email = '';
};

onMounted(() => {
  void store.load();
});
</script>

<style scoped>
.user-view {
  padding: 20px;
  background: var(--color-surface);
  color: var(--color-text);
}

.user-form {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

input {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-surface);
  color: var(--color-text);
}

.error {
  padding: 10px;
  border-radius: 4px;
  background: var(--color-danger-soft);
  color: var(--color-danger-text);
  border: 1px solid var(--color-danger);
}
</style>
```

颜色全部走 `theme.css` 的变量，深色主题自动生效；文案走 i18n，切换语言自动重渲染。

---

## 9. 文案

**`src/shared/i18n/index.ts`** 加一节：

```ts
export interface AppMessages {
  // …已有
  user: { title: string; name: string; email: string; create: string };
}

// zh-CN
user: { title: '用户管理', name: '姓名', email: '邮箱', create: '添加' },

// en-US
user: { title: 'Users', name: 'Name', email: 'Email', create: 'Add' },
```

两种语言的键结构有用例守护（`shared/i18n/index.test.ts`），漏写一边会失败。

---

## 10. 测试

**模块单测**（纯 Node，不需要 mock electron）：

```ts
// src/main/modules/user.module.test.ts
import { describe, expect, it } from 'vitest';
import { UserModule } from './user.module';

describe('UserModule', () => {
  it('初始化后有默认数据', async () => {
    const module = new UserModule();
    await module.init();
    expect(module.list().length).toBeGreaterThan(0);
  });

  it('创建后能查到，且返回副本', async () => {
    const module = new UserModule();
    await module.init();
    const created = module.create({ name: '李四', email: 'lisi@example.com' });

    expect(module.list().some((user) => user.id === created.id)).toBe(true);

    created.name = '被改了';
    expect(module.list().find((user) => user.id === created.id)?.name).toBe('李四');
  });
});
```

**组件测试**（jsdom + mock 掉 invoke）：

```ts
/**
 * @vitest-environment jsdom
 */
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, it, vi } from 'vitest';
import UserView from './UserView.vue';

const invoke = vi.fn();

beforeEach(() => {
  setActivePinia(createPinia());
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: { invoke } });
});

it('挂载时加载用户列表', async () => {
  invoke.mockResolvedValueOnce([{ id: '1', name: '张三', email: 'a@b.c', createdAt: '' }]);

  const wrapper = mount(UserView);
  await flushPromises();

  expect(invoke).toHaveBeenCalledWith('user:list');
  expect(wrapper.text()).toContain('张三');
});
```

**真实链路**：把这条用例补进 `scripts/e2e.mjs`（打开页面 → 填表 → 提交 → 校验列表），因为组件测试 mock 掉了 `invoke`，**序列化错误只有 e2e 能发现**。

---

## 11. 验证清单

```bash
npm run typecheck        # 通道名、参数、白名单完整性
npm run lint
npm run format:check
npm test                 # 模块 + 组件用例
npm run build
npm run smoke            # 应用能启动、配置与日志落盘
npm run e2e              # 真实 IPC 链路（改了交互就必须跑）
```

---

## 12. 常见坑

| 现象                                                   | 原因                                                  | 处理                                                    |
| ------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------- |
| 编译报 `Type 'true' is not assignable to type 'never'` | 加了通道但没加 preload 白名单                         | 补白名单                                                |
| 运行时 `Blocked IPC channel`                           | 通道名拼错，或改了 preload 没重新构建                 | 检查 `IPC_CHANNELS` 与白名单，重跑 `electron:dev`       |
| `An object could not be cloned.`                       | 传了 Vue 的 Proxy / 函数 / Symbol                     | 用 `toPlain()` 转纯数据                                 |
| `Blocked IPC call from untrusted sender`               | 页面不是 `localhost:5173`（开发）或 `file://`（打包） | 不要用 `127.0.0.1` 或自定义协议                         |
| 保存配置报「不是已知配置项」                           | schema 白名单没加字段                                 | 改 `shared/config/schema.ts`                            |
| 组件里颜色在深色下不对                                 | 写了硬编码色值                                        | 用 `theme.css` 的 CSS 变量                              |
| 新增文案只改了一种语言                                 | i18n 键结构不一致                                     | 两种语言都补，用例会挡住                                |
| 想读写任意文件                                         | 框架不提供该通道（防提权链）                          | 在自己的模块里用 Node API，路径限制在 `userData` 子目录 |

---

## 13. 变体：需要持久化

不要往 `userData/modules` 写文件（那是插件目录，会被执行）。在自己的模块里用一个专用子目录：

```ts
import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';

const dataDir = path.join(app.getPath('userData'), 'user-data'); // 专用子目录
const dataFile = path.join(dataDir, 'users.json');

private async save(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  const temp = `${dataFile}.tmp`;
  await fs.writeFile(temp, JSON.stringify(this.users, null, 2), 'utf-8');
  await fs.rename(temp, dataFile); // 原子替换
}
```

写入失败不要让整个应用崩掉：`init` 里读不到就回退默认值，和 `ConfigModule` 的处理方式一致。
