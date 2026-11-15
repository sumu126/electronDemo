/**
 * 跨进程文案：主进程（托盘、通知）与渲染进程共用同一份资源，
 * 由配置项 language 决定，避免两处各写一套字符串。
 */

export type Locale = 'zh-CN' | 'en-US';

export const SUPPORTED_LOCALES: readonly Locale[] = ['zh-CN', 'en-US'];

export const DEFAULT_LOCALE: Locale = 'zh-CN';

export interface FrameworkFeature {
  readonly title: string;
  readonly description: string;
}

export interface AppMessages {
  app: { titleSuffix: string; defaultTitle: string };
  home: {
    fetchSystemInfo: string;
    loading: string;
    systemInfo: string;
    config: string;
    debugTools: string;
    hideDebugTools: string;
    debugHint: string;
    testBackend: string;
    pingResult: string;
  };
  config: {
    title: string;
    appearance: string;
    theme: string;
    themeLight: string;
    themeDark: string;
    themeAuto: string;
    language: string;
    features: string;
    developerTools: string;
    save: string;
    saving: string;
    saveFailed: string;
    reset: string;
  };
  framework: {
    description: string;
    features: readonly FrameworkFeature[];
  };
  modal: { close: string; dialog: string };
  tray: { show: string; quit: string; minimizedTitle: string; minimizedBody: string };
  errorBoundary: { title: string; description: string; reload: string };
  notFound: { title: string; description: string; backHome: string };
}

const zhCN: AppMessages = {
  app: {
    titleSuffix: '框架',
    defaultTitle: 'Electron + Vue3 应用框架',
  },
  home: {
    fetchSystemInfo: '获取系统信息',
    loading: '加载中...',
    systemInfo: '系统信息',
    config: '配置',
    debugTools: '调试工具',
    hideDebugTools: '收起调试工具',
    debugHint: '用于验证主进程与渲染进程之间的通信',
    testBackend: '测试后端通信',
    pingResult: '后端返回',
  },
  config: {
    title: '应用配置',
    appearance: '外观设置',
    theme: '主题',
    themeLight: '浅色',
    themeDark: '深色',
    themeAuto: '跟随系统',
    language: '语言',
    features: '功能设置',
    developerTools: '开发者工具',
    save: '保存配置',
    saving: '保存中...',
    saveFailed: '保存失败，请重试（详细信息已写入日志）',
    reset: '重置',
  },
  framework: {
    description: '一个现代化的桌面应用程序框架',
    features: [
      { title: '模块化架构', description: '清晰的分层架构，便于维护和扩展' },
      { title: 'TypeScript 支持', description: '完整的类型安全，提升开发体验' },
      { title: '状态管理', description: '使用 Pinia 进行高效的状态管理' },
      { title: '跨进程通信', description: '安全高效的主进程与渲染进程通信' },
    ],
  },
  modal: {
    close: '关闭',
    dialog: '对话框',
  },
  tray: {
    show: '显示窗口',
    quit: '退出',
    minimizedTitle: '应用已最小化到托盘',
    minimizedBody: '点击托盘图标可恢复窗口',
  },
  errorBoundary: {
    title: '页面出错了',
    description: '这个页面渲染时抛出了异常，你可以重试或重新加载应用。',
    reload: '重新加载',
  },
  notFound: {
    title: '页面不存在',
    description: '这个地址没有对应的页面，可能已经被删除或移动。',
    backHome: '返回首页',
  },
};

const enUS: AppMessages = {
  app: {
    titleSuffix: 'Framework',
    defaultTitle: 'Electron + Vue3 Application Framework',
  },
  home: {
    fetchSystemInfo: 'System info',
    loading: 'Loading...',
    systemInfo: 'System information',
    config: 'Settings',
    debugTools: 'Debug tools',
    hideDebugTools: 'Hide debug tools',
    debugHint: 'Verifies the main ↔ renderer IPC round trip',
    testBackend: 'Test IPC',
    pingResult: 'Backend replied',
  },
  config: {
    title: 'Application settings',
    appearance: 'Appearance',
    theme: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeAuto: 'Follow system',
    language: 'Language',
    features: 'Features',
    developerTools: 'Developer tools',
    save: 'Save settings',
    saving: 'Saving...',
    saveFailed: 'Failed to save. Please retry (details are in the log).',
    reset: 'Reset',
  },
  framework: {
    description: 'A modern desktop application framework',
    features: [
      { title: 'Modular architecture', description: 'Clear layering that is easy to maintain' },
      { title: 'TypeScript first', description: 'End-to-end type safety' },
      { title: 'State management', description: 'Pinia stores shared across views' },
      { title: 'Secure IPC', description: 'Whitelisted, typed channels between processes' },
    ],
  },
  modal: {
    close: 'Close',
    dialog: 'Dialog',
  },
  tray: {
    show: 'Show window',
    quit: 'Quit',
    minimizedTitle: 'Minimized to tray',
    minimizedBody: 'Click the tray icon to restore the window',
  },
  errorBoundary: {
    title: 'Something went wrong',
    description: 'This view threw while rendering. You can retry or reload the application.',
    reload: 'Reload',
  },
  notFound: {
    title: 'Page not found',
    description: 'This route does not exist yet, it may have been removed or moved.',
    backHome: 'Back to home',
  },
};

const MESSAGES: Record<Locale, AppMessages> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

/** 未知语言回退到默认语言，避免配置里写了不支持的值就渲染空白 */
export function normalizeLocale(locale: string | undefined | null): Locale {
  return locale && (SUPPORTED_LOCALES as readonly string[]).includes(locale)
    ? (locale as Locale)
    : DEFAULT_LOCALE;
}

export function getMessages(locale: string | undefined | null): AppMessages {
  return MESSAGES[normalizeLocale(locale)];
}
