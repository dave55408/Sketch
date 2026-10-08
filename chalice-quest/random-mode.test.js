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
const source=fs.readFileSync(__dirname+'/game.js','utf8').replace(/\}\)\(\);\s*$/,`globalThis.testApi={initial,blocked,grid,hardGrid,state:()=>state,randomFloorLocations,updateVesper,update};})();`);
vm.runInNewContext(source,context);
const api=context.testApi;
const initialGrid=JSON.stringify(api.hardGrid);
const castleSlots=new Set();
for(let run=0;run<100;run++){
  api.initial('random');
  const state=api.state(),outside=api.grid.flat().filter(Boolean);
  assert.notStrictEqual(state.room,'random');
  assert(outside.includes(state.room));
  assert(!api.blocked(state.room,state.player.x,state.player.y));
  for(const castle of ['gold','white','black']){
    assert(outside.includes(castle));castleSlots.add(outside.indexOf(castle));
  }
  assert(['whiteInside','blackInside'].includes(state.items.chalice.room));
  assert.strictEqual(state.mazeBridgeId,null);
  for(const [id,item] of Object.entries(state.items)){
    assert(!api.blocked(item.room,item.x,item.y),`${id} blocked in ${item.room}`);
    assert(api.randomFloorLocations(item.room).some(p=>p.x===item.x&&p.y===item.y),`${id} unreachable`);
    if(id.endsWith('Key'))assert(outside.includes(item.room));
  }
  for(const dragon of state.dragons){
    assert(!api.blocked(dragon.room,dragon.x,dragon.y),`${dragon.name} blocked`);
    assert(api.randomFloorLocations(dragon.room).some(p=>p.x===dragon.x&&p.y===dragon.y),`${dragon.name} unreachable`);
  }
  assert(api.randomFloorLocations(state.randomVesperStart.room).some(p=>p.x===state.randomVesperStart.x&&p.y===state.randomVesperStart.y));
}
assert(castleSlots.size>3);
api.initial('gold');
assert.strictEqual(JSON.stringify(api.grid),initialGrid);
assert.strictEqual(api.state().items.chalice.room,'greyDungeon');
api.initial();
element('randomModeBtn').onclick();
assert.strictEqual(api.state().mode,'playing');
assert(['whiteInside','blackInside'].includes(api.state().items.chalice.room));
api.updateVesper(60);
const vesper=api.state().dragons.find(dragon=>dragon.name==='Vesper');
assert(vesper);
assert.strictEqual(vesper.room,api.state().randomVesperStart.room);
api.initial();
element('hardModeBtn').onclick();
assert.strictEqual(api.state().mode,'playing');
assert.strictEqual(JSON.stringify(api.grid),initialGrid);
element('game').getBoundingClientRect=()=>({left:0,top:0,width:960,height:640});
element('hardModeBtn').getBoundingClientRect=()=>({left:350,right:420,top:450,bottom:490});
element('randomModeBtn').getBoundingClientRect=()=>({left:460,right:520,top:450,bottom:490});
api.initial();
api.update(0);
assert.strictEqual(api.state().mode,'playing');
assert(['whiteInside','blackInside'].includes(api.state().items.chalice.room));
console.log('100 random starts and Hard reset passed');
