# 从页面到后端功能 API 实现示例

## 1. 概述

本文档将详细介绍如何在 Electron + Vue3 框架中实现从前端页面到后端 API 的完整功能链路。我们将以一个「用户信息管理」功能为例，展示完整的实现步骤。

## 2. 实现流程

### 2.1 整体流程

```
前端页面 → 预加载脚本 → IPC 通信 → 后端处理器 → 业务逻辑 → 返回结果
```

### 2.2 详细步骤

1. **定义类型和常量**：在共享代码中定义相关类型和 IPC 通道常量
2. **创建后端模块**：实现业务逻辑的核心模块
3. **实现 IPC 处理器**：处理前端发来的 IPC 请求
4. **注册 IPC 通道**：在 IPC 管理器中注册新的通道
5. **暴露前端 API**：在预加载脚本中暴露 API 给前端
6. **创建前端服务**：封装 API 调用逻辑
7. **实现前端组件**：创建用户界面和交互逻辑
8. **测试功能**：验证整个功能链路是否正常工作

## 3. 具体实现示例

### 3.1 步骤 1：定义类型和常量

**创建/修改共享类型文件**：`src/shared/types/index.ts`

```typescript
// 用户信息类型
export interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  createdAt: string;
}

// 用户信息更新类型
export interface UserUpdate {
  name?: string;
  email?: string;
  age?: number;
}
```

**创建/修改常量文件**：`src/shared/constants/index.ts`

```typescript
export const IPC_CHANNELS = {
  // 现有通道...
  
  // 用户相关通道
  USER_GET_ALL: 'user:get-all',
  USER_GET_BY_ID: 'user:get-by-id',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
};
```

### 3.2 步骤 2：创建后端模块

**创建用户模块**：`src/main/modules/user.module.ts`

```typescript
import { User, UserUpdate } from '@shared/types';

export class UserModule {
  public readonly name = 'UserModule';
  private users: User[] = [];
  private nextId = 1;

  public async init(): Promise<void> {
    // 初始化示例数据
    this.users = [
      {
        id: '1',
        name: '张三',
        email: 'zhangsan@example.com',
        age: 25,
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        name: '李四',
        email: 'lisi@example.com',
        age: 30,
        createdAt: new Date().toISOString(),
      },
    ];
    this.nextId = 3;
    console.log('UserModule initialized with', this.users.length, 'users');
  }

  public async getAllUsers(): Promise<User[]> {
    return this.users;
  }

  public async getUserById(id: string): Promise<User | undefined> {
    return this.users.find(user => user.id === id);
  }

  public async createUser(userData: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    const newUser: User = {
      id: this.nextId.toString(),
      ...userData,
      createdAt: new Date().toISOString(),
    };
    this.users.push(newUser);
    this.nextId++;
    return newUser;
  }

  public async updateUser(id: string, updates: UserUpdate): Promise<User | undefined> {
    const userIndex = this.users.findIndex(user => user.id === id);
    if (userIndex === -1) {
      return undefined;
    }
    
    this.users[userIndex] = {
      ...this.users[userIndex],
      ...updates,
    };
    return this.users[userIndex];
  }

  public async deleteUser(id: string): Promise<boolean> {
    const initialLength = this.users.length;
    this.users = this.users.filter(user => user.id !== id);
    return this.users.length < initialLength;
  }
}
```

### 3.3 步骤 3：实现 IPC 处理器

**创建用户处理器**：`src/main/ipc/user.handler.ts`

```typescript
import { IpcMainInvokeEvent } from 'electron';
import { BaseIpcHandler } from './base.handler';
import { User, UserUpdate } from '@shared/types';
import { UserModule } from '../modules/user.module';

export class UserHandler extends BaseIpcHandler {
  private userModule: UserModule;

  constructor(userModule: UserModule) {
    super();
    this.userModule = userModule;
  }

  async getAllUsers(event: IpcMainInvokeEvent): Promise<User[]> {
    return this.handleAsync<User[]>(() => {
      return this.userModule.getAllUsers();
    }).then(response => {
      if (!response.success) {
        throw new Error(response.error!);
      }
      return response.data!;
    });
  }

  async getUserById(event: IpcMainInvokeEvent, id: string): Promise<User | undefined> {
    return this.handleAsync<User | undefined>(() => {
      return this.userModule.getUserById(id);
    }).then(response => {
      if (!response.success) {
        throw new Error(response.error!);
      }
      return response.data!;
    });
  }

  async createUser(event: IpcMainInvokeEvent, userData: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    return this.handleAsync<User>(() => {
      return this.userModule.createUser(userData);
    }).then(response => {
      if (!response.success) {
        throw new Error(response.error!);
      }
      return response.data!;
    });
  }

  async updateUser(event: IpcMainInvokeEvent, id: string, updates: UserUpdate): Promise<User | undefined> {
    return this.handleAsync<User | undefined>(() => {
      return this.userModule.updateUser(id, updates);
    }).then(response => {
      if (!response.success) {
        throw new Error(response.error!);
      }
      return response.data!;
    });
  }

  async deleteUser(event: IpcMainInvokeEvent, id: string): Promise<boolean> {
    return this.handleAsync<boolean>(() => {
      return this.userModule.deleteUser(id);
    }).then(response => {
      if (!response.success) {
        throw new Error(response.error!);
      }
      return response.data!;
    });
  }
}
```

