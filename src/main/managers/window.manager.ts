import { BrowserWindow, screen, Tray, Menu, nativeImage, nativeTheme, app, shell } from 'electron';
import type { NativeImage } from 'electron';
import fs from 'fs';
import { join } from 'path';

import type { AppConfig, WindowConfig } from '@shared/types';
import { getMessages, type AppMessages } from '@shared/i18n';
import { isTrustedSenderUrl, DEV_SERVER_URL } from '../ipc/sender';
import { ConfigModule } from '../modules/config.module';
import { getLogger } from '../utils/app-logger';
import { isDevtoolsShortcut } from './devtools-shortcut';
import { pickDecodableImage } from './tray-icon';
import {
  resolveCloseAction,
  resolveLoadTarget,
  resolveWindowBackgroundColor,
  resolveWindowIconCandidates,
} from './window-policy';
import { MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH, resolveInitialWindowState } from './window-state';

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private configModule: ConfigModule | null = null;
  private quitting = false;
  // 托盘通知只在本进程内记一次；配置只读，不再落盘
  private hasShownTrayNotice = false;

  public setConfigModule(configModule: ConfigModule): void {
    this.configModule = configModule;
  }

  public markQuitting(): void {
    this.quitting = true;
  }

  // macOS 上 activate 可能发生在退出流程被打断之后，需要复位才能继续按托盘语义关闭
  public resetQuitting(): void {
    this.quitting = false;
  }

  public createMainWindow(): BrowserWindow {
    const primaryDisplay = screen.getPrimaryDisplay();
    const savedWindow = this.configModule?.getValue<WindowConfig>('window');
    const initialState = resolveInitialWindowState(
      savedWindow,
      primaryDisplay.workArea,
      screen.getAllDisplays().map((display) => display.workArea),
    );

    const windowIcon = this.pickWindowIcon();

    this.mainWindow = new BrowserWindow({
      width: initialState.width,
      height: initialState.height,
      ...(initialState.x !== undefined && initialState.y !== undefined
        ? { x: initialState.x, y: initialState.y }
        : {}),
      minWidth: MIN_WINDOW_WIDTH,
      minHeight: MIN_WINDOW_HEIGHT,
      frame: true, // 保留窗口边框和系统控制按钮
      autoHideMenuBar: true, // 隐藏默认菜单栏
      show: false, // 等首帧渲染完成再显示，避免启动时白屏闪烁
      // 首帧背景跟随主题：深色主题下启动不再先闪一帧白底
      backgroundColor: resolveWindowBackgroundColor(
        this.configModule?.getValue<AppConfig['theme']>('theme'),
        nativeTheme.shouldUseDarkColors,
      ),
      ...(windowIcon ? { icon: windowIcon } : {}),
      webPreferences: {
        preload: join(__dirname, './preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        // 与启动早期的判断保持一致：只有显式 false 才关闭，异常值一律按开启处理
        sandbox: this.configModule?.getValue<boolean>('security.sandboxEnabled') !== false,
      },
    });

    // 首帧就绪后再显示：启动过程不再出现空白窗口
    this.mainWindow.once('ready-to-show', () => {
      if (!this.mainWindow) {
        return;
      }
      if (initialState.maximized) {
        this.mainWindow.maximize();
      }
      this.mainWindow.show();
    });

    // 兜底：页面加载失败时也要让窗口可见，否则应用看起来像没启动
    this.mainWindow.webContents.on('did-fail-load', () => {
      this.mainWindow?.show();
    });

    // 窗口关闭事件 - 最小化到系统托盘；托盘不可用或正在退出时允许真正关闭
    this.mainWindow.on('close', (event) => {
      const trayAvailable = this.quitting ? true : this.setupTray();

      if (resolveCloseAction({ quitting: this.quitting, trayAvailable }) === 'hide') {
        event.preventDefault();
        this.mainWindow?.hide();
        return;
      }

      // 托盘建不起来时清掉半成品，避免残留一个不可见的托盘图标
      if (!this.quitting && !trayAvailable) {
        this.destroyTray();
      }
    });

    // 窗口真正关闭事件
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    this.loadApp(this.mainWindow);
    this.registerNavigationGuards(this.mainWindow);
    this.registerDevtoolsGuard(this.mainWindow);

    return this.mainWindow;
  }

  // 统一入口：无论是首次启动、激活还是二次实例，创建窗口后都会被正确加载
  private loadApp(window: BrowserWindow): void {
    const target = resolveLoadTarget({
      // 注意：Electron 45 下用 `electron .` 启动时 app.isPackaged 也会返回 true，
      // 因此用 process.defaultApp 判断是否为开发模式。
      isDevelopment: Boolean(process.defaultApp),
      devServerUrl: DEV_SERVER_URL,
      resourcesPath: process.resourcesPath,
    });

    if (target.kind === 'url') {
      window.loadURL(target.url);
      // 开发者工具由配置开关控制，让 features.developerTools 真正生效
      if (this.configModule?.getValue<boolean>('features.developerTools')) {
        window.webContents.openDevTools();
      }
      return;
    }

    window.loadFile(target.file);
  }

  private registerNavigationGuards(window: BrowserWindow): void {
    const isDevelopment = Boolean(process.defaultApp);

    // 新窗口一律拦截；仅 https 外链交给系统浏览器
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://')) {
        void shell.openExternal(url);
      }
      return { action: 'deny' };
    });

    // 页面内导航只允许应用自身地址
    window.webContents.on('will-navigate', (event, url) => {
      if (!isTrustedSenderUrl(url, isDevelopment)) {
        event.preventDefault();
      }
    });
  }

  /**
   * 生产态禁用开发者工具，除非配置里显式打开 features.developerTools。
   * 光去掉菜单还不够：F12 / Ctrl+Shift+I / Cmd+Alt+I 仍能直接唤出，这里一并拦掉。
   */
  private registerDevtoolsGuard(window: BrowserWindow): void {
    const allowDevTools = Boolean(this.configModule?.getValue<boolean>('features.developerTools'));

    // 开发态需要 DevTools，不拦
    if (allowDevTools || process.defaultApp) {
      return;
    }

    window.webContents.on('before-input-event', (event, input) => {
      if (isDevtoolsShortcut(input)) {
        event.preventDefault();
      }
    });

    // 兜底：通过其它途径打开时立即关闭
    window.webContents.on('devtools-opened', () => {
      window.webContents.closeDevTools();
    });
  }

  public getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  // 窗口图标同样按平台取第一个能解码的候选：Linux 上 ICO 可能得到空图像
  private pickWindowIcon(): NativeImage | null {
    const candidates = resolveWindowIconCandidates(process.platform).map((iconPath) =>
      join(app.getAppPath(), iconPath),
    );
    const picked = pickDecodableImage(candidates, (iconPath) =>
      fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : null,
    );

    return picked?.image ?? null;
  }

  // 托盘与通知文案跟随配置语言
  private messages(): AppMessages {
    return getMessages(this.configModule?.getValue<string>('language'));
  }

  private setupTray(): boolean {
    // 如果托盘已存在，确保托盘可见并显示通知
    if (this.tray) {
      this.checkAndShowTrayNotification();
      return true;
    }

    // 创建托盘图标：按 ico → png 顺序尝试，取第一个能真正解码出图像的
    // （Linux 上 ICO 可能解不出来，只看文件是否存在会得到不可见的空图标）
    const iconCandidates = [
      join(app.getAppPath(), 'assets/icon.ico'),
      join(app.getAppPath(), 'assets/icon.png'),
    ];

    const pickedIcon = pickDecodableImage(iconCandidates, (iconPath) =>
      fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : null,
    );

    if (!pickedIcon) {
      // 图标全部不可用时托盘不可见，按「托盘不可用」处理：允许直接关窗，避免窗口被藏起来又唤不回
      getLogger().warn('No decodable tray icon found, treating tray as unavailable');
      this.tray = null;
      return false;
    }

    try {
      this.tray = new Tray(pickedIcon.image);
    } catch (error) {
      // 托盘建不起来（部分 Linux 桌面无状态栏）时返回 false，调用方据此允许关窗
      getLogger().error('Failed to create tray', error);
      this.tray = null;
      return false;
    }

    // 设置托盘提示，使用配置中的应用名称
    const appName = this.configModule?.getValue<string>('appName') || 'Electron Vue3 Framework';
    this.tray.setToolTip(appName);

    // 托盘文案跟随配置的语言
    const messages = this.messages();

    // 创建托盘菜单
    const contextMenu = Menu.buildFromTemplate([
      {
        label: messages.tray.show,
        click: () => {
          if (this.mainWindow) {
            this.mainWindow.show();
            this.mainWindow.focus();
          }
        },
      },
      {
        label: messages.tray.quit,
        click: () => {
          this.markQuitting();
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);

    // 托盘图标点击事件
    this.tray.on('click', () => {
      if (this.mainWindow) {
        if (this.mainWindow.isVisible()) {
          this.mainWindow.hide();
        } else {
          this.mainWindow.show();
          this.mainWindow.focus();
        }
      }
    });

    // 设置托盘时显示提醒
    this.checkAndShowTrayNotification();

    return true;
  }

  private checkAndShowTrayNotification(): void {
    const { tray: trayMessages } = this.messages();
    const balloonEnabled =
      this.configModule?.getValue<boolean>('tray.balloonNotificationEnabled') ?? false;

    if (balloonEnabled) {
      // 每次关闭都显示通知
      this.showTrayNotification(trayMessages.minimizedTitle, trayMessages.minimizedBody);
      return;
    }

    // 默认只在本次运行第一次关闭时显示通知；配置只读，不再落盘
    if (!this.hasShownTrayNotice) {
      this.hasShownTrayNotice = true;
      this.showTrayNotification(trayMessages.minimizedTitle, trayMessages.minimizedBody);
    }
  }

  private showTrayNotification(title: string, content: string): void {
    if (!this.tray) {
      return;
    }

    try {
      // 使用Windows气球通知
      this.tray.displayBalloon({
        title: title,
        content: content,
        icon: nativeImage.createFromPath(join(app.getAppPath(), 'assets/icon.ico')),
      });
    } catch {
      // 忽略通知错误
    }
  }

  public destroyTray(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
