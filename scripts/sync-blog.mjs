import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportSite } from './export-site.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv[2]) throw new Error('用法：npm run sync:blog -- /path/to/blog');
const target = resolve(process.argv[2]);
await exportSite(resolve(target, 'source/music'));
const text = await readFile(resolve(root, 'tests/account-ui.test.mjs'), 'utf8');
const output = resolve(target, 'test/music/account-ui.test.mjs'); await mkdir(dirname(output), { recursive: true });
await writeFile(output, text.replace(/from '\.\.\/([a-z-/]+)\.js'/g, "from '../../source/music/$1.js'"));
console.log('已同步音乐公开文件与账号界面回归测试');
