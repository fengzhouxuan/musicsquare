import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,access,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {exportSite,siteFiles} from '../scripts/export-site.mjs';

test('export copies only public assets and preserves unrelated destination files',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'music-export-'));
  try{
    const source=join(folder,'source');const target=join(folder,'target');
    await mkdir(join(source,'data'),{recursive:true});await mkdir(target);
    for(const file of siteFiles)await writeFile(join(source,file),'content-'+file);
    await writeFile(join(source,'secret.txt'),'do not publish');await writeFile(join(target,'keep.txt'),'keep');
    assert.equal(await exportSite(target,source),siteFiles.length);
    assert.equal(await readFile(join(target,'data/featured.json'),'utf8'),'content-data/featured.json');
    assert.equal(await readFile(join(target,'keep.txt'),'utf8'),'keep');
    await assert.rejects(access(join(target,'secret.txt')));
    await assert.rejects(exportSite(source,source),/源码/);await assert.rejects(exportSite(join(source,'nested'),source),/源码/);
  }finally{await rm(folder,{recursive:true,force:true});}
});
