const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadGame(profileChase=false) {
  const sounds=[];
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      id, dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} },
      getContext() { return { clearRect() {}, fillRect() {}, drawImage() {} }; },
      listeners: {}, addEventListener(type, handler) { this.listeners[type]=handler; }, contains() { return true; }, focus() {}, setAttribute() {},
      open:false,showModal(){this.open=true;},close(){this.open=false;this.listeners.close?.();},
      getBoundingClientRect() { return { left: 0, right: 0, top: 0, bottom: 0 }; },
      clientWidth: 0, hidden: id === 'hints', textContent: '', innerHTML: ''
    });
    return elements.get(id);
  }
  const context = {
    document: { getElementById: element, querySelectorAll() { return []; }, addEventListener() {},
      body: { classList: { add() {}, toggle() {} } } },
    window: { addEventListener() {} }, Audio: class { constructor(src){this.src=src;this.plays=0;sounds.push(this);} pause() {} play() { this.plays++;return Promise.resolve(); } }, Image: class {},
    requestAnimationFrame() {}, clearTimeout() {}, setTimeout() {}, performance: { now() { return 0; } }, console
  };
  let source = fs.readFileSync(__dirname + '/game.js', 'utf8').replace(
    /\}\)\(\);\s*$/, 'globalThis.testApi={enter,initial,visibleExits,neighbor,dir,blocked,dragonDoor,connectedRooms,batNeighbor,updateDragons,updateBat,updateElves,update,updateAxe,updateTreasureRemoval,pickup,movePlayer,itemPosition,wallColor,heldObjectColor,refreshHints,teleportToRoom,grid,hardGrid,state:()=>state};})();'
  );
  const chaseMetrics={shots:0,routes:0};
  if(profileChase){
    context.chaseMetrics=chaseMetrics;
    source=source.replace('function elfClearShot(elf,origin=elf){','function elfClearShot(elf,origin=elf){chaseMetrics.shots++;');
    source=source.replace('function findDragonRoute(dragon,player){','function findDragonRoute(dragon,player){chaseMetrics.routes++;');
  }
  vm.runInNewContext(source, context);
  return { api: context.testApi, element, window: context.window, sounds, chaseMetrics };
}

test('mini map houses appear only after visits or while hints are on', () => {
  const {api,element}=loadGame();api.initial('gold');
  const homes=['west','blueGate','redTrail','blackApproach'];
  const cell=home=>element('map').innerHTML.match(new RegExp('<span data-room="'+home+'"[^]*?</span>'))[0];
  for(const home of homes){assert(!cell(home).includes('♜'));assert(cell(home).includes('Unexplored'));}
  api.enter('west',200,320);api.enter('gold',480,320);
  assert(cell('west').includes('♜'),'visited house stays visible');
  assert(!cell('blueGate').includes('♜'),'other houses stay hidden');
  element('map').querySelectorAll=element('mazeMap').querySelectorAll=()=>[];
  element('hints').hidden=false;api.enter('gold',480,320);
  for(const home of homes)assert(cell(home).includes('♜'),'hints reveal every house');
  element('hints').hidden=true;api.enter('gold',480,320);
  assert(cell('west').includes('♜'));assert(!cell('blueGate').includes('♜'));
  api.enter('redTrailInside',480,320);api.enter('gold',480,320);
  assert(cell('redTrail').includes('♜'),'visiting a house interior also reveals it');
});

test('the behavior window freezes play and closing it resumes the existing quest', () => {
  const {api,element,window}=loadGame();api.initial('gold');const state=api.state();
  state.mode='playing';state.room='stone';state.elves=[];state.dragons=[];
  Object.assign(state.player,{x:480,y:320});window.joystickInput={x:1,y:0};
  element('behaviorToggle').onclick({preventDefault(){}});
  assert.equal(element('behaviorDialog').open,true);
  api.update(.05);assert.equal(state.player.x,480);assert.equal(state.mode,'playing');
  element('behaviorClose').onclick();assert.equal(element('behaviorDialog').open,false);
  api.update(.05);assert(state.player.x>480);assert.equal(api.state(),state);
  state.mode='paused';element('behaviorToggle').onclick({preventDefault(){}});
  element('behaviorClose').onclick();assert.equal(state.mode,'paused');
});

test('picking up the flute plays once and another pickup starts a fresh sound', () => {
  const {api,sounds,element}=loadGame();api.initial('gold');const state=api.state();
  state.mode='playing';state.room='goldInside';state.elves=[];state.dragons=[];
  Object.assign(state.player,{x:480,y:320});state.items.flute={room:state.room,x:480,y:320};
  const sound=sounds.find(sound=>sound.src.startsWith('assets/pan-flute-loop.mp3'));
  const pickupSound=sounds.find(sound=>sound.src==='assets/pick-up.mp3');
  const dropSound=sounds.find(sound=>sound.src==='assets/drop.mp3');
  api.pickup();assert.equal(state.held,'flute');assert.equal(sound.plays,1);assert.equal(sound.loop,false);
  assert.equal(pickupSound.plays,0);
  sound.onended();for(let i=0;i<10;i++)api.update(0);assert.equal(sound.plays,1);
  element('dropBtn').onclick();assert.equal(sound.loop,false);
  assert.equal(dropSound.plays,1);
  state.pickupDelay=0;Object.assign(state.player,{x:state.items.flute.x,y:state.items.flute.y});
  api.pickup();assert.equal(sound.plays,2);assert.equal(sound.currentTime,0);
  assert.equal(pickupSound.plays,0);
});

test('flute loops only with Pelendil in the room and stops on swaps and restarts', () => {
  const {api,sounds,element}=loadGame();api.initial('gold');const state=api.state();
  const purple=state.elves.find(elf=>elf.home==='blackApproach');state.elves=[purple];state.dragons=[];
  state.mode='playing';state.room='goldInside';Object.assign(purple,{room:state.room,x:800,y:320,wait:100});
  Object.assign(state.player,{x:480,y:320});state.items.flute={room:state.room,x:480,y:320};
  const sound=sounds.find(sound=>sound.src.startsWith('assets/pan-flute-loop.mp3'));let pauses=0;sound.pause=()=>{pauses++;};
  api.pickup();assert.equal(sound.plays,1);assert.equal(sound.loop,true);
  for(let i=0;i<10;i++)api.update(0);assert.equal(sound.plays,1,'frames do not restart the loop');
  api.enter('stone',480,320);assert.equal(sound.loop,false);sound.onended();api.update(0);assert.equal(sound.plays,1);
  purple.room='stone';api.update(0);assert.equal(sound.loop,true);assert.equal(sound.plays,2);
  element('pauseBtn').onclick();assert.equal(pauses,1);element('pauseBtn').onclick();assert.equal(sound.plays,3);
  element('behaviorToggle').onclick({preventDefault(){}});assert.equal(pauses,2);
  element('behaviorClose').onclick();assert.equal(sound.plays,4);
  state.items.coin={room:state.room,x:state.player.x,y:state.player.y};api.pickup();
  assert.equal(state.held,'coin');assert.equal(sound.loop,false);assert.equal(pauses,3);
  state.pickupDelay=0;Object.assign(state.player,{x:state.items.flute.x,y:state.items.flute.y});api.pickup();
  assert.equal(state.held,'flute');assert.equal(sound.loop,true);
  api.initial('gold');assert.equal(sound.loop,false);assert.equal(sound.currentTime,0);assert.equal(pauses,4);
});

test('Pelendil carrying the flute loops its sound on screen and stops when he drops it or leaves', () => {
  const {api,sounds}=loadGame();api.initial('gold');const state=api.state();
  const purple=state.elves.find(elf=>elf.home==='blackApproach');state.elves=[purple];state.dragons=[];
  state.mode='playing';state.room='goldInside';state.held=null;
  Object.assign(purple,{room:state.room,carrying:'flute',stunTimer:10});state.items.flute.room='elf:blackApproach';
  const sound=sounds.find(sound=>sound.src.startsWith('assets/pan-flute-loop.mp3'));let pauses=0;sound.pause=()=>{pauses++;};
  api.update(0);assert.equal(sound.loop,true);assert.equal(sound.plays,1);
  for(let i=0;i<10;i++)api.update(0);assert.equal(sound.plays,1);
  api.enter('stone',480,320);assert.equal(sound.loop,false);assert.equal(pauses,1);
  purple.room='stone';api.update(0);assert.equal(sound.loop,true);assert.equal(sound.plays,2);
  purple.carrying=null;state.items.flute={room:'stone',x:800,y:320};api.update(0);
  assert.equal(sound.loop,false);assert.equal(pauses,2);
});

test('flute and flower start in their swapped rooms in every quest mode', () => {
  for(const mode of ['gold','random','easy']){
    const {api}=loadGame();api.initial(mode);const state=api.state();
    assert.equal(state.items.flute.room,mode==='easy'?'labyrinthApproach':'blueGate');
    assert.equal(state.items.flower.room,mode==='easy'?'labyrinthVault':'blackApproach');
    for(const id of ['flute','flower'])assert(!api.blocked(state.items[id].room,state.items[id].x,state.items[id].y,true));
  }
});

test('Mosswood Forest has a walkable north entrance to Western Maze Root Gallery and a south return', () => {
  for(const mode of ['gold','easy','random']){
    const {api,window}=loadGame();api.initial(mode);const state=api.state();state.mode='playing';state.elves=[];state.dragons=[];
    assert.equal(api.neighbor('stone',api.dir.up),'mazeML');
    assert.equal(api.neighbor('mazeML',api.dir.down),'stone');
    assert.equal(api.neighbor('mazeBR',api.dir.down),'mazeBR');
    assert(api.visibleExits('stone').up);
    assert(api.dragonDoor('stone','mazeML'));
    assert(api.dragonDoor('mazeML','stone'));
    for(let y=550;y<=650;y+=10)assert.equal(api.blocked('mazeML',480,y),false);
    state.room='stone';Object.assign(state.player,{x:480,y:20});window.joystickInput={x:0,y:-1};
    for(let step=0;step<20&&state.room==='stone';step++)api.movePlayer(.016);
    assert.equal(state.room,'mazeML');assert.equal(api.blocked(state.room,state.player.x,state.player.y),false);
    window.joystickInput={x:0,y:0};api.update(.4);Object.assign(state.player,{x:480,y:620});window.joystickInput={x:0,y:1};
    for(let step=0;step<20&&state.room==='mazeML';step++)api.movePlayer(.016);
    assert.equal(state.room,'stone');assert.equal(api.blocked(state.room,state.player.x,state.player.y),false);
  }
});

test('the bat traverses Western Maze between its exterior exits without looping at Heartwood north', () => {
  for(const [from,to,y,vy] of [['stone','black',-1,-.6],['black','stone',641,.6]]){
    const {api}=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.dragons=[];state.elves=[];
    Object.assign(state.bat,{room:from,x:480,y,vx:0,vy,carrying:'coin',mazeDestination:null});state.items.coin.room='bat';
    api.updateBat(0);assert.notEqual(state.bat.room,from);
    for(let step=0;step<1200&&state.bat.room!==to;step++)api.updateBat(.05);
    assert.equal(state.bat.room,to,from+' to '+to);
    const enteredY=state.bat.y;api.updateBat(.05);assert.equal(state.bat.room,to);
    assert(to==='stone'?state.bat.y>enteredY:state.bat.y<enteredY,'bat flies into the exterior instead of back into the maze');
  }
  const {api}=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.dragons=[];
  Object.assign(state.bat,{room:'mazeML',x:480,y:620,vx:0,vy:.6,carrying:'coin',mazeDestination:'mazeML'});state.items.coin.room='bat';
  for(let step=0;step<100&&state.bat.room!=='stone';step++)api.updateBat(.05);
  assert.equal(state.bat.room,'stone','a stale Root Gallery destination recovers to the Mosswood exit');
});

test('every room has a distinct Elf Adventure name in every quest mode', () => {
  const ids=['entry','blackApproachSouth','west','gold','blueGate','homeCrossing','stone','crossroads','blueMaze','blueVault','redTrail','south','blackApproach','westInside','blueGateInside','redTrailInside','blackApproachInside','greyDungeon','goldInside','mazeTL','mazeTR','mazeML','mazeMR','mazeBR'];
  for(const mode of ['gold','easy','random']){
    const {api,element}=loadGame();api.initial(mode);api.state().mode='playing';const names=new Set();
    for(const id of ids){assert(api.teleportToRoom(id),id);const name=element('roomName').textContent;assert(name);names.add(name);}
    assert.equal(names.size,ids.length);
    assert(names.has('GOLDEN KEEP'));assert(names.has('JEWELKEEP TREASURY'));assert(names.has('EMERALD GLADE'));
    for(const room of ['FERN GALLERY','TWILIGHT CROSSING','ROOT GALLERY','MOONLIT CROSSING','HEARTWOOD CHAMBER'])assert(names.has('WESTERN MAZE · '+room));
    assert(![...names].some(name=>/BLACK CASTLE|GREY DUNGEON/.test(name)));
  }
});

test('mouse hover names ground, carried, and placed objects at the displayed canvas scale', () => {
  const {api,element}=loadGame();api.initial('gold');const state=api.state(),canvas=element('game');state.mode='playing';state.room='crossroads';
  canvas.getBoundingClientRect=()=>({left:100,top:50,width:480,height:320});
  const hover=(x,y)=>canvas.listeners.mousemove({clientX:100+x/2,clientY:50+y/2});
  for(const [id,name] of [['apple','Apple'],['coin','Coin'],['axe','Axe'],['flute','Flute'],['flower','Flower'],['blackKey','Black key'],['jewelOrange','Amber jewel']]){
    const item=state.items[id];state.room=item.room;hover(item.x,item.y);assert.equal(canvas.title,name);
  }
  state.room='crossroads';
  state.held='axe5';state.heldSide='right';Object.assign(state.player,{x:100,y:200});hover(135,200);assert.equal(canvas.title,'Axe');
  state.held=null;state.items.axe5={room:'elf:west',x:0,y:0};Object.assign(state.elves[0],{room:'crossroads',x:100,y:200,carrying:'axe5',axeSide:'right'});hover(150,200);assert.equal(canvas.title,'Axe');
  state.placedBridges.bridge2={room:'crossroads',x:100,y:100};hover(160,100);assert.equal(canvas.title,'Bridge');
  hover(900,100);assert.equal(canvas.title,'');
  hover(state.items.apple.x,state.items.apple.y);canvas.listeners.mouseleave();assert.equal(canvas.title,'');
});

test('Western Maze leads north to the black castle and its original interior chain', () => {
  for(const mode of ['gold','easy','random']){
    const {api,window,element}=loadGame();api.initial(mode);const state=api.state();state.mode='playing';state.elves=[];state.dragons=[];
    const dungeon=mode==='easy'?'nightfallInside':'blackDungeon';
    assert.equal(api.neighbor('mazeTR',api.dir.up),'black');
    assert.equal(api.neighbor('black',api.dir.down),'mazeTR');
    assert.equal(api.neighbor('blackInside',api.dir.up),dungeon);
    assert.equal(api.neighbor(dungeon,api.dir.down),'blackInside');
    assert.equal(api.neighbor('blackInside',api.dir.down),'black');
    assert.equal(api.state().items.blackKey.room,'labyrinthVault');
    assert.equal(api.visibleExits('black').left,false);assert.equal(api.visibleExits('black').up,false);
    for(const [from,to,y,dy] of [['mazeTR','black',20,-1],['black','mazeTR',620,1],['blackInside',dungeon,20,-1],[dungeon,'blackInside',620,1],['blackInside','black',620,1]]){
      window.joystickInput={x:0,y:0};api.update(.4);state.room=from;Object.assign(state.player,{x:480,y});window.joystickInput={x:0,y:dy};
      for(let step=0;step<20&&state.room===from;step++)api.movePlayer(.016);
      assert.equal(state.room,to,mode+' '+from+' to '+to);assert.equal(api.blocked(to,state.player.x,state.player.y),false);
    }
    assert(element('mazeMap').innerHTML.includes('data-room="black"'));
    for(const room of ['black','blackInside',dungeon])assert(api.teleportToRoom(room),room);
  }
});

test('the black key raises the black castle gate and permits entry', () => {
  const {api,window}=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.elves=[];state.dragons=[];
  state.room='black';Object.assign(state.player,{x:480,y:505});window.joystickInput={x:0,y:-.2};
  api.update(.02);assert.equal(state.room,'black');assert.equal(state.gates.black,false);
  assert(api.blocked('black',290,180));assert.equal(api.blocked('black',480,170),false);
  state.held='blackKey';state.items.blackKey.room='held';
  for(let step=0;step<100&&state.room==='black';step++)api.update(.016);
  assert.equal(state.room,'blackInside');assert.equal(state.gateLift.black,1);
  assert.equal(state.mode,'playing');
});

test('White Castle connects east of Blue Vault and its white key opens access to Amber', () => {
  const {api,window,element}=loadGame();api.initial('gold');const state=api.state();
  state.mode='playing';state.elves=[];state.dragons=[];
  assert.equal(state.items.sword.room,'goldInside');assert.equal(state.items.whiteKey.room,'stone');
  assert.equal(state.items.blackKey.room,'labyrinthVault');assert.equal(state.items.jewelOrange.room,'whiteInside');
  for(const id of ['sword','whiteKey','blackKey','jewelOrange']){
    const item=state.items[id];assert(!api.blocked(item.room,item.x,item.y,true),id+' starts on open floor');
  }
  assert.equal(api.neighbor('labyrinthVault',api.dir.right),'white');
  assert.equal(api.neighbor('white',api.dir.left),'labyrinthVault');
  state.room='labyrinthVault';Object.assign(state.player,{x:955,y:320});window.joystickInput={x:1,y:0};
  for(let i=0;i<30&&state.room==='labyrinthVault';i++)api.movePlayer(.016);
  assert.equal(state.room,'white');
  window.joystickInput={x:0,y:0};api.update(.4);
  Object.assign(state.player,{x:480,y:505});window.joystickInput={x:0,y:-.2};
  api.update(.02);assert.equal(state.room,'white');assert.equal(state.gates.white,false);
  state.held='whiteKey';state.items.whiteKey.room='held';
  for(let i=0;i<100&&state.room==='white';i++)api.update(.016);
  assert.equal(state.room,'whiteInside');assert.equal(state.gateLift.white,1);
  assert(element('map').innerHTML.includes('data-room="white" class="current'));
  state.held=null;window.joystickInput={x:0,y:0};api.update(.4);
  Object.assign(state.player,{x:480,y:620});window.joystickInput={x:0,y:1};
  for(let i=0;i<30&&state.room==='whiteInside';i++)api.movePlayer(.016);
  assert.equal(state.room,'white');
});

test('jewel flashes keep staggered offsets and choose fresh intervals between four and seven-and-a-half seconds', () => {
  const {api}=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.elves=[];state.dragons=[];
  const schedules=Object.values(state.jewelFlashSchedule);
  schedules.forEach((schedule,index)=>assert(Math.abs(schedule.next-(4-index*4/6))<1e-8));
  api.update(4);
  const previous=new Map();
  for(const schedule of schedules){
    assert(schedule.start!==null);const interval=schedule.next-schedule.start;assert(interval>=4&&interval<=7.5);
    previous.set(schedule,schedule.next);
  }
  api.update(7.5);
  for(const schedule of schedules){
    assert(schedule.start>=previous.get(schedule));const interval=schedule.next-schedule.start;assert(interval>=4&&interval<=7.5);
  }
  const nextTimes=schedules.map(schedule=>schedule.next);state.mode='paused';api.update(20);
  assert.deepEqual(schedules.map(schedule=>schedule.next),nextTimes);
});

test('jewel flash timer advances during play and stops while paused', () => {
  const {api}=loadGame();api.initial('gold');const state=api.state();state.elves=[];state.dragons=[];state.mode='playing';
  assert.equal(state.jewelFlashElapsed,0);api.update(.5);assert.equal(state.jewelFlashElapsed,.5);
  state.mode='paused';api.update(25);assert.equal(state.jewelFlashElapsed,.5);
});

test('all six returned jewels trigger the existing win animation and final victory screen', () => {
  for(const room of ['goldInside']){
    const {api,element,sounds}=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.room=room;state.elves=[];state.dragons=[];
    const ids=['jewelOrange','jewelGold','jewelRed','jewelPurple','jewel','jewelGreen'];
    for(const [index,id] of ids.slice(0,5).entries())state.items[id]={room:'goldInside',x:620+index*40,y:320};
    api.update(.01);assert.equal(state.mode,'playing');assert.equal(element('jewelProgress').textContent,'Jewels in treasury: 5 / 6');
    state.bat.carrying='jewelGreen';state.items.jewelGreen.room='bat';api.update(.01);assert.equal(state.mode,'playing');
    state.bat.carrying=null;state.held='jewelGreen';state.items.jewelGreen.room='held';api.update(.01);
    assert.equal(state.mode,'playing');assert.equal(element('jewelProgress').textContent,'Jewels in treasury: 5 / 6');
    Object.assign(state.player,{x:800,y:400});element('dropBtn').onclick();api.update(.01);
    assert.equal(state.mode,'winning');assert.equal(element('jewelProgress').textContent,'Jewels in treasury: 6 / 6');
    const win=sounds.find(sound=>sound.src==='assets/win-good.mp3');assert.equal(win.plays,1);
    api.update(.1);assert.equal(win.plays,1);assert(state.winTimer>0);
    win.paused=true;api.update(7);assert.equal(state.mode,'won');assert.equal(element('overlayTitle').textContent,'THE SIX JEWELS RETURN');
  }
});

test('jewels outside the castle do not count toward the treasury-only victory', () => {
  const {api,element}=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.elves=[];state.dragons=[];
  const ids=['jewelOrange','jewelGold','jewelRed','jewelPurple','jewel','jewelGreen'];
  for(const [index,id] of ids.entries())state.items[id]={room:'gold',x:150+index*90,y:550};
  api.update(.01);assert.equal(state.mode,'playing');assert.equal(element('jewelProgress').textContent,'Jewels in treasury: 0 / 6');
  state.room='goldInside';api.update(.01);assert.equal(state.mode,'playing');
  for(const [index,id] of ids.slice(0,5).entries())state.items[id]={room:'goldInside',x:620+index*40,y:320};
  state.held='jewelGreen';state.items.jewelGreen.room='held';state.room='gold';api.update(.01);
  assert.equal(state.mode,'playing');assert.equal(element('jewelProgress').textContent,'Jewels in treasury: 5 / 6');
  state.room='goldInside';api.update(.01);assert.equal(state.mode,'playing');
  Object.assign(state.player,{x:800,y:400});element('dropBtn').onclick();api.update(.01);assert.equal(state.mode,'winning');
});

test('jewels elsewhere inside the golden castle do not count until placed in treasures', () => {
  const {api,element}=loadGame();api.initial('gold');const state=api.state();
  state.mode='playing';state.room='goldInside';state.elves=[];state.dragons=[];state.bat.room='south';
  const ids=['jewelOrange','jewelGold','jewelRed','jewelPurple','jewel','jewelGreen'];
  for(const [index,id] of ids.entries())state.items[id]={room:'goldInside',x:150+index*40,y:320};
  api.update(.01);assert.equal(element('jewelProgress').textContent,'Jewels in treasury: 0 / 6');assert.equal(state.mode,'playing');
  for(const [index,id] of ids.slice(0,5).entries())Object.assign(state.items[id],{x:620+index*40,y:320});
  for(const [x,y] of [[564,320],[866,320],[700,134],[700,486]]){
    Object.assign(state.items.jewelGreen,{x,y});api.update(.01);
    assert.equal(element('jewelProgress').textContent,'Jewels in treasury: 5 / 6');assert.equal(state.mode,'playing');
  }
  Object.assign(state.items.jewelGreen,{x:700,y:400});api.update(.01);
  assert.equal(element('jewelProgress').textContent,'Jewels in treasury: 6 / 6');assert.equal(state.mode,'winning');
});

test('the chalice is absent in every quest mode', () => {
  const {api,element}=loadGame();
  for(const mode of ['gold','easy','random']){
    api.initial(mode);assert.equal(api.state().items.chalice,undefined);
    api.refreshHints();assert(!element('map').innerHTML.includes('Chalice'));
  }
});

test('four apples and four coins start around the kingdom and copies share gift preferences', () => {
  const { api }=loadGame();api.initial('gold');const state=api.state();state.room='gold';
  const apples=Object.keys(state.items).filter(id=>/^apple[234]?$/.test(id)),coins=Object.keys(state.items).filter(id=>/^coin[234]?$/.test(id));
  assert.equal(apples.length,4);assert.equal(coins.length,4);
  assert.equal(new Set([...apples,...coins].map(id=>state.items[id].room)).size,8);
  for(const id of ['apple2','apple3','apple4','coin2','coin3','coin4']){
    api.initial('gold');const current=api.state();current.room='gold';const elf=current.elves[0];current.elves=[elf];
    Object.assign(elf,{room:'westInside',x:305,y:320,wait:0,goal:null,path:[]});
    current.items[id]={room:elf.room,x:245,y:320};api.updateElves(.05);
    assert.equal(elf.carrying,id);assert.equal(elf.emotionalState.sentiment,id.startsWith('apple')?1:2);assert.equal(elf.giftsReceived,id.startsWith('apple')?1:0);
    for(let step=0;step<3000&&elf.giftTask;step++)api.updateElves(.05);
    assert.equal(elf.giftTask,null);assert.equal(elf.emotionalState.sentiment,id.startsWith('apple')?1:3);assert.equal(elf.giftsReceived,1);
  }
});

test('the extra apple and coin start on open floor in Western Maze and can be picked up', () => {
  for(const mode of ['gold','easy','random'])for(const id of ['apple4','coin4']){
    const {api}=loadGame();api.initial(mode);const state=api.state();state.mode='playing';
    state.elves=[];state.dragons=[];const item=state.items[id];assert.equal(item.room,id==='apple4'?'mazeBR':'mazeML');
    assert(!api.blocked(item.room,item.x,item.y,true));
    state.room=item.room;Object.assign(state.player,{x:item.x,y:item.y});api.pickup();assert.equal(state.held,id);
  }
});

test('weapons start inside Golden Keep and the original eight gifts start on open floor across the kingdom', () => {
  const {api}=loadGame();
  for(const mode of ['gold','easy','random']){
    api.initial(mode);const state=api.state();
    for(const id of ['sword','axe'])assert.equal(state.items[id].room,'goldInside');
    const gifts=['apple','apple2','apple3','coin','coin2','coin3','flower','flute'];
    assert.equal(new Set(gifts.map(id=>state.items[id].room)).size,8);
    for(const id of ['sword','axe',...gifts]){
      const item=state.items[id];assert(!api.blocked(item.room,item.x,item.y,true),mode+' '+id+' on open floor');
      if(gifts.includes(id))assert(api.grid.flat().includes(item.room),id+' in a kingdom room');
    }
  }
});

test('the Wyrmwood bridge starts beside the lower-left tree and can be picked up', () => {
  for(const mode of ['gold','easy','random']){
    const {api}=loadGame();api.initial(mode);const state=api.state();state.mode='playing';
    state.elves=[];state.dragons=[];const tree=state.trees[2],bridge=state.items.bridge;
    assert.equal(bridge.room,'south');assert.equal(bridge.x,tree.x+150);assert.equal(bridge.y,Math.min(485,tree.y));
    for(const dx of [-81,81])for(const dy of [-72,72])assert(!api.blocked('south',bridge.x+dx,bridge.y+dy,true),'bridge clears trees and walls');
    state.room='south';Object.assign(state.player,{x:bridge.x-75,y:bridge.y+72});
    assert(!api.blocked(state.room,state.player.x,state.player.y,true));api.pickup();assert.equal(state.held,'bridge');
  }
});

test('the white key starts one hundred pixels above its former position on open floor', () => {
  for(const mode of ['gold','easy','random']){
    const {api}=loadGame();api.initial(mode);const state=api.state();state.mode='playing';
    const key=state.items.whiteKey;assert.equal(key.room,'stone');assert.equal(key.x,475);assert.equal(key.y,455);
    assert(!api.blocked(key.room,key.x,key.y,true));state.room=key.room;Object.assign(state.player,{x:key.x,y:key.y});
    api.pickup();assert.equal(state.held,'whiteKey');
  }
});

test('loose objects start near walls on open floor with clear doorways', () => {
  const {api}=loadGame();
  for(const mode of ['gold','easy','random']){
    api.initial(mode);const state=api.state();
    for(const [id,item] of Object.entries(state.items)){
      if(item.room==='absent'||item.room==='placed'||item.room==='unplaced'||item.treasureOwner||item.room==='goldInside'||id==='goldKey'||id==='whiteKey'||id==='bridge')continue;
      assert(Math.min(item.x,960-item.x,item.y,640-item.y)<=(id.startsWith('bridge')?155:85),mode+' '+id+' is near a wall');
      assert(!api.blocked(item.room,item.x,item.y,true),id+' is on open floor');
      for(const room of api.connectedRooms(item.room)){
        const door=api.dragonDoor(item.room,room);
        if(door)assert(Math.hypot(item.x-door.exit.x,item.y-door.exit.y)>110,id+' leaves the doorway clear');
      }
    }
    assert.equal(state.items.sword.x,310);assert.equal(state.items.axe.x,180);
    assert.equal(state.items.jewelRed.treasureOwner,'west');
  }
});

test('Inherited smaller quest fixture has the requested objects and dragons', () => {
  const { api, element } = loadGame();
  api.initial('easy');api.state().mode='playing';
  const state = api.state();
  assert.equal(state.questMode, 'easy');
  assert.equal(state.mode, 'playing');
  assert.equal(state.room, 'gold');
  const expected = { goldKey: 'gold', sword: 'goldInside', bridge: 'south', magnet: 'blackApproachSouth' };
  for (const [id, room] of Object.entries(expected)) {
    assert.equal(state.items[id].room, room);
    assert.equal(api.blocked(room, state.items[id].x, state.items[id].y), false, id);
  }
  assert.equal(state.dragons.length, 4);
  assert.equal(api.grid[0][1], null);
  assert.equal(state.items.goldKey.x, 210);
  assert.equal(state.items.goldKey.y, 285);
  assert(!api.blocked('gold',state.items.goldKey.x,state.items.goldKey.y,true));
  assert.equal(state.dragons.find(d=>d.name==='Yorgle').room,'west');
  assert.equal(state.dragons.find(d=>d.name==='Grundle').room,'south');
  assert.equal(state.dragons.find(d=>d.name==='Rhindle').room,'whiteInside');
  assert.equal(state.bat.room,'south');
  assert.equal(state.dragons.find(d => d.name === 'Vesper').room, 'nightfallInside');
  assert.equal(state.dragons.length, 4);
  assert.doesNotThrow(() => api.refreshHints());
});

test('elf houses have solid walls, open gates, and interiors with working return exits', () => {
  const { api, window }=loadGame();
  for(const home of ['west','blueGate','redTrail','blackApproach']){
    api.initial('gold');const state=api.state();state.mode='playing';state.room=home;
    const inverted=false,outsideY=y=>y;
    assert.equal(api.wallColor(home),api.wallColor(home+'Inside'));
    for(const [x,y] of [[320,300],[650,300],[488,200],[440,420],[537,420],[488,365]])assert(api.blocked(home,x,outsideY(y)),`${home} wall at ${x},${outsideY(y)}`);
    assert(!api.blocked(home,488,outsideY(410)),`${home} open gate`);
    state.player.x=488.5;state.player.y=outsideY(515);window.joystickInput={x:0,y:inverted?1:-1};
    for(let i=0;i<60&&state.room===home;i++)api.update(.016);
    assert.equal(state.room,home+'Inside');
    assert(!api.blocked(state.room,state.player.x,state.player.y));
    assert.equal(api.visibleExits(state.room).down,true);
    assert.equal(api.visibleExits(state.room).up,false);
    window.joystickInput={x:0,y:1};
    for(let i=0;i<100&&state.room!==home;i++)api.update(.016);
    assert.equal(state.room,home);
    assert(!api.blocked(home,state.player.x,state.player.y));
    assert.equal(state.player.x,488.5);
  }
  assert.equal(api.wallColor('westInside'),'#8B1515');
});

test('players bounce off every resident elf from all four directions', () => {
  const { api, window }=loadGame();
  for(const home of ['west','blueGate','redTrail','blackApproach'])for(const [x,y,dx,dy] of [[727,445,1,0],[813,445,-1,0],[770,402,0,1],[770,488,0,-1]]){
    api.initial('gold');const state=api.state();state.mode='playing';state.room=home;
    Object.assign(state.player,{x,y});window.joystickInput={x:dx,y:dy};
    api.movePlayer(.016);
    assert.equal(state.player.x,x);assert.equal(state.player.y,y);
    assert.equal(state.player.bounce.time,0);
    assert.equal(state.player.bounce.x,dx?-dx:0);assert.equal(state.player.bounce.y,dy?-dy:0);
    assert(api.blocked(home,770,445));
    window.joystickInput={x:-dx,y:-dy};api.movePlayer(.016);
    assert(state.player.x!==x||state.player.y!==y);
  }
});

test('elves pass through each other while remaining solid to the player', () => {
  const { api }=loadGame();api.initial('gold');const state=api.state();state.room='gold';
  const [first,second]=state.elves;state.elves=[first,second];
  Object.assign(first,{room:'westInside',x:300,y:320,wait:0,goal:{x:650,y:320},path:[{x:650,y:320}]});
  Object.assign(second,{room:'westInside',x:400,y:320,wait:0,goal:{x:200,y:320},path:[{x:200,y:320}]});
  assert(!api.blocked('westInside',second.x,second.y,first.home));
  assert(api.blocked('westInside',second.x,second.y));
  for(let step=0;step<50;step++)api.updateElves(.05);
  assert(first.x>second.x,'elves cross paths');assert.equal(first.y,320);assert.equal(second.y,320);
  assert(api.blocked(first.room,first.x,first.y));assert(api.blocked(second.room,second.x,second.y));
});

test('idle elves leave house interiors rather than selecting indoor wandering destinations', () => {
  for(const home of ['west','blueGate','redTrail','blackApproach']){
    const {api}=loadGame();api.initial('gold');const state=api.state();state.room='gold';
    const elf=state.elves.find(elf=>elf.home===home);state.elves=[elf];
    Object.assign(elf,{room:home+'Inside',x:650,y:320,wait:0,goal:null,path:[]});
    api.updateElves(.05);assert.equal(elf.goal.door.to,home,'idle elf aims for the exit');
    for(let step=0;step<400&&elf.room===home+'Inside';step++)api.updateElves(.05);
    assert.equal(elf.room,home);assert(!elf.giftTask);
  }
});

test('roaming elves move, use connected doors, and remain solid away from home', () => {
  const { api }=loadGame();api.initial('gold');const state=api.state();
  state.items.apple2.room='absent';
  const elf=state.elves.find(elf=>elf.home==='west');
  Object.assign(elf,{room:'homeCrossing',x:800,y:320,wait:0,goal:{x:925,y:320,door:api.dragonDoor('homeCrossing','stone')},path:[{x:925,y:320}]});
  api.updateElves(.1);assert(elf.x>800&&elf.room==='homeCrossing');
  for(let step=0;step<100&&elf.room==='homeCrossing';step++)api.updateElves(.05);
  assert.equal(elf.room,'stone');assert.equal(elf.home,'west');
  assert(api.blocked('stone',elf.x,elf.y));assert(!api.blocked('stone',elf.x,elf.y,elf.home));
  Object.assign(elf,{room:'west',x:725,y:250,wait:0,goal:{x:400,y:250},path:[{x:400,y:250}]});
  for(let step=0;step<30;step++)api.updateElves(.016);
  assert(!api.blocked(elf.room,elf.x,elf.y,elf.home));assert(elf.x>=711);
  assert(state.elves.every(elf=>elf.room!=='south'));
});

test('sad aggressive elves collect either axe, hunt the player, and end the game on a hit', () => {
  for(const id of ['axe','axe2']){
    const { api,element }=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.room='westInside';
    const elf=state.elves[0];state.elves=[elf];state.dragons=[];
    Object.assign(elf,{room:state.room,x:180,y:320,goal:null,path:[],wait:10,emotionalState:{sentiment:1,passion:3}});
    state.items.jewelRed.room='absent';state.items[id==='axe'?'axe2':'axe'].room='held';
    state.items[id]={room:state.room,x:300,y:320};Object.assign(state.player,{x:700,y:320});
    let carried=false,thrown=false;
    for(let step=0;step<500&&state.mode!=='lost';step++){
      api.updateElves(.05);if(elf.carrying===id)carried=true;
      if(state.axeFlights[id]){thrown=true;assert.equal(state.axeFlights[id].thrower,elf.home);}
      api.updateAxe(.05);
    }
    assert(carried);assert(thrown);assert.equal(state.mode,'lost');
    assert.equal(element('overlayTitle').textContent,'GAME OVER');assert(state.message.includes('axe hit you'));assert.equal(state.swallowedBy,null);
  }
});

test('armed elves find a clear throwing angle around dropped items and Mosswood trees', () => {
  for(const obstacle of ['coin','tree']){
    const {api}=loadGame();api.initial('gold');const state=api.state();
    state.mode='playing';state.room='stone';state.dragons=[];
    const elf=state.elves.find(elf=>elf.home==='blackApproach');state.elves=[elf];
    for(const item of Object.values(state.items))item.room='absent';
    const y=obstacle==='tree'?160:320;
    Object.assign(elf,{room:'stone',x:obstacle==='tree'?100:500,y,carrying:'axe5',wait:0,goal:null,path:[],emotionalState:{sentiment:1,passion:3}});
    state.items.axe5={room:'elf:'+elf.home,x:0,y:0};
    Object.assign(state.player,{x:obstacle==='tree'?340:700,y});
    if(obstacle==='coin')state.items.coin={room:'stone',x:600,y:320};
    let thrown=false;
    for(let step=0;step<600&&state.mode!=='lost';step++){
      api.updateElves(.05);
      if(state.axeFlights.axe5)thrown=true;
      api.updateAxe(.01);api.updateAxe(.01);api.updateAxe(.01);api.updateAxe(.01);api.updateAxe(.01);
    }
    assert(thrown,obstacle+' should not leave the elf stuck holding its axe');
    assert.equal(state.mode,'lost',obstacle+' shot should clear the obstacle and reach the player');
    assert(Math.abs(elf.y-y)>5,obstacle+' requires moving to a different throwing angle');
  }
});

test('elf chase personalities choose separate positions and spread out from an overlapping start', () => {
  const {api}=loadGame();api.initial('gold');const state=api.state();
  state.mode='playing';state.room='stone';state.dragons=[];
  for(const item of Object.values(state.items))item.room='absent';
  Object.assign(state.player,{x:700,y:320});
  const axes=['axe2','axe3','axe4','axe5'];
  state.elves.forEach((elf,index)=>{
    Object.assign(elf,{room:'stone',x:180,y:320,carrying:axes[index],wait:0,goal:null,path:[],emotionalState:{sentiment:1,passion:3}});
    state.items[axes[index]]={room:'elf:'+elf.home,x:0,y:0};
  });
  const goals=state.elves.map(()=>null);
  for(let step=0;step<30&&!goals.every(Boolean);step++){
    api.updateElves(.05);
    state.elves.forEach((elf,index)=>{if(!goals[index]&&elf.goal?.firingPosition)goals[index]=elf.goal;});
  }
  assert(goals.every(goal=>goal?.firingPosition));
  for(let i=0;i<goals.length;i++)for(let j=i+1;j<goals.length;j++){
    assert(Math.hypot(goals[i].x-goals[j].x,goals[i].y-goals[j].y)>=75,'chase destinations should be separated');
  }
  assert(new Set(goals.map(goal=>Math.round(Math.hypot(goal.x-700,goal.y-320)))).size>=3,'personalities prefer different distances');
  for(let step=0;step<200;step++)api.updateElves(.05);
  for(let i=0;i<state.elves.length;i++)for(let j=i+1;j<state.elves.length;j++){
    const a=state.elves[i],b=state.elves[j];
    assert(Math.hypot(a.x-b.x,a.y-b.y)>56,'chasing elves should separate their bodies');
  }
  assert(Object.values(state.axeFlights).filter(Boolean).length>=2,'spreading out still allows axe throws');
});

test('blocked chase searches have bounded work per frame and react when the blocker is removed', () => {
  const {api,chaseMetrics}=loadGame(true);api.initial('gold');const state=api.state();
  state.mode='playing';state.room='stone';state.dragons=[];
  for(const item of Object.values(state.items))item.room='absent';
  Object.assign(state.player,{x:700,y:320});state.held='coin';state.heldSide='right';
  state.elves.forEach((elf,index)=>{
    const axe='axe'+(index+2);
    Object.assign(elf,{room:'stone',x:180+index*80,y:320,carrying:axe,wait:0,goal:null,path:[],emotionalState:{sentiment:1,passion:3}});
    state.items[axe]={room:'elf:'+elf.home,x:0,y:0};
  });
  let finishedSearch=false;
  for(let frame=0;frame<180;frame++){
    const before=chaseMetrics.shots;api.updateElves(1/60);
    assert(chaseMetrics.shots-before<=16,'blocked searches must not scan every throwing position in one frame');
    finishedSearch||=state.elves.some(elf=>elf.shotSearch?.done);
  }
  assert(!Object.values(state.axeFlights).some(Boolean));
  assert(finishedSearch,'failed searches finish and cache their result');
  state.held=null;
  for(let frame=0;frame<300&&!Object.values(state.axeFlights).some(Boolean);frame++)api.updateElves(1/60);
  assert(Object.values(state.axeFlights).some(Boolean),'removing the blocker lets the elves throw again');
});

test('angry elves pursue across rooms and stop hunting when their emotions change', () => {
  const { api }=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.room='stone';
  const elf=state.elves[0];state.elves=[elf];state.dragons=[];
  Object.assign(elf,{room:'homeCrossing',x:600,y:320,goal:null,path:[],wait:0,carrying:'axe',emotionalState:{sentiment:1,passion:3}});
  state.items.axe={room:'elf:west',x:0,y:0};Object.assign(state.player,{x:600,y:320});
  for(let step=0;step<200&&elf.room!=='stone';step++)api.updateElves(.05);
  assert.equal(elf.room,'stone');assert(elf.hunting);
  elf.emotionalState.sentiment=2;elf.goal=null;elf.path=[];api.updateElves(.05);assert.equal(elf.hunting,false);
  const flightCount=Object.values(state.axeFlights).filter(Boolean).length;
  api.updateElves(.05);assert.equal(Object.values(state.axeFlights).filter(Boolean).length,flightCount);
});

test('sad disgusted elves go home for their own treasury axe before chasing the player', () => {
  for(const [id,home] of Object.entries({axe2:'west',axe5:'blackApproach'})){
    const {api}=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.room='gold';state.dragons=[];
    const elf=state.elves.find(elf=>elf.home===home);state.elves=[elf];
    Object.assign(elf,{room:'homeCrossing',x:480,y:320,goal:null,path:[],wait:0,emotionalState:{sentiment:1,passion:3}});
    state.items.axe={room:elf.room,x:600,y:320};
    for(let step=0;step<3000&&!elf.carrying;step++)api.updateElves(.05);
    assert.equal(elf.room,home+'Inside',home+' '+JSON.stringify({x:elf.x,y:elf.y,goal:elf.goal,path:elf.path,carrying:elf.carrying}));assert.equal(elf.carrying,id,home+' chooses its own axe over the nearby loose axe');
    assert.equal(elf.emotionalState.sentiment,1);assert.equal(elf.emotionalState.passion,3);
    state.room='stone';Object.assign(state.player,{x:850,y:320});
    Object.assign(elf,{room:'stone',x:150,y:320,goal:null,path:[],wait:0,huntTimer:0});
    for(let step=0;step<20;step++)api.updateElves(.05);
    assert(elf.x>150,home+' pursues the player after arming');
  }
});

test('new gifts interrupt an aggressive elf hunt and bring them home for assessment', () => {
  for(const armed of [false,true]){
    const {api}=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.room='stone';
    const elf=state.elves[0];state.elves=[elf];
    Object.assign(elf,{room:'homeCrossing',x:600,y:320,hunting:true,wait:0,goal:{x:925,y:320},path:[{x:925,y:320}],emotionalState:{sentiment:1,passion:3}});
    if(armed){elf.carrying='axe';state.items.axe.room='elf:west';}
    state.items.coin={room:'westInside',x:245,y:320};api.updateElves(.05);
    assert.equal(elf.hunting,false);assert.equal(elf.giftTask.id,'coin');assert(!elf.carrying);
    if(armed)assert.equal(state.items.axe.room,'homeCrossing');
    for(let step=0;step<1600&&elf.giftsReceived<1;step++)api.updateElves(.05);
    assert.equal(elf.room,'westInside');assert.equal(elf.giftsReceived,1);assert.equal(elf.emotionalState.sentiment,2);
    assert.equal(elf.carrying,null);assert.equal(state.items.coin.room,'westInside');assert.equal(elf.hunting,false);
  }
});

test('aggressive hunting elves move twenty percent above the faster base and think ten percent faster', () => {
  const {api}=loadGame();api.initial('gold');const state=api.state();state.room='gold';
  const elf=state.elves[0];state.elves=[elf];state.items.axe={room:'stone',x:480,y:320};state.items.axe2.room='held';
  Object.assign(elf,{room:'homeCrossing',x:600,y:320,wait:0,goal:null,path:[],emotionalState:{sentiment:1,passion:3}});
  api.updateElves(.1);assert(Math.abs(elf.x-609.438)<1e-8,'aggressive movement is 94.38 pixels per second');
  const timer=elf.huntTimer;api.updateElves(.1);assert(Math.abs(elf.huntTimer-(timer-.11))<1e-8,'decision timer advances ten percent faster');
  elf.stunTimer=30;const x=elf.x;api.updateElves(1);assert.equal(elf.stunTimer,29);assert.equal(elf.x,x,'knockout duration stays unchanged');
});

test('Disgusted elves move twenty percent faster and Sad alone does not change speed', () => {
  const {api}=loadGame();api.initial('gold');const state=api.state();state.room='gold';
  const elf=state.elves[0];state.elves=[elf];
  for(const [sentiment,passion,speed] of [[3,1,78.65],[2,2,78.65],[1,2,78.65],[3,3,94.38],[2,3,94.38],[1,3,94.38]]){
    Object.assign(elf,{room:'stone',x:300,y:320,wait:0,goal:{x:600,y:320,clearDoorway:true},path:[{x:600,y:320}],emotionalState:{sentiment,passion}});
    api.updateElves(.1);assert(Math.abs(elf.x-(300+speed*.1))<1e-8,`${sentiment},${passion} moves at ${speed}`);
  }
});

test('hunting elves reuse routes and immediately react when their target axe is claimed', () => {
  const {api}=loadGame();api.initial('gold');const state=api.state();state.room='gold';state.mode='playing';
  const elf=state.elves[0];state.elves=[elf];
  for(const id of ['axe3','axe4','axe5'])state.items[id].room='absent';
  Object.assign(elf,{room:'homeCrossing',x:600,y:320,wait:0,goal:null,path:[],emotionalState:{sentiment:1,passion:3}});
  state.items.axe={room:'stone',x:480,y:320};state.items.axe2.room='held';
  api.updateElves(.016);const goal=elf.goal,path=elf.path,routes=state.elfRoomRoutes;
  assert(goal?.door);assert(routes.size>0);
  for(let step=0;step<8;step++)api.updateElves(.016);
  assert.equal(elf.goal,goal);assert.equal(elf.path,path);assert.equal(state.elfRoomRoutes,routes);
  state.items.axe.room='held';api.updateElves(.016);assert.equal(elf.goal,null);assert.equal(elf.path.length,0);
  api.initial('gold');assert.equal(api.state().elfRoomRoutes,undefined,'new quest clears cached room routes');
});

test('sad aggressive elves find axes in other rooms', () => {
  const { api }=loadGame();api.initial('gold');const state=api.state();state.room='stone';state.mode='playing';
  const elf=state.elves[0];state.elves=[elf];
  Object.assign(elf,{room:'homeCrossing',x:600,y:320,goal:null,path:[],wait:0,emotionalState:{sentiment:1,passion:3}});
  state.items.axe={room:'stone',x:480,y:320};state.items.axe2.room='held';Object.assign(state.player,{x:700,y:320});
  for(let step=0;step<1000&&elf.carrying!=='axe';step++)api.updateElves(.05);
  assert.equal(elf.room,'stone');assert.equal(elf.carrying,'axe');
});

test('knocked-out aggressive elves wait to recover before seeking an axe', () => {
  const { api }=loadGame();api.initial('gold');const state=api.state();state.room='westInside';
  const elf=state.elves[0];state.elves=[elf];Object.assign(elf,{room:state.room,x:245,y:320,stunTimer:30,emotionalState:{sentiment:1,passion:3}});
  state.items.axe2.room='held';
  state.items.axe={room:state.room,x:300,y:320,elfAssessment:{home:'west',x:300,y:320}};
  api.updateElves(29.9);assert(!elf.carrying);assert.equal(elf.x,245);
  api.updateElves(.1);assert.equal(elf.carrying,'axe');
});

test('elves clear doorways immediately after crossing or finding a blocked entrance', () => {
  for(const [from,to] of [['homeCrossing','stone'],['westInside','west'],['west','westInside']]){
    const { api }=loadGame();api.initial('gold');const state=api.state();state.room='gold';
    state.items.apple2.room='absent';
    const elf=state.elves[0];state.elves=[elf];const door=api.dragonDoor(from,to);
    Object.assign(elf,{room:from,...door.exit,goal:{...door.exit,door},path:[],wait:0});
    api.updateElves(.05);assert.equal(elf.room,to);assert.equal(elf.wait,0);assert(elf.goal.clearDoorway);
    for(let step=0;step<100&&elf.goal?.clearDoorway;step++)api.updateElves(.05);
    assert(!elf.goal?.clearDoorway,'elf walks away from doorway before pausing');
    assert(Math.hypot(elf.x-door.entry.x,elf.y-door.entry.y)>95);
  }
  const { api }=loadGame();api.initial('gold');const state=api.state();state.room='stone';
  state.items.apple2.room='absent';
  Object.assign(state.player,{x:35,y:320});const elf=state.elves[0];state.elves=[elf];
  const door=api.dragonDoor('homeCrossing','stone');
  Object.assign(elf,{room:'homeCrossing',...door.exit,goal:{...door.exit,door},path:[],wait:0});
  api.updateElves(.05);assert.equal(elf.room,'homeCrossing');assert.equal(elf.wait,0);assert(elf.goal.clearDoorway);
  const x=elf.x;api.updateElves(.1);assert(elf.x<x,'elf steps aside from blocked entrance');
});

test('elves recover from tight wall-corner approaches in Blue Maze and Blue Vault', () => {
  for(const [home,room,x,y,goal] of [
    ['blueGate','blueMaze',577.3285839999294,420.61071533332745,{x:332.35046503599733,y:403.7123700603843}],
    ['blackApproach','blueVault',578.1232442477652,420.0004819725076,{x:480,y:585}]
  ]){
    const {api}=loadGame();api.initial('gold');const state=api.state();state.room='gold';
    const elf=state.elves.find(elf=>elf.home===home);state.elves=[elf];
    Object.assign(elf,{room,x,y,wait:0,goal,path:[{x:570,y:420},goal]});
    let moved=false;
    for(let step=0;step<120;step++){
      api.updateElves(.05);assert(!api.blocked(elf.room,elf.x,elf.y,elf.home),'elf stays out of walls');
      if(Math.hypot(elf.x-x,elf.y-y)>35)moved=true;
    }
    assert(moved,`${home} gets around the wall corner in ${room}`);
  }
});

test('elves pick up axes on the side facing the player and throw from that same position', () => {
  for(const [playerX,side,offset] of [[250,'left',-51.5],[710,'right',54.5]]){
    const {api}=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.room='stone';
    const elf=state.elves[0];state.elves=[elf];
    Object.assign(state.player,{x:playerX,y:320});
    Object.assign(elf,{room:'stone',x:480,y:320,wait:0,goal:null,path:[],emotionalState:{sentiment:1,passion:3}});
    state.items.axe2={room:'stone',x:480,y:380};
    api.updateElves(.01);assert.equal(elf.carrying,'axe2');assert.equal(elf.axeSide,side);
    const start=api.itemPosition('axe2');assert.equal(start.x,elf.x+offset);assert.equal(start.y,elf.y);
    elf.huntTimer=0;api.updateElves(.01);
    assert(state.axeFlights.axe2);assert.equal(elf.carrying,null);
    assert.equal(state.items.axe2.x,start.x);assert.equal(state.items.axe2.y,start.y);
  }
});

test('elves ignore loose gifts while roaming even when a liked object is close or moves', () => {
  for(const home of ['west','blueGate','redTrail','blackApproach']){
    const {api}=loadGame();api.initial('gold');const state=api.state();state.room='gold';
    const elf=state.elves.find(elf=>elf.home===home);state.elves=[elf];
    const goal={x:600,y:320};Object.assign(elf,{room:'stone',x:480,y:320,wait:0,goal,path:[goal]});
    for(const id of ['apple','coin','flower','flute'])state.items[id]={room:'stone',x:480,y:370};
    api.updateElves(.05);assert.equal(elf.goal,goal);assert(!elf.giftTask);assert(!elf.carrying);
    state.items.apple.x=elf.x;state.items.apple.y=elf.y+60;
    api.updateElves(.05);assert(!elf.giftTask);assert(!elf.carrying);
    for(const id of ['apple','coin','flower','flute'])assert.equal(state.items[id].room,'stone');
  }
});


test('elves arrange liked gifts in separate treasure boxes', () => {
  const {api}=loadGame();api.initial('gold');const state=api.state();state.room='gold';
  const elf=state.elves[0];state.elves=[elf];const boxes=new Set();
  for(const id of ['coin','flower','flute']){
    Object.assign(elf,{room:'westInside',x:305,y:320,goal:null,path:[],wait:0});
    state.items[id]={room:'westInside',x:245,y:320};api.updateElves(.05);
    for(let step=0;step<2000&&elf.giftTask;step++)api.updateElves(.05);
    assert.equal(elf.giftTask,null);const item=state.items[id];
    assert.equal(item.room,'westInside');assert([625,715,805].includes(item.x));assert([265,340].includes(item.y));
    boxes.add(item.x+','+item.y);
  }
  assert.equal(boxes.size,3,'gifts occupy distinct boxes');
  assert.equal(state.items.jewelRed.x,800);assert.equal(state.items.jewelRed.y,415);
});

test('elves tidy moved treasures without counting another gift or changing their emotions', () => {
  const {api}=loadGame();api.initial('gold');const state=api.state();state.room='gold';
  const elf=state.elves[0];state.elves=[elf];Object.assign(elf,{room:'westInside',x:650,y:300,goal:null,path:[],wait:0});
  state.items.coin={room:'westInside',x:700,y:300,treasureOwner:'west',elfAssessment:{home:'west',x:650,y:265}};
  const emotions={...elf.emotionalState},count=elf.giftsReceived;api.updateElves(.05);assert(elf.giftTask.tidy);
  for(let step=0;step<2000&&elf.giftTask;step++)api.updateElves(.05);
  assert.equal(elf.giftTask,null);assert.equal(state.items.coin.x,650);assert.equal(state.items.coin.y,265);
  assert.equal(state.items.coin.treasureOwner,'west');assert.equal(elf.giftsReceived,count);assert.deepEqual({...elf.emotionalState},emotions);
});

test('extra liked gifts are assessed but only one of each kind is kept in treasures', () => {
  const {api}=loadGame();api.initial('gold');const state=api.state();state.room='gold';
  const elf=state.elves[0];state.elves=[elf];Object.assign(elf,{room:'westInside',x:305,y:320,wait:0,goal:null,path:[]});
  state.items.coin={room:'westInside',x:650,y:300,treasureOwner:'west',elfAssessment:{home:'west',x:650,y:300}};
  state.items.coin2={room:'westInside',x:245,y:320};api.updateElves(.05);
  assert.equal(elf.carrying,'coin2');assert(elf.giftTask.excess);assert.equal(elf.giftsReceived,0);
  for(let step=0;step<3000&&elf.giftTask;step++)api.updateElves(.05);
  assert.equal(elf.giftTask,null);assert.equal(elf.giftsReceived,1);assert.equal(state.items.coin.room,'westInside');assert.equal(state.items.coin2.room,'crossroads');
});

test('elves stop for loose objects and reroute around them without affecting player pickup', () => {
  const { api }=loadGame();api.initial('gold');const state=api.state();
  const elf=state.elves[1];for(const other of state.elves)other.wait=1000;
  Object.assign(elf,{room:'westInside',x:300,y:320,wait:0,goal:{x:650,y:320},path:[{x:650,y:320}]});
  state.items.apple={room:'westInside',x:480,y:320};
  assert(api.blocked('westInside',480,320,elf.home));
  assert(!api.blocked('westInside',480,320,true));
  let wentAround=false,reached=false;
  for(let step=0;step<260;step++){
    api.updateElves(.05);
    assert(!(Math.abs(elf.x-480)<45&&Math.abs(elf.y-320)<45));
    if(Math.abs(elf.y-320)>45)wentAround=true;
    if(elf.x>630){reached=true;break;}
  }
  assert(wentAround);assert(reached);assert.equal(state.items.apple.x,480);
  state.placedBridges.bridge={room:'westInside',x:650,y:400,vertical:true};
  assert(api.blocked('westInside',590,400,elf.home));
  assert(!api.blocked('westInside',650,520,elf.home));
});

test('axe hits freeze elves for a 0.4-second surprise followed by twenty seconds knocked out', () => {
  for(const id of ['axe','axe2']){
    const { api }=loadGame();api.initial('gold');const state=api.state();state.room='westInside';
    const elf=state.elves[0];state.elves=[elf];
    Object.assign(elf,{room:state.room,x:480,y:320,wait:0,goal:{x:650,y:320},path:[{x:650,y:320}]});
    elf.emotionalState={sentiment:3,passion:3};
    Object.assign(state.player,{x:300,y:500});
    state.items[id]={room:state.room,x:350,y:320};
    state.axeFlights[id]={room:state.room,vx:650,vy:0,age:0,travelled:0};
    api.updateAxe(.4);assert.equal(state.axeFlights[id],null);
    assert.equal(elf.surpriseTimer,.4);assert.equal(elf.stunTimer,20);
    assert.equal(elf.emotionalState.sentiment,1);assert.equal(elf.emotionalState.passion,3);
    for(const dt of [.2,.2,10,9.9]){
      api.updateElves(dt);assert.equal(elf.x,480);assert.equal(elf.y,320);assert.equal(elf.room,'westInside');
    }
    assert.equal(elf.surpriseTimer,0);assert(Math.abs(elf.stunTimer-.1)<1e-8);
    api.updateElves(.1);assert.equal(elf.stunTimer,0);
    assert.equal(elf.emotionalState.sentiment,1);assert.equal(elf.emotionalState.passion,3);
  }
});

test('either axe pauses a dragon for 0.4 seconds, then movement resumes', () => {
  for(const id of ['axe','axe2']){
    const {api}=loadGame();api.initial('gold');const state=api.state();
    state.mode='playing';state.room='westInside';state.elves=[];
    Object.assign(state.player,{x:700,y:320});
    const dragon=state.dragons[0];state.dragons=[dragon];
    Object.assign(dragon,{room:state.room,x:480,y:320,speed:100});
    state.items[id]={room:state.room,x:350,y:320};
    state.axeFlights[id]={room:state.room,vx:650,vy:0,age:0,travelled:0};
    api.updateAxe(.4);assert.equal(state.axeFlights[id],null);
    assert.equal(dragon.axePauseTimer,.4);assert.equal(dragon.dead,false);
    for(const dt of [.2,.2]){api.updateDragons(dt);assert.equal(dragon.x,480);assert.equal(dragon.y,320);}
    assert.equal(dragon.axePauseTimer,0);
    api.updateDragons(.1);assert(dragon.x>480);
  }
});

test('an axe pause freezes a dragon bite and preserves time remaining after recovery', () => {
  const {api}=loadGame();api.initial('gold');const state=api.state();
  state.mode='playing';state.room='westInside';state.elves=[];
  Object.assign(state.player,{x:480,y:335});
  const dragon=state.dragons[0];state.dragons=[dragon];
  Object.assign(dragon,{room:state.room,x:480,y:320,biting:true,biteTimer:.3,axePauseTimer:.4});
  api.updateDragons(.2);assert.equal(dragon.biteTimer,.3);assert.equal(state.mode,'playing');
  api.updateDragons(.3);assert(Math.abs(dragon.biteTimer-.2)<1e-8);assert.equal(state.mode,'playing');
});

test('players can steal carried items only while an elf is knocked out', () => {
  const { api }=loadGame();api.initial('gold');const state=api.state();state.room='westInside';state.mode='playing';
  const elf=state.elves[0];state.elves=[elf];
  Object.assign(elf,{room:state.room,x:480,y:320,carrying:'apple',giftTask:{id:'apple',feeling:'likes'}});
  state.items.apple={room:'elf:west',x:245,y:320};Object.assign(state.player,{x:480,y:385});
  api.pickup();assert.equal(state.held,null);assert.equal(elf.carrying,'apple');
  elf.surpriseTimer=.5;elf.stunTimer=30;
  api.pickup();assert.equal(state.held,null);
  api.updateElves(.5);api.pickup();assert.equal(state.held,'apple');assert.equal(state.items.apple.room,'held');
  assert.equal(elf.carrying,null);assert.equal(elf.giftTask,null);
  assert.equal(elf.emotionalState.sentiment,2);assert.equal(elf.emotionalState.passion,2);
  api.updateElves(29.9);assert.equal(elf.x,480);assert.equal(elf.y,320);assert.equal(state.held,'apple');
});

test('elf pickup and drop sounds are thirty percent of player volume', () => {
  const {api,element,sounds}=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.room='crossroads';
  const elf=state.elves[0];state.elves=[elf];Object.assign(elf,{room:'westInside',x:305,y:320,wait:0,goal:null,path:[]});
  state.items.apple={room:'westInside',x:245,y:320};api.updateElves(.05);
  const pickup=sounds.find(sound=>sound.src==='assets/pick-up.mp3'),drop=sounds.find(sound=>sound.src==='assets/drop.mp3');
  assert.equal(pickup.volume,.3);
  Object.assign(state.player,{x:state.items.coin.x,y:state.items.coin.y});api.pickup();assert.equal(state.held,'coin');assert.equal(pickup.volume,1);
  element('dropBtn').onclick();assert.equal(drop.volume,1);
  for(let step=0;step<1000&&elf.giftTask;step++)api.updateElves(.05);
  assert.equal(elf.giftTask,null);assert.equal(drop.volume,.3);
});

test('happy elves pause for one second before sharing their jewel', () => {
  const {api}=loadGame();api.initial('gold');const state=api.state();state.room='gold';
  const elf=state.elves[0];state.elves=[elf];
  Object.assign(elf,{room:'westInside',x:730,y:415,wait:0,goal:null,path:[],emotionalState:{sentiment:3,passion:1}});
  api.updateElves(.1);assert(elf.giftTask.offering);assert(!elf.carrying);assert.equal(elf.x,730);assert.equal(elf.y,415);
  api.updateElves(.89);assert(!elf.carrying);assert.equal(elf.x,730);assert.equal(elf.y,415);
  api.updateElves(.01);assert.equal(elf.carrying,'jewelRed');assert.equal(elf.giftTask.sharePause,0);
});

test('two gifts make each elf Passive, earn trust, and trigger a jewel offering', () => {
  for(const [id,home] of Object.entries({jewelRed:'west',jewelPurple:'blackApproach',jewel:'redTrail',jewelGreen:'blueGate'})){
    const { api }=loadGame();api.initial('gold');const state=api.state();state.room='gold';
    const elf=state.elves.find(elf=>elf.home===home);state.elves=[elf];
    Object.assign(elf,{room:home+'Inside',x:305,y:320,goal:null,path:[],wait:0});
    assert.equal(elf.giftsReceived,0);assert.equal(elf.trusted,false);
    state.items.apple={room:elf.room,x:245,y:320};api.updateElves(.05);
    assert.equal(elf.giftsReceived,home==='west'?1:0);assert.equal(elf.trusted,false);
    assert.equal(elf.emotionalState.passion,2);
    for(let step=0;step<1000&&elf.giftTask;step++)api.updateElves(.05);
    assert.equal(state.items[id].x,800);assert.equal(elf.giftsReceived,1);
    state.items[home==='blueGate'?'flower':'coin']={room:home+'Inside',x:245,y:320};
    for(let step=0;step<2000&&!(state.items[id].x<=395);step++)api.updateElves(.05);
    const jewel=state.items[id];assert(jewel.x>=95&&jewel.x<=395);assert.equal(jewel.room,home+'Inside');
    assert.equal(elf.giftsReceived,2);assert.equal(elf.trusted,true);assert.equal(elf.emotionalState.passion,1);
  }
});

test('each elf leaving Trust carries its shared jewel back into the protected corner', () => {
  for(const [id,home] of Object.entries({jewelRed:'west',jewelPurple:'blackApproach',jewel:'redTrail',jewelGreen:'blueGate'})){
    const {api}=loadGame();api.initial('gold');const state=api.state();state.room='gold';
    const elf=state.elves.find(elf=>elf.home===home);state.elves=[elf];
    Object.assign(elf,{room:home+'Inside',x:305,y:320,goal:null,path:[],wait:0,trusted:true,giftsReceived:2,emotionalState:{sentiment:2,passion:1}});
    state.items[id]={room:elf.room,x:245,y:320,elfAssessment:{home,x:245,y:320}};
    api.updateElves(.01);elf.emotionalState.passion=2;
    for(let step=0;step<2000&&!(state.items[id].x>=750&&state.items[id].room===elf.room);step++)api.updateElves(.05);
    const jewel=state.items[id];assert.equal(jewel.room,home+'Inside');
    assert(jewel.x>=750&&jewel.x<=850&&jewel.y>=365&&jewel.y<=465);
    assert.equal(elf.carrying,null);assert.equal(elf.giftsReceived,2);assert.equal(elf.emotionalState.passion,2);
    assert(api.blocked(jewel.room,jewel.x,jewel.y),'returned jewel is protected');
    for(let step=0;step<20;step++)api.updateElves(.05);
    assert.equal(state.items[id].x,jewel.x,'past trust does not immediately trigger another offering');
  }
});

test('an elf leaving Trust waits for recovery and does not reclaim carried jewels', () => {
  const {api}=loadGame();api.initial('gold');const state=api.state();state.room='gold';
  const elf=state.elves[0];state.elves=[elf];
  Object.assign(elf,{room:'westInside',x:305,y:320,goal:null,path:[],wait:0,trusted:true,emotionalState:{sentiment:2,passion:1}});
  state.items.jewelRed={room:'held',x:245,y:320};state.held='jewelRed';
  api.updateElves(.01);elf.emotionalState.passion=2;api.updateElves(.05);
  assert.equal(state.items.jewelRed.room,'held');assert.notEqual(elf.carrying,'jewelRed');
  state.held=null;state.items.jewelRed={room:'westInside',x:245,y:320,elfAssessment:{home:'west',x:245,y:320}};
  elf.stunTimer=1;const x=elf.x;api.updateElves(.5);
  assert.equal(elf.x,x);assert.equal(state.items.jewelRed.x,245);
  for(let step=0;step<2000&&state.items.jewelRed.x<750;step++)api.updateElves(.05);
  assert(state.items.jewelRed.x>=750);assert.equal(state.items.jewelRed.room,'westInside');
});

test('jewel protection blocks the cursor and allows escape if it returns around the player', () => {
  const { api,window }=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.room='westInside';
  const elf=state.elves[0];Object.assign(state.player,{x:750,y:415});window.joystickInput={x:1,y:0};
  for(let step=0;step<10;step++)api.movePlayer(.01);
  assert(state.player.x<=755,'cursor stops at glow');assert(api.blocked(state.room,800,415,true));
  elf.stunTimer=30;
  assert(!api.blocked(state.room,800,415,true));
  for(let step=0;step<15;step++)api.movePlayer(.01);
  assert(state.player.x>780,'cursor can enter while owner is unconscious');
  elf.stunTimer=0;
  for(let step=0;step<30;step++)api.movePlayer(.01);
  assert(state.player.x>=845,'cursor can escape a reactivated field');
});

test('knocked-out elves lose jewel protection until they recover', () => {
  for(const [id,home] of Object.entries({jewelRed:'west',jewelPurple:'blackApproach',jewel:'redTrail',jewelGreen:'blueGate'})){
    const { api }=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.room=home+'Inside';
    const elf=state.elves.find(elf=>elf.home===home);
    Object.assign(state.player,{x:730,y:415});assert(!api.blocked(state.room,730,415,true));
    api.pickup();assert.equal(state.held,null,'awake elf protects jewel');
    elf.stunTimer=30;elf.surpriseTimer=.5;api.pickup();assert.equal(state.held,null,'surprise phase still protects jewel');
    elf.surpriseTimer=0;elf.stunTimer=0;api.pickup();assert.equal(state.held,null,'recovery restores protection');
    elf.stunTimer=30;api.pickup();assert.equal(state.held,id,'jewel can be reached from outside the corner while unconscious');
    assert.equal(elf.emotionalState.sentiment,2);assert.equal(elf.emotionalState.passion,2,'penalty waits until treasure leaves area');
    state.player.x=500;api.updateTreasureRemoval();assert.equal(elf.emotionalState.sentiment,1);assert.equal(elf.emotionalState.passion,2);
  }
});

test('jewels have mental protection without corner walls until happy passive elves offer them as gifts', () => {
  for(const [id,home] of Object.entries({jewelRed:'west',jewelPurple:'blackApproach',jewel:'redTrail',jewelGreen:'blueGate'})){
    const { api }=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.room=home+'Inside';
    const elf=state.elves.find(elf=>elf.home===home);state.elves=[elf];
    assert(!api.blocked(state.room,755,415,true));assert(api.blocked(state.room,800,370,true));
    assert(!api.blocked(state.room,845,415,true));assert(api.blocked(state.room,800,460,true));
    Object.assign(state.player,{x:800,y:415});api.pickup();assert.equal(state.held,null,'protected jewel cannot be grabbed even at its center');
    state.room='gold';Object.assign(elf,{room:home+'Inside',x:650,y:320,wait:0,goal:null,path:[],emotionalState:{sentiment:3,passion:1}});
    let carried=false,delivered=false;
    for(let step=0;step<1000;step++){
      api.updateElves(.05);api.updateTreasureRemoval();
      if(elf.carrying===id)carried=true;
      if(carried&&!elf.giftTask){delivered=true;break;}
    }
    assert(carried);assert(delivered);const item=state.items[id];
    assert.equal(item.room,home+'Inside');assert(item.x>=95&&item.x<=395&&item.y>=135&&item.y<=485);
    assert.equal(elf.emotionalState.sentiment,3);assert.equal(elf.emotionalState.passion,1);
    state.room=item.room;Object.assign(state.player,{x:item.x,y:item.y});state.pickupDelay=0;
    api.pickup();assert.equal(state.held,id,'offered jewel is available to the player');
    assert.equal(elf.emotionalState.sentiment,3);assert.equal(elf.emotionalState.passion,1);
  }
});

test('each elf starts with their matching jewel in their treasure area', () => {
  const { api }=loadGame();api.initial('gold');const state=api.state();
  for(const [id,home] of Object.entries({jewelRed:'west',jewelPurple:'blackApproach',jewel:'redTrail',jewelGreen:'blueGate'})){
    const item=state.items[id];assert.equal(item.room,home+'Inside');assert.equal(item.treasureOwner,home);
    assert(item.x>=565&&item.x<=865&&item.y>=135&&item.y<=485);assert(api.blocked(item.room,item.x,item.y));
    const elf=state.elves.find(elf=>elf.home===home);api.updateElves(.1);
    assert(!elf.giftTask,'starting treasure is already assessed');assert.equal(elf.emotionalState.sentiment,2);
  }
  assert.equal(state.items.jewelOrange.room,'whiteInside');assert.equal(state.items.jewelGold.room,'blackDungeon');
});

test('Amber starts inside White Castle and Citrine and Vesper start in the second black castle room', () => {
  const {api}=loadGame();
  for(const mode of ['gold','easy','random']){
    api.initial(mode);const state=api.state(),secondRoom=mode==='easy'?'nightfallInside':'blackDungeon';
    assert.equal(state.items.jewelOrange.room,'whiteInside');
    assert.equal(state.items.jewelGold.room,secondRoom);
    const vesper=state.dragons.filter(dragon=>dragon.name==='Vesper');
    assert.equal(vesper.length,1);assert.equal(vesper[0].room,secondRoom);
    for(const pos of [state.items.jewelOrange,state.items.jewelGold,vesper[0]])assert(!api.blocked(pos.room,pos.x,pos.y,true));
    assert(Math.hypot(vesper[0].x-state.items.jewelGold.x,vesper[0].y-state.items.jewelGold.y)>80);
    assert.equal(api.neighbor(secondRoom,api.dir.down),'blackInside');
  }
});

test('treasures count as taken only when moved outside their treasure area', () => {
  for(const home of ['west','blueGate','redTrail','blackApproach']){
    const { api }=loadGame();api.initial('gold');const state=api.state();
    state.mode='playing';state.room=home+'Inside';
    const elf=state.elves.find(elf=>elf.home===home),others=state.elves.filter(other=>other!==elf);
    Object.assign(state.player,{x:715,y:320});
    state.items.apple={room:state.room,x:715,y:320,treasureOwner:home};
    api.pickup();assert.equal(state.held,'apple');
    assert.equal(elf.emotionalState.sentiment,2);assert.equal(elf.emotionalState.passion,2);
    state.player.x=680;api.updateTreasureRemoval();
    assert.equal(elf.emotionalState.sentiment,2);assert.equal(elf.emotionalState.passion,2);
    state.player.x=500;api.updateTreasureRemoval();
    assert.equal(elf.emotionalState.sentiment,1);assert.equal(elf.emotionalState.passion,2);
    assert(others.every(other=>other.emotionalState.sentiment===2&&other.emotionalState.passion===2));
    api.pickup();assert.equal(elf.emotionalState.sentiment,1);assert.equal(elf.emotionalState.passion,2);
    state.held=null;state.pickupDelay=0;state.player.x=715;state.items.coin={room:state.room,x:715,y:320};
    api.pickup();assert.equal(state.held,'coin');assert.equal(elf.emotionalState.sentiment,1);assert.equal(elf.emotionalState.passion,2);
    elf.emotionalState={sentiment:2,passion:2};state.held=null;state.pickupDelay=0;
    state.items.coin.room=state.room;
    Object.assign(state.player,{x:245,y:320});state.items.flower={room:state.room,x:245,y:320};
    api.pickup();assert.equal(state.held,'flower');assert.equal(elf.emotionalState.sentiment,2);assert.equal(elf.emotionalState.passion,2);
  }
});

test('treasure theft preserves Trust, Neutral, and Disgust attitudes', () => {
  for(const passion of [1,2,3]){
    const {api}=loadGame();api.initial('gold');const state=api.state(),elf=state.elves[0];
    elf.emotionalState={sentiment:3,passion};state.room='westInside';Object.assign(state.player,{x:500,y:320});
    state.held='apple';state.items.apple={room:'held',x:500,y:320,treasureOwner:'west'};
    api.updateTreasureRemoval();assert.equal(elf.emotionalState.sentiment,2);assert.equal(elf.emotionalState.passion,passion);
    assert(!state.message.includes('gained'));api.updateTreasureRemoval();assert.equal(elf.emotionalState.sentiment,2);
  }
});

test('dropping a treasure inside its area is harmless, but leaving the room with it counts', () => {
  const { api,element }=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.room='westInside';
  state.items.jewelRed={room:state.room,x:715,y:320,treasureOwner:'west'};
  const elf=state.elves[0];Object.assign(state.player,{x:715,y:320});
  api.pickup();assert.equal(state.held,'jewelRed');
  element('dropBtn').onclick();api.updateTreasureRemoval();
  assert.equal(elf.emotionalState.sentiment,2);assert.equal(elf.emotionalState.passion,2);
  const item=state.items.jewelRed;state.player.x=item.x;state.player.y=item.y;state.pickupDelay=0;
  api.pickup();assert.equal(state.held,'jewelRed');state.room='crossroads';api.updateTreasureRemoval();
  assert.equal(elf.emotionalState.sentiment,1);assert.equal(elf.emotionalState.passion,2);
  api.updateTreasureRemoval();assert.equal(elf.emotionalState.sentiment,1);assert.equal(elf.emotionalState.passion,2);
});

test('elf emotions start neutral and gift sentiment stays within one to three', () => {
  const { api }=loadGame();api.initial('gold');const state=api.state();state.room='gold';
  state.items.jewelRed.room='absent';
  for(const elf of state.elves){assert.equal(elf.emotionalState.sentiment,2);assert.equal(elf.emotionalState.passion,2);}
  const elf=state.elves[0];state.elves=[elf];
  for(const [id,expected] of [['flower',3],['coin',3],['apple',2],['apple',1],['apple',1],['jewel',1],['flower',2]]){
    Object.assign(elf,{room:'westInside',x:305,y:320,goal:null,path:[],wait:0});
    state.items[id]={room:'westInside',x:245,y:320};
    const previous={...elf.emotionalState};api.updateElves(.05);
    if(id==='apple')assert.equal(elf.emotionalState.sentiment,expected,'hated gift changes emotions on pickup');
    else assert.deepEqual({...elf.emotionalState},previous,'emotions stay unchanged while carrying '+id);
    for(let step=0;step<4000&&elf.giftTask;step++)api.updateElves(.05);
    assert.equal(elf.giftTask,null);assert.equal(elf.emotionalState.sentiment,expected,'gift counts only once');assert.equal(elf.emotionalState.passion,elf.giftsReceived>=2?1:2);
  }
});

test('every elf reacts to a hated gift on pickup and does not react again when discarding it', () => {
  for(const [home,id] of Object.entries({west:'apple',blueGate:'coin',redTrail:'flower',blackApproach:'flute'})){
    const {api}=loadGame();api.initial('gold');const state=api.state();state.room='gold';
    const elf=state.elves.find(elf=>elf.home===home);state.elves=[elf];
    Object.assign(elf,{room:home+'Inside',x:305,y:320,goal:null,path:[],wait:0});
    state.items[id]={room:elf.room,x:245,y:320};api.updateElves(.05);
    assert.equal(elf.carrying,id);assert.equal(elf.emotionalState.sentiment,1);assert.equal(elf.giftsReceived,1);
    assert.equal(elf.giftTask.reactionApplied,true);
    for(let step=0;step<4000&&elf.giftTask;step++)api.updateElves(.05);
    assert.equal(elf.giftTask,null);assert.equal(elf.emotionalState.sentiment,1);assert.equal(elf.giftsReceived,1);
    assert.equal(elf.emotionalState.passion,2);
  }
});

test('elves carry liked gifts to treasures and hated gifts to the nearest room outside their home', () => {
  const preferences={west:{apple:false,coin:true,flower:true,flute:true},blueGate:{apple:true,coin:false,flower:true,flute:true},redTrail:{apple:true,coin:true,flower:false,flute:true},blackApproach:{apple:true,coin:true,flower:true,flute:false}};
  for(const [home,gifts] of Object.entries(preferences))for(const [id,liked] of Object.entries(gifts)){
    const { api }=loadGame();api.initial('gold');const state=api.state();state.room='gold';
    const elf=state.elves.find(elf=>elf.home===home);state.elves=[elf];
    Object.assign(elf,{room:home+'Inside',x:350,y:320,wait:0,goal:null,path:[]});
    state.items[id]={room:home+'Inside',x:245,y:320};
    let carried=false,delivered=false;
    for(let step=0;step<4000;step++){
      api.updateElves(.05);
      if(elf.carrying===id)carried=true;
      if((carried||liked===null)&&!elf.giftTask){delivered=true;break;}
    }
    assert.equal(carried,liked!==null,`${home} only carries liked or hated gifts`);assert(delivered,`${home} assesses ${id}`);
    const discardRoom=['west','redTrail'].includes(home)?'homeCrossing':'blueVault';
    const item=state.items[id];assert.equal(item.room,liked!==false?home+'Inside':discardRoom);
    if(liked===false)assert(!api.blocked(item.room,item.x,item.y,true),'discarded gift is on accessible floor');
    if(liked===null){assert.equal(item.x,245);assert.equal(item.y,320);assert.equal(elf.emotionalState.sentiment,2);}
    if(liked)assert(item.x>=565&&item.x<=865&&item.y>=135&&item.y<=485);
    assert(elf.carrying==null);
  }
});

test('elves begin gift deliveries even when the player overlaps them', () => {
  const {api,chaseMetrics}=loadGame(true);api.initial('gold');const state=api.state();state.room='westInside';
  const elf=state.elves[0];state.elves=[elf];
  Object.assign(elf,{room:state.room,x:480,y:320,goal:null,path:[],wait:0});
  Object.assign(state.player,{x:480,y:320});state.items.apple={room:state.room,x:245,y:320};
  for(let i=0;i<30;i++)api.updateElves(1/60);
  assert(chaseMetrics.routes<=8,'blocked gift does not trigger four searches every frame');
  assert(elf.goal,'overlapping player does not block delivery');
  assert(elf.x<480,'elf moves toward the gift');
  assert(!elf.giftTask.retryTimer,'delivery does not wait for player contact to clear');
});

test('roaming elves return for gifts and resume deliveries after being stunned', () => {
  const { api }=loadGame();api.initial('gold');const state=api.state();state.room='gold';
  const elf=state.elves.find(elf=>elf.home==='west');state.elves=[elf];
  Object.assign(elf,{room:'stone',x:480,y:320,wait:0,goal:null,path:[]});
  state.items.apple={room:'westInside',x:245,y:320};
  for(let step=0;step<4000&&!elf.carrying;step++)api.updateElves(.05);
  assert.equal(elf.carrying,'apple');assert.equal(elf.room,'westInside');
  const {x,y}=elf;elf.stunTimer=30;
  api.updateElves(29);assert.equal(elf.x,x);assert.equal(elf.y,y);assert.equal(elf.carrying,'apple');
  api.updateElves(1);
  for(let step=0;step<1000&&elf.giftTask;step++)api.updateElves(.05);
  assert.equal(elf.giftTask,null);assert.equal(state.items.apple.room,'homeCrossing');
  state.items.flute={room:'westInside',x:245,y:320};api.updateElves(.05);
  assert.equal(elf.giftTask.id,'flute');
  state.items.flute.room='held';state.held='flute';api.updateElves(.05);
  assert.equal(elf.giftTask,null);assert.equal(state.held,'flute');assert.equal(state.items.flute.room,'held');
});

test('elves return home to assess gifts anywhere inside, then leave assessed treasures alone', () => {
  for(const [id,x,y] of [['apple',480,430],['flute',720,320],['jewel',480,250]]){
    const { api }=loadGame();api.initial('gold');const state=api.state();state.room='gold';
    const elf=state.elves[0];state.elves=[elf];
    Object.assign(elf,{room:'stone',x:480,y:320,wait:100,goal:{x:800,y:320},path:[{x:800,y:320}]});
    state.items[id]={room:'westInside',x,y};api.updateElves(.05);
    assert.equal(elf.giftTask.id,id);assert(elf.wait<1,'gift overrides roaming wait');
    let finished=false;
    for(let step=0;step<5000;step++){
      api.updateElves(.05);
      if(!elf.giftTask){finished=true;break;}
    }
    assert(finished,`${id} assessment finishes`);
    const item=state.items[id];
    assert.equal(item.room,id==='apple'?'homeCrossing':'westInside');
    if(id==='flute')assert(item.x>=565&&item.x<=865&&item.y>=135&&item.y<=485);
    if(id==='jewel'){assert.equal(item.x,x);assert.equal(item.y,y);}
    const position={x:item.x,y:item.y};
    for(let step=0;step<20;step++)api.updateElves(.05);
    assert.notEqual(elf.giftTask?.id,id);assert.equal(item.x,position.x);assert.equal(item.y,position.y);
  }
});

test('dragons ignore elves outside the player room', () => {
  const {api}=loadGame();api.initial('gold');const state=api.state();
  state.mode='playing';state.room='gold';
  const elf=state.elves[0],dragon=state.dragons.find(d=>d.name==='Grundle');state.elves=[elf];state.dragons=[dragon];
  Object.assign(elf,{room:'westInside',x:330,y:320});
  Object.assign(dragon,{room:elf.room,x:300,y:320,follow:[],escape:null,stalker:false});
  const emotions={...elf.emotionalState},stun=elf.stunTimer;
  for(let step=0;step<20;step++)api.updateDragons(.1);
  assert.equal(dragon.x,300);assert.equal(dragon.y,320);
assert.equal(elf.stunTimer,stun);assert.deepEqual({...elf.emotionalState},emotions);
});

test('dragons pursue the player through elves without attacking or changing them', () => {
  const {api}=loadGame();api.initial('gold');const state=api.state();
  state.mode='playing';state.room='crossroads';Object.assign(state.player,{x:700,y:320});
  const elf=state.elves[0],dragon=state.dragons[0];state.elves=[elf];state.dragons=[dragon];
  Object.assign(elf,{room:state.room,x:350,y:320});
  Object.assign(dragon,{room:state.room,x:300,y:320,speed:100,follow:[],escape:null,stalker:false});
  const emotions={...elf.emotionalState},stun=elf.stunTimer;
  assert(api.blocked(state.room,elf.x,elf.y),'elf still blocks the player');
  for(let step=0;step<30;step++)api.updateDragons(.05);
  assert(dragon.x>elf.x+60,'dragon crosses the elf position');
  assert.equal(dragon.y,320,'dragon does not detour around the elf');
assert.equal(elf.stunTimer,stun);assert.deepEqual({...elf.emotionalState},emotions);
  assert.equal(state.mode,'playing');
});

test('elves keep moving through player contact from every direction', () => {
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const { api }=loadGame();api.initial('gold');const state=api.state();
    state.room='westInside';Object.assign(state.player,{x:480,y:320});
    const elf=state.elves[0];for(const other of state.elves)other.wait=1000;
    const goal={x:480+dx*150,y:320+dy*150};
    Object.assign(elf,{room:state.room,x:480-dx*150,y:320-dy*150,wait:0,goal,path:[goal]});
    let crossedPlayer=false,reached=false;
    for(let step=0;step<240;step++){
      api.updateElves(.05);
      if(Math.hypot(elf.x-480,elf.y-320)<10)crossedPlayer=true;
      assert(Math.abs(dx?(elf.y-320):(elf.x-480))<.001,'player contact does not divert the elf');
      if(Math.hypot(elf.x-goal.x,elf.y-goal.y)<10){reached=true;break;}
    }
    assert(crossedPlayer,'elf passes through player contact');assert(reached,'elf continues to its original destination');
    assert.equal(state.player.x,480);assert.equal(state.player.y,320);
  }
});

test('door arrivals avoid elves and overlapping players can escape without passing through them', () => {
  const { api, window }=loadGame();
  for(const [room,x,y] of [['stone',35,320],['westInside',480,525],['west',488.5,515],['mazeTR',480,30]]){
    api.initial('gold');const state=api.state();state.mode='playing';
    Object.assign(state.elves[0],{room,x,y});api.enter(room,x,y);
    const p=state.player;assert(!api.blocked(room,p.x,p.y),`${room} safe arrival`);
    assert(Math.hypot(p.x-x,p.y-y)>43);
  }
  api.initial('gold');const state=api.state();state.mode='playing';state.room='west';
  const elf=state.elves[0];state.player.x=elf.x+10;state.player.y=elf.y;
  window.joystickInput={x:-1,y:0};api.movePlayer(.016);assert.equal(state.player.x,elf.x+10);
  window.joystickInput={x:1,y:0};for(let i=0;i<12;i++)api.movePlayer(.016);
  assert(state.player.x>elf.x+60);assert(!api.blocked('west',state.player.x,state.player.y));
  Object.assign(elf,{room:'homeCrossing',x:925,y:320,wait:0,goal:{x:925,y:320,door:api.dragonDoor('homeCrossing','stone')},path:[]});
  state.room='stone';state.player.x=35;state.player.y=320;api.updateElves(.016);
  assert.equal(elf.room,'stone','player cannot block an elf from entering the room');
});

test('Black lines block movement in Elf Crossing and Blue Vault only', () => {
  const { api }=loadGame();api.initial('gold');
  for(const [room,x] of [['homeCrossing',80],['blueVault',880]]){
    for(const y of [80,320,560]){
      assert(api.blocked(room,x,y,true),`${room} solid line`);
      assert(api.blocked(room,x-18,y,true),`${room} left edge collision`);
      assert(api.blocked(room,x+18,y,true),`${room} right edge collision`);
      assert(!api.blocked(room,x+35*(room==='homeCrossing'?1:-1),y,true),`${room} clear beside line`);
    }
  }
  assert(!api.blocked('crossroads',80,320,true));
  assert(!api.blocked('stone',880,320,true));
});

test('Stone Passage trees and Elf Crossing walls leave central travel routes open', () => {
  const { api }=loadGame();api.initial('gold');
  for(const room of ['stone','homeCrossing']){
    for(let x=110;x<=890;x+=20)assert(!api.blocked(room,x,320),`${room} east-west path inside the boundary line`);
    for(let y=70;y<=570;y+=20)assert(!api.blocked(room,480,y),`${room} center path`);
  }
  for(const [x,y] of [[220,160],[740,160],[220,480],[740,480]])assert(api.blocked('stone',x,y));
  assert(api.blocked('homeCrossing',250,159));assert(api.blocked('homeCrossing',710,484));
  for(const [cx,y] of [[250,85],[250,320],[710,320],[710,555]]){
    for(let x=cx-60;x<=cx+60;x+=10)assert(!api.blocked('homeCrossing',x,y),`clear route around wall at ${x},${y}`);
  }
});

test('map double-clicks teleport to walkable ground in fields, houses, and mazes', () => {
  const { api, element }=loadGame();api.initial('gold');api.state().mode='playing';
  for(const room of [...api.grid.flat().filter(Boolean),'mazeTL','mazeTR','mazeML','mazeMR','mazeBR']){
    const map=element(room.startsWith('maze')?'mazeMap':'map'),cell={dataset:{room}};
    assert(map.innerHTML.includes(`data-room="${room}"`));
    map.listeners.dblclick({target:{closest(){return cell;}},preventDefault(){}});
    const state=api.state(),p=state.player;
    assert.equal(state.room,room);
    assert(!api.blocked(room,p.x,p.y));
    for(const [dx,dy] of [[6,0],[-6,0],[0,6],[0,-6]])assert(!api.blocked(room,p.x+dx,p.y+dy));
    assert(state.dragons.every(d=>d.room!==room||Math.hypot(p.x-d.x,p.y-d.y)>=90));
  }
  const state=api.state(),before=state.room;
  element('map').listeners.dblclick({target:{closest(){return null;}},preventDefault(){throw new Error('empty map cell');}});
  assert.equal(state.room,before);
  assert.equal(api.teleportToRoom('missingRoom'),false);
  state.mode='paused';state.held='goldKey';
  assert.equal(api.teleportToRoom('west'),true);
  assert.equal(state.mode,'playing');assert.equal(state.held,'goldKey');
  assert.equal(element('overlay').hidden,true);
});

test('the action button drops a stationary axe and throws along movement including diagonals', () => {
  const { api, element, window }=loadGame();
  for(const [dx,dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1]]){
    api.initial('gold');const state=api.state();state.mode='playing';state.room='westInside';state.player.x=480;state.player.y=320;state.held='axe';
    window.joystickInput={x:dx,y:dy};element('dropBtn').onclick();
    assert.equal(state.held,null);assert.equal(state.items.axe.room,'westInside');
    if(!dx&&!dy){assert.equal(state.axeFlights.axe,null);continue;}
    assert(state.axeFlights.axe);api.updateAxe(.05);
    const length=Math.hypot(dx,dy);assert(Math.abs(state.items.axe.x-(480+dx/length*32.5))<.01);assert(Math.abs(state.items.axe.y-(285+dy/length*32.5))<.01);
    for(let i=0;i<200&&state.axeFlights.axe;i++)api.updateAxe(.016);
    assert.equal(state.axeFlights.axe,null);assert(!api.blocked(state.items.axe.room,state.items.axe.x,state.items.axe.y));
    state.room=state.items.axe.room;state.player.x=state.items.axe.x-100;state.player.y=state.items.axe.y;state.pickupDelay=0;window.joystickInput={x:0,y:0};api.updateAxe(1.01);state.player.x=state.items.axe.x;api.pickup();assert.equal(state.held,null);assert.equal(state.items.axe.room,'absent');
  }
});

test('axes launch from their current held offset without jumping to the cursor center', () => {
  const { api, element, window }=loadGame();
  for(const side of ['up','down','left','right'])for(const id of ['axe','axe2']){
    api.initial('gold');const state=api.state();state.mode='playing';state.room='westInside';state.player.x=480;state.player.y=320;state.held=id;state.heldSide=side;
    const direction=api.dir[side],start={x:480+direction.x*35,y:320+direction.y*35};
    window.joystickInput={x:1,y:0};element('dropBtn').onclick();
    assert.equal(state.items[id].x,start.x);assert.equal(state.items[id].y,start.y);
    api.updateAxe(.05);assert(Math.abs(state.items[id].x-start.x-32.5)<.01);assert.equal(state.items[id].y,start.y);
  }
});

test('axes start inside Golden Keep and the red and purple cottages and can fly independently', () => {
  const { api, element, window }=loadGame();api.initial('gold');const state=api.state();state.mode='playing';
  assert.equal(state.items.axe.room,'goldInside');
  assert.equal(state.items.axe3.room,'absent');
  assert.equal(state.items.axe4.room,'absent');
  assert.equal(Object.entries(state.items).filter(([id,item])=>/^axe/.test(id)&&item.room==='goldInside').length,1);
  for(const [id,home] of Object.entries({axe2:'west',axe5:'blackApproach'})){
    const item=state.items[id];assert.equal(item.room,home+'Inside');assert.equal(item.treasureOwner,home);
    assert(item.x>=565&&item.x<=865&&item.y>=135&&item.y<=485);
  }
  state.room='westInside';state.player.x=state.items.axe2.x;state.player.y=state.items.axe2.y;api.pickup();assert.equal(state.held,'axe2');
  api.teleportToRoom('westInside');state.player.x=480;state.player.y=420;window.joystickInput={x:-1,y:0};element('dropBtn').onclick();
  assert(state.axeFlights.axe2);assert.equal(state.axeFlights.axe,null);
  state.player.x=480;state.player.y=320;state.held='axe';window.joystickInput={x:1,y:0};element('dropBtn').onclick();api.updateAxe(.1);
  assert(state.axeFlights.axe&&state.axeFlights.axe2);
  assert(state.items.axe.x>480);assert(state.items.axe2.x<480);
  assert.equal(state.items.axe.room,'westInside');assert.equal(state.items.axe2.room,'westInside');
});

test('a thrown axe is single-use, fades after landing, and cannot be reclaimed', () => {
  const {api,element,window}=loadGame();
  for(const id of ['axe','axe2','axe5']){
    api.initial('gold');const state=api.state();state.mode='playing';state.room='goldInside';
    state.elves=[];state.dragons=[];Object.assign(state.player,{x:480,y:320});
    state.held=id;state.items[id].room='held';window.joystickInput={x:1,y:0};element('dropBtn').onclick();
    for(let i=0;i<200&&state.axeFlights[id];i++)api.updateAxe(.016);
    assert.equal(state.axeFlights[id],null);assert(state.usedAxes.has(id));assert.equal(state.axeFades[id],0);
    const axe=state.items[id];state.room=axe.room;Object.assign(state.player,{x:axe.x,y:axe.y});
    state.pickupDelay=0;window.joystickInput={x:0,y:0};api.pickup();assert.equal(state.held,null);
    api.updateAxe(.3);assert.equal(state.axeFades[id],.3);assert.notEqual(axe.room,'absent');
    api.pickup();assert.equal(state.held,null);
    api.updateAxe(.71);assert.equal(axe.room,'absent');assert.equal(state.axeFades[id],undefined);
    api.initial('gold');assert(!api.state().usedAxes.has(id));assert.notEqual(api.state().items[id].room,'absent');
  }
});

test('Gaster disappearance sound plays once through direct audio on local-file pages', () => {
  const {api,element,window,sounds}=loadGame();api.initial('gold');const state=api.state();
  window.location={protocol:'file:'};
  window.AudioContext=class{constructor(){throw new Error('Local-file audio must bypass Web Audio');}};
  state.mode='playing';state.room='goldInside';state.elves=[];state.dragons=[];
  Object.assign(state.player,{x:480,y:320});state.held='axe';state.items.axe.room='held';
  const sound=sounds.find(sound=>sound.src==='assets/gaster-disapear.mp3');assert(sound);
  window.joystickInput={x:1,y:0};element('dropBtn').onclick();assert.equal(sound.plays,0);
  for(let i=0;i<200&&state.axeFlights.axe;i++)api.updateAxe(.016);
  assert.equal(sound.plays,0);
  api.updateAxe(.39);assert.equal(sound.plays,0);assert.notEqual(state.items.axe.room,'absent');
  api.updateAxe(.02);assert.equal(sound.plays,1);assert.equal(sound.volume,1);
  api.updateAxe(.61);assert.equal(sound.plays,1);
});

test('putting down an unused axe does not consume it', () => {
  const {api,element,window}=loadGame();api.initial('gold');const state=api.state();state.mode='playing';
  state.room='goldInside';Object.assign(state.player,{x:480,y:320});state.held='axe';state.items.axe.room='held';
  window.joystickInput={x:0,y:0};element('dropBtn').onclick();api.updateAxe(1);
  assert(!state.usedAxes.has('axe'));assert.equal(state.items.axe.room,'goldInside');
});

test('an elf-thrown axe fades after a fatal hit even on the game-over screen', () => {
  const {api}=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.room='goldInside';
  state.elves=[];state.dragons=[];Object.assign(state.player,{x:480,y:320});
  state.items.axe={room:state.room,x:440,y:320};
  state.axeFlights.axe={room:state.room,vx:650,vy:0,travelled:0,age:0,thrower:'west'};
  api.updateAxe(.1);assert.equal(state.mode,'lost');assert(state.usedAxes.has('axe'));
  api.update(.3);assert.equal(state.axeFades.axe,.3);
  api.update(.71);assert.equal(state.items.axe.room,'absent');
});

test('the thrown axe passes through the thrower for half a second, then collides normally', () => {
  const { api, element, window }=loadGame();api.initial('gold');
  const state=api.state();state.mode='playing';state.room='westInside';state.player.x=480;state.player.y=320;state.held='axe';window.joystickInput={x:1,y:0};
  state.items.jewelRed.room='absent';
  element('dropBtn').onclick();api.updateAxe(.1);
  state.player.x=600;api.updateAxe(.1);
  assert(state.axeFlights.axe);assert(state.items.axe.x>600);
  state.player.x=810;api.updateAxe(.29);assert(state.axeFlights.axe);
  assert(Math.abs(state.axeFlights.axe.age-.49)<.001);
  api.updateAxe(.03);assert.equal(state.axeFlights.axe,null);
  assert(Math.abs(state.items.axe.x-state.player.x)<36);
});

test('thrown axes land on objects and characters without damaging them, and cross open exits', () => {
  const { api, element, window }=loadGame();
  for(const target of ['item','dragon','bat','elf']){
    api.initial('gold');const state=api.state();state.mode='playing';state.room=target==='elf'?'west':'westInside';state.player.x=target==='elf'?770:480;state.player.y=target==='elf'?530:320;state.held='axe';
    if(target==='item')state.items.apple={room:state.room,x:650,y:320};
    if(target==='dragon')Object.assign(state.dragons[0],{room:state.room,x:650,y:320});
    if(target==='bat')Object.assign(state.bat,{room:state.room,x:650,y:320});
    window.joystickInput=target==='elf'?{x:0,y:-1}:{x:1,y:0};element('mobileDropBtn').onclick();api.updateAxe(1);
    assert.equal(state.axeFlights.axe,null);assert.equal(state.items.axe.room,state.room);
    if(target==='elf')assert(state.items.axe.y>445);else assert(state.items.axe.x>480&&state.items.axe.x<650);
    assert(state.dragons.every(d=>!d.dead));
  }
  api.initial('gold');const state=api.state();state.mode='playing';state.room='stone';state.player.x=880;state.player.y=280;state.held='axe';state.heldSide='right';window.joystickInput={x:1,y:0};
  element('dropBtn').onclick();api.updateAxe(.2);assert.equal(state.items.axe.room,'crossroads');assert(state.axeFlights.axe);
});

test('the reference castle has solid towers, an open upper notch, and a working raised gate', () => {
  const {api}=loadGame();api.initial('gold');const state=api.state();
  assert(api.blocked('gold',350,170,true));assert(api.blocked('gold',620,170,true));
  assert(!api.blocked('gold',488,170,true),'upper center matches the reference opening');
  assert(api.blocked('gold',488,300,true),'center of castle remains solid');
  assert(api.blocked('gold',480,440,true),'closed lattice blocks entrance');
  state.gates.gold=true;state.gateLift.gold=1;
  assert(!api.blocked('gold',480,440,true),'raised gate leaves doorway open');
});

test('Golden Castle side doors are closed and its gold key is accessible', () => {
  const { api }=loadGame();
  for(const mode of ['gold','easy','random']){
    api.initial(mode);const state=api.state(),exits=api.visibleExits('gold');
    assert.equal(exits.left,false);assert.equal(exits.right,false);
    assert.equal(state.items.goldKey.room,'gold');
    assert(!api.blocked('gold',state.items.goldKey.x,state.items.goldKey.y));
    for(const d of [api.dir.left,api.dir.right]){
      assert.equal(api.neighbor('gold',d),'gold');
      assert.equal(api.batNeighbor('gold',d),'gold');
    }
  }
  api.initial('gold');
  assert.equal(api.neighbor('west',api.dir.right),'west');
  assert.equal(api.neighbor('blueGate',api.dir.left),'blueGate');
  assert.equal(api.neighbor('gold',api.dir.down),'crossroads');
  const seen=new Set(['gold']),queue=['gold'];
  for(let i=0;i<queue.length;i++)for(const room of api.connectedRooms(queue[i]))if(!seen.has(room)){seen.add(room);queue.push(room);}
  for(const room of api.grid.flat().filter(room=>room&&room!=='south'))assert(seen.has(room));
  assert.equal(api.state().items.chalice,undefined);
});

test('Southern Wilds north door connects to The Crossroads while other doors stay closed', () => {
  const { api,window }=loadGame();api.initial('gold');
  assert.equal(api.neighbor('south',api.dir.up),'crossroads');assert.equal(api.neighbor('crossroads',api.dir.down),'south');
  assert.equal(api.batNeighbor('south',api.dir.up),'crossroads');
  for(const direction of [api.dir.left,api.dir.right,api.dir.down])assert.equal(api.neighbor('south',direction),'south');
  for(const [x,y] of [[5,320],[955,320],[480,635]])assert(api.blocked('south',x,y));
  assert(!api.blocked('south',480,5));
  for(const [from,y,dy,to] of [['south',5,-1,'crossroads'],['crossroads',635,1,'south']]){
    api.initial('gold');
    const state=api.state();state.mode='playing';state.room=from;state.dragons=[];Object.assign(state.player,{x:480,y});
    window.joystickInput={x:0,y:dy};api.movePlayer(.1);assert.equal(state.room,to);
  }
});

test('all dragons stay still off screen without a chase or escape route', () => {
  for(const mode of ['gold','easy','random']){
    const {api,chaseMetrics}=loadGame(true);api.initial(mode);const state=api.state();state.mode='playing';state.room='goldInside';
    const starts=state.dragons.map(d=>({room:d.room,x:d.x,y:d.y}));const searches=chaseMetrics.routes;
    for(let frame=0;frame<180;frame++)api.updateDragons(1/60);
    assert.deepEqual(state.dragons.map(d=>({room:d.room,x:d.x,y:d.y})),starts);
    assert.equal(chaseMetrics.routes,searches,'idle off-screen dragons do not search for routes');
  }
});

test('every dragon uses the same basic pursuit when the player shares its room', () => {
  for(const name of ['Yorgle','Grundle','Rhindle','Vesper']){
    const {api}=loadGame();api.initial('gold');const state=api.state();state.room='crossroads';state.mode='playing';state.elves=[];
    const dragon=state.dragons.find(d=>d.name===name);state.dragons=[dragon];
    Object.assign(dragon,{room:state.room,x:300,y:320});Object.assign(state.player,{x:600,y:320});
    api.updateDragons(.1);assert(Math.abs(dragon.x-(300+dragon.speed*.1))<1e-8,name+' chases at its normal speed');
  }
});

test('Rhindle follows out of White Castle even when Amber has not been taken', () => {
  for(const mode of ['gold','easy','random']){
    const {api}=loadGame();api.initial(mode);const state=api.state();state.mode='playing';
    const red=state.dragons.find(d=>d.name==='Rhindle');state.dragons=[red];state.elves=[];
    state.room='whiteInside';state.gates.white=true;state.gateLift.white=1;
    api.enter('white',480,530);
    for(let step=0;step<400&&red.room==='whiteInside';step++)api.updateDragons(.05);
    assert.equal(red.room,'white');assert.equal(state.items.jewelOrange.room,'whiteInside');
  }
});

test('dragons reuse obstacle routes and replan when the chase target moves', () => {
  const {api,chaseMetrics}=loadGame(true);api.initial('gold');const state=api.state();
  const red=state.dragons.find(d=>d.name==='Rhindle');state.dragons=[red];state.elves=[];
  state.mode='playing';state.room='white';state.held='jewelOrange';state.items.jewelOrange.room='held';
  Object.assign(red,{room:'white',x:150,y:150});Object.assign(state.player,{x:730,y:320});
  for(let frame=0;frame<180;frame++)api.updateDragons(1/60);
  assert(chaseMetrics.routes>0&&chaseMetrics.routes<=3,'a stationary target reuses its route');
  assert(Math.hypot(red.x-150,red.y-150)>150,'route reuse still advances the dragon around obstacles');
  const searches=chaseMetrics.routes;Object.assign(state.player,{x:150,y:500});
  for(let frame=0;frame<30;frame++)api.updateDragons(1/60);
  assert(chaseMetrics.routes>searches,'moving the target behind an obstacle triggers a new route');
});

test('dragons throttle retries for unreachable targets and recover when the target becomes reachable', () => {
  const {api,chaseMetrics}=loadGame(true);api.initial('gold');const state=api.state();
  const red=state.dragons.find(d=>d.name==='Rhindle');state.dragons=[red];state.elves=[];
  state.mode='playing';state.room='whiteInside';state.held='jewelOrange';state.items.jewelOrange.room='held';
  Object.assign(red,{x:480,y:400});Object.assign(state.player,{x:10,y:10});
  for(let frame=0;frame<180;frame++)api.updateDragons(1/60);
  assert(chaseMetrics.routes<=4,'failed routes are retried at most once every 0.75 seconds');
  Object.assign(state.player,{x:480,y:200});const initialY=red.y;
  for(let frame=0;frame<30;frame++)api.updateDragons(1/60);
  assert(red.y<initialY,'the dragon resumes pursuit when a direct path opens');
});

test('the bat and green dragon start in Southern Wilds, and the bat can leave through its north door', () => {
  const { api }=loadGame();
  for(const mode of ['gold','easy','random']){
    api.initial(mode);const state=api.state();state.mode='playing';
    assert.equal(state.bat.room,'south');
    assert.equal(state.dragons.length,4);
    assert.equal(state.dragons.find(d=>d.name==='Grundle').room,'south');
    for(const dragon of state.dragons)assert(!api.blocked(dragon.room,dragon.x,dragon.y));
    api.updateDragons(120);
    for(const [x,y,vx,vy] of [[-1,320,-1,0],[961,320,1,0],[480,-1,0,-1],[480,641,0,1]]){
      Object.assign(state.bat,{room:'south',x,y,vx,vy});api.updateBat(0);assert.equal(state.bat.room,y<0?'crossroads':'south');
    }
    assert.equal(state.dragons.find(d=>d.name==='Grundle').room,'south');
    assert.equal(state.dragons.find(d=>d.name==='Rhindle').room,'whiteInside');
  }
});

test('dead dragons block movement from all sides while allowing the player to escape overlap', () => {
  const { api, window }=loadGame();
  for(const [x,y,dx,dy] of [[440,320,1,0],[520,320,-1,0],[480,250,0,1],[480,390,0,-1]]){
    api.initial('easy');const state=api.state();state.mode='playing';state.room='crossroads';
    state.player.x=x;state.player.y=y;
    const dragon=state.dragons[0];Object.assign(dragon,{room:'crossroads',x:480,y:320,dead:true,enteringFromBelow:false});
    window.joystickInput={x:dx,y:dy};api.movePlayer(.05);
    assert.equal(state.player.x,x);assert.equal(state.player.y,y);
    dragon.dead=false;api.movePlayer(.05);
    assert(dx?state.player.x!==x:state.player.y!==y);
  }
  api.initial('easy');const state=api.state();state.mode='playing';state.room='crossroads';
  Object.assign(state.dragons[0],{room:'crossroads',x:480,y:320,dead:true,enteringFromBelow:false});
  state.player.x=490;state.player.y=320;window.joystickInput={x:1,y:0};api.movePlayer(.05);
  assert(state.player.x>490);
  state.dragons[0].room='west';state.player.x=440;api.movePlayer(.05);assert(state.player.x>440);
});

test('Easy exits follow the requested map and close absent connections', () => {
  const { api } = loadGame();
  api.initial('easy');
  const expected = {
    gold: { down: 'crossroads' },
    crossroads: { up: 'gold', down:'south', left: 'west', right: 'blackApproach' },
    west: { right: 'crossroads' },
    blackApproach: { left: 'crossroads', down: 'blackApproachSouth' },
    blackApproachSouth: { up: 'blackApproach', down: 'greyDungeon' }, greyDungeon: { up: 'blackApproachSouth' }
  };
  for (const [room, exits] of Object.entries(expected)) {
    for (const [edge, direction] of Object.entries(api.dir)) {
      assert.equal(api.visibleExits(room)[edge], !!exits[edge], room + ' ' + edge);
      assert.equal(api.neighbor(room, direction), exits[edge] || room);
      if (exits[edge]) assert(api.dragonDoor(room, exits[edge]), room + ' route');
    }
  }
  for (const room of ['goldInside']) {
    assert.equal(api.visibleExits(room).up, false);
    assert.equal(api.visibleExits(room).down, true);
    assert.equal(api.blocked(room, 480, 20), true);
  }
  assert.equal(api.dragonDoor('blackInside', 'greyDungeon'), null);


  assert.equal(api.wallColor('greyDungeon'), '#8C58B8');
  assert.equal(api.dragonDoor('mazeTR','greyDungeon'),null);
  assert.equal(api.dragonDoor('greyDungeon','mazeTR'),null);
  assert.equal(api.batNeighbor('gold', api.dir.left), 'gold');
  assert(!api.connectedRooms('mazeTR').includes('greyDungeon'));
  api.initial('gold');
  assert.equal(JSON.stringify(api.grid), JSON.stringify(api.hardGrid));

  assert.equal(api.state().items.chalice,undefined);
});


test('the full center opening connects Witchlight Crossing and Starless Sanctum', () => {
  const { api, window } = loadGame();
  for (const [from, to, y, dy] of [['mazeMR', 'mazeBR', 620, 1], ['mazeBR', 'mazeMR', 20, -1]]) {
    for (const x of [396, 420, 444, 480, 516, 540, 564]) {
      api.initial('easy');
      const state = api.state();
      state.mode = 'playing';
      state.room = from;
      state.player.x = x;
      state.player.y = y;
      state.dragons = [];
      window.joystickInput = { x: 0, y: dy };
      for (let step = 0; step < 12 && state.room === from; step++) api.movePlayer(.016);
      assert.equal(state.room, to, `${from} crossing at x=${x}`);
      assert.equal(api.blocked(to, state.player.x, state.player.y), false);
    }
  }
});

test('Winding Wood south leads through the copied Blue Labyrinth Gate and Blue Vault', () => {
  for(const mode of ['gold','easy','random']){
    const {api,window,element}=loadGame();api.initial(mode);const state=api.state();state.mode='playing';state.elves=[];state.dragons=[];
    for(const [from,to,y,dy] of [['blueMaze','labyrinthApproach',620,1],['labyrinthApproach','blueMaze',20,-1],['labyrinthApproach','labyrinthGate',620,1],['labyrinthGate','labyrinthApproach',20,-1],['labyrinthGate','labyrinthVault',620,1],['labyrinthVault','labyrinthGate',20,-1]]){
      window.joystickInput={x:0,y:0};api.update(.4);state.room=from;Object.assign(state.player,{x:480,y});window.joystickInput={x:0,y:dy};
      assert(api.dragonDoor(from,to));assert.equal(api.neighbor(from,dy>0?api.dir.down:api.dir.up),to);
      for(let step=0;step<20&&state.room===from;step++)api.movePlayer(.016);
      assert.equal(state.room,to,mode+' '+from+' to '+to);assert(!api.blocked(to,state.player.x,state.player.y));
    }
    for(const room of ['labyrinthGate','labyrinthVault']){
      assert(api.blocked(room,210,150));assert.equal(api.visibleExits(room).left,false);assert.equal(api.visibleExits(room).right,room==='labyrinthVault');
      assert(element('map').innerHTML.includes('data-room="'+room+'"'));assert(api.teleportToRoom(room));
    }
    assert.equal(api.visibleExits('labyrinthVault').down,false);
    assert.deepEqual(JSON.parse(JSON.stringify(api.visibleExits('labyrinthApproach'))),{left:false,right:false,up:true,down:true});
    assert(api.blocked('labyrinthApproach',20,320));assert(api.blocked('labyrinthApproach',940,320));
    for(const x of [100,210,480,750,860])for(const y of [100,540])assert(!api.blocked('labyrinthApproach',x,y),'approaches to the obstacle remain open');
    for(const x of [60,210,480,750,900])assert(api.blocked('labyrinthApproach',x,320),'obstacle spans the room');
    assert(api.blocked('labyrinthApproach',240,220));assert(api.blocked('labyrinthApproach',720,420));
    assert(element('map').innerHTML.includes('data-room="labyrinthApproach"'));
  }
});

test('Rootbound Vault remains disconnected from Winding Wood', () => {
  const {api}=loadGame();api.initial('gold');
  assert.equal(api.neighbor('blueMaze',api.dir.down),'labyrinthApproach');
  assert.equal(api.visibleExits('blueMaze').down,true);
  assert.equal(api.blocked('blueMaze',480,620),false);
  assert.equal(api.neighbor('greyDungeon',api.dir.up),'greyDungeon');
  assert(api.blocked('greyDungeon',480,20));
  assert.equal(api.dragonDoor('blueMaze','greyDungeon'),null);
  assert.equal(api.dragonDoor('greyDungeon','blueMaze'),null);
});

test('Western Maze is blocked from Rootbound Vault in both directions', () => {
  const { api, window }=loadGame();
  for(const [from,y,dy,to] of [['mazeTR',5,-1,'greyDungeon'],['greyDungeon',635,1,'mazeTR']]){
    api.initial('easy');
    const state=api.state();state.mode='playing';state.room=from;state.player.x=480;state.player.y=y;
    window.joystickInput={x:0,y:dy};api.movePlayer(.1);
    assert.equal(state.room,from==='mazeTR'?'black':from);
    if(from==='greyDungeon')assert.equal(api.blocked(from,480,y),true);
    assert(!api.connectedRooms(from).includes(to));
  }
});

test('Meadow and Ravenwood doors match the centered eighty percent crossing doors', () => {
  const { api, window }=loadGame();
  for(const [room,x,dx] of [['west',955,1],['blackApproach',5,-1]]){
    for(const y of [80,100,540,560]){
      api.initial('easy');
      const state=api.state();state.mode='playing';state.room=room;state.player.x=x;state.player.y=y;
      assert.equal(api.blocked(room,x,y),false);
      window.joystickInput={x:dx,y:0};api.movePlayer(.1);
      assert.equal(state.room,'crossroads');
      assert.equal(api.blocked(state.room,state.player.x,state.player.y),false);
    }
    api.initial('easy');
    for(const y of [0,64,78,562,576,640])assert.equal(api.blocked(room,x,y),true);
  }
  assert.equal(api.wallColor('blackApproach'),'#800080');
  api.initial('gold');
  assert.equal(api.blocked('west',955,100),true);
  assert.equal(api.blocked('blackApproach',5,540),true);
});

test('Wayfarer Crossing has green walls and centered side doors spanning eighty percent of its height', () => {
  const { api, window } = loadGame();
  for(const [x,dx,destination] of [[5,-1,'west'],[955,1,'blackApproach']]){
    for(const y of [80,100,540,560]){
      api.initial('easy');
      const state=api.state();state.mode='playing';state.room='crossroads';
      state.player.x=x;state.player.y=y;
      assert.equal(api.wallColor('crossroads'),'#74B474');
      assert.equal(api.blocked('crossroads',x,y),false);
      window.joystickInput={x:dx,y:0};
      api.movePlayer(.1);
      assert.equal(state.room,destination);
      assert.equal(api.blocked(state.room,state.player.x,state.player.y),false);
    }
    api.initial('easy');
    for(const y of [0,64,78,562,576,640])assert.equal(api.blocked('crossroads',x,y),true);
  }
  api.initial('gold');
  assert.equal(api.blocked('crossroads',5,100),true);
  assert.notEqual(api.wallColor('crossroads'),'#74B474');
});

test('each elf starts with an axe and home key in separate treasure boxes in every mode', () => {
  for(const mode of ['gold','entry','random']){
    const {api}=loadGame();api.initial(mode);const state=api.state();
    for(const [home,axe] of Object.entries({west:'axe2',blueGate:'axe3',redTrail:'axe4',blackApproach:'axe5'})){
      for(const [id,x] of [[axe,625],[home+'Key',715]]){
        const item=state.items[id];
        assert.equal(item.room,home+'Inside');assert.equal(item.x,x);assert.equal(item.y,265);
        assert.equal(item.treasureOwner,home);
      }
    }
  }
});