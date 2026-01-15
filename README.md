# Electron + Vue3 应用框架

一个现代化的桌面应用开发框架，结合了Electron、Vue3和TypeScript技术栈，提供了标准化的项目结构、模块化架构和丰富的开箱即用功能。

## 特性

- **现代化技术栈**: 使用 Electron、Vue3、TypeScript、Vite 和 Pinia
- **标准化架构**: 清晰的目录结构和模块划分
- **模块化设计**: 支持插件化模块系统，易于扩展
- **IPC通信**: 安全高效的主进程与渲染进程通信机制
- **配置管理**: 统一的配置管理系统
- **响应式UI**: 基于Vue3 Composition API的响应式用户界面
- **开发友好**: 支持热重载和快速开发模式

## 目录结构

```
electron-vue3-framework/
├── src/
│   ├── main/                 # 主进程代码
│   │   ├── index.ts          # 主进程入口
│   │   ├── managers/         # 管理器类 (窗口、IPC、模块)
│   │   └── modules/          # 核心模块
│   ├── renderer/             # 渲染进程代码
│   │   ├── main.ts           # Vue应用入口
│   │   ├── App.vue           # 根组件
│   │   ├── components/       # Vue组件
│   │   ├── composables/      # 组合式API函数
│   │   ├── stores/           # Pinia状态管理
│   │   └── utils/            # 工具函数
│   ├── preload/              # 预加载脚本
│   │   └── index.ts
│   └── shared/               # 共享类型定义
│       └── types.ts
├── assets/                   # 静态资源
├── dist/                     # 构建输出 (渲染进程)
├── dist-electron/            # 构建输出 (主进程)
├── package.json
├── vite.config.ts            # Vite配置文件
└── tsconfig.json             # TypeScript配置文件
```

## 快速开始

### 环境要求

- Node.js >= 16.x
- npm 或 yarn

### 安装

```bash
# 克隆项目
git clone <repository-url>
cd electron-vue3-framework

# 安装依赖
npm install
```

### 开发模式

```bash
# 同时启动开发服务器和Electron应用（推荐）
npm run electron:dev

# 或者分别启动（用于调试）
# 终端1：启动开发服务器
npm run dev

# 终端2：启动Electron应用
npm run electron:start
```

**开发模式特点**：
- 前端支持热重载，代码更改会自动刷新
- Electron应用窗口会自动打开
- 开发工具默认开启，便于调试
- 使用 `http://localhost:5173` 加载前端资源

### 生产构建

```bash
# 构建应用
npm run build

# 构建并打包Electron应用（临时）
npm run electron:build

# 构建Windows安装包
npm run electron:build-win
```

### 打包配置

项目使用electron-builder进行打包，主要配置如下：

- **目标平台**: Windows (NSIS安装程序)
- **架构**: x64
- **安装选项**: 
  - 允许用户更改安装目录
  - 创建桌面快捷方式
  - 创建开始菜单快捷方式
- **输出目录**: `dist-app/`

打包后的文件位于 `dist-app/` 目录，包含：
- `Electron Vue3 Framework Setup [version].exe` - Windows安装程序
- `win-unpacked/` - 解包的应用程序文件

**注意**: 应用在打包后会正确处理本地资源加载，避免 "Not allowed to load local resource" 错误。

## 故障排除

### 常见问题

1. **端口5173被占用**
   ```bash
   # 检查占用端口的进程
   netstat -ano | findstr :5173
   
   # 终止占用端口的进程（替换PID为实际进程ID）
   taskkill /PID <PID> /F
   ```

2. **Electron应用无法启动**
   - 确保前端开发服务器已启动（http://localhost:5173）
   - 检查是否有防火墙或安全软件阻止连接

3. **IPC通信错误："An object could not be cloned"**
   - 已修复：配置数据在传输前会自动序列化
   - 确保使用最新版本的代码

4. **打包后应用白屏**
   - 已修复：资源路径已正确配置
   - 确保构建时包含所有必要文件

### 开发建议

- 使用 `npm run electron:dev` 进行开发，确保前后端同步启动
- 修改代码后，前端会自动热重载，无需重启Electron应用
- 如需调试主进程，可在Electron启动参数中添加 `--inspect` 或 `--inspect-brk`

## 主要功能

### 模块系统

框架内置了模块化系统，支持动态加载和注册模块：

```typescript
// 注册自定义模块
const customModule = {
  name: 'CustomModule',
  init: () => {
    // 模块初始化逻辑
  },
  destroy: () => {
    // 模块销毁逻辑
  }
};

moduleManager.register(customModule);
```

### IPC通信

框架提供了安全的IPC通信机制：

```typescript
// 在渲染进程中调用主进程方法
const result = await window.electronAPI.invoke('app:get-info');

// 发送消息到主进程
window.electronAPI.send('custom:event', data);

// 监听来自主进程的消息
window.electronAPI.on('custom:response', (event, data) => {
  console.log(data);
});
```

### 配置管理

统一的配置管理系统，支持持久化存储：

```typescript
// 获取配置
const configValue = configService.get('setting.key');

// 更新配置
await configService.set('setting.key', newValue);

// 监听配置变化
configService.watch('setting.key', (newValue) => {
  // 处理配置变化
});
```

### 窗口管理

便捷的窗口管理功能：

```typescript
// 创建新窗口
const newWindow = windowManager.createWindow('window-id', {
  width: 800,
  height: 600,
  webPreferences: {
    // 窗口选项
  }
});
```

## 技术栈

- **Electron**: 跨平台桌面应用开发框架
- **Vue3**: 现代化前端框架，使用Composition API
- **TypeScript**: 类型安全的JavaScript超集
- **Vite**: 快速的构建工具
- **Pinia**: Vue官方推荐的状态管理库
- **@vueuse/core**: 实用的Vue组合式API集合

## 贡献

欢迎提交Issue和Pull Request来改进此框架。

## 项目状态

✅ **已完成的功能**：
- 完整的Electron + Vue3项目架构
- 模块化系统设计
- IPC跨进程通信
- 配置管理系统
- 窗口管理功能
- Windows安装包打包
- 开发模式热重载
- 错误处理和故障排除

## 许可证

MIT License