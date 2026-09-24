    document.addEventListener('pointerup', finishPointerAction);
    document.addEventListener('pointercancel', finishPointerAction);
    document.addEventListener('keydown', (event) => {
      if (event.code === 'KeyX' && !editor) circleKeyPressed = true;
      if (event.code === 'KeyZ' && !editor && !event.ctrlKey && !event.altKey && !event.metaKey && (!isTextEntryTarget(event.target) || event.target === zoomPercentage)) {
        if (event.target === zoomPercentage) event.preventDefault();
        zoomKeyHeld = true;
        updateBrushCursor();
      }
      if (event.code === 'Space' && !editor && !event.ctrlKey && !event.altKey && !event.metaKey && !isTextEntryTarget(event.target)) {
        event.preventDefault();
        if (selection) {
          beginSelectionMutation();
          detachSelection();
          return;
        }
        panKeyHeld = true;
        updateBrushCursor();
      }
    });
    document.addEventListener('keyup', (event) => {
      if (event.code === 'KeyX') circleKeyPressed = false;
      if (event.code === 'KeyZ') {
        zoomKeyHeld = false;
        canvasPan = null;
        updateBrushCursor();
      }
      if (event.code === 'Space') {
        panKeyHeld = false;
        canvasPan = null;
        updateBrushCursor();
      }
    });
    window.addEventListener('blur', () => { circleKeyPressed = false; zoomKeyHeld = false; panKeyHeld = false; canvasPan = null; updateBrushCursor(); });
    lineWidth.addEventListener('input', () => {
      document.getElementById('widthNumber').textContent = lineWidth.value;
      updateBrushCursor();
    });
    textSize.addEventListener('input', () => {
      document.getElementById('textNumber').textContent = textSize.value;
      updateBrushCursor();
      positionTextMoveHandle();
    });
    function selectTool(isTextMode) {
      const selectedTool = isTextMode ? textTool : drawTool;
      if (selectedTool.checked) return;
      selectedTool.checked = true;
      selectedTool.dispatchEvent(new Event('change'));
    }
    function armShape(isEllipse) {
      if (selectionToolActive()) exitSelectMode();
      else selectTool(false);
      queuedShape = { shiftKey: false, altKey: false, isEllipse, fromToolbar: true };
      document.getElementById('boxButton').classList.toggle('shape-active', !isEllipse);
      document.getElementById('circleButton').classList.toggle('shape-active', isEllipse);
    }
    function disarmToolbarShape() {
      queuedShape = null;
      document.querySelectorAll('#boxButton, #circleButton').forEach((button) => button.classList.remove('shape-active'));
      shapeConstrain.checked = false;
    }
    document.querySelector('.tools').addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (button && button !== colorPickerButton) {
        setColorPickerMode(false);
        if (!button.matches('#boxButton, #circleButton')) disarmToolbarShape();
      }
    });
    document.getElementById('undoButton').addEventListener('click', undoLast);
    document.getElementById('redoButton').addEventListener('click', redoLast);
    document.getElementById('cutButton').addEventListener('click', cutSelection);
    document.getElementById('copyButton').addEventListener('click', copySelection);
    document.getElementById('pasteButton').addEventListener('click', () => { pasteSelection(); });
    document.getElementById('mirrorButton').addEventListener('click', () => { flipActiveImage(); });
    document.getElementById('strokeButton').addEventListener('click', strokeSelectionMarquee);
    document.getElementById('shapeEffectsButton').addEventListener('click', () => {
      if (pendingImage) showImageEffectsControl();
      else if (selection) showSelectionBlurControl();
      else showSelectionRequiredMessage();
    });
    document.getElementById('boxButton').addEventListener('click', () => armShape(false));
    document.getElementById('circleButton').addEventListener('click', () => armShape(true));
    lineWidth.addEventListener('pointerdown', () => { setColorPickerMode(false); selectTool(false); });
    lineWidth.addEventListener('focus', () => { setColorPickerMode(false); selectTool(false); });
    textSize.addEventListener('pointerdown', () => { setColorPickerMode(false); selectTool(true); });
    textSize.addEventListener('focus', () => { setColorPickerMode(false); selectTool(true); });
    shapeConstrain.addEventListener('change', () => setColorPickerMode(false));
    moreControls.addEventListener('change', () => setColorPickerMode(false));
    zoomPercentage.addEventListener('focus', () => setColorPickerMode(false));
    colorPickerButton.addEventListener('click', () => setColorPickerMode(!colorPickerMode));
    document.querySelectorAll('.color-swatch').forEach((swatch) => swatch.addEventListener('click', () => {
      color.value = swatchDrawColor(swatch);
      document.querySelectorAll('.color-swatch').forEach((item) => item.classList.toggle('active', item === swatch));
      updateWashAppearance();
      refreshOpenEffectsShadowColor();
      updateBrushCursor();
    }));
    color.addEventListener('input', () => {
      if (!colorPickerSampleInProgress) setColorPickerMode(false);
      document.querySelectorAll('.color-swatch').forEach((swatch) => {
        swatch.classList.toggle('active', swatchDrawColor(swatch).toLowerCase() === color.value.toLowerCase());
      });
      updateWashAppearance();
      refreshOpenEffectsShadowColor();
      updateBrushCursor();
    });
    wash.addEventListener('change', () => {
      if (!colorPickerSampleInProgress) setColorPickerMode(false);
      updateWashAppearance();
      refreshOpenEffectsShadowColor();
      updateBrushCursor();
    });
    [drawTool, textTool].forEach((tool) => tool.addEventListener('change', () => {
      if (!tool.checked) return;
      setColorPickerMode(false);
      setFillMode(false);
      selectButton.classList.remove('active');
      selectButton.setAttribute('aria-pressed', 'false');
      removeSelection();
      commitText();
      canvas.style.cursor = 'none';
      updateBrushCursor();
    }));
    [drawTool, textTool].forEach((tool) => tool.addEventListener('click', () => setFillMode(false)));
    fillButton.addEventListener('click', () => {
      setColorPickerMode(false);
      cancelImagePlacement();
      commitText();
      removeSelection();
      selectButton.classList.remove('active');
      selectButton.setAttribute('aria-pressed', 'false');
      const activating = !fillMode;
      setFillMode(activating);
      if (!activating) drawTool.checked = true;
    });
    document.addEventListener('keydown', (event) => {
      if (event.target === zoomPercentage) return;
      if (event.code === 'Enter' && !editor && (pendingImage || selection)) {
        event.preventDefault();
        if (pendingImage) placePendingImage();
        else commitSelection();
        return;
      }
      if (event.code === 'Delete') {
        if (pendingImage) {
          event.preventDefault();
          cancelImagePlacement();
          return;
        }
        if (editor) {
          event.preventDefault();
          editor.moveHandle?.remove();
          editor.remove();
          editor = null;
          textDrag = null;
          return;
        }
        if (selection) {
          event.preventDefault();
          eraseSelection();
          return;
        }
      }
      if (event.code === 'Escape' && colorPickerMode) {
        event.preventDefault();
        setColorPickerMode(false);
        return;
      }
      if (event.code === 'Escape') {
        event.preventDefault();
        if (editor) {
          editor.moveHandle?.remove();
          editor.remove();
          editor = null;
          textDrag = null;
        }
        cancelImagePlacement();
        removeSelection();
        selectionDraftElement?.remove();
        selectionDraftElement = null;
        selectionDraft = null;
        selectButton.classList.remove('active');
        selectButton.setAttribute('aria-pressed', 'false');
        setFillMode(false);
        drawTool.checked = true;
        textTool.checked = false;
        updateBrushCursor();
        return;
      }
      if (primaryModifierPressed(event) && event.code === 'KeyC' && !editor && selection) {
        event.preventDefault();
        copySelection();
        return;
      }
      if (primaryModifierPressed(event) && event.code === 'KeyX' && !editor && selection) {
        event.preventDefault();
        cutSelection();
        return;
      }
      if (primaryModifierPressed(event) && event.code === 'KeyV' && !editor) {
        event.preventDefault();
        pasteSelection();
        return;
      }
      if (primaryModifierPressed(event) && event.code === 'KeyZ' && !editor && !(event.metaKey && event.shiftKey)) {
        event.preventDefault();
        undoLast();
        return;
      }
      if (primaryModifierPressed(event) && (event.code === 'KeyY' || (event.metaKey && event.shiftKey && event.code === 'KeyZ')) && !editor) {
        event.preventDefault();
        redoLast();
        return;
      }
      if (pendingImage && !editor && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) {
        event.preventDefault();
        if (event.code === 'ArrowLeft') pendingImage.x -= 1;
        if (event.code === 'ArrowRight') pendingImage.x += 1;
        if (event.code === 'ArrowUp') pendingImage.y -= 1;
        if (event.code === 'ArrowDown') pendingImage.y += 1;
        updateImagePreview();
        return;
      }
      if (selection?.detached && !editor && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) {
        event.preventDefault();
        if (event.code === 'ArrowLeft') selection.x -= 1;
        if (event.code === 'ArrowRight') selection.x += 1;
        if (event.code === 'ArrowUp') selection.y -= 1;
        if (event.code === 'ArrowDown') selection.y += 1;
        renderSelection();
        return;
      }
      if (event.code === 'Backquote' && editor) {
        event.preventDefault();
        editor.moveHandle?.remove();
        editor.remove();
        editor = null;
        selectTool(false);
        return;
      }
      if (editor && event.target === editor && (event.code === 'ArrowUp' || event.code === 'ArrowDown')) {
        event.preventDefault();
        const direction = event.code === 'ArrowUp' ? 1 : -1;
        textSize.value = Math.min(Number(textSize.max), Math.max(Number(textSize.min), Number(textSize.value) + direction));
        textSize.dispatchEvent(new Event('input'));
        editor.style.fontSize = `${textSize.value}px`;
        return;
      }
      if (editor && event.target === editor && (event.code === 'ArrowLeft' || event.code === 'ArrowRight')) {
        event.preventDefault();
        const swatches = [...document.querySelectorAll('.color-swatch')];
        const selected = swatches.findIndex((swatch) => swatchDrawColor(swatch).toLowerCase() === color.value.toLowerCase());
        const direction = event.code === 'ArrowRight' ? 1 : -1;
        swatches[(selected + direction + swatches.length) % swatches.length].click();
        return;
      }
      const typingInField = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(event.target.tagName);
      if (event.code === 'KeyE' && !editor && pendingImage) {
        event.preventDefault();
        showImageEffectsControl();
        return;
      }
      if (event.code === 'KeyE' && !editor && selection) {
        event.preventDefault();
        showSelectionBlurControl();
        return;
      }
      if (event.code === 'KeyL' && !editor) {
        event.preventDefault();
        strokeSelectionMarquee();
        return;
      }
      if (event.code === 'KeyF' && !editor) {
        event.preventDefault();
        fillButton.click();
        return;
      }
      if (event.code === 'KeyW' && !editor) {
        event.preventDefault();
        wash.checked = !wash.checked;
        wash.dispatchEvent(new Event('change'));
        return;
      }
      if (event.code === 'KeyT' && !editor && !typingInField) {
        event.preventDefault();
        toggleTheme();
        return;
      }
      if (event.code === 'KeyM' && event.shiftKey && !editor) {
        event.preventDefault();
        toggleSpectrumRotation();
        return;
      }
      if (event.code === 'KeyM' && !editor && flipActiveImage()) {
        event.preventDefault();
        return;
      }
      if (event.code === 'KeyS' && !editor) {
        event.preventDefault();
        if (event.repeat) return;
        const now = performance.now();
        if (now - lastSelectShortcutAt < 350) {
          selectionMode = selectionMode === 'rect' ? 'lasso' : 'rect';
          selectionMenu.hidden = true;
          selectMode.setAttribute('aria-expanded', 'false');
          updateSelectionToolButton();
        }
        lastSelectShortcutAt = now;
        if (!selectionToolActive()) selectButton.click();
        return;
      }
      if (event.code === 'KeyR' && (!editor || event.target === editor)) {
        event.preventDefault();
        document.querySelector('.floating-help')?.remove();
        resetSketchPad({ preserveText: Boolean(editor) });
        return;
      }
      if (event.code === 'KeyC' && !primaryModifierPressed(event) && !editor) {
        event.preventDefault();
        if (!clearDialog.open) clearDialog.showModal();
        return;
      }
      const navigationCode = ({ Digit1: 'ArrowLeft', Digit2: 'ArrowRight', Digit3: 'ArrowUp', Digit4: 'ArrowDown' })[event.code] || event.code;
      if ((navigationCode === 'ArrowLeft' || navigationCode === 'ArrowRight') && !editor) {
        event.preventDefault();
        const swatches = [...document.querySelectorAll('.color-swatch')];
        const selected = swatches.findIndex((swatch) => swatchDrawColor(swatch).toLowerCase() === color.value.toLowerCase());
        const direction = navigationCode === 'ArrowRight' ? 1 : -1;
        const next = (selected + direction + swatches.length) % swatches.length;
        swatches[next].click();
        return;
      }
      if ((navigationCode === 'ArrowUp' || navigationCode === 'ArrowDown') && !editor) {
        event.preventDefault();
        const control = textTool.checked ? textSize : lineWidth;
        const direction = navigationCode === 'ArrowUp' ? 1 : -1;
        control.value = Math.min(Number(control.max), Math.max(Number(control.min), Number(control.value) + direction));
        control.dispatchEvent(new Event('input'));
        control.blur();
        return;
      }
      if (event.code !== 'Backquote' || editor) return;
      event.preventDefault();
      if (selectionToolActive()) {
        exitSelectMode();
        return;
      }
      selectTool(!textTool.checked);
    });
