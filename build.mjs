#!/usr/bin/env node

import { execa } from 'execa';
import { build } from 'vite';
import { join } from 'path';
import { rm, mkdir } from 'fs/promises';

async function buildMain() {
  console.log('Building main process...');
  await build({
    configFile: './vite.config.ts',
    mode: 'electron',
  });
  console.log('Main process built successfully!');
}

async function buildRenderer() {
  console.log('Building renderer process...');
  await build({
    configFile: './vite.config.ts',
    mode: 'web',
  });
  console.log('Renderer process built successfully!');
}

async function copyAssets() {
  console.log('Copying assets...');
  // 如果有资源文件需要复制，可以在这里添加逻辑
  console.log('Assets copied successfully!');
}

async function main() {
  try {
    // 清理之前的构建产物
    console.log('Cleaning up previous build...');
    try {
      await rm('./dist', { recursive: true, force: true });
      await rm('./dist-electron', { recursive: true, force: true });
    } catch (error) {
      console.log('No previous build to clean.');
    }
    
    // 创建输出目录
    await mkdir('./dist', { recursive: true });
    await mkdir('./dist-electron', { recursive: true });
    
    // 并行构建主进程和渲染进程
    await Promise.all([buildMain(), buildRenderer()]);
    
    // 复制必要资源
    await copyAssets();
    
    console.log('Build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

main();