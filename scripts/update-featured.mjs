import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import core from '../featured-core.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const headers={'User-Agent':'Mozilla/5.0','Referer':'https://music.163.com/'};
const playlistLimit=12;
const trackLimit=500;

export async function requestJSON(url,options={},fetchImpl=fetch){
  let lastError;
  for(let attempt=0;attempt<2;attempt++){
    try{
      const response=await fetchImpl(url,{...options,signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw Error('HTTP '+response.status);
      return await response.json();
    }catch(error){lastError=error;}
  }
  throw lastError;
}

function assertCode(data,expected){
  if(!data || data.code!==expected)throw Error('上游接口返回错误');
}

export async function fetchRecommended(source,request=requestJSON){
  if(source==='netease'){
    const data=await request('https://music.163.com/api/personalized/playlist?limit='+playlistLimit,{headers});
    assertCode(data,200);
    return (data.result||[]).map(x=>({id:String(x.id),name:x.name,cover:x.picUrl,playCount:x.playCount,trackCount:x.trackCount,description:x.copywriter,pageUrl:'https://music.163.com/#/playlist?id='+x.id}));
  }
  if(source==='qq'){
    const body={comm:{ct:24},recomPlaylist:{module:'playlist.HotRecommendServer',method:'get_hot_recommend',param:{async:1,cmd:2}}};
    const data=await request('https://u.y.qq.com/cgi-bin/musicu.fcg',{
      method:'POST',headers:{...headers,Referer:'https://y.qq.com/','Content-Type':'application/json'},body:JSON.stringify(body)
    });
    assertCode(data,0);
    if(data.recomPlaylist?.code!==0)throw Error('QQ 推荐接口返回错误');
    return (data.recomPlaylist?.data?.v_hot||[]).slice(0,playlistLimit).map(x=>({id:String(x.content_id),name:x.title,cover:x.cover,playCount:x.listen_num,trackCount:x.song_cnt||x.song_count,pageUrl:'https://y.qq.com/n/ryqq/playlist/'+x.content_id}));
  }
  if(source!=='kuwo')throw Error('不支持的音乐平台');
  const data=await request('https://wapi.kuwo.cn/api/pc/classify/playlist/getRcmPlayList?pn=0&rn='+playlistLimit+'&order=hot',{headers});
  assertCode(data,200);
  return (data.data?.data||[]).slice(0,playlistLimit).map(x=>({id:String(x.id),name:x.name,cover:x.img,playCount:x.listencnt,trackCount:x.songnum||x.total,creator:x.uname,description:x.desc,pageUrl:'https://www.kuwo.cn/playlist_detail/'+x.id}));
}

export async function fetchPlaylistDetails(source,playlist,request=requestJSON){
  if(!/^\d+$/.test(playlist.id))throw Error('歌单 ID 不正确');
  let detail;
  if(source==='netease'){
    const data=await request('https://music.163.com/api/v6/playlist/detail?id='+playlist.id+'&n='+trackLimit,{headers});
    assertCode(data,200);
    const p=data.playlist;
    if(!p || String(p.id)!==playlist.id)throw Error('歌单详情不匹配');
    const ids=(p.trackIds||[]).slice(0,trackLimit).map(x=>String(x.id));
    const songs=new Map((p.tracks||[]).map(x=>[String(x.id),x]));
    const missing=ids.filter(id=>!songs.has(id));
    for(let i=0;i<missing.length;i+=100){
      const result=await request('https://music.163.com/api/song/detail?ids='+encodeURIComponent(JSON.stringify(missing.slice(i,i+100))),{headers});
      assertCode(result,200);
      for(const song of result.songs||[])songs.set(String(song.id),song);
    }
    detail={...playlist,name:p.name,cover:p.coverImgUrl,description:p.description,creator:p.creator?.nickname,tags:p.tags,trackCount:p.trackCount,
      tracks:ids.map(id=>songs.get(id)).filter(Boolean).map(x=>({id:String(x.id),name:x.name,artist:(x.ar||x.artists||[]).map(a=>a.name).join('、'),album:(x.al||x.album)?.name,cover:(x.al||x.album)?.picUrl,pageUrl:'https://music.163.com/#/song?id='+x.id}))};
  }else if(source==='qq'){
    const params=new URLSearchParams({disstid:playlist.id,type:'1',json:'1',utf8:'1',format:'json',onlysong:'0',g_tk:'5381',loginUin:'0',hostUin:'0',platform:'yqq',needNewCode:'0'});
    const data=await request('https://i.y.qq.com/qzone-music/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?'+params,{headers:{...headers,Referer:'https://y.qq.com/'}});
    assertCode(data,0);
    const p=data.cdlist?.[0];
    if(!p || String(p.disstid)!==playlist.id)throw Error('歌单详情不匹配');
    detail={...playlist,name:p.dissname,cover:p.logo,description:p.desc,creator:p.nickname,tags:(p.tags||[]).map(x=>x.name),trackCount:p.songnum,
      tracks:(p.songlist||[]).slice(0,trackLimit).map(x=>({id:x.songmid,name:x.songname,artist:(x.singer||[]).map(a=>a.name).join('、'),album:x.albumname,cover:x.albummid?'https://y.gtimg.cn/music/photo_new/T002R300x300M000'+x.albummid+'.jpg':null,pageUrl:'https://y.qq.com/n/ryqq/songDetail/'+x.songmid}))};
  }else if(source==='kuwo'){
    const tracks=[];let p;
    for(let page=0;page<trackLimit/100;page++){
      const params=new URLSearchParams({op:'getlistinfo',pid:playlist.id,pn:String(page),rn:'100',encode:'utf8',keyset:'pl2012',identity:'kuwo',pcmp4:'1',vipver:'1',newver:'1'});
      const data=await request('https://nplserver.kuwo.cn/pl.svc?'+params,{headers});
      if(!Array.isArray(data.musiclist))throw Error('酷我歌单详情不正确');
      if(!p)p=data;
      tracks.push(...data.musiclist.map(x=>({id:x.id,name:x.name||x.song_name,artist:x.artist||x.artist_name,album:x.album,cover:x.albumpic,pageUrl:'https://www.kuwo.cn/play_detail/'+x.id})));
      if(data.musiclist.length<100 || tracks.length>=Number(p.total||p.validtotal))break;
    }
    detail={...playlist,name:p.title,cover:p.pic,description:p.info,creator:p.uname,tags:[],trackCount:Number(p.total||p.validtotal)||tracks.length,tracks};
  }else throw Error('不支持的音乐平台');
  const normalized=core.normalizePlaylist(source,detail);
  if(!normalized || !normalized.tracks.length)throw Error('歌单未返回可用歌曲');
  return normalized;
}

export async function updateCatalog(previous,{recommend=fetchRecommended,details=fetchPlaylistDetails,now=new Date().toISOString()}={}){
  const catalog=core.parseCatalog(previous);
  let updated=0;
  await Promise.all(core.sources.map(async source=>{
    const old=catalog.sources[source];
    try{
      const recommended=await recommend(source);
      if(!Array.isArray(recommended) || !recommended.length)throw Error('empty');
      const playlists=[];let fresh=0;let failures=0;
      for(const playlist of recommended.slice(0,playlistLimit)){
        try{const detail=await details(source,playlist);playlists.push({...detail,updatedAt:now});fresh++;}
        catch(error){failures++;const cached=old.playlists.find(x=>x.id===playlist.id);if(cached)playlists.push(cached);}
      }
      if(!fresh)throw Error('no fresh playlists');
      catalog.sources[source]={updatedAt:now,error:failures?'部分歌单更新失败，保留已有数据':'',playlists};updated++;
    }catch(error){catalog.sources[source]={...old,error:'更新失败，保留上次数据'};}
  }));
  if(updated)catalog.generatedAt=now;
  return {catalog,updated};
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const path=resolve(root,'data/featured.json');
  let previous={version:1,generatedAt:'',sources:{}};
  try{previous=JSON.parse(await readFile(path,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const {catalog,updated}=await updateCatalog(previous);
  await mkdir(dirname(path),{recursive:true});
  const content=JSON.stringify(catalog,null,2)+'\n';
  await writeFile(path+'.tmp',content);await rename(path+'.tmp',path);
  for(const source of core.sources){const data=catalog.sources[source];console.log(source+': '+data.playlists.length+' 个歌单'+(data.error?'（'+data.error+'）':''));}
  if(!updated){console.error('本次没有成功更新任何平台');process.exitCode=1;}
}
