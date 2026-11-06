import { describe, expect, it } from 'vitest';
import { isTrustedSenderUrl } from './sender';

describe('isTrustedSenderUrl', () => {
  it('开发模式只信任本地 Vite 服务', () => {
    expect(isTrustedSenderUrl('http://localhost:5173/', true)).toBe(true);
    expect(isTrustedSenderUrl('http://localhost:5173/#/', true)).toBe(true);
    expect(isTrustedSenderUrl('https://evil.example.com', true)).toBe(false);
    expect(isTrustedSenderUrl('file:///tmp/index.html', true)).toBe(false);
  });

  it('打包后只信任 file://', () => {
    expect(isTrustedSenderUrl('file:///app/dist/index.html', false)).toBe(true);
    expect(isTrustedSenderUrl('http://localhost:5173/', false)).toBe(false);
  });
});
