# Electron + Vue3 桌面应用框架

一个现代化的桌面应用开发框架，结合了 Electron、Vue3 和 TypeScript 技术栈，提供标准化的项目结构、模块化架构和丰富的开箱即用功能。

## 🚀 核心特性

### 技术栈优势
- **现代化技术组合**: Electron + Vue3 + TypeScript + Vite + Pinia
- **类型安全**: 全面的 TypeScript 支持，提供完整的类型定义
- **开发体验**: 支持热重载、快速构建和实时调试

### 架构设计亮点
- **清晰的职责分离**: 主进程、渲染进程、预加载脚本分离设计
- **模块化系统**: 支持插件化扩展，易于维护和扩展
- **安全的 IPC 通信**: 基于预加载脚本的安全通信机制
- **统一配置管理**: 支持环境变量和运行时配置

### 功能特性
- **窗口管理**: 多窗口支持、系统托盘、窗口状态管理
- **状态管理**: 基于 Pinia 的响应式状态管理
- **UI 组件**: 基于 Vue3 Composition API 的组件化设计
- **构建系统**: 高效的 Vite 构建和 electron-builder 打包

## 📁 项目结构

```
electron-vue3-framework/
├── src/
│   ├── main/                 # 主进程代码
│   │   ├── index.ts          # 主进程入口
│   │   ├── managers/         # 管理器类
│   │   │   ├── window.manager.ts    # 窗口管理器
│   │   │   ├── module.manager.ts    # 模块管理器
│   │   │   └── ipc.manager.ts       # IPC 管理器
│   │   ├── ipc/              # IPC 处理器
│   │   │   ├── ipc.manager.ts       # IPC 管理器
│   │   │   ├── system.handler.ts    # 系统处理器
│   │   │   ├── config.handler.ts    # 配置处理器
│   │   │   ├── file.handler.ts      # 文件处理器
│   │   │   └── window.handler.ts    # 窗口处理器
│   │   └── modules/          # 核心模块
│   │       └── config.module.ts     # 配置模块
│   ├── renderer/             # 渲染进程代码
│   │   ├── main.ts           # Vue 应用入口
│   │   ├── App.vue           # 根组件
│   │   ├── components/       # Vue 组件
│   │   │   ├── ConfigPanel.vue      # 配置面板
│   │   │   ├── FrameworkInfo.vue    # 框架信息
│   │   │   ├── Message.vue          # 消息组件
│   │   │   ├── Modal.vue            # 模态框
│   │   │   └── Table.vue            # 表格组件
│   │   ├── composables/      # 组合式 API 函数
│   │   │   ├── index.ts              # 导出文件
│   │   │   └── useConfig.ts          # 配置 Hook
│   │   ├── stores/           # Pinia 状态管理
│   │   │   └── app.store.ts          # 应用状态
│   │   ├── services/         # 服务层
│   │   │   └── config.service.ts     # 配置服务
│   │   └── utils/            # 工具函数
│   │       ├── index.ts              # 导出文件
│   │       └── message.ts            # 消息工具
│   ├── preload/              # 预加载脚本
│   │   └── index.ts          # 预加载脚本入口
│   └── shared/               # 共享代码
│       ├── constants/        # 常量定义
│       │   └── index.ts              # IPC 通道常量
│       ├── types/            # 类型定义
│       │   └── index.ts              # 应用类型
│       └── utils/            # 共享工具
│           ├── index.ts              # 导出文件
│           └── helpers.ts            # 辅助函数
├── assets/                   # 静态资源
│   ├── icon.ico              # 应用图标 (Windows)
│   └── icon.png              # 应用图标
├── dist-electron/            # 主进程构建输出
├── dist/                     # 渲染进程构建输出
├── .env                      # 环境变量配置
├── package.json              # 项目配置
├── vite.config.ts            # Vite 配置
├── tsconfig.json             # TypeScript 配置
├── build.mjs                 # 构建脚本
├── build-app.js              # 应用打包脚本
└── index.html                # HTML 模板
```

