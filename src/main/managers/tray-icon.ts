export interface DecodableImage {
  isEmpty(): boolean;
}

/**
 * 按顺序尝试候选图标，返回第一个能解码出非空图像的。
 *
 * 为什么不能只看文件是否存在：Linux 上 nativeImage 可能解不出 ICO（文件明明在），
 * 结果是拿到空图像、托盘图标不可见——用户看不到托盘，却仍然被「关闭到托盘」拦住。
 */
export function pickDecodableImage<T extends DecodableImage>(
  candidates: readonly string[],
  load: (path: string) => T | null,
): { path: string; image: T } | null {
  for (const candidate of candidates) {
    try {
      const image = load(candidate);

      if (image && !image.isEmpty()) {
        return { path: candidate, image };
      }
    } catch {
      // 解码失败就试下一个候选
    }
  }

  return null;
}
