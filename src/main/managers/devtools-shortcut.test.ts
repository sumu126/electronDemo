import { describe, expect, it } from 'vitest';
import { isDevtoolsShortcut } from './devtools-shortcut';

describe('isDevtoolsShortcut', () => {
  it('识别 F12（大小写与修饰键无关）', () => {
    expect(isDevtoolsShortcut({ key: 'F12' })).toBe(true);
    expect(isDevtoolsShortcut({ key: 'f12' })).toBe(true);
    expect(isDevtoolsShortcut({ key: 'F12', control: true })).toBe(true);
  });

  it('识别 Ctrl+Shift+I', () => {
    expect(isDevtoolsShortcut({ key: 'i', control: true, shift: true })).toBe(true);
    expect(isDevtoolsShortcut({ key: 'I', control: true, shift: true })).toBe(true);
  });

  it('识别 Cmd+Alt+I', () => {
    expect(isDevtoolsShortcut({ key: 'i', meta: true, alt: true })).toBe(true);
  });

  it('不误伤普通输入与近似组合', () => {
    expect(isDevtoolsShortcut({ key: 'i' })).toBe(false);
    expect(isDevtoolsShortcut({ key: 'i', control: true })).toBe(false);
    expect(isDevtoolsShortcut({ key: 'i', meta: true })).toBe(false);
    expect(isDevtoolsShortcut({ key: 'j', control: true, shift: true })).toBe(false);
    expect(isDevtoolsShortcut({ key: 'c', control: true })).toBe(false);
  });
});
