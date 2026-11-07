import { describe, expect, it } from 'vitest';
import { isTrustedSenderUrl } from './sender';

describe('isTrustedSenderUrl', () => {
  it('开发模式只信任本地 Vite 服务', () => {
    expect(isTrustedSenderUrl('http://localhost:5173/', true)).toBe(true);
    expect(isTrustedSenderUrl('http://localhost:5173/#/', true)).toBe(true);
    expect(isTrustedSenderUrl('https://evil.example.com', true)).toBe(false);
    expect(isTrustedSenderUrl('file:///tmp/index.html', true)).toBe(false);
  });

  it('开发模式不信任前缀伪装的来源', () => {
    expect(isTrustedSenderUrl('http://localhost:5173.evil.com/', true)).toBe(false);
    expect(isTrustedSenderUrl('http://localhost:5173@evil.com/', true)).toBe(false);
    expect(isTrustedSenderUrl('http://localhost:51730/', true)).toBe(false);
    expect(isTrustedSenderUrl('https://localhost:5173/', true)).toBe(false);
  });

  it('打包后只信任 file://', () => {
    expect(isTrustedSenderUrl('file:///app/dist/index.html', false)).toBe(true);
    expect(isTrustedSenderUrl('file:///C:/app/resources/dist/index.html', false)).toBe(true);
    expect(isTrustedSenderUrl('http://localhost:5173/', false)).toBe(false);
  });

  it('打包后拒绝带主机或凭证的 file URL', () => {
    expect(isTrustedSenderUrl('file://evil.example.com/C:/app/index.html', false)).toBe(false);
  });

  it('无法解析的地址一律不信任', () => {
    expect(isTrustedSenderUrl('', false)).toBe(false);
    expect(isTrustedSenderUrl('about:blank', false)).toBe(false);
    expect(isTrustedSenderUrl('not a url', false)).toBe(false);
  });
});
