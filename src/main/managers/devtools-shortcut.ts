export interface KeyInput {
  key: string;
  control?: boolean;
  shift?: boolean;
  meta?: boolean;
  alt?: boolean;
}

/**
 * 判断一次键盘输入是否是「打开开发者工具」的快捷键。
 *
 * 生产态要拦掉全部途径：只去掉菜单项是不够的，快捷键仍然能直接唤出。
 * 独立成纯函数是为了能单测覆盖各组合（Ctrl+Shift+I / Cmd+Alt+I / F12）。
 */
export function isDevtoolsShortcut(input: KeyInput): boolean {
  const key = input.key.toLowerCase();

  if (input.key === 'F12' || key === 'f12') {
    return true;
  }

  if (input.control && input.shift && key === 'i') {
    return true;
  }

  return Boolean(input.meta && input.alt && key === 'i');
}
