import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestJSON,fetchRecommended,fetchPlaylistDetails,updateCatalog} from '../scripts/update-featured.mjs';
import core from '../featured-core.js';

const playlist={id:'1',name:'Mix'};
const normalized=core.normalizePlaylist('netease',{...playlist,tracks:[{id:'2',title:'Song'}]});

test('collector retries transport and HTTP errors once',async()=>{
  let calls=0;
  const result=await requestJSON('https://test',{},async()=>{if(++calls===1)throw Error('network');return {ok:true,json:async()=>({ok:1})};});
  assert.equal(calls,2);assert.equal(result.ok,1);
  await assert.rejects(requestJSON('https://test',{},async()=>({ok:false,status:500})),/500/);
});

test('recommendations map all three platform envelopes without authentication',async()=>{
  assert.equal((await fetchRecommended('netease',async()=>({code:200,result:[{id:1,name:'N'}]})))[0].name,'N');
  assert.equal((await fetchRecommended('qq',async(url,options)=>{
    assert.equal(options.method,'POST');assert.equal(JSON.parse(options.body).recomPlaylist.module,'playlist.HotRecommendServer');
    return {code:0,recomPlaylist:{code:0,data:{v_hot:[{content_id:2,title:'Q'}]}}};
  }))[0].id,'2');
  assert.equal((await fetchRecommended('kuwo',async()=>({code:200,data:{data:[{id:3,name:'K'}]}})))[0].id,'3');
  for(const source of core.sources)await assert.rejects(fetchRecommended(source,async()=>({code:-1})),/错误/);
  await assert.rejects(fetchRecommended('qq',async()=>({code:0,recomPlaylist:{code:1}})),/QQ/);
  for(const source of core.sources){
    const envelope=source==='netease'?{code:200}:source==='qq'?{code:0,recomPlaylist:{code:0}}:{code:200};
    assert.deepEqual(await fetchRecommended(source,async()=>envelope),[]);
  }
  await assert.rejects(fetchRecommended('bad'),/不支持/);
});

test('NetEase fills missing metadata in song-ID order',async()=>{
  const detail=await fetchPlaylistDetails('netease',playlist,async url=>{
    if(url.includes('/playlist/detail'))return {code:200,playlist:{id:1,name:'Mix',trackCount:3,trackIds:[{id:2},{id:3},{id:4}],tracks:[{id:3,name:'B',ar:[{name:'Artist'}],al:{name:'Album'}}]}};
    return {code:200,songs:[{id:2,name:'A',artists:[{name:'A'}],album:{name:'Album'}},{id:4,name:'C'}]};
  });
  assert.deepEqual(detail.tracks.map(t=>t.title),['A','B','C']);assert.equal(detail.tracks[1].artist,'Artist');
});

test('QQ preserves song mids and playlist tags',async()=>{
  const detail=await fetchPlaylistDetails('qq',playlist,async()=>({code:0,cdlist:[{disstid:'1',dissname:'Q',tags:[{name:'流行'}],songnum:1,songlist:[{songmid:'mid1',songname:'Song',albummid:'album1',singer:[{name:'Singer'}]}]}]}));
  assert.equal(detail.tracks[0].songid,'mid1');assert.deepEqual(detail.tags,['流行']);assert.match(detail.tracks[0].cover,/album1/);
});

test('Kuwo paginates and stops at the declared total',async()=>{
  let pages=0;
  const detail=await fetchPlaylistDetails('kuwo',playlist,async url=>{
    assert.match(url,new RegExp('pn='+pages));pages++;
    return {title:'K',total:101,musiclist:Array.from({length:pages===1?100:1},(_,i)=>({id:(pages-1)*100+i+1,song_name:'Song',artist_name:'Singer'}))};
  });
  assert.equal(pages,2);assert.equal(detail.tracks.length,101);
});

test('details reject mismatch, empty lists and invalid platform responses',async()=>{
  await assert.rejects(fetchPlaylistDetails('qq',{id:'../1'}),/ID/);
  await assert.rejects(fetchPlaylistDetails('bad',playlist),/不支持/);
  await assert.rejects(fetchPlaylistDetails('netease',playlist,async()=>({code:200,playlist:{id:9}})),/不匹配/);
  await assert.rejects(fetchPlaylistDetails('qq',playlist,async()=>({code:0,cdlist:[]})),/不匹配/);
  await assert.rejects(fetchPlaylistDetails('kuwo',playlist,async()=>({})),/不正确/);
  await assert.rejects(fetchPlaylistDetails('kuwo',playlist,async()=>({musiclist:[],total:0})),/可用歌曲/);
  await assert.rejects(fetchPlaylistDetails('qq',playlist,async()=>({code:0,cdlist:[{disstid:1}]})),/可用歌曲/);
  await assert.rejects(fetchPlaylistDetails('netease',playlist,async()=>({code:200,playlist:{id:1}})),/可用歌曲/);
});

test('partial platform failure retains old snapshot and its timestamp',async()=>{
  const previous={version:1,generatedAt:'old',sources:{netease:{updatedAt:'old',playlists:[normalized]}}};
  const {catalog,updated}=await updateCatalog(previous,{
    now:'new',recommend:async source=>{if(source==='netease')throw Error('secret transport detail');return [playlist];},
    details:async source=>core.normalizePlaylist(source,{...playlist,tracks:[{id:2,title:'New'}]})
  });
  assert.equal(updated,2);assert.equal(catalog.generatedAt,'new');assert.equal(catalog.sources.netease.updatedAt,'old');
  assert.equal(catalog.sources.netease.playlists[0].tracks[0].title,'Song');assert.doesNotMatch(catalog.sources.netease.error,/secret/);
  assert.equal(previous.generatedAt,'old');
});

test('partial playlist failure preserves cached playlist; total failure never empties data',async()=>{
  const previous={version:1,generatedAt:'old',sources:{netease:{playlists:[normalized]}}};
  const partial=await updateCatalog(previous,{
    recommend:async()=>[playlist,{id:'3',name:'new'}],details:async(source,p)=>{if(p.id==='1')throw Error('down');return {...normalized,id:'3'};},now:'new'
  });
  assert.equal(partial.catalog.sources.netease.playlists.length,2);assert.match(partial.catalog.sources.netease.error,/部分/);
  const failed=await updateCatalog(previous,{recommend:async()=>[playlist],details:async()=>{throw Error('down');}});
  assert.equal(failed.updated,0);assert.equal(failed.catalog.generatedAt,'old');assert.equal(failed.catalog.sources.netease.playlists.length,1);
  const empty=await updateCatalog(previous,{recommend:async()=>[]});assert.equal(empty.updated,0);
});
