import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { syncShared, sharedFiles } from '../scripts/sync-shared.mjs';

test('shared module synchronization copies the allowlist and preserves unrelated files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'music-shared-test-'));
  try {
    const source = join(root, 'video-shared'); const target = join(root, 'music-shared'); await mkdir(source); await mkdir(target);
    for (const file of sharedFiles) await writeFile(join(source, file), 'module:' + file);
    await writeFile(join(source, 'secret.txt'), 'private'); await writeFile(join(target, 'keep.txt'), 'keep');
    assert.equal(await syncShared(source, target), sharedFiles.length);
    for (const file of sharedFiles) assert.equal(await readFile(join(target, file), 'utf8'), 'module:' + file);
    assert.equal(await readFile(join(target, 'keep.txt'), 'utf8'), 'keep');
    await assert.rejects(readFile(join(target, 'secret.txt')));
    await assert.rejects(syncShared(join(root, 'missing'), join(root, 'other')));
  } finally { await rm(root, { recursive: true }); }
});
