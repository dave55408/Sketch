const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('upward joystick input enters the gold castle with its key', () => {
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
  const window = { joystickInput: { x: 0, y: 0 }, addEventListener() {} };
  const context = {
    document: {
      getElementById: element, querySelectorAll() { return []; }, addEventListener() {},
      body: { classList: { add() {}, toggle() {} } }
    },
    window, Audio: class { pause() {} }, Image: class {},
    requestAnimationFrame() {}, clearTimeout() {}, setTimeout() {},
    performance: { now() { return 0; } }, console, Math, Set, Object, Map, Int16Array
  };
  const source = fs.readFileSync(__dirname + '/game.js', 'utf8').replace(
    /\}\)\(\);\s*$/, 'globalThis.testApi={initial,gateCheck,state:()=>state};})();'
  );
  vm.runInNewContext(source, context);

  const { initial, gateCheck, state } = context.testApi;
  initial('gold');
  const game = state();
  game.mode = 'playing';
  game.player.x = 480;
  game.player.y = 500;
  game.held = 'goldKey';
  game.heldSide = 'up';
  game.gateLift.gold = 1;

  gateCheck();
  assert.equal(game.gates.gold, true);
  assert.equal(game.room, 'gold');
  window.joystickInput.y = -1;
  gateCheck();
  assert.equal(game.room, 'goldInside');
});
