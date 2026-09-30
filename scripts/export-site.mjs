import { copyFile, mkdir, realpath } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const siteFiles=['index.html','featured-core.js','pikachu.gif','LICENSE','data/featured.json'];

// Copy only public assets. Do not delete destination files or copy repository automation.
export async function exportSite(destination,source=root){
  const sourcePath=await realpath(source);
  const target=resolve(destination);
  await mkdir(target,{recursive:true});
  const targetPath=await realpath(target);
  const path=relative(sourcePath,targetPath);
  if(!path || (!path.startsWith('..') && !isAbsolute(path)))throw Error('导出目录不能在音乐站源码目录内');
  for(const file of siteFiles){
    const output=resolve(targetPath,file);
    await mkdir(dirname(output),{recursive:true});
    await copyFile(resolve(sourcePath,file),output);
  }
  return siteFiles.length;
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv[2])throw Error('用法：npm run export:site -- /path/to/blog/source/music');
  const count=await exportSite(process.argv[2]);
  console.log('已导出 '+count+' 个公开文件到 '+resolve(process.argv[2]));
}
