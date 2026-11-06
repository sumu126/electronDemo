import path from 'path';
import { describe, expect, it } from 'vitest';
import { isPathInside } from './path';

const root = path.resolve('userData');

describe('isPathInside', () => {
  it('接受 root 内的相对路径', () => {
    expect(isPathInside(root, 'config.json')).toBe(true);
    expect(isPathInside(root, path.join('nested', 'file.txt'))).toBe(true);
  });

  it('接受以 .. 开头的合法文件名', () => {
    expect(isPathInside(root, '..foo')).toBe(true);
  });

  it('拒绝父级目录穿越', () => {
    expect(isPathInside(root, '../secret.txt')).toBe(false);
    expect(isPathInside(root, path.join('..', '..', 'secret.txt'))).toBe(false);
  });

  it('拒绝 root 之外的绝对路径', () => {
    expect(isPathInside(root, path.resolve('outside.txt'))).toBe(false);
  });

  it('接受 root 自身', () => {
    expect(isPathInside(root, '.')).toBe(true);
  });
});
