const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('joystick clamps movement and leaves other touches alone', () => {
  const listeners = new Map();
  const circles = [];
  const logs = [];
  let nextFrame;
  const ctx = {
    setTransform() {}, clearRect() {}, beginPath() {}, fill() {},
    arc(x, y, radius) { circles.push({ x, y, radius }); }
  };
  const canvas = {
    getContext() { return ctx; },
    getBoundingClientRect() { return { left: 0, top: 0, right: 320, bottom: 568, width: 320, height: 568 }; }
  };
  const window = {
    devicePixelRatio: 2,
    matchMedia() { return { matches: true, addEventListener() {} }; },
    addEventListener(type, handler) { listeners.set(type, handler); }
  };
  vm.runInNewContext(fs.readFileSync(__dirname + '/joystick.js', 'utf8'), {
    document: { getElementById() { return canvas; } }, window,
    requestAnimationFrame(handler) { nextFrame = handler; },
    console: { log(message) { logs.push(message); } }, Math
  });

  assert.equal(canvas.width, 640);
  assert.equal(canvas.height, 1136);
  nextFrame();
  assert.deepEqual(circles.slice(0, 2), [
    { x: 100, y: 468, radius: 60 },
    { x: 100, y: 468, radius: 30 }
  ]);
  assert.match(logs.at(-1), /X: 0\.00, Y: 0\.00/);

  function emit(type, touches) {
    let prevented = false;
    listeners.get(type)({ changedTouches: touches, preventDefault() { prevented = true; } });
    return prevented;
  }
  const joystick = (x, y) => ({ identifier: 1, clientX: x, clientY: y });
  const other = { identifier: 2, clientX: 280, clientY: 468 };
  assert.equal(emit('touchstart', [other]), false);
  assert.equal(emit('touchstart', [joystick(100, 468)]), true);
  assert.equal(emit('touchmove', [joystick(300, 468)]), true);
  assert.equal(window.joystickInput.x, 1);
  assert.equal(window.joystickInput.y, 0);
  assert.equal(emit('touchmove', [other]), false);
  emit('touchend', [other]);
  assert.equal(window.joystickInput.x, 1);
  circles.length = 0;
  nextFrame();
  assert.deepEqual(circles[1], { x: 130, y: 468, radius: 30 });
  assert.match(logs.at(-1), /X: 1\.00, Y: 0\.00/);
  emit('touchend', [joystick(300, 468)]);
  assert.deepEqual({ ...window.joystickInput }, { x: 0, y: 0 });
});
