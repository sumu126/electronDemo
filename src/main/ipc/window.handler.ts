import { IpcMainInvokeEvent, BrowserWindow } from 'electron';

export class WindowHandler {
  private getWindowByEvent(event: IpcMainInvokeEvent): BrowserWindow | null {
    return BrowserWindow.getAllWindows().find((w) => w.webContents.id === event.sender.id) ?? null;
  }

  // 优先操作发起调用的窗口；找不到时退回第一个窗口，没有窗口则报错
  private withTargetWindow(
    event: IpcMainInvokeEvent,
    action: (window: BrowserWindow) => void,
  ): void {
    const target = this.getWindowByEvent(event) ?? BrowserWindow.getAllWindows()[0];

    if (!target) {
      throw new Error('No browser window found');
    }

    action(target);
  }

  async minimizeWindow(event: IpcMainInvokeEvent): Promise<void> {
    this.withTargetWindow(event, (window) => window.minimize());
  }

  async maximizeWindow(event: IpcMainInvokeEvent): Promise<void> {
    this.withTargetWindow(event, (window) => {
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
    });
  }

  async closeWindow(event: IpcMainInvokeEvent): Promise<void> {
    this.withTargetWindow(event, (window) => window.close());
  }
}
