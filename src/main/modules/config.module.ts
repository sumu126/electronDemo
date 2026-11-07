import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { ensureDir, deepMerge } from '@shared/utils';
import { createDefaultConfig } from '@shared/config/defaults';
import {
  findUnknownConfigKeys,
  isPlainObject,
  sanitizeConfigUpdate,
  stripUnknownConfigKeys,
} from '@shared/config/schema';
import { AppConfig } from '@shared/types';
import { APP_CONSTANTS } from '@shared/constants';

export class ConfigModule {
  public readonly name = 'ConfigModule';
  private config: AppConfig;
  private configPath: string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'config.json');
    this.config = this.getDefaultConfig();
  }

  public async init(): Promise<void> {
    await this.loadConfig();
  }

  public async destroy(): Promise<void> {
    // 保存配置并在销毁前执行清理工作
    await this.saveConfig();
  }

  private getDefaultConfig(): AppConfig {
    return createDefaultConfig({
      appName: app.getName() || APP_CONSTANTS.NAME,
      version: app.getVersion() || APP_CONSTANTS.VERSION,
    });
  }

  private async loadConfig(): Promise<void> {
    try {
      // 确保用户数据目录存在
      await ensureDir(path.dirname(this.configPath));

      // 检查配置文件是否存在
      try {
        const configFile = await fs.readFile(this.configPath, 'utf-8');
        const savedConfig: unknown = JSON.parse(configFile);

        if (!isPlainObject(savedConfig)) {
          throw new Error('config.json 不是对象');
        }

        // 旧版本残留的未知键：先备份再裁剪，避免污染运行时与无限累积
        const unknownKeys = findUnknownConfigKeys(savedConfig);

        if (unknownKeys.length > 0) {
          await this.backupConfigFile();
          console.warn(
            `Dropping unknown config keys (backup: ${this.configPath}.bak): ${unknownKeys.join(', ')}`,
          );
        }

        // 深度合并默认配置和已校验的保存配置
        this.config = deepMerge(this.getDefaultConfig(), stripUnknownConfigKeys(savedConfig));
        await this.saveConfig();
      } catch (error) {
        // 如果配置文件不存在或解析失败，则使用默认配置
        console.warn('Failed to load config, using defaults:', error);
        await this.saveConfig();
      }
    } catch (error) {
      console.error('Error loading config:', error);
      // 出错时也使用默认配置
      this.config = this.getDefaultConfig();
    }
  }

  // 只在首次裁剪前备份，避免覆盖掉上一份干净备份
  private async backupConfigFile(): Promise<void> {
    const backupPath = `${this.configPath}.bak`;

    try {
      await fs.access(backupPath);
    } catch {
      await fs.copyFile(this.configPath, backupPath);
    }
  }

  public saveConfig(): Promise<void> {
    // 串行化：窗口状态防抖落盘与 setValue 可能并发，排队执行避免旧快照覆盖新快照
    const snapshot = JSON.stringify(this.config, null, 2);

    this.writeQueue = this.writeQueue
      .catch(() => undefined)
      .then(() => this.writeSnapshot(snapshot));

    return this.writeQueue;
  }

  private async writeSnapshot(snapshot: string): Promise<void> {
    // 原子写：先写临时文件再 rename，进程在写一半时退出不会留下损坏的 config.json
    const tempPath = `${this.configPath}.tmp`;

    try {
      await ensureDir(path.dirname(this.configPath));
      await fs.writeFile(tempPath, snapshot, 'utf-8');
      await fs.rename(tempPath, this.configPath);
    } catch (error) {
      console.error('Error saving config:', error);
      throw error;
    }
  }

  public getConfig(): AppConfig {
    return { ...this.config }; // 返回副本以防止外部直接修改
  }

  public async updateConfig(updates: unknown): Promise<void> {
    // 先校验再深合并，避免局部更新覆盖同级字段，也避免未知/非法值进入配置
    const safeUpdates = sanitizeConfigUpdate(updates);
    this.config = deepMerge(this.config, safeUpdates);
    await this.saveConfig();
  }

  public getValue<T>(keyPath: string): T | undefined {
    // 简单的键路径解析（例如 'window.width'）
    return keyPath.split('.').reduce((obj: any, prop) => obj?.[prop], this.config) as T;
  }

  public async setValue<T>(keyPath: string, value: T): Promise<void> {
    // 复用手动更新的校验路径：把 'a.b.c' 还原成嵌套对象再走 updateConfig
    const keys = keyPath.split('.');
    let update: unknown = value;

    for (let index = keys.length - 1; index >= 0; index -= 1) {
      update = { [keys[index]]: update };
    }

    await this.updateConfig(update);
  }
}
