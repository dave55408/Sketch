const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadGame() {
  const elements = new Map();
  const drawCalls = [];
  const gameContext = {
    globalAlpha: 1,
    save() { this.savedAlpha = this.globalAlpha; },
    restore() { this.globalAlpha = this.savedAlpha; },
    translate() {},
    fillRect(x, y, w, h) { drawCalls.push({ type: 'rect', alpha: this.globalAlpha, color: this.fillStyle, x, y, w, h }); },
    drawImage() { drawCalls.push({ type: 'image', alpha: this.globalAlpha }); }
  };
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      id, dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} },
      getContext() { return id === 'game' ? gameContext : { clearRect() {}, fillRect() {}, drawImage() {} }; },
      addEventListener() {}, focus() {}, setAttribute() {},
      getBoundingClientRect() { return { left: 0, right: 0, top: 0, bottom: 0 }; },
      clientWidth: 0, hidden: id === 'hints', textContent: '', innerHTML: ''
    });
    return elements.get(id);
  }
  const window = { joystickInput: { x: 0, y: 0 }, addEventListener() {} };
  const context = {
    document: { getElementById: element, querySelectorAll() { return []; }, addEventListener() {}, body: { classList: { add() {}, toggle() {} } } },
    window, Audio: class { pause() {} play() { return Promise.resolve(); } }, Image: class {},
    requestAnimationFrame() {}, clearTimeout() {}, setTimeout() {}, performance: { now() { return 0; } },
    console, Math, Set, Object, Map, Int16Array
  };
  const source = fs.readFileSync(__dirname + '/game.js', 'utf8').replace(
    /\}\)\(\);\s*$/, 'globalThis.testApi={initial,blocked,drawPlacedBridge,exposedBridgeLeg,itemPosition,placeBridge,update,setBridgePixels:data=>{bridgePixelData=data},state:()=>state};})();'
  );
  vm.runInNewContext(source, context);
  return { ...context.testApi, window, drawCalls };
}

test('bridge channels over solid terrain render at twenty percent opacity', () => {
  const game = loadGame();
  game.initial('gold');
  game.drawPlacedBridge({ room: 'mazeTR', x: 340, y: 427 });
  const mazeChannel = game.drawCalls.filter(call => call.color === '#8f8b8f');
  assert.ok(mazeChannel.length > 0);
  assert.ok(mazeChannel.every(call => call.alpha === 0.2));
  assert.ok(game.drawCalls.some(call => call.color === '#67523c' && call.alpha === 1));
  game.drawCalls.length = 0;
  game.drawPlacedBridge({ room: 'road', x: 480, y: 320 });
  assert.equal(game.drawCalls.some(call => call.color === '#c39b68'), false);
  game.drawCalls.length = 0;
  game.drawPlacedBridge({ room: 'redDungeon', x: 480, y: 322.5 });
  assert.ok(game.drawCalls.some(call => call.color === '#c39b68' && call.alpha === 0.2));
});

test('a placed maze bridge clears only the path between its legs', () => {
  const game = loadGame();
  game.initial('gold');
  const state = game.state();
  state.room = 'mazeTR';
  assert.equal(game.blocked('mazeTR', 340, 427), false);
  assert.equal(game.blocked('mazeTR', 270, 427), true);
  delete state.placedBridges.bridge2;
  assert.equal(game.blocked('mazeTR', 340, 427), true);
  state.items.bridge2 = { room: 'mazeTR', x: 340, y: 427 };
  assert.equal(game.blocked('mazeTR', 340, 427), true);
});

test('a placed dungeon bridge leaves solid ground outside its central path', () => {
  const game = loadGame();
  game.initial('gold');
  const state = game.state();
  state.room = 'redDungeon';
  state.placedBridges.bridge = { room: 'redDungeon', x: 480, y: 322.5, vertical: true };
  assert.equal(game.blocked('redDungeon', 480, 322.5), false);
  assert.equal(game.blocked('redDungeon', 410, 322.5), true);
  delete state.placedBridges.bridge;
  assert.equal(game.blocked('redDungeon', 480, 322.5), true);
});

test('the White Dungeon gap is shorter than the bridge', () => {
  const game = loadGame();
  game.initial('gold');
  const state = game.state();
  state.room = 'redDungeon';
  assert.equal(game.blocked('redDungeon', 480, 250), false);
  assert.equal(game.blocked('redDungeon', 480, 322.5), true);
  assert.equal(game.blocked('redDungeon', 480, 394), false);
});

test('an exposed maze leg is picked up on contact without a button press', () => {
  const game = loadGame();
  game.initial('gold');
  const state = game.state();
  state.mode = 'playing';
  state.room = 'mazeTR';
  state.player.x = 400;
  state.player.y = 499;
  assert.equal(game.exposedBridgeLeg('bridge2'), true);
  state.player.x = 275;
  state.player.y = 330;
  state.dragons = [];
  assert.equal(game.exposedBridgeLeg('bridge2'), false);
  game.window.joystickInput.y = 1;
  game.update(0.05);
  assert.equal(state.held, 'bridge2');
  assert.equal(state.placedBridges.bridge2, undefined);
  assert.equal(game.itemPosition('bridge2').x, 340);
  assert.equal(game.itemPosition('bridge2').y, 427);
  state.player.x += 20;
  state.player.y += 10;
  assert.equal(game.itemPosition('bridge2').x, 360);
  assert.equal(game.itemPosition('bridge2').y, 437);
  game.placeBridge();
  assert.equal(state.placedBridges.bridge2.x, 360);
  assert.equal(state.placedBridges.bridge2.y, 437);
});

test('purple pixels inside the bridge can be touched, while transparent space cannot', () => {
  const game = loadGame();
  game.initial('gold');
  const state = game.state();
  state.mode = 'playing';
  state.room = 'mazeTR';
  state.dragons = [];
  const pixels = new Uint8Array(70 * 51 * 4);
  pixels[(25 * 70 + 30) * 4 + 3] = 255;
  game.setBridgePixels(pixels);
  state.player.x = 390;
  state.player.y = 427;
  assert.equal(game.exposedBridgeLeg('bridge2'), false);
  state.player.x = 330;
  assert.equal(game.exposedBridgeLeg('bridge2'), true);
  game.window.joystickInput.x = 0.1;
  game.update(0.05);
  assert.equal(state.held, 'bridge2');
});

test('the dungeon bridge stays placed through the center and lifts at a leg', () => {
  const game = loadGame();
  game.initial('gold');
  const state = game.state();
  state.mode = 'playing';
  state.room = 'redDungeon';
  state.placedBridges.bridge = { room: 'redDungeon', x: 480, y: 322.5, vertical: true };
  state.dragons = [];
  game.window.joystickInput.y = 1;
  state.player.x = 480;
  state.player.y = 210;
  game.update(0.05);
  assert.ok(state.placedBridges.bridge);
  state.player.x = 414;
  state.player.y = 234.5;
  game.update(0.05);
  assert.equal(state.held, 'bridge');
  assert.equal(state.placedBridges.bridge, undefined);
});

test('walking between the bridge legs does not pick it up', () => {
  const game = loadGame();
  game.initial('gold');
  const state = game.state();
  state.mode = 'playing';
  state.room = 'redDungeon';
  state.placedBridges.bridge = { room: 'redDungeon', x: 480, y: 322.5, vertical: true };
  state.dragons = [];
  game.window.joystickInput.y = 1;
  state.player.x = 435;
  state.player.y = 210;
  for (let i = 0; i < 14; i++) game.update(0.05);
  assert.ok(state.player.y > 394);
  assert.equal(game.exposedBridgeLeg('bridge'), false);
  assert.ok(state.placedBridges.bridge);
  assert.equal(state.held, null);
  state.player.x = 414;
  state.player.y = 234.5;
  game.update(0.05);
  assert.equal(state.held, 'bridge');
});

test('a bridge placed in another maze room opens only its own crossing', () => {
  const game = loadGame();
  game.initial('gold');
  const state = game.state();
  state.mode = 'playing';
  state.room = 'mazeTL';
  state.player.x = 300;
  state.player.y = 122;
  state.player.face = 'down';
  state.heldSide = 'down';
  state.held = 'bridge';
  state.items.bridge.room = 'held';
  state.dragons = [];
  game.placeBridge();
  const placement = state.placedBridges.bridge;
  assert.equal(placement.room, 'mazeTL');
  assert.equal(placement.vertical, true);
  assert.equal(placement.x, 300);
  assert.equal(placement.y, 210);
  assert.ok(placement.y > 200 && placement.y < 225);
  assert.equal(game.blocked('mazeTL', 300, 210), false);
  assert.equal(game.blocked('mazeTL', 200, 210), true);
  game.window.joystickInput.y = 1;
  for (let i = 0; i < 11; i++) game.update(0.05);
  assert.ok(state.player.y > 267);
  assert.ok(state.placedBridges.bridge);
  state.pickupDelay = 0;
  state.player.x = placement.x - 66;
  state.player.y = placement.y + 72 + 35;
  game.window.joystickInput.y = -1;
  game.update(0.05);
  assert.equal(state.held, 'bridge');
  assert.equal(state.placedBridges.bridge, undefined);
});

test('a bridge stays upright when placed while facing sideways', () => {
  const game = loadGame();
  game.initial('gold');
  const state = game.state();
  state.mode = 'playing';
  state.room = 'mazeTR';
  state.player.x = 180;
  state.player.y = 300;
  state.player.face = 'right';
  state.heldSide = 'right';
  state.held = 'bridge';
  state.items.bridge.room = 'held';
  game.placeBridge();
  assert.equal(state.placedBridges.bridge.vertical, true);
  assert.equal(state.placedBridges.bridge.x, 268);
  assert.equal(game.blocked('mazeTR', 215, 300), true);
  assert.equal(game.blocked('mazeTR', 215, 400), true);
});

test('setting a bridge down keeps its carried position on open ground', () => {
  const game = loadGame();
  game.initial('gold');
  const state = game.state();
  state.mode = 'playing';
  state.room = 'road';
  state.player.x = 480;
  state.player.y = 320;
  state.player.face = 'right';
  state.heldSide = 'left';
  state.held = 'bridge';
  state.items.bridge.room = 'held';
  game.placeBridge();
  assert.equal(state.placedBridges.bridge.x, 392);
  assert.equal(state.placedBridges.bridge.y, 320);
  assert.equal(state.items.bridge.x, 392);
  assert.equal(state.items.bridge.y, 320);
});

test('placing a carried bridge still spans the dungeon gap', () => {
  const game = loadGame();
  game.initial('gold');
  const state = game.state();
  state.mode = 'playing';
  state.room = 'redDungeon';
  state.player.x = 480;
  state.player.y = 234;
  state.player.face = 'down';
  state.heldSide = 'down';
  state.held = 'bridge';
  state.items.bridge.room = 'held';
  state.dragons = [];
  game.placeBridge();
  assert.equal(state.placedBridges.bridge.room, 'redDungeon');
  assert.equal(state.placedBridges.bridge.y, 322);
  assert.equal(game.blocked('redDungeon', 480, 322), false);
  assert.equal(game.blocked('redDungeon', 410, 322), true);
  game.window.joystickInput.y = 1;
  for (let i = 0; i < 14; i++) game.update(0.05);
  assert.ok(state.player.y > 394);
  assert.ok(state.placedBridges.bridge);
});
