const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadGame() {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      id, dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} },
      getContext() { return { clearRect() {}, fillRect() {}, drawImage() {} }; },
      addEventListener() {}, focus() {}, setAttribute() {},
      getBoundingClientRect() { return { left: 0, right: 0, top: 0, bottom: 0 }; },
      clientWidth: 0, hidden: id === 'hints', textContent: '', innerHTML: ''
    });
    return elements.get(id);
  }
  const context = {
    document: { getElementById: element, querySelectorAll() { return []; }, addEventListener() {},
      body: { classList: { add() {}, toggle() {} } } },
    window: { addEventListener() {} }, Audio: class { pause() {} }, Image: class {},
    requestAnimationFrame() {}, clearTimeout() {}, setTimeout() {}, performance: { now() { return 0; } }, console
  };
  const source = fs.readFileSync(__dirname + '/game.js', 'utf8').replace(
    /\}\)\(\);\s*$/, 'globalThis.testApi={initial,visibleExits,neighbor,dir,blocked,dragonDoor,connectedRooms,batNeighbor,updateVesper,updateDragons,movePlayer,wallColor,chaliceColor,heldObjectColor,refreshHints,grid,hardGrid,state:()=>state};})();'
  );
  vm.runInNewContext(source, context);
  return { api: context.testApi, element, window: context.window };
}

test('Easy button starts the smaller quest with the requested objects and dragons', () => {
  const { api, element } = loadGame();
  element('easyModeBtn').onclick();
  const state = api.state();
  assert.equal(state.questMode, 'easy');
  assert.equal(state.mode, 'playing');
  assert.equal(state.room, 'gold');
  const expected = { goldKey: 'gold', blackKey: 'blackApproachSouth', sword: 'goldInside', chalice: 'nightfallInside', magnet: 'blackInside' };
  for (const [id, room] of Object.entries(expected)) {
    assert.equal(state.items[id].room, room);
    assert.equal(api.blocked(room, state.items[id].x, state.items[id].y), false, id);
  }
  assert.equal(state.dragons.length, 3);
  assert.equal(api.grid[0][1], null);
  assert.equal(state.items.goldKey.x, 210);
  assert.equal(state.items.goldKey.y, 285);
  assert.equal(state.dragons.find(d => d.name === 'Grundle').room, 'blackApproachSouth');
  assert.equal(state.dragons.find(d => d.name === 'Rhindle').room, 'nightfallInside');
  api.updateVesper(120);
  assert.equal(state.dragons.length, 3);
  assert.doesNotThrow(() => api.refreshHints());
});

test('yellow dragon enters from below on the first visit to the Western Meadow', () => {
  const { api } = loadGame();
  api.initial('easy');
  const state=api.state(),yellow=state.dragons.find(d => d.name === 'Yorgle');
  assert.equal(yellow.room, 'west');
  assert.equal(yellow.y, 690);
  api.updateDragons(.1);
  assert.equal(yellow.y, 690);
  state.room='west';
  api.updateDragons(.1);
  assert.equal(yellow.y, 679.5);
  for(let i=0;i<9;i++)api.updateDragons(.1);
  assert.equal(yellow.y, 585);
  assert.equal(yellow.enteringFromBelow, false);
  assert.equal(api.visibleExits('west').down, false);
});

test('Easy Yorgle travels toward the player without needing a follow trail', () => {
  const { api }=loadGame();api.initial('easy');
  const state=api.state(),yellow=state.dragons.find(d=>d.name==='Yorgle');
  state.mode='playing';state.room='crossroads';state.player.x=480;state.player.y=320;
  yellow.enteringFromBelow=false;yellow.x=900;yellow.y=320;
  assert.equal(yellow.follow.length,0);
  api.updateDragons(.1);
  assert.equal(yellow.room,'crossroads');
  assert.equal(yellow.stalker,true);
  api.initial('gold');assert.equal(api.state().dragons.find(d=>d.name==='Yorgle').stalker,false);
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
    crossroads: { up: 'gold', left: 'west', right: 'blackApproach' },
    west: { up: 'mazeML', right: 'crossroads' },
    blackApproach: { left: 'crossroads', down: 'blackApproachSouth' },
    blackApproachSouth: { up: 'blackApproach' }, black: { down: 'mazeTR' }
  };
  for (const [room, exits] of Object.entries(expected)) {
    for (const [edge, direction] of Object.entries(api.dir)) {
      assert.equal(api.visibleExits(room)[edge], !!exits[edge], room + ' ' + edge);
      assert.equal(api.neighbor(room, direction), exits[edge] || room);
      if (exits[edge]) assert(api.dragonDoor(room, exits[edge]), room + ' route');
    }
  }
  for (const room of ['goldInside', 'nightfallInside']) {
    assert.equal(api.visibleExits(room).up, false);
    assert.equal(api.visibleExits(room).down, true);
    assert.equal(api.blocked(room, 480, 20), true);
  }
  assert.equal(api.dragonDoor('blackInside', 'greyDungeon'), null);
  assert.equal(api.visibleExits('blackInside').up, true);
  assert.equal(api.visibleExits('blackInside').down, true);
  assert.equal(api.wallColor('blackInside'), '#C06848');
  assert.equal(api.dragonDoor('blackInside','nightfallInside').to,'nightfallInside');
  assert.equal(api.dragonDoor('nightfallInside','blackInside').to,'blackInside');
  assert.equal(api.batNeighbor('gold', api.dir.left), 'gold');
  assert(api.connectedRooms('mazeTR').includes('black'));
  api.initial('gold');
  assert.equal(JSON.stringify(api.grid), JSON.stringify(api.hardGrid));
  assert.equal(api.visibleExits('blackInside').up, true);
  assert.equal(api.state().items.chalice.room, 'greyDungeon');
});

test('chalices and held-object lines follow the requested sixteen-color sequence', () => {
  const { api }=loadGame();api.initial('easy');
  const state=api.state();state.mode='winning';
  const colors=['#A8A8A8','#C4A000','#D86000','#D01C00','#B00020','#800080','#4010BC','#0034B8','#0068A0','#008060','#008818','#388400','#707400','#A05800','#B84000','#C02040'];
  for(let i=0;i<colors.length;i++){
    state.winTimer=i*(.5334/16);
    assert.equal(api.chaliceColor(),colors[i]);
    state.held='chalice';assert.equal(api.heldObjectColor(),colors[i]);
  }
  state.winTimer=.5334;assert.equal(api.chaliceColor(),colors[0]);
  state.winTimer=.5334/32;assert.equal(api.chaliceColor(),'#B6A454');
  assert.equal(api.heldObjectColor(),api.chaliceColor());
  state.held=null;assert.equal(api.heldObjectColor(),'#000000');
});

test('Nightfall Atrium leads up to the chalice room and back down to the castle', () => {
  const { api, window }=loadGame();
  for(const [from,y,dy,to] of [['blackInside',5,-1,'nightfallInside'],['nightfallInside',635,1,'blackInside'],['blackInside',635,1,'black']]){
    api.initial('easy');
    const state=api.state();state.mode='playing';state.room=from;state.player.x=480;state.player.y=y;
    window.joystickInput={x:0,y:dy};api.movePlayer(.1);
    assert.equal(state.room,to);
    assert.equal(api.blocked(state.room,state.player.x,state.player.y),false);
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
  assert.equal(api.wallColor('blackApproach'),'#9CA864');
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
