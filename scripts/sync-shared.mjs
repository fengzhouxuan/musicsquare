import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const sharedFiles = ['account-client.js', 'sync-data.js', 'music-library.js', 'music-account.js'];

// The canonical account/sync modules live in videostation/shared.
export async function syncShared(source = resolve(root, '../videostation/shared'), destination = resolve(root, 'shared')) {
  await mkdir(destination, { recursive: true });
  for (const name of sharedFiles) await copyFile(resolve(source, name), resolve(destination, name));
  return sharedFiles.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log('已同步 ' + await syncShared(process.argv[2]) + ' 个公共账号与同步模块');
}
