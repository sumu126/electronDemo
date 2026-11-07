/**
 * Vue 的 ref / reactive 返回的是 Proxy，而 Electron IPC 用结构化克隆传参，
 * Proxy 无法被克隆——直接把响应式对象丢给 `invoke` 会报
 * "An object could not be cloned."。
 *
 * 所以发 IPC 前统一转成纯数据。框架的 IPC 契约本来就只接受 JSON 可序列化的值
 * （配置 schema 也是这么约束的），JSON 往返是这里最稳的方式。
 */
export const toPlain = <T>(value: T): T => {
  if (value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
};