## 🛠️ 快速开始

### 环境要求

- **Node.js**: >= 16.x (推荐 18.x 或更高版本)
- **包管理器**: npm 或 yarn
- **操作系统**: Windows 10/11, macOS, Linux

### 安装步骤

```bash
# 克隆项目
git clone <repository-url>
cd electron-vue3-framework

# 安装依赖
npm install

# 或使用 yarn
yarn install
```

### 开发模式

#### 推荐方式（一体化启动）
```bash
# 同时启动开发服务器和 Electron 应用
npm run electron:dev
```

#### 分离启动（用于调试）
```bash
# 终端 1：启动前端开发服务器
npm run dev

# 终端 2：启动 Electron 应用
npm run electron:start
```

**开发模式特性**：
- 🔥 前端热重载，代码更改自动刷新
- 🪟 Electron 窗口自动打开
- 🔧 开发工具默认开启
- 🌐 使用 `http://localhost:5173` 加载资源

### 生产构建

```bash
# 构建应用（渲染进程 + 主进程）
npm run build

# 构建并打包 Electron 应用
npm run electron:build

# 构建 Windows 安装包
npm run electron:build-win

# 简化版 Windows 打包
npm run electron:build-win-simple
```

## 📦 打包配置

项目使用 electron-builder 进行应用打包：

### 打包选项
- **目标平台**: Windows (NSIS 安装程序)
- **架构支持**: x64
- **安装配置**:
  - 允许用户自定义安装目录
  - 创建桌面快捷方式
  - 创建开始菜单快捷方式
  - 非一键安装模式

### 输出目录
- **安装包**: `dist-app/Electron Vue3 Framework Setup [version].exe`
- **解包应用**: `dist-app/win-unpacked/`

### 资源管理
- **图标**: 支持 ICO 和 PNG 格式
- **静态资源**: 自动包含在打包文件中
- **环境变量**: 支持开发和生产环境配置

## 🔧 核心功能详解

### 模块系统

框架内置模块化系统，支持动态加载和生命周期管理：

```typescript
// 自定义模块示例
const customModule = {
  name: 'CustomModule',
  dependencies: ['ConfigModule'],
  
  async init(): Promise<void> {
    // 模块初始化逻辑
    console.log('CustomModule initialized');
  },
  
  async destroy(): Promise<void> {
    // 模块销毁逻辑
    console.log('CustomModule destroyed');
  },
  
  // 模块提供的 API
  getData(): any {
    return { message: 'Hello from CustomModule' };
  }
};

// 注册模块
moduleManager.register(customModule);
```

### IPC 通信机制

安全的进程间通信，基于预加载脚本：

#### 渲染进程调用主进程
```typescript
// 调用主进程方法（带返回值）
const systemInfo = await window.electronAPI.invoke('system:get-info');

// 发送消息到主进程（无返回值）
window.electronAPI.send('window:minimize');

// 监听主进程消息
window.electronAPI.on('config:updated', (event, newConfig) => {
  console.log('配置已更新:', newConfig);
});
```

#### 主进程处理器注册
```typescript
// 注册 IPC 处理器
ipcManager.registerHandler({
  channel: 'custom:operation',
  handler: async (event, ...args) => {
    // 处理逻辑
    return { success: true, data: '操作完成' };
  }
});
```

### 配置管理系统

统一的配置管理，支持持久化存储和实时同步：

```typescript
// 获取配置
const currentConfig = configService.getConfig();
const theme = configService.getValue('theme');

// 更新配置
await configService.updateConfig({
  theme: 'dark',
  language: 'zh-CN'
});

// 监听配置变化
const unsubscribe = configService.subscribe((newConfig) => {
  console.log('配置发生变化:', newConfig);
});

// 在 Vue 组件中使用
const { config, updateConfig, loading } = useConfig();
```

### 窗口管理功能

强大的窗口管理能力：

