export const DEV_SERVER_URL = 'http://localhost:5173';

/**
 * 判断请求来源是否可信：开发模式只允许本地 Vite 服务，打包后只允许 file://。
 */
export function isTrustedSenderUrl(url: string, isDevelopment: boolean): boolean {
  if (isDevelopment) {
    return url.startsWith(DEV_SERVER_URL);
  }
  return url.startsWith('file://');
}