### 3.4 步骤 4：注册 IPC 通道

**修改 IPC 管理器**：`src/main/ipc-manager/ipc.manager.ts`

```typescript
import { IpcMain, IpcMainInvokeEvent } from 'electron';
// 现有导入...
import { UserHandler } from '../ipc/user.handler';
import { IPC_CHANNELS } from '@shared/constants';
import { UserModule } from '../modules/user.module';

export class IpcManager {
  // 现有属性...
  private userHandler: UserHandler | null = null;

  constructor(ipcMain: IpcMain, moduleManager: ModuleManager) {
    // 现有代码...
  }

  public setupHandlers(): void {
    // 现有代码...
    
    // 初始化需要模块的处理器
    this.initializeUserHandler();
    
    // 现有注册代码...
    
    // 注册用户处理器
    this.registerUserHandlers();
  }

  private initializeUserHandler(): void {
    const userModule = this.moduleManager.getModule('UserModule') as UserModule;
    if (!userModule) {
      console.error('UserModule not found in module manager');
      return;
    }
    this.userHandler = new UserHandler(userModule);
  }

  // 现有注册方法...

  private registerUserHandlers(): void {
    if (!this.userHandler) {
      console.error('UserHandler not initialized');
      return;
    }
    
    this.registerHandler({
      channel: IPC_CHANNELS.USER_GET_ALL,
      handler: (event: IpcMainInvokeEvent): Promise<any> => {
        return this.userHandler!.getAllUsers(event);
      },
    });
    
    this.registerHandler({
      channel: IPC_CHANNELS.USER_GET_BY_ID,
      handler: (event: IpcMainInvokeEvent, id: string): Promise<any> => {
        return this.userHandler!.getUserById(event, id);
      },
    });
    
    this.registerHandler({
      channel: IPC_CHANNELS.USER_CREATE,
      handler: (event: IpcMainInvokeEvent, userData: any): Promise<any> => {
        return this.userHandler!.createUser(event, userData);
      },
    });
    
    this.registerHandler({
      channel: IPC_CHANNELS.USER_UPDATE,
      handler: (event: IpcMainInvokeEvent, id: string, updates: any): Promise<any> => {
        return this.userHandler!.updateUser(event, id, updates);
      },
    });
    
    this.registerHandler({
      channel: IPC_CHANNELS.USER_DELETE,
      handler: (event: IpcMainInvokeEvent, id: string): Promise<any> => {
        return this.userHandler!.deleteUser(event, id);
      },
    });
  }
}
```

### 3.5 步骤 5：暴露前端 API

**修改预加载脚本**：`src/preload/index.ts`

```typescript
import { contextBridge, ipcRenderer } from 'electron';
import { User, UserUpdate } from '@shared/types';

// 定义暴露给渲染进程的安全API
contextBridge.exposeInMainWorld('electronAPI', {
  // 现有 API...
  
  // 用户相关 API
  getUserList: () => ipcRenderer.invoke('user:get-all'),
  getUserById: (id: string) => ipcRenderer.invoke('user:get-by-id', id),
  createUser: (userData: Omit<User, 'id' | 'createdAt'>) => ipcRenderer.invoke('user:create', userData),
  updateUser: (id: string, updates: UserUpdate) => ipcRenderer.invoke('user:update', id, updates),
  deleteUser: (id: string) => ipcRenderer.invoke('user:delete', id),
});

// 扩展 Window 接口以支持类型提示
declare global {
  interface Window {
    electronAPI: {
      // 现有 API 定义...
      
      // 用户相关 API 定义
      getUserList: () => Promise<User[]>;
      getUserById: (id: string) => Promise<User | undefined>;
      createUser: (userData: Omit<User, 'id' | 'createdAt'>) => Promise<User>;
      updateUser: (id: string, updates: UserUpdate) => Promise<User | undefined>;
      deleteUser: (id: string) => Promise<boolean>;
    };
  }
}
```

