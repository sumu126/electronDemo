import path from 'path';

/**
 * 判断 target 是否位于 root 目录内。
 * target 既可以是相对 root 的路径，也可以是绝对路径；越界（含 `..` 穿越）返回 false。
 */
export function isPathInside(root: string, target: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(resolvedRoot, target);
  const relativePath = path.relative(resolvedRoot, resolvedTarget);

  if (relativePath === '') {
    return true;
  }

  // 只拒绝真正的 `..` 段，避免把 `..foo` 这类合法文件名误判为越界
  return !path.isAbsolute(relativePath) && relativePath.split(path.sep)[0] !== '..';
}
