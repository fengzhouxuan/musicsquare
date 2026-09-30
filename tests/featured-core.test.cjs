const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../featured-core.js');

test('URL normalization allows HTTPS assets and rejects unsafe links',()=>{
  assert.equal(core.safeURL('http://example.com/a'),'https://example.com/a');
  assert.equal(core.safeURL('//example.com/a'),'https://example.com/a');
  for(const value of [null,'','relative','javascript:alert(1)','data:text/html,hi','https://user:secret@example.com'])assert.equal(core.safeURL(value),null);
});

test('track IDs, playback state and QQ identity survive normalization',()=>{
  const track=core.normalizeTrack('qq',{id:'abc123',name:' Song ',artist:'Singer',audioUrl:'https://expired.test'});
  assert.equal(track.title,'Song');assert.equal(track.songMid,'abc123');assert.equal(track.featured,true);
  assert.equal(track.audioUrl,null);assert.equal(track.detailsLoaded,false);
  for(const [source,raw] of [['other',{}],['qq',null],['qq',{id:'../1',title:'a'}],['qq',{id:1,title:''}]])assert.equal(core.normalizeTrack(source,raw),null);
});

test('catalog discards invalid tracks, duplicate IDs and unknown platforms',()=>{
  const p=core.normalizePlaylist('netease',{id:1,name:'Mix',tags:['Pop','Pop',null,' '],trackCount:9,tracks:[{id:2,title:'A'},{id:2,title:'B'},{id:3,title:''}]});
  assert.equal(p.tracks.length,1);assert.equal(p.trackCount,9);assert.deepEqual(p.tags,['Pop']);
  assert.equal(core.normalizePlaylist('qq',{id:'a'}),null);assert.equal(core.normalizePlaylist('bad',{}),null);
  const catalog=core.parseCatalog({version:1,sources:{netease:{updatedAt:'now',error:'cached',playlists:[p,null]},unknown:{}}});
  assert.equal(catalog.sources.netease.playlists.length,1);assert.equal(catalog.sources.netease.error,'cached');assert.equal(catalog.sources.qq.playlists.length,0);
  assert.equal(catalog.sources.unknown,undefined);
  assert.throws(()=>core.parseCatalog({version:2}));assert.throws(()=>core.parseCatalog(null));
});

test('all-platform view merges lists and filters shared tags without losing source identity',()=>{
  const catalog=core.parseCatalog({version:1,sources:{
    netease:{playlists:[{id:1,name:'N',tags:['流行']}]},
    qq:{playlists:[{id:1,name:'Q',tags:['流行']}]},
    kuwo:{playlists:[{id:2,name:'K'}]}
  }});
  assert.deepEqual(core.getPlaylists(catalog).map(p=>p.source),['netease','qq','kuwo']);
  assert.deepEqual(core.getPlaylists(catalog,'all','流行').map(p=>p.name),['N','Q']);
  assert.deepEqual(core.getPlaylists(catalog,'qq').map(p=>p.name),['Q']);
  assert.deepEqual(core.getPlaylists(catalog,'all','missing'),[]);
  assert.deepEqual(core.getPlaylists(null),[]);
  assert.deepEqual(core.getPlaylists({sources:{netease:catalog.sources.netease}}).map(p=>p.name),['N']);
});

test('category discovery deduplicates tags, scopes platforms and searches without case or whitespace sensitivity',()=>{
  const catalog=core.parseCatalog({version:1,sources:{
    netease:{playlists:[{id:1,name:'N',tags:['民谣','学习','DJ']},{id:2,name:'N2',tags:['民谣']}]},
    qq:{playlists:[{id:3,name:'Q',tags:['民谣','流行']}]},
    kuwo:{playlists:[{id:4,name:'K'}]}
  }});
  assert.deepEqual(core.getTags(catalog),['流行','民谣','学习','DJ']);
  assert.deepEqual(core.getTags(catalog,'qq'),['流行','民谣']);
  assert.deepEqual(core.getTags(catalog,'all',' dJ '),['DJ']);
  assert.deepEqual(core.getTags(catalog,'all','学'),['学习']);
  assert.deepEqual(core.getTags(catalog,'netease','流行'),[]);
  assert.deepEqual(core.getTags(catalog,'kuwo'),[]);
  assert.deepEqual(core.getTags(null),[]);
  assert.deepEqual(core.getTags(catalog,'missing'),[]);
});

test('queue wraps, skips failures, shuffles and terminates when all tracks fail',()=>{
  const list=['a','b','c'].map(uid=>({uid}));
  assert.equal(core.nextIndex([],0,'next','list',new Set()),-1);
  assert.equal(core.nextIndex(list,2,'next','list',new Set()),0);
  assert.equal(core.nextIndex(list,0,'prev','list',new Set(['c'])),1);
  assert.equal(core.nextIndex(list,0,'next','single',new Set()),0);
  assert.equal(core.nextIndex(list,0,'next','single',new Set(['a'])),1);
  assert.equal(core.nextIndex(list,0,'next','shuffle',new Set(),()=>0),1);
  assert.equal(core.nextIndex(list,0,'next','shuffle',new Set(),()=>1),2);
  assert.equal(core.nextIndex(list,0,'next','shuffle',new Set(['b','c']),()=>0),0);
  assert.equal(core.nextIndex(list,0,'next','list',new Set(['a','b','c'])),-1);
});

test('browser requests reject HTTP errors and time out',async()=>{
  assert.deepEqual(await core.requestJSON('https://test',async()=>({ok:true,json:async()=>({a:1})})),{a:1});
  await assert.rejects(core.requestJSON('https://test',async()=>({ok:false,status:503})),/503/);
  await assert.rejects(core.requestJSON('https://test',async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')))),5),/aborted/);
});

test('audio resolution preserves identity and never falls back to a same-name song',async()=>{
  const netease=await core.resolveTrack({source:'netease',songid:'123'});
  assert.match(netease.audioUrl,/id=123&type=url/);assert.match(netease.lrcUrl,/type=lrc/);
  const qq={source:'qq',songid:'mid1',title:'Song'};
  const good=await core.resolveTrack(qq,async url=>{
    assert.match(url,/mid=mid1/);return {song_mid:'mid1',song_play_url_standard:'http://example.com/a.mp3',song_lyric:'[00:00]hi'};
  });
  assert.equal(good.audioUrl,'https://example.com/a.mp3');assert.equal(good.lrc,'[00:00]hi');
  const fallback=await core.resolveTrack(qq,async()=>({song_mid:'mid1',song_play_url:'https://example.com/b.mp3'}));assert.match(fallback.audioUrl,/b.mp3/);
  await assert.rejects(core.resolveTrack(qq,async()=>({song_mid:'other'})),/不一致/);
  await assert.rejects(core.resolveTrack(qq,async()=>({song_mid:'mid1',song_play_url:'javascript:bad'})),/音源/);
  const kuwo=await core.resolveTrack({source:'kuwo',songid:'456'},async url=>{
    assert.match(url,/rid=456/);return {code:200,data:{rid:456,url:'http://example.com/c.mp3'}};
  });assert.match(kuwo.audioUrl,/^https:/);
  await assert.rejects(core.resolveTrack({source:'kuwo',songid:'456'},async()=>({code:200,data:{rid:456}})),/音源/);
  await assert.rejects(core.resolveTrack({source:'kuwo',songid:'456'},async()=>({code:200,data:{rid:260839262,url:'https://example.com/message.mp3'}})),/不一致/);
  await assert.rejects(core.resolveTrack(null),/标识/);
  await assert.rejects(core.resolveTrack({source:'bad',songid:'1'}),/标识/);
});