### 3.6 步骤 6：创建前端服务

**创建用户服务**：`src/renderer/services/user.service.ts`

```typescript
import { User, UserUpdate } from '@shared/types';

export class UserService {
  /**
   * 获取所有用户
   */
  async getAllUsers(): Promise<User[]> {
    try {
      return await window.electronAPI.getUserList();
    } catch (error) {
      console.error('获取用户列表失败:', error);
      throw error;
    }
  }

  /**
   * 根据 ID 获取用户
   */
  async getUserById(id: string): Promise<User | undefined> {
    try {
      return await window.electronAPI.getUserById(id);
    } catch (error) {
      console.error(`获取用户 ${id} 失败:`, error);
      throw error;
    }
  }

  /**
   * 创建新用户
   */
  async createUser(userData: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    try {
      return await window.electronAPI.createUser(userData);
    } catch (error) {
      console.error('创建用户失败:', error);
      throw error;
    }
  }

  /**
   * 更新用户信息
   */
  async updateUser(id: string, updates: UserUpdate): Promise<User | undefined> {
    try {
      return await window.electronAPI.updateUser(id, updates);
    } catch (error) {
      console.error(`更新用户 ${id} 失败:`, error);
      throw error;
    }
  }

  /**
   * 删除用户
   */
  async deleteUser(id: string): Promise<boolean> {
    try {
      return await window.electronAPI.deleteUser(id);
    } catch (error) {
      console.error(`删除用户 ${id} 失败:`, error);
      throw error;
    }
  }
}

// 导出单例实例
export const userService = new UserService();
```

### 3.7 步骤 7：实现前端组件

**创建用户管理组件**：`src/renderer/components/UserManager.vue`

```vue
<template>
  <div class="user-manager">
    <h2>用户管理</h2>
    
    <!-- 添加用户表单 -->
    <div class="user-form" v-if="showAddForm">
      <h3>添加新用户</h3>
      <form @submit.prevent="handleAddUser">
        <div class="form-group">
          <label>姓名:</label>
          <input v-model="newUser.name" type="text" required>
        </div>
        <div class="form-group">
          <label>邮箱:</label>
          <input v-model="newUser.email" type="email" required>
        </div>
        <div class="form-group">
          <label>年龄:</label>
          <input v-model.number="newUser.age" type="number" min="0" required>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-success" :disabled="loading">
            {{ loading ? '提交中...' : '添加用户' }}
          </button>
          <button type="button" class="btn btn-secondary" @click="showAddForm = false">
            取消
          </button>
        </div>
      </form>
    </div>
    
    <!-- 用户列表 -->
    <div class="user-list">
      <button @click="showAddForm = true" class="btn btn-primary" :disabled="loading">
        添加用户
      </button>
      
      <div class="loading" v-if="loading">加载中...</div>
      
      <table class="user-table" v-if="!loading && users.length > 0">
        <thead>
          <tr>
            <th>ID</th>
            <th>姓名</th>
            <th>邮箱</th>
            <th>年龄</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td>{{ user.id }}</td>
            <td>{{ user.name }}</td>
            <td>{{ user.email }}</td>
            <td>{{ user.age }}</td>
            <td>{{ formatDate(user.createdAt) }}</td>
            <td>
              <button @click="editUser(user)" class="btn btn-info btn-sm">编辑</button>
              <button @click="confirmDelete(user.id)" class="btn btn-danger btn-sm">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
      
      <div class="empty-state" v-if="!loading && users.length === 0">
        暂无用户数据
      </div>
    </div>
    
    <!-- 编辑用户弹窗 -->
    <Modal v-model:visible="showEditModal" title="编辑用户" width="500px">
      <form @submit.prevent="handleUpdateUser">
        <div class="form-group">
          <label>姓名:</label>
          <input v-model="editUser.name" type="text" required>
        </div>
        <div class="form-group">
          <label>邮箱:</label>
          <input v-model="editUser.email" type="email" required>
        </div>
        <div class="form-group">
          <label>年龄:</label>
          <input v-model.number="editUser.age" type="number" min="0" required>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-success" :disabled="loading">
            {{ loading ? '提交中...' : '保存更改' }}
          </button>
        </div>
      </form>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { userService } from '../services/user.service';
import { User } from '@shared/types';
import Modal from './Modal.vue';

// 响应式数据
const users = ref<User[]>([]);
const loading = ref(false);
const showAddForm = ref(false);
const showEditModal = ref(false);

// 新用户数据
const newUser = ref({
  name: '',
  email: '',
  age: 0
});

// 编辑用户数据
const editUser = ref<User>({
  id: '',
  name: '',
  email: '',
  age: 0,
  createdAt: ''
});

// 加载用户列表
const loadUsers = async () => {
  loading.value = true;
  try {
    users.value = await userService.getAllUsers();
  } catch (error) {
    console.error('加载用户失败:', error);
    alert('加载用户失败，请重试');
  } finally {
    loading.value = false;
  }
};

// 添加用户
const handleAddUser = async () => {
  loading.value = true;
  try {
    await userService.createUser(newUser.value);
    // 重置表单
    newUser.value = {
      name: '',
      email: '',
      age: 0
    };
    showAddForm.value = false;
    // 重新加载用户列表
    await loadUsers();
    alert('用户添加成功');
  } catch (error) {
    console.error('添加用户失败:', error);
    alert('添加用户失败，请重试');
  } finally {
    loading.value = false;
  }
};

// 编辑用户
const editUser = (user: User) => {
  editUser.value = { ...user };
  showEditModal.value = true;
};

// 更新用户
const handleUpdateUser = async () => {
  loading.value = true;
  try {
    await userService.updateUser(editUser.value.id, {
      name: editUser.value.name,
      email: editUser.value.email,
      age: editUser.value.age
    });
    showEditModal.value = false;
    // 重新加载用户列表
    await loadUsers();
    alert('用户更新成功');
  } catch (error) {
    console.error('更新用户失败:', error);
    alert('更新用户失败，请重试');
  } finally {
    loading.value = false;
  }
};

// 确认删除
const confirmDelete = (id: string) => {
  if (confirm('确定要删除这个用户吗？')) {
    handleDelete(id);
  }
};

// 删除用户
const handleDelete = async (id: string) => {
  loading.value = true;
  try {
    await userService.deleteUser(id);
    // 重新加载用户列表
    await loadUsers();
    alert('用户删除成功');
  } catch (error) {
    console.error('删除用户失败:', error);
    alert('删除用户失败，请重试');
  } finally {
    loading.value = false;
  }
};

// 格式化日期
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString();
};

// 组件挂载时加载用户列表
onMounted(() => {
  loadUsers();
});
</script>

<style scoped>
.user-manager {
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.user-form {
  margin-bottom: 30px;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #f9f9f9;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.form-group input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.form-actions {
  margin-top: 20px;
  display: flex;
  gap: 10px;
}

.user-list {
  margin-top: 20px;
}

.user-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
}

.user-table th,
.user-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

.user-table th {
  background-color: #f2f2f2;
  font-weight: bold;
}

.user-table tr:hover {
  background-color: #f5f5f5;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}

.loading {
  text-align: center;
  padding: 20px;
  color: #666;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #999;
  background: #f9f9f9;
  border-radius: 4px;
  margin-top: 20px;
}
</style>
```

**在 App.vue 中添加用户管理组件**：

```vue
<template>
  <div class="app-container">
    <!-- 现有代码... -->
    
    <main class="app-main">
      <FrameworkInfo />
      
      <!-- 现有代码... -->
      
      <!-- 添加用户管理组件 -->
      <UserManager />
    </main>
    
    <!-- 现有代码... -->
  </div>
</template>

<script setup lang="ts">
// 现有导入...
import UserManager from './components/UserManager.vue';

// 现有代码...
</script>
```

### 3.8 步骤 8：注册模块

**修改模块管理器**：`src/main/managers/module.manager.ts`

```typescript
import { app } from 'electron';
import { join } from 'path';
import { ConfigModule } from '../modules/config.module';
import { UserModule } from '../modules/user.module';

export interface Module {
  name: string;
  init(): Promise<void>;
  destroy?(): Promise<void>;
}

export class ModuleManager {
  private modules: Map<string, Module> = new Map();

  public async init(): Promise<void> {
    // 初始化系统模块
    await this.loadCoreModules();
    
    // 初始化用户模块
    await this.loadUserModules();
  }

  private async loadCoreModules(): Promise<void> {
    // 核心模块加载逻辑
    console.log('Loading core modules...');
    
    // 注册配置管理模块
    const configModule = new ConfigModule();
    await this.registerModule(configModule);
  }

  private async loadUserModules(): Promise<void> {
    // 用户模块加载逻辑
    console.log('Loading user modules...');
    
    // 注册用户管理模块
    const userModule = new UserModule();
    await this.registerModule(userModule);
  }

  // 现有方法...
}
```

## 4. 测试功能

### 4.1 启动应用

```bash
npm run electron:dev
```

### 4.2 验证功能

1. **查看用户列表**：应用启动后，应该能看到默认的用户数据
2. **添加用户**：点击「添加用户」按钮，填写表单并提交
3. **编辑用户**：点击用户列表中的「编辑」按钮，修改用户信息并保存
4. **删除用户**：点击用户列表中的「删除」按钮，确认后删除用户
5. **验证数据**：每次操作后，用户列表应该实时更新

### 4.3 调试技巧

- **前端调试**：使用 Chrome DevTools 查看控制台日志和网络请求
- **后端调试**：在主进程代码中添加 `console.log()` 语句查看执行流程
- **IPC 调试**：检查 IPC 通道名称是否匹配，参数是否正确
- **错误处理**：查看控制台中的错误信息，定位问题所在

## 5. 常见问题及解决方案

### 5.1 问题：前端无法调用 API

**可能原因**：
- 预加载脚本中没有暴露 API
- IPC 通道名称不匹配
- 后端处理器未注册

**解决方案**：
- 检查 `preload/index.ts` 中的 API 暴露
- 验证 `IPC_CHANNELS` 中的通道名称
- 确认 `IpcManager.setupHandlers()` 中注册了处理器

### 5.2 问题：后端处理器未初始化

**可能原因**：
- 模块未在 `ModuleManager` 中注册
- 模块初始化失败

**解决方案**：
- 检查 `ModuleManager.loadUserModules()` 中是否注册了模块
- 查看控制台中的模块初始化日志

### 5.3 问题：数据不更新

**可能原因**：
- 前端未重新加载数据
- 后端数据操作失败
- IPC 通信错误

**解决方案**：
- 确保操作后调用 `loadUsers()` 重新加载数据
- 检查后端模块中的数据操作逻辑
- 查看 IPC 通信的错误信息

### 5.4 问题：类型错误

**可能原因**：
- TypeScript 类型定义不匹配
- 参数类型错误

**解决方案**：
- 检查 `shared/types/index.ts` 中的类型定义
- 验证前后端传递的参数类型
- 查看 TypeScript 编译错误

## 6. 扩展功能

### 6.1 添加数据持久化

**修改用户模块**：添加数据持久化功能

```typescript
import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { User, UserUpdate } from '@shared/types';

export class UserModule {
  public readonly name = 'UserModule';
  private users: User[] = [];
  private nextId = 1;
  private dataPath: string;

  constructor() {
    this.dataPath = path.join(app.getPath('userData'), 'users.json');
  }

  public async init(): Promise<void> {
    try {
      // 尝试从文件加载数据
      await this.loadFromFile();
      console.log('UserModule initialized with', this.users.length, 'users from file');
    } catch (error) {
      // 如果加载失败，使用默认数据
      this.users = [
        {
          id: '1',
          name: '张三',
          email: 'zhangsan@example.com',
          age: 25,
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          name: '李四',
          email: 'lisi@example.com',
          age: 30,
          createdAt: new Date().toISOString(),
        },
      ];
      this.nextId = 3;
      console.log('UserModule initialized with default users');
      
      // 保存默认数据到文件
      await this.saveToFile();
    }
  }

  public async destroy?(): Promise<void> {
    // 保存数据到文件
    await this.saveToFile();
  }

  // 现有方法...

  private async loadFromFile(): Promise<void> {
    try {
      const data = await fs.readFile(this.dataPath, 'utf-8');
      const parsed = JSON.parse(data);
      this.users = parsed.users || [];
      this.nextId = parsed.nextId || 1;
    } catch (error) {
      throw new Error('Failed to load users from file');
    }
  }

  private async saveToFile(): Promise<void> {
    try {
      const data = JSON.stringify({ users: this.users, nextId: this.nextId }, null, 2);
      await fs.writeFile(this.dataPath, data, 'utf-8');
    } catch (error) {
      console.error('Failed to save users to file:', error);
    }
  }

  // 重写修改数据的方法，添加保存逻辑
  public async createUser(userData: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    const newUser: User = {
      id: this.nextId.toString(),
      ...userData,
      createdAt: new Date().toISOString(),
    };
    this.users.push(newUser);
    this.nextId++;
    await this.saveToFile();
    return newUser;
  }

  public async updateUser(id: string, updates: UserUpdate): Promise<User | undefined> {
    const userIndex = this.users.findIndex(user => user.id === id);
    if (userIndex === -1) {
      return undefined;
    }
    
    this.users[userIndex] = {
      ...this.users[userIndex],
      ...updates,
    };
    await this.saveToFile();
    return this.users[userIndex];
  }

  public async deleteUser(id: string): Promise<boolean> {
    const initialLength = this.users.length;
    this.users = this.users.filter(user => user.id !== id);
    if (this.users.length < initialLength) {
      await this.saveToFile();
      return true;
    }
    return false;
  }
}
```