```typescript
// 创建新窗口
const newWindow = windowManager.createWindow('settings', {
  width: 800,
  height: 600,
  title: '设置'
});

// 窗口事件处理
windowManager.on('window-created', (windowId) => {
  console.log(`窗口已创建: ${windowId}`);
});

// 系统托盘支持
windowManager.setupTray();
```

## 🎯 开发指南

### 添加新功能模块

1. **创建模块文件**
```typescript
// src/main/modules/your-module.module.ts
export class YourModule {
  name = 'YourModule';
  
  async init(): Promise<void> {
    // 初始化逻辑
  }
  
  // 模块方法...
}
```

2. **注册 IPC 处理器**
```typescript
// src/main/ipc/your-module.handler.ts
export class YourModuleHandler {
  // 处理器实现...
}
```

3. **在前端添加对应服务**
```typescript
// src/renderer/services/your-module.service.ts
export class YourModuleService {
  // 服务方法...
}
```

### 自定义构建配置

修改 `vite.config.ts` 来自定义构建行为：

```typescript
// 自定义渲染进程配置
const customRendererConfig = defineConfig({
  // 添加插件、配置别名等
  plugins: [
    vue(),
    // 其他插件...
  ],
  build: {
    // 构建配置...
  }
});
```

## 🐛 故障排除

### 常见问题

1. **端口 5173 被占用**
```bash
# Windows 检查端口占用
netstat -ano | findstr :5173

# 终止进程（替换 PID）
taskkill /PID <PID> /F

# 或修改 Vite 配置中的端口号
```

2. **Electron 应用无法启动**
- 确保前端开发服务器正常运行（http://localhost:5173）
- 检查防火墙或安全软件设置
- 查看控制台错误信息

3. **IPC 通信错误**
- 确保预加载脚本配置正确
- 检查类型定义是否完整
- 验证通道名称是否匹配

4. **打包后应用白屏**
- 确认资源路径配置正确
- 检查构建输出是否完整
- 验证环境变量设置

### 调试技巧

**主进程调试**:
```bash
# 在 Electron 启动参数中添加调试选项
electron . --inspect=9229
```

**渲染进程调试**:
- 使用 Chrome DevTools（默认开启）
- 查看 Console 和 Network 面板

## 📚 API 参考

### 主进程 API

#### WindowManager
- `createMainWindow(): BrowserWindow` - 创建主窗口
- `createWindow(id: string, options: WindowOptions): BrowserWindow` - 创建新窗口
- `setupTray(): void` - 设置系统托盘
- `destroyTray(): void` - 销毁系统托盘

#### IpcManager
- `registerHandler(handler: IpcHandler): void` - 注册 IPC 处理器
- `setupHandlers(): void` - 设置所有处理器
- `unregisterHandler(channel: string): void` - 注销处理器

#### ModuleManager
- `init(): Promise<void>` - 初始化所有模块
- `register(module: BaseModule): void` - 注册模块
- `getModule(name: string): BaseModule | null` - 获取模块

### 渲染进程 API

#### Electron API (通过预加载脚本暴露)
- `invoke(channel: string, ...args: any[]): Promise<any>` - 调用主进程方法
- `send(channel: string, ...args: any[]): void` - 发送消息到主进程
- `on(channel: string, listener: Function): void` - 监听主进程消息

#### 配置服务
- `getConfig(): AppConfig` - 获取完整配置
- `updateConfig(updates: Partial<AppConfig>): Promise<void>` - 更新配置
- `subscribe(callback: ConfigCallback): Unsubscribe` - 监听配置变化

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范
- 使用 TypeScript 并确保类型安全
- 遵循现有的代码风格
- 添加适当的注释和文档
- 确保所有功能都有相应的测试

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

感谢以下开源项目的支持：
- [Electron](https://electronjs.org/) - 跨平台桌面应用框架
- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架
- [Vite](https://vitejs.dev/) - 下一代前端构建工具
- [TypeScript](https://www.typescriptlang.org/) - JavaScript 的超集

---

**⭐ 如果这个项目对您有帮助，请给它一个 Star！**