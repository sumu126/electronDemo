export const DEV_SERVER_URL = 'http://localhost:5173';

const DEV_SERVER_ORIGIN = new URL(DEV_SERVER_URL).origin;

/**
 * 判断请求来源是否可信。
 *
 * 开发态：只允许本地 Vite 服务的 origin，按 URL 解析后精确比对。
 * 不能用 startsWith：`http://localhost:5173.evil.com`、`http://localhost:5173@evil.com`、
 * `http://localhost:51730` 都能通过前缀判断。
 *
 * 打包后：只允许 file:// 页面，且拒绝带主机或凭证的 file URL（`file://evil.com/x`）。
 */
export function isTrustedSenderUrl(url: string, isDevelopment: boolean): boolean {
  if (!url) {
    return false;
  }

  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (isDevelopment) {
    return parsed.origin === DEV_SERVER_ORIGIN;
  }

  return parsed.protocol === 'file:' && parsed.host === '';
}