### 6.2 添加搜索功能

**修改用户服务**：添加搜索方法

```typescript
// 在 user.service.ts 中添加
async searchUsers(keyword: string): Promise<User[]> {
  try {
    const allUsers = await this.getAllUsers();
    return allUsers.filter(user => 
      user.name.toLowerCase().includes(keyword.toLowerCase()) ||
      user.email.toLowerCase().includes(keyword.toLowerCase())
    );
  } catch (error) {
    console.error('搜索用户失败:', error);
    throw error;
  }
}
```

**修改用户管理组件**：添加搜索功能

```vue
<template>
  <!-- 现有代码... -->
  
  <!-- 用户列表 -->
  <div class="user-list">
    <div class="list-header">
      <button @click="showAddForm = true" class="btn btn-primary" :disabled="loading">
        添加用户
      </button>
      <div class="search-box">
        <input 
          v-model="searchKeyword" 
          type="text" 
          placeholder="搜索用户..."
          @input="handleSearch"
        >
      </div>
    </div>
    
    <!-- 现有代码... -->
    
    <table class="user-table" v-if="!loading && filteredUsers.length > 0">
      <!-- 现有代码... -->
      <tbody>
        <tr v-for="user in filteredUsers" :key="user.id">
          <!-- 现有代码... -->
        </tr>
      </tbody>
    </table>
    
    <div class="empty-state" v-if="!loading && filteredUsers.length === 0">
      {{ searchKeyword ? '没有找到匹配的用户' : '暂无用户数据' }}
    </div>
  </div>
  
  <!-- 现有代码... -->
</template>

<script setup lang="ts">
// 现有导入...

// 响应式数据
const users = ref<User[]>([]);
const filteredUsers = ref<User[]>([]);
const searchKeyword = ref('');
// 现有代码...

// 加载用户列表
const loadUsers = async () => {
  loading.value = true;
  try {
    users.value = await userService.getAllUsers();
    filteredUsers.value = [...users.value];
  } catch (error) {
    console.error('加载用户失败:', error);
    alert('加载用户失败，请重试');
  } finally {
    loading.value = false;
  }
};

// 搜索用户
const handleSearch = () => {
  if (!searchKeyword.value) {
    filteredUsers.value = [...users.value];
    return;
  }
  
  const keyword = searchKeyword.value.toLowerCase();
  filteredUsers.value = users.value.filter(user => 
    user.name.toLowerCase().includes(keyword) ||
    user.email.toLowerCase().includes(keyword)
  );
};

// 现有代码...
</script>

<style scoped>
/* 现有样式... */

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.search-box {
  flex: 1;
  max-width: 300px;
  margin-left: 20px;
}

.search-box input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

/* 现有样式... */
</style>
```

## 7. 总结

通过本示例，我们成功实现了一个完整的用户信息管理功能，包括：

1. **后端模块**：实现了用户数据的增删改查逻辑
2. **IPC 通信**：建立了前端与后端的安全通信通道
3. **前端服务**：封装了 API 调用逻辑，提供了友好的接口
4. **用户界面**：创建了直观的用户管理界面，支持添加、编辑、删除用户
5. **数据持久化**：可选的文件存储功能，确保数据不丢失
6. **搜索功能**：可选的用户搜索功能，提高用户体验

这个示例展示了如何在 Electron + Vue3 框架中构建完整的功能链路，从后端数据处理到前端用户界面，涵盖了实际开发中的常见场景。

你可以基于这个示例，扩展更多功能，如：
- 用户认证和权限管理
- 数据导入/导出
- 分页和排序
- 更多的业务逻辑

希望本示例对你理解和使用 Electron + Vue3 框架有所帮助！