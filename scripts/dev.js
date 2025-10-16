/**
 * 打包开发环境
 */
import { parseArgs } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import esbuild from 'esbuild';

/**
 * 解析命令行参数
 */
const {
  values: { format },
  positionals,
} = parseArgs({
  allowPositionals: true,
  options: {
    format: {
      type: 'string',
      short: 'f',
      default: 'esm',
    },
  },
});

// 创建esm的__filename
const __filename = fileURLToPath(import.meta.url);
// 创建esm的__dirname
const __dirname = dirname(__filename);
// 创建esm的require
const require = createRequire(import.meta.url);

const target = positionals.length ? positionals[0] : 'vue';
const entry = resolve(__dirname, `../packages/${target}/src/index.ts`);
const outfile = resolve(__dirname, `../packages/${target}/dist/${target}.${format}.js`);
const pkg = require(`../packages/${target}/package.json`);

esbuild
  .context({
    entryPoints: [entry],
    outfile,
    format,
    platform: format === 'cjs' ? 'node' : 'browser',
    sourcemap: true,
    bundle: true,
    globalName: pkg.buildOptions?.name,
  })
  .then(ctx => ctx.watch());
