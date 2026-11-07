/**
 * 示例插件：复制到 userData/modules/ 下即会被框架加载。
 *
 *   Windows: %APPDATA%\electron-vue3-demo\modules\hello.cjs
 *   macOS/Linux: ~/.config/electron-vue3-demo/modules/hello.cjs
 *
 * 约定详见 docs/插件开发.md
 */

const logger = globalThis.__frameworkLogger;

module.exports = {
  name: 'HelloModule',
  version: '1.0.0',
  description: '示例模块：演示生命周期与日志入口',

  async init() {
    logger?.info('HelloModule initialized');

    // 可以拿到主进程的完整能力，例如读取应用版本
    try {
      const { app } = require('electron');
      logger?.info('HelloModule sees app', { name: app.getName(), version: app.getVersion() });
    } catch (error) {
      // 极端情况下无法 require electron 时不要影响其它模块
      logger?.warn('HelloModule could not read app info', error);
    }
  },

  async destroy() {
    logger?.info('HelloModule destroyed');
  },
};
