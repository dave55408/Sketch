const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const elements=new Map();
function element(id){
  if(!elements.has(id))elements.set(id,{
    id,dataset:{},style:{},classList:{add(){},remove(){},toggle(){}},
    getContext(){return {clearRect(){},fillRect(){},drawImage(){}};},
    addEventListener(){},focus(){},setAttribute(){},getBoundingClientRect(){return {left:0,right:0,top:0,bottom:0};},
    clientWidth:0,hidden:id==='hints',textContent:'',innerHTML:''
  });
  return elements.get(id);
}
const context={document:{getElementById:element,querySelectorAll(){return [];},addEventListener(){},body:{classList:{add(){},toggle(){}}}},
  window:{addEventListener(){}},Audio:class {pause(){}},Image:class {},requestAnimationFrame(){},clearTimeout(){},setTimeout(){},performance:{now(){return 0;}},console,Math,Set,Object,Map,Int16Array};
const source=fs.readFileSync(__dirname+'/game.js','utf8').replace(/\}\)\(\);\s*$/,`globalThis.testApi={initial,blocked,grid,hardGrid,state:()=>state,randomFloorLocations,connectedRooms,rooms,update,dragonDoor,movePlayer};})();`);
vm.runInNewContext(source,context);
const api=context.testApi;
assert.strictEqual(api.state().mode,'playing');
assert.strictEqual(api.state().questMode,'hard');
assert.strictEqual(api.state().room,'gold');
assert.strictEqual(element('overlay').hidden,true);
const initialGrid=JSON.stringify(api.hardGrid);
const castleSlots=new Set();
for(let run=0;run<100;run++){
  api.initial('random');
  const state=api.state(),outside=api.grid.flat().filter(Boolean);
  assert.notStrictEqual(state.room,'random');
  assert(outside.includes(state.room));
  assert(!api.blocked(state.room,state.player.x,state.player.y));
  for(const castle of ['gold']){
    assert(outside.includes(castle));castleSlots.add(outside.indexOf(castle));
  }
  assert(outside.includes(state.items.chalice.room));
  assert.strictEqual(state.placedBridges.bridge2,undefined);
  for(const [id,item] of Object.entries(state.items)){
    assert(!api.blocked(item.room,item.x,item.y),`${id} blocked in ${item.room}`);
    if(id!=='chalice')assert(api.randomFloorLocations(item.room).some(p=>p.x===item.x&&p.y===item.y),`${id} unreachable`);
    if(id.endsWith('Key'))assert(outside.includes(item.room));
  }
  for(const dragon of state.dragons){
    assert(!api.blocked(dragon.room,dragon.x,dragon.y),`${dragon.name} blocked`);
    assert.strictEqual(dragon.room,'south');
  }
  assert.strictEqual(state.dragons.length,3);
}
assert(castleSlots.size>3);
api.initial('gold');
assert.strictEqual(JSON.stringify(api.grid),initialGrid);
assert.strictEqual(JSON.stringify(api.grid),JSON.stringify([
  ['west',null,'gold',null,'blueGate'],
  ['homeCrossing','stone','crossroads','blueMaze','blueVault'],
  ['redTrail',null,'south',null,'blackApproach'],
  [null,null,null,null,null]
]),'Remaining rooms retain their original map slots');
assert.strictEqual(api.state().items.chalice.room,'south');
for(const [from,x,y,dx,dy,to] of [
  ['west',480,635,0,1,'homeCrossing'],['homeCrossing',480,5,0,-1,'west'],
  ['redTrail',480,5,0,-1,'homeCrossing'],['homeCrossing',480,635,0,1,'redTrail'],
  ['stone',5,320,-1,0,'homeCrossing'],['homeCrossing',955,320,1,0,'stone'],
]){
  api.initial('gold');const state=api.state();
  Object.assign(state,{room:from,mode:'playing',dragons:[]});
  Object.assign(state.player,{x,y});context.window.joystickInput={x:dx,y:dy};
  api.movePlayer(.1);
  assert.strictEqual(state.room,to,`${from} connects to ${to}`);
  assert(!api.blocked(to,state.player.x,state.player.y));
}
context.window.joystickInput={x:0,y:0};
const removedRooms=['white','black','whiteInside','blackInside','nightfallInside','catacombs','redRuins','road','greyApproach','redDungeon'];
for(const id of removedRooms)assert.strictEqual(api.rooms[id],undefined,`${id} was removed`);
assert.strictEqual(api.state().items.whiteKey,undefined);
assert.strictEqual(api.state().items.blackKey,undefined);
for(const mode of ['gold','easy']){
  api.initial(mode);
  const state=api.state(),seen=new Set(['gold']),queue=['gold'];
  for(const [id,name] of Object.entries({west:'RUBY GROVE',blueGate:'EMERALD GLADE',redTrail:'SAPPHIRE SHORE',blackApproach:'AMETHYST HOLLOW'})){
    assert.strictEqual(api.rooms[id].name,name);
  }
  assert(!api.connectedRooms('west').includes('mazeML'));
  assert(!api.connectedRooms('mazeML').includes('west'));
  assert(api.blocked('west',480,20),'The former maze exit is closed');
  assert(api.blocked('mazeML',480,635),'The maze return exit is closed');
  assert(!api.connectedRooms('redTrail').includes('redDungeon'));
  assert(api.blocked('redTrail',480,635),"Blue Elf's Home has no south exit");
  for(let i=0;i<queue.length;i++)for(const room of api.connectedRooms(queue[i])){
    assert(api.rooms[room],`route to missing room ${room}`);
    assert(api.dragonDoor(queue[i],room),`${queue[i]} has a door to ${room}`);
    assert(!removedRooms.includes(room));
    if(!seen.has(room)){seen.add(room);queue.push(room);}
  }
  for(const room of api.grid.flat().filter(room=>room&&room!=='south'))assert(seen.has(room),`${room} connected in ${mode}`);
  for(const [id,item] of Object.entries(state.items)){
    if(item.room==='absent'||item.room==='placed')continue;
    assert(id==='chalice'&&item.room==='south'||item.room==='goldInside'||seen.has(item.room),`${id} reachable in ${mode}`);
    assert(!api.blocked(item.room,item.x,item.y),`${id} on accessible floor in ${mode}`);
  }
  state.mode='playing';api.update(61);
  assert.strictEqual(state.dragons.length,3,'No delayed fourth dragon');
  assert(!state.dragons.some(dragon=>dragon.name==='Vesper'));
}
const html=fs.readFileSync(__dirname+'/index.html','utf8');
assert(!html.includes('easyModeBtn'));
assert(!html.includes('randomModeBtn'));
assert.strictEqual(element('easyModeBtn').onclick,undefined);
assert.strictEqual(element('randomModeBtn').onclick,undefined);
api.initial();
element('hardModeBtn').onclick();
assert.strictEqual(api.state().mode,'playing');
assert.strictEqual(api.state().questMode,'hard');
assert.strictEqual(api.state().room,'gold');
assert.strictEqual(api.state().items.chalice.room,'south');
assert.strictEqual(JSON.stringify(api.grid),initialGrid);
element('restartBtn').onclick();
assert.strictEqual(api.state().mode,'playing');
assert.strictEqual(api.state().questMode,'hard');
assert.strictEqual(api.state().room,'gold');
assert.strictEqual(element('overlay').hidden,true);
element('hardModeBtn').onclick();
assert.strictEqual(api.state().questMode,'hard');
element('game').getBoundingClientRect=()=>({left:0,top:0,width:960,height:640});
element('hardModeBtn').getBoundingClientRect=()=>({left:460,right:520,top:450,bottom:490});
api.initial();
api.update(0);
assert.strictEqual(api.state().mode,'playing');
assert.strictEqual(api.state().questMode,'hard');
assert.strictEqual(api.state().items.chalice.room,'south');
console.log('Inherited random layout checks and Hard-only click, restart, and title cursor checks passed');
