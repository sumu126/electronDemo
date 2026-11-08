import { describe, expect, it, vi } from 'vitest';
import { pickDecodableImage } from './tray-icon';

const empty = { isEmpty: () => true };
const icon = { isEmpty: () => false };

describe('pickDecodableImage', () => {
  it('第一个候选可用时直接返回', () => {
    const load = vi.fn(() => icon);
    const picked = pickDecodableImage(['a.ico', 'a.png'], load);

    expect(picked?.path).toBe('a.ico');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('第一个解出空图像时回退到下一个（Linux 上 ICO 常见）', () => {
    const load = vi.fn((path: string) => (path.endsWith('.ico') ? empty : icon));
    const picked = pickDecodableImage(['icon.ico', 'icon.png'], load);

    expect(picked?.path).toBe('icon.png');
  });

  it('解码抛错时继续尝试，不冒泡', () => {
    const load = vi.fn((path: string) => {
      if (path.endsWith('.ico')) {
        throw new Error('cannot decode');
      }
      return icon;
    });

    expect(pickDecodableImage(['icon.ico', 'icon.png'], load)?.path).toBe('icon.png');
  });

  it('全部候选不可用时返回 null', () => {
    const load = vi.fn(() => empty);

    expect(pickDecodableImage(['a.ico', 'a.png'], load)).toBeNull();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('空候选列表返回 null 且不调用解码', () => {
    const load = vi.fn(() => icon);

    expect(pickDecodableImage([], load)).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });
});
