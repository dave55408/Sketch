(() => {
  const canvas = document.getElementById('virtualJoystick');
  const ctx = canvas.getContext('2d');
  const visible = window.matchMedia('(max-width: 899px) and (orientation: portrait), (max-width: 399px)');
  const input = window.joystickInput = { x: 0, y: 0 };
  const outerRadius = 60;
  const thumbRadius = 30;
  const travel = outerRadius - thumbRadius;
  const padding = 40;
  let touchId = null;

  function center() {
    const rect = canvas.getBoundingClientRect();
    return { x: rect.left + padding + outerRadius, y: rect.bottom - padding - outerRadius };
  }

  function setInput(touch) {
    const origin = center();
    const dx = touch.clientX - origin.x;
    const dy = touch.clientY - origin.y;
    const distance = Math.hypot(dx, dy);
    const scale = distance > travel ? travel / distance : 1;
    input.x = dx * scale / travel;
    input.y = dy * scale / travel;
  }

  function resetInput() {
    touchId = null;
    input.x = 0;
    input.y = 0;
  }

  function activeTouch(event) {
    for (const touch of event.changedTouches) {
      if (touch.identifier === touchId) return touch;
    }
    return null;
  }

  window.addEventListener('touchstart', event => {
    if (!visible.matches || touchId !== null) return;
    const origin = center();
    for (const touch of event.changedTouches) {
      if (Math.hypot(touch.clientX - origin.x, touch.clientY - origin.y) > outerRadius) continue;
      touchId = touch.identifier;
      setInput(touch);
      event.preventDefault();
      break;
    }
  }, { passive: false });

  window.addEventListener('touchmove', event => {
    if (touchId === null) return;
    const touch = activeTouch(event);
    if (!touch) return;
    setInput(touch);
    event.preventDefault();
  }, { passive: false });

  for (const type of ['touchend', 'touchcancel']) {
    window.addEventListener(type, event => {
      if (touchId !== null && activeTouch(event)) resetInput();
    });
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function drawCircle(x, y, radius, color) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function frame() {
    if (visible.matches) {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      const origin = center();
      drawCircle(origin.x - rect.left, origin.y - rect.top, outerRadius, '#808080');
      drawCircle(origin.x - rect.left + input.x * travel, origin.y - rect.top + input.y * travel, thumbRadius, '#ffffff');
      console.log(`Joystick X: ${input.x.toFixed(2)}, Y: ${input.y.toFixed(2)}`);
    }
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resizeCanvas);
  visible.addEventListener('change', () => { resetInput(); resizeCanvas(); });
  resizeCanvas();
  requestAnimationFrame(frame);
})();
