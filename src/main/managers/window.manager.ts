import { BrowserWindow, screen, Rectangle } from 'electron';
import { join } from 'path';

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private windows: Map<string, BrowserWindow> = new Map();

  public createMainWindow(): BrowserWindow {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    this.mainWindow = new BrowserWindow({
      width: Math.min(1200, width - 50),
      height: Math.min(800, height - 50),
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        preload: join(__dirname, './preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false, // 在开发阶段暂时关闭sandbox以支持某些功能
      },
      icon: join(__dirname, '../../../assets/icon.png'), // 如果有图标的话
    });

    this.mainWindow.setBackgroundColor('#ffffff'); // 匹配你的应用主题色

    // 窗口关闭事件
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    return this.mainWindow;
  }

  public createWindow(
    id: string,
    options: Electron.BrowserWindowConstructorOptions
  ): BrowserWindow {
    // 检查窗口是否已存在
    if (this.windows.has(id)) {
      const existingWindow = this.windows.get(id);
      if (existingWindow && !existingWindow.isDestroyed()) {
        existingWindow.focus();
        return existingWindow;
      } else {
        this.windows.delete(id);
      }
    }

    const window = new BrowserWindow({
      ...options,
      webPreferences: {
        preload: join(__dirname, './preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        ...(options.webPreferences || {}),
      },
    });

    // 窗口关闭时从映射中移除
    window.on('closed', () => {
      this.windows.delete(id);
    });

    this.windows.set(id, window);

    return window;
  }

  public getWindow(id: string): BrowserWindow | null {
    return this.windows.get(id) || null;
  }

  public closeWindow(id: string): boolean {
    const window = this.getWindow(id);
    if (window && !window.isDestroyed()) {
      window.close();
      this.windows.delete(id);
      return true;
    }
    return false;
  }

  public getAllWindows(): BrowserWindow[] {
    return Array.from(this.windows.values()).filter(window => !window.isDestroyed());
  }

  public getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }
}