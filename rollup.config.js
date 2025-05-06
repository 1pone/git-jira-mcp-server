import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import esbuild from 'rollup-plugin-esbuild';
import banner2 from 'rollup-plugin-banner2';

export default {
  input: 'src/index.ts', // 你的入口文件
  output: {
    file: 'dist/index.js',
    format: 'esm', // 你用的是 import/export，建议用 esm
  },
  plugins: [
    nodeResolve({
      preferBuiltins: true, // Node.js 内置模块优先
    }),
    commonjs(),
    json(),
    esbuild({
      target: 'node18', // 你的 Node 版本
    }),
    banner2(() => '#!/usr/bin/env node\n', { raw: true }),
  ],
  external: [], // 不排除任何依赖，全部打包进 dist
};