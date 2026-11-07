import { Menu, type MenuItemConstructorOptions } from 'electron';

export interface ApplicationMenuOptions {
  allowDevTools: boolean;
  platform?: NodeJS.Platform;
}

/**
 * 应用菜单模板。
 *
 * 用 role 而不是手写 label：菜单文字由系统按当前语言本地化，不用自己维护一套。
 * 与默认菜单的差别只有一处：是否包含「开发者工具」，由 features.developerTools 决定。
 */
export function buildMenuTemplate({
  allowDevTools,
  platform = process.platform,
}: ApplicationMenuOptions): MenuItemConstructorOptions[] {
  const isMac = platform === 'darwin';

  const viewSubmenu: MenuItemConstructorOptions[] = [
    { role: 'reload' },
    { role: 'forceReload' },
    ...(allowDevTools ? [{ role: 'toggleDevTools' as const }] : []),
    { type: 'separator' },
    { role: 'resetZoom' },
    { role: 'zoomIn' },
    { role: 'zoomOut' },
    { type: 'separator' },
    { role: 'togglefullscreen' },
  ];

  return [
    // macOS 必须有 appMenu，否则 Cmd+Q / Cmd+H 等系统快捷键失效
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    { role: 'editMenu' },
    { label: '', role: 'viewMenu', submenu: viewSubmenu },
    { role: 'windowMenu' },
  ];
}

export function applyApplicationMenu(options: ApplicationMenuOptions): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildMenuTemplate(options)));
}
