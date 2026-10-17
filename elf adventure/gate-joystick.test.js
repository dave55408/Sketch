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
      listeners: {}, addEventListener(type, handler) { this.listeners[type] = handler; }, focus() {}, setAttribute() {},
      getBoundingClientRect() { return { left: 0, right: 0, top: 0, bottom: 0 }; },
      clientWidth: 0, hidden: id === 'hints', textContent: '', innerHTML: ''
    });
    return elements.get(id);
  }
  const window = { joystickInput: { x: 0, y: 0 }, addEventListener() {} };
  const context = {
    document: {
      getElementById: element, querySelectorAll() { return []; }, addEventListener() {},
      body: { classList: { add() {}, toggle() {} } }
    },
    window, Audio: class { pause() {} play() { return Promise.resolve(); } }, Image: class {},
    requestAnimationFrame() {}, clearTimeout() {}, setTimeout() {},
    performance: { now() { return 0; } }, console, Math, Set, Object, Map, Int16Array
  };
  const source = fs.readFileSync(__dirname + '/game.js', 'utf8').replace(
    /\}\)\(\);\s*$/, 'globalThis.testApi={initial,enter,gateCheck,update,keys,blocked,state:()=>state};})();'
  );
  vm.runInNewContext(source, context);
  return {...context.testApi,window,element};
}

test('upward joystick input enters the gold castle with its key', () => {
  const { initial, gateCheck, state,window,element } = loadGame();
  initial('gold');
  const game = state();
  game.mode = 'playing';
  game.player.x = 480;
  game.player.y = 450;
  game.items.goldKey = { room: 'gold', x: 480, y: 200 };
  gateCheck();
  assert.equal(game.gates.gold, false);
  game.items.goldKey.y = 420;
  gateCheck();
  assert.equal(game.gates.gold, true);
  game.items.goldKey.y = 500;
  gateCheck();
  assert.equal(game.gates.gold, false);
  game.held = 'goldKey';
  game.heldSide = 'up';
  game.gateLift.gold = 1;

  gateCheck();
  assert.equal(game.gates.gold, true);
  assert.equal(game.room, 'gold');
  window.joystickInput.y = -1;
  gateCheck();
  assert.equal(game.room, 'goldInside');

  let prevented = false;
  element('mobileDropBtn').listeners.touchstart({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(game.held, null);
  assert.equal(window.joystickInput.y, -1);
});

for(const side of ['up','left','right','down'])for(const input of [-1,-.2]){
  test(`first entry and repeat entry work with the key ${side} and joystick ${input}`,()=>{
    const api=loadGame();api.initial('gold');
    const game=api.state();game.mode='playing';game.dragons=[];game.elves=[];
    game.bat.room='south';game.bat.sightCooldown=10000;game.bat.pickupCooldown=10000;
    game.held='goldKey';game.heldSide=side;game.items.goldKey.room='held';
    const walkUntil=(direction,room)=>{
      api.window.joystickInput.y=direction;
      for(let frame=0;frame<900&&game.room!==room;frame++)api.update(1/60);
      assert.equal(game.room,room);
    };
    walkUntil(input,'goldInside');
    walkUntil(1,'gold');
    walkUntil(input,'goldInside');
  });
}

for(const home of ['west','blueGate','redTrail','blackApproach'])for(const side of ['up','down']){
  test(`${home} gate closes for a pulled key, stays open for a pushed key, and reopens for entry (${side})`,()=>{
    const api=loadGame();api.initial('gold');const game=api.state();
    game.mode='playing';game.dragons=[];game.elves=[];game.bat.room='absent';
    api.enter(home+'Inside',488.5,600);
    game.held=home+'Key';game.heldSide=side;game.items[game.held].room='held';
    api.window.joystickInput.y=1;
    for(let frame=0;frame<120&&game.room!==home;frame++)api.update(1/60);
    assert.equal(game.room,home);
    for(let frame=0;frame<10;frame++)api.update(1/60);
    api.window.joystickInput.y=0;
    for(let frame=0;frame<70;frame++)api.update(1/60);
    assert.equal(game.gates[home],side==='down');
    assert.equal(game.gateLift[home],side==='down'?1:0);
    assert.equal(api.blocked(home,488.5,400),side==='up');
    api.window.joystickInput.y=-1;
    for(let frame=0;frame<300&&game.room!==home+'Inside';frame++)api.update(1/60);
    assert.equal(game.room,home+'Inside','matching home key reopens the gate for entry');
  });
}