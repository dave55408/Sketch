    function coordinates(event) {
      const bounds = canvas.getBoundingClientRect();
      return {
        x: (event.clientX - bounds.left) * canvas.width / bounds.width,
        y: (event.clientY - bounds.top) * canvas.height / bounds.height,
      };
    }
    function recolorFillCursorBucket() {
      const selectedColor = color.value.toLowerCase();
      const colorKey = `${selectedColor}:${wash.checked}`;
      if (!fillCursorSource.complete || !fillCursorSource.naturalWidth || fillCursorColor === colorKey) return;
      try {
        const swatch = document.createElement('canvas');
        swatch.width = fillCursorSource.naturalWidth;
        swatch.height = fillCursorSource.naturalHeight;
        const swatchContext = swatch.getContext('2d');
        swatchContext.drawImage(fillCursorSource, 0, 0);
        const pixels = swatchContext.getImageData(0, 0, swatch.width, swatch.height);
        const red = Number.parseInt(selectedColor.slice(1, 3), 16);
        const green = Number.parseInt(selectedColor.slice(3, 5), 16);
        const blue = Number.parseInt(selectedColor.slice(5, 7), 16);
        for (let index = 0; index < pixels.data.length; index += 4) {
          if (pixels.data[index + 3] && pixels.data[index] > 140 && pixels.data[index] > pixels.data[index + 1] * 2 && pixels.data[index] > pixels.data[index + 2] * 2) {
            pixels.data[index] = red;
            pixels.data[index + 1] = green;
            pixels.data[index + 2] = blue;
            pixels.data[index + 3] = Math.round(pixels.data[index + 3] * (wash.checked ? .3 : 1));
          }
        }
        swatchContext.putImageData(pixels, 0, 0);
        fillCursorBucket.src = swatch.toDataURL();
        fillCursorColor = colorKey;
      } catch (_) {
        fillCursorBucket.src = 'assets/fill_red.png';
      }
    }
    function updateBrushCursor(point) {
      canvas.classList.toggle('fill-active', fillMode);
      canvas.classList.toggle('color-picker-active', colorPickerMode);
      canvas.style.cursor = panModeActive() ? (canvasPan ? 'grabbing' : 'grab') : colorPickerMode ? 'none' : fillMode ? 'none' : pendingImage || selectionToolActive() ? 'crosshair' : 'none';
      brushCursor.hidden = panModeActive() || colorPickerMode || fillMode || textTool.checked || selectionToolActive() || !pointerOverCanvas || Boolean(pendingImage);
      textCursor.hidden = panModeActive() || colorPickerMode || fillMode || !textTool.checked || selectionToolActive() || !pointerOverCanvas || Boolean(pendingImage);
      fillCursor.hidden = panModeActive() || colorPickerMode || !fillMode || !pointerOverCanvas;
      colorPickerCursor.hidden = panModeActive() || !colorPickerMode || !pointerOverCanvas;
      fillCursor.style.color = wash.checked ? washColor(color.value, .3) : color.value;
      recolorFillCursorBucket();
      if (!brushCursor.hidden) {
        const size = Number(lineWidth.value);
        brushCursor.style.width = `${size}px`;
        brushCursor.style.height = `${size}px`;
        brushCursor.style.background = color.value;
        brushCursor.style.opacity = wash.checked ? '.3' : '.65';
      }
      if (!textCursor.hidden) {
        textCursor.style.height = `${textSize.value}px`;
        const selectedColor = color.value.toLowerCase();
        const darkMode = document.documentElement.dataset.theme === 'dark';
        textCursor.style.color = darkMode && ['#080808', '#ffffff'].includes(selectedColor)
          ? '#CCCCCC'
          : selectedColor === '#ffffff' ? '#111827' : color.value;
        textCursor.style.opacity = wash.checked ? '.3' : '1';
      }
      if (point) {
        const canvasBounds = canvas.getBoundingClientRect();
        const areaBounds = area.getBoundingClientRect();
        const x = canvasBounds.left - areaBounds.left + point.x * canvasBounds.width / canvas.width;
        const y = canvasBounds.top - areaBounds.top + point.y * canvasBounds.height / canvas.height;
        brushCursor.style.left = `${x}px`;
        brushCursor.style.top = `${y}px`;
        textCursor.style.left = `${x}px`;
        textCursor.style.top = `${y}px`;
        fillCursor.style.left = `${x}px`;
        fillCursor.style.top = `${y}px`;
        colorPickerCursor.style.left = `${x}px`;
        colorPickerCursor.style.top = `${y}px`;
      }
    }
    function washColor(hex, opacity) {
      const value = hex.replace('#', '');
      const red = Number.parseInt(value.slice(0, 2), 16);
      const green = Number.parseInt(value.slice(2, 4), 16);
      const blue = Number.parseInt(value.slice(4, 6), 16);
      return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
    }
    function lightWashSwatchColor(hex) {
      const value = hex.replace('#', '');
      const base = [48, 48, 48];
      return `rgb(${[0, 2, 4].map((offset, index) => Math.round(Number.parseInt(value.slice(offset, offset + 2), 16) * .3 + base[index] * .7)).join(', ')})`;
    }
    function calculateConstrainedBox(startPoint, currentPoint, modifiers) {
      const deltaX = currentPoint.x - startPoint.x;
      const deltaY = currentPoint.y - startPoint.y;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      if (modifiers.altKey && modifiers.shiftKey) {
        const size = Math.max(absX, absY);
        return { x: startPoint.x - size, y: startPoint.y - size, width: size * 2, height: size * 2 };
      }
      if (modifiers.altKey) return { x: startPoint.x - absX, y: startPoint.y - absY, width: absX * 2, height: absY * 2 };
      if (modifiers.shiftKey) {
        const size = Math.max(absX, absY);
        const directionX = Math.sign(deltaX) || Math.sign(deltaY) || 1;
        const directionY = Math.sign(deltaY) || Math.sign(deltaX) || 1;
        return { x: directionX < 0 ? startPoint.x - size : startPoint.x, y: directionY < 0 ? startPoint.y - size : startPoint.y, width: size, height: size };
      }
      return { x: Math.min(startPoint.x, currentPoint.x), y: Math.min(startPoint.y, currentPoint.y), width: absX, height: absY };
    }
    function constrainLinePoint(startPoint, currentPoint) {
      const deltaX = currentPoint.x - startPoint.x;
      const deltaY = currentPoint.y - startPoint.y;
      const angle = Math.atan2(deltaY, deltaX);
      const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
      const distance = deltaX * Math.cos(snappedAngle) + deltaY * Math.sin(snappedAngle);
      return {
        x: startPoint.x + distance * Math.cos(snappedAngle),
        y: startPoint.y + distance * Math.sin(snappedAngle),
      };
    }
    function drawConstrainedBox(box, isEllipse = false) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(strokeBase, 0, 0);
      ctx.beginPath();
      if (isEllipse) ctx.ellipse(box.x + box.width / 2, box.y + box.height / 2, box.width / 2, box.height / 2, 0, 0, Math.PI * 2);
      else ctx.rect(box.x, box.y, box.width, box.height);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineJoin = 'miter';
      ctx.globalAlpha = strokeAlpha;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineJoin = 'round';
    }
    function showSelectionRequiredMessage() {
      alert('These controls need an active selection to work.');
    }
    function strokeSelectionMarquee() {
      if (!selection) {
        showSelectionRequiredMessage();
        return false;
      }
      beginSelectionMutation();
      selection.marqueeStroke = { color: color.value, width: Number(lineWidth.value), alpha: wash.checked ? .3 : 1 };
      renderSelection();
      return true;
    }
    function applySelectionBlur(amount) {
      if (!selection?.blurSource) return;
      const adjustments = selection.colorAdjustments || { brightness: 0, contrast: 0, grayscale: 0, sepia: 0, invert: 0, saturation: 0, hue: 0 };
      const contentContext = selection.content.getContext('2d');
      contentContext.clearRect(0, 0, selection.content.width, selection.content.height);
      contentContext.save();
      contentContext.filter = `${amount ? `blur(${amount}px) ` : ''}brightness(${100 + adjustments.brightness}%) contrast(${100 + adjustments.contrast}%) grayscale(${adjustments.grayscale}%) sepia(${adjustments.sepia}%) invert(${adjustments.invert}%) saturate(${100 + (adjustments.saturation || 0)}%) hue-rotate(${adjustments.hue}deg)`;
      contentContext.drawImage(selection.blurSource, 0, 0);
      contentContext.restore();
      const preview = selection.container.querySelector('canvas');
      preview.width = selection.content.width;
      preview.height = selection.content.height;
      preview.getContext('2d').drawImage(selection.content, 0, 0);
      renderSelection();
    }
    function setEffectsToolbarActive(active) {
      document.getElementById('shapeEffectsButton').classList.toggle('shape-active', active);
    }
    function showSelectionBlurControl() {
      if (!selection) return false;
      selection.colorAdjustments ||= { brightness: 0, contrast: 0, grayscale: 0, sepia: 0, invert: 0, saturation: 0, hue: 0 };
      if (!selection.blurSource) {
        beginSelectionMutation();
        selection.blurSource = document.createElement('canvas');
        selection.blurSource.width = selection.content.width;
        selection.blurSource.height = selection.content.height;
        selection.blurSource.getContext('2d').drawImage(selection.content, 0, 0);
      }
      if (!selection.blurControl) {
        const control = document.createElement('div');
        control.className = 'selection-blur-control';
        control.innerHTML = '<label>Blur <input data-blur type="range" min="0" max="30" value="4" aria-label="Blur amount"><output data-blur-value>4</output></label><label>Shadow size <input data-shadow type="range" min="0" max="30" value="0" aria-label="Shadow width"><output data-shadow-value>0</output><select data-shadow-direction aria-label="Shadow direction"><option value="se">⬊</option><option value="s">⬇</option><option value="sw">⬋</option><option value="e">➡</option><option value="w">⬅</option><option value="ne">⬈</option><option value="n">⬆</option><option value="nw">⬉</option></select></label>';
        control.insertAdjacentHTML('afterbegin', '<div class="selection-effects-title">Selection effects</div>');
        const blurRange = control.querySelector('[data-blur]');
        const blurOutput = control.querySelector('[data-blur-value]');
        const shadowRange = control.querySelector('[data-shadow]');
        const shadowDirection = control.querySelector('[data-shadow-direction]');
        const shadowOutput = control.querySelector('[data-shadow-value]');
        shadowDirection.title = 'Shadow offset direction';
        blurRange.value = '0';
        blurOutput.value = '0';
        blurOutput.textContent = '0';
        shadowDirection.innerHTML = '<option value="none">No offset</option><option value="n">&#11014;</option><option value="ne">&#11016;</option><option value="e">&#10145;</option><option value="se" selected>&#11018;</option><option value="s">&#11015;</option><option value="sw">&#11019;</option><option value="w">&#11013;</option><option value="nw">&#11017;</option>';
        shadowDirection.options[0].text = '.';
        shadowDirection.value = 'se';
        addShadowDirectionTooltips(shadowDirection);
        control.insertAdjacentHTML('beforeend', '<label>Shadow blur <input data-shadow-blur type="range" min="0" max="30" value="0" aria-label="Shadow blur amount"><output data-shadow-blur-value>0</output></label>');
        const shadowBlurRange = control.querySelector('[data-shadow-blur]');
        const shadowBlurOutput = control.querySelector('[data-shadow-blur-value]');
        const blurSection = document.createElement('section');
        blurSection.className = 'selection-effects-section divided';
        blurSection.innerHTML = '<strong>Blur</strong>';
        blurSection.append(blurRange.closest('label'));
        const shadowSection = document.createElement('section');
        shadowSection.className = 'selection-effects-section divided shadow-section';
        shadowSection.innerHTML = '<strong>Shadow</strong>';
        shadowSection.append(shadowRange.closest('label'), shadowBlurRange.closest('label'));
        const shadowOffsetControl = document.createElement('div');
        shadowOffsetControl.className = 'shadow-offset-control';
        shadowOffsetControl.append(shadowDirection);
        shadowSection.append(shadowOffsetControl);
        const colorSection = document.createElement('section');
        colorSection.className = 'selection-effects-section divided';
        colorSection.innerHTML = '<strong>Tonal</strong><label>Brightness <input data-adjustment="brightness" type="range" min="-100" max="100" value="0"><output>0</output></label><label>Contrast <input data-adjustment="contrast" type="range" min="-100" max="100" value="0"><output>0</output></label>';
        const colorEffectsSection = document.createElement('section');
        colorEffectsSection.className = 'selection-effects-section';
        colorEffectsSection.innerHTML = '<strong>Color</strong><label>Grayscale <input data-adjustment="grayscale" type="range" min="0" max="100" value="0"><output>0</output></label><label>Hue <input data-adjustment="hue" type="range" min="0" max="360" value="0"><output>0</output></label><label>Invert <input data-adjustment="invert" type="range" min="0" max="100" value="0"><output>0</output></label><label>Saturation <input data-adjustment="saturation" type="range" min="-100" max="100" value="0"><output>0</output></label><label>Sepia <input data-adjustment="sepia" type="range" min="0" max="100" value="0"><output>0</output></label>';
        const reset = document.createElement('button');
        reset.type = 'button';
        reset.className = 'selection-effects-reset';
        reset.textContent = 'Reset to defaults';
        const actions = document.createElement('div');
        actions.className = 'selection-effects-actions';
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.textContent = 'Cancel';
        const okay = document.createElement('button');
        okay.type = 'button';
        okay.textContent = 'OK';
        actions.append(reset, cancel, okay);
        control.append(blurSection, shadowSection, colorSection, colorEffectsSection, actions);
        const adjustmentInputs = control.querySelectorAll('[data-adjustment]');
        control.addEventListener('pointerdown', (event) => event.stopPropagation());
        const title = control.querySelector('.selection-effects-title');
        const closeX = document.createElement('button');
        closeX.type = 'button';
        closeX.textContent = '\u00d7';
        closeX.title = 'Cancel effects';
        closeX.setAttribute('aria-label', 'Cancel effects');
        closeX.addEventListener('pointerdown', (event) => event.stopPropagation());
        title.append(closeX);
        title.addEventListener('pointerdown', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const bounds = control.getBoundingClientRect();
          const offsetX = event.clientX - bounds.left;
          const offsetY = event.clientY - bounds.top;
          const move = (moveEvent) => {
            const areaBounds = area.getBoundingClientRect();
            control.style.left = `${Math.max(0, Math.min(area.clientWidth - control.offsetWidth, moveEvent.clientX - areaBounds.left - offsetX))}px`;
            control.style.top = `${Math.max(0, Math.min(area.clientHeight - control.offsetHeight, moveEvent.clientY - areaBounds.top - offsetY))}px`;
            control.dataset.moved = 'true';
          };
          const stop = () => {
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', stop);
            document.removeEventListener('pointercancel', stop);
          };
          document.addEventListener('pointermove', move);
          document.addEventListener('pointerup', stop, { once: true });
          document.addEventListener('pointercancel', stop, { once: true });
        });
        blurRange.addEventListener('input', () => {
          blurOutput.value = blurRange.value;
          blurOutput.textContent = blurRange.value;
          applySelectionBlur(Number(blurRange.value));
        });
        adjustmentInputs.forEach((input) => input.addEventListener('input', () => {
          selection.colorAdjustments[input.dataset.adjustment] = Number(input.value);
          input.nextElementSibling.value = input.value;
          input.nextElementSibling.textContent = input.value;
          applySelectionBlur(Number(blurRange.value));
        }));
        const updateShadow = () => {
          shadowOutput.value = shadowRange.value;
          shadowOutput.textContent = shadowRange.value;
          shadowBlurOutput.value = shadowBlurRange.value;
          shadowBlurOutput.textContent = shadowBlurRange.value;
          selection.shadow = Number(shadowRange.value) || Number(shadowBlurRange.value) ? { width: Number(shadowRange.value), blur: Number(shadowBlurRange.value), direction: shadowDirection.value, color: color.value, alpha: wash.checked ? .3 : .5 } : null;
          renderSelection();
        };
        shadowRange.addEventListener('input', updateShadow);
        shadowBlurRange.addEventListener('input', updateShadow);
        shadowDirection.addEventListener('change', updateShadow);
        reset.addEventListener('click', () => {
          blurRange.value = shadowRange.value = shadowBlurRange.value = '0';
          blurOutput.value = blurOutput.textContent = '0';
          shadowOutput.value = shadowOutput.textContent = '0';
          shadowBlurOutput.value = shadowBlurOutput.textContent = '0';
          shadowDirection.value = 'se';
          selection.colorAdjustments = { brightness: 0, contrast: 0, grayscale: 0, sepia: 0, invert: 0, saturation: 0, hue: 0 };
          adjustmentInputs.forEach((input) => {
            input.value = '0';
            input.nextElementSibling.value = input.nextElementSibling.textContent = '0';
          });
          selection.shadow = null;
          applySelectionBlur(0);
        });
        const closeEffects = (restoreDefaults) => {
          if (!selection) return;
          if (restoreDefaults) {
            const contentContext = selection.content.getContext('2d');
            contentContext.clearRect(0, 0, selection.content.width, selection.content.height);
            contentContext.drawImage(selection.blurSource, 0, 0);
            selection.colorAdjustments = { brightness: 0, contrast: 0, grayscale: 0, sepia: 0, invert: 0, saturation: 0, hue: 0 };
            selection.shadow = null;
            const preview = selection.container.querySelector('canvas');
            preview.width = selection.content.width;
            preview.height = selection.content.height;
            preview.getContext('2d').drawImage(selection.content, 0, 0);
            renderSelection();
          }
          selection.blurControl?.remove();
          selection.blurControl = null;
          selection.blurSource = null;
          setEffectsToolbarActive(false);
        };
        cancel.addEventListener('click', () => closeEffects(true));
        closeX.addEventListener('click', () => closeEffects(true));
        okay.addEventListener('click', () => closeEffects(false));
        selection.blurControl = control;
        area.append(control);
        applySelectionBlur(Number(blurRange.value));
      }
      selection.blurControl.hidden = false;
      setEffectsToolbarActive(true);
      updateSelectionPreview();
      selection.blurControl.querySelector('[data-blur]').focus();
      return true;
    }
    function swatchDrawColor(swatch) {
      return document.documentElement.dataset.theme === 'dark' && swatch.dataset.darkColor
        ? swatch.dataset.darkColor
        : swatch.dataset.color;
    }
    function updateWashAppearance() {
      document.querySelectorAll('.color-swatch').forEach((swatch) => {
        const swatchColor = swatchDrawColor(swatch);
        swatch.style.backgroundColor = wash.checked ? (document.documentElement.dataset.theme === 'dark' ? lightWashSwatchColor(swatchColor) : washColor(swatchColor, .3)) : swatchColor;
        swatch.style.borderColor = wash.checked ? swatchColor : '';
        swatch.style.boxShadow = '';
      });
      color.style.opacity = wash.checked ? '.3' : '1';
    }
    function refreshOpenEffectsShadowColor() {
      if (selection?.blurControl && selection.shadow) {
        selection.shadow.color = color.value;
        selection.shadow.alpha = wash.checked ? .3 : .5;
        renderSelection();
      }
      if (pendingImage?.effectsControl && pendingImage.effects?.shadow) {
        pendingImage.effects.shadow.color = washColor(color.value, wash.checked ? .3 : .5);
        updateImagePreview();
      }
    }
    function save() {
      snapshots.push(canvas.toDataURL());
      redoSnapshots.length = 0;
      requestCanvasNavigatorPreview();
    }
    function setFillMode(active) {
      fillMode = active;
      if (active) setColorPickerMode(false);
      if (active) {
        drawTool.checked = false;
        textTool.checked = false;
      }
      fillButton.classList.toggle('active', active);
      fillButton.setAttribute('aria-pressed', String(active));
      updateBrushCursor();
    }
    function setColorPickerMode(active) {
      colorPickerMode = active;
      colorPickerButton.classList.toggle('shape-active', active);
      colorPickerButton.setAttribute('aria-pressed', String(active));
      if (active) setFillMode(false);
      if (!active) colorPickerPreview.hidden = true;
      updateBrushCursor();
    }
    function canvasColorAt(point) {
      const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(point.x)));
      const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(point.y)));
      const [red, green, blue, alpha] = ctx.getImageData(x, y, 1, 1).data;
      if (alpha === 0) return document.documentElement.dataset.theme === 'dark' ? '#121212' : '#FFFFFF';
      return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
    }
    function updateColorPickerPreview(point) {
      const hex = canvasColorAt(point);
      colorPickerPreviewSwatch.style.background = hex;
      colorPickerPreviewValue.value = hex.toUpperCase();
      colorPickerPreview.hidden = false;
      const canvasBounds = canvas.getBoundingClientRect();
      const areaBounds = area.getBoundingClientRect();
      const x = canvasBounds.left - areaBounds.left + point.x * canvasBounds.width / canvas.width;
      const y = canvasBounds.top - areaBounds.top + point.y * canvasBounds.height / canvas.height;
      const left = Math.min(area.clientWidth - colorPickerPreview.offsetWidth - 8, x + 24);
      const top = Math.max(8, y - colorPickerPreview.offsetHeight - 12);
      colorPickerPreview.style.left = `${Math.max(8, left)}px`;
      colorPickerPreview.style.top = `${top}px`;
    }
    function pickCanvasColor(point) {
      color.value = canvasColorAt(point);
      wash.checked = false;
      color.dispatchEvent(new Event('input'));
      wash.dispatchEvent(new Event('change'));
      setColorPickerMode(false);
    }
    function fillContainedArea(point) {
      const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(point.x)));
      const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(point.y)));
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const startIndex = (y * canvas.width + x) * 4;
      const target = [...pixels.data.slice(startIndex, startIndex + 4)];
      const colorValue = color.value.slice(1);
      const replacement = [
        Number.parseInt(colorValue.slice(0, 2), 16),
        Number.parseInt(colorValue.slice(2, 4), 16),
        Number.parseInt(colorValue.slice(4, 6), 16),
        wash.checked ? 77 : 255,
      ];
      if (target.every((value, index) => value === replacement[index])) return;
      save();
      const fillTolerance = 24;
      const isNearWhite = (index) => pixels.data[index] >= 255 - fillTolerance
        && pixels.data[index + 1] >= 255 - fillTolerance
        && pixels.data[index + 2] >= 255 - fillTolerance;
      const matchesTarget = (index) => {
        if (target[3] === 0) {
          return pixels.data[index + 3] < 128 || isNearWhite(index);
        }
        return target.every((value, channel) => Math.abs(pixels.data[index + channel] - value) <= fillTolerance);
      };
      const pixelCount = canvas.width * canvas.height;
      const queue = new Int32Array(pixelCount);
      const visited = new Uint8Array(pixelCount);
      const filled = new Uint8Array(pixelCount);
      let head = 0, tail = 0;
      const enqueue = (pixel) => {
        if (visited[pixel]) return;
        visited[pixel] = 1;
        queue[tail++] = pixel;
      };
      enqueue(y * canvas.width + x);
      while (head < tail) {
        const pixel = queue[head++];
        const pixelIndex = pixel * 4;
        if (!matchesTarget(pixelIndex)) continue;
        replacement.forEach((value, channel) => { pixels.data[pixelIndex + channel] = value; });
        filled[pixel] = 1;
        const pixelX = pixel % canvas.width;
        if (pixelX > 0) enqueue(pixel - 1);
        if (pixelX < canvas.width - 1) enqueue(pixel + 1);
        if (pixel >= canvas.width) enqueue(pixel - canvas.width);
        if (pixel < canvas.width * (canvas.height - 1)) enqueue(pixel + canvas.width);
      }
      for (let pixel = 0; pixel < pixelCount; pixel += 1) {
        if (filled[pixel] || !isNearWhite(pixel * 4)) continue;
        const pixelX = pixel % canvas.width;
        const touchesFill = (pixelX > 0 && filled[pixel - 1])
          || (pixelX < canvas.width - 1 && filled[pixel + 1])
          || (pixel >= canvas.width && filled[pixel - canvas.width])
          || (pixel < canvas.width * (canvas.height - 1) && filled[pixel + canvas.width]);
        if (touchesFill) replacement.forEach((value, channel) => { pixels.data[pixel * 4 + channel] = value; });
      }
      ctx.putImageData(pixels, 0, 0);
    }
    function pendingImageDimensions() {
      const baseScale = Math.min(canvas.width / pendingImage.image.naturalWidth, canvas.height / pendingImage.image.naturalHeight, 1);
      return {
        width: pendingImage.image.naturalWidth * baseScale * pendingImage.scaleX,
        height: pendingImage.image.naturalHeight * baseScale * pendingImage.scaleY,
      };
    }
    function imageEffectsFilter(effects) {
      const effect = effects || { blur: 0, brightness: 0, contrast: 0, grayscale: 0, sepia: 0, invert: 0, saturation: 0, hue: 0, shadow: null };
      const filter = `blur(${effect.blur}px) brightness(${100 + effect.brightness}%) contrast(${100 + effect.contrast}%) grayscale(${effect.grayscale}%) sepia(${effect.sepia}%) invert(${effect.invert}%) saturate(${100 + (effect.saturation || 0)}%) hue-rotate(${effect.hue}deg)`;
      if (!effect.shadow || (!effect.shadow.width && !effect.shadow.blur)) return filter;
      const vectors = { none: [0, 0], n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0], nw: [-1, -1] };
      const [horizontal, vertical] = vectors[effect.shadow.direction] || vectors.se;
      const shadowBlur = effect.shadow.direction === 'none' ? effect.shadow.blur + effect.shadow.width : effect.shadow.blur;
      return `${filter} drop-shadow(${horizontal * effect.shadow.width}px ${vertical * effect.shadow.width}px ${shadowBlur}px ${effect.shadow.color})`;
    }
    function updateImagePreview() {
      if (!pendingImage) return;
      const { width, height } = pendingImageDimensions();
      pendingImage.container.style.width = `${width}px`;
      pendingImage.container.style.height = `${height}px`;
      pendingImage.container.style.left = `${pendingImage.x - width / 2}px`;
      pendingImage.container.style.top = `${pendingImage.y - height / 2}px`;
      pendingImage.container.style.transform = `rotate(${pendingImage.rotation}deg)`;
      const preview = pendingImage.container.querySelector('img');
      preview.style.transform = `scale(${pendingImage.flipX ? -1 : 1}, ${pendingImage.flipY ? -1 : 1})`;
      preview.style.filter = imageEffectsFilter(pendingImage.effects);
      if (pendingImage.effectsControl && !pendingImage.effectsControl.dataset.moved) positionEffectsControl(pendingImage.effectsControl, pendingImage.x - width / 2, pendingImage.y - height / 2);
      if (pendingImage.crop) {
        const left = pendingImage.x - width / 2;
        const top = pendingImage.y - height / 2;
        if (pendingImage.crop.lassoPoints) {
          preview.style.clipPath = `polygon(${pendingImage.crop.lassoPoints.map((point) => `${point.x - left}px ${point.y - top}px`).join(', ')})`;
        } else {
          const crop = pendingImage.crop;
          preview.style.clipPath = `inset(${Math.max(0, crop.y - top)}px ${Math.max(0, left + width - crop.x - crop.width)}px ${Math.max(0, top + height - crop.y - crop.height)}px ${Math.max(0, crop.x - left)}px)`;
        }
      } else preview.style.clipPath = '';
    }
    function showImageEffectsControl() {
      if (!pendingImage) return;
      if (pendingImage.effectsControl) { pendingImage.effectsControl.hidden = false; setEffectsToolbarActive(true); updateImagePreview(); return; }
      const image = pendingImage;
      image.effects ||= { blur: 0, brightness: 0, contrast: 0, grayscale: 0, sepia: 0, invert: 0, saturation: 0, hue: 0, shadow: null };
      const control = document.createElement('div');
      control.className = 'selection-blur-control';
      control.innerHTML = '<div class="selection-effects-title">Effects</div><section class="selection-effects-section"><strong>Blur</strong><label>Blur <input data-effect="blur" type="range" min="0" max="30" value="0"><output>0</output></label></section><section class="selection-effects-section"><strong>Shadow</strong><label>Shadow size <input data-shadow="width" type="range" min="0" max="30" value="0"><output>0</output></label><label>Blur <input data-shadow="blur" type="range" min="0" max="30" value="0"><output>0</output></label><label>Direction <select data-shadow-direction><option value="none">No offset</option><option value="n">&#11014;</option><option value="ne">&#11016;</option><option value="e">&#10145;</option><option value="se" selected>&#11018;</option><option value="s">&#11015;</option><option value="sw">&#11019;</option><option value="w">&#11013;</option><option value="nw">&#11017;</option></select></label></section><section class="selection-effects-section"><strong>Color</strong><label>Brightness <input data-effect="brightness" type="range" min="-100" max="100" value="0"><output>0</output></label><label>Contrast <input data-effect="contrast" type="range" min="-100" max="100" value="0"><output>0</output></label><label>Grayscale <input data-effect="grayscale" type="range" min="0" max="100" value="0"><output>0</output></label><label>Hue <input data-effect="hue" type="range" min="0" max="360" value="0"><output>0</output></label><label>Invert <input data-effect="invert" type="range" min="0" max="100" value="0"><output>0</output></label><label>Saturation <input data-effect="saturation" type="range" min="-100" max="100" value="0"><output>0</output></label><label>Sepia <input data-effect="sepia" type="range" min="0" max="100" value="0"><output>0</output></label></section><div class="selection-effects-actions"><button type="button" data-reset>Reset to defaults</button><button type="button" data-cancel>Cancel</button><button type="button" data-ok>OK</button></div>';
      control.querySelector('[data-shadow-direction]').options[0].text = '.';
      control.querySelector('[data-shadow-direction]').title = 'Shadow offset direction';
      addShadowDirectionTooltips(control.querySelector('[data-shadow-direction]'));
      const imageShadowSection = control.querySelectorAll('section')[1];
      imageShadowSection.classList.add('shadow-section');
      const imageShadowDirection = control.querySelector('[data-shadow-direction]');
      const imageShadowDirectionLabel = imageShadowDirection.closest('label');
      const imageShadowOffsetControl = document.createElement('div');
      imageShadowOffsetControl.className = 'shadow-offset-control';
      imageShadowOffsetControl.append(imageShadowDirection);
      imageShadowDirectionLabel.remove();
      imageShadowSection.append(imageShadowOffsetControl);
      const imageColorBasicSection = control.querySelectorAll('section')[2];
      imageColorBasicSection.querySelector('strong').textContent = 'Tonal';
      imageColorBasicSection.classList.add('divided');
      const imageColorEffectsSection = document.createElement('section');
      imageColorEffectsSection.className = 'selection-effects-section';
      imageColorEffectsSection.innerHTML = '<strong>Color</strong>';
      [...imageColorBasicSection.querySelectorAll('[data-effect]')].slice(2).forEach((input) => imageColorEffectsSection.append(input.closest('label')));
      imageColorBasicSection.after(imageColorEffectsSection);
      control.querySelectorAll('section').forEach((section, index) => { if (index < 3) section.classList.add('divided'); });
      const update = () => {
        control.querySelectorAll('[data-effect]').forEach((input) => { image.effects[input.dataset.effect] = Number(input.value); input.nextElementSibling.textContent = input.value; });
        const width = Number(control.querySelector('[data-shadow="width"]').value);
        const blur = Number(control.querySelector('[data-shadow="blur"]').value);
        control.querySelectorAll('[data-shadow]').forEach((input) => { input.nextElementSibling.textContent = input.value; });
        image.effects.shadow = width || blur ? { width, blur, direction: control.querySelector('[data-shadow-direction]').value, color: washColor(color.value, wash.checked ? .3 : .5) } : null;
        updateImagePreview();
      };
      control.querySelectorAll('input, select').forEach((input) => input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', update));
      control.querySelector('[data-reset]').addEventListener('click', () => { control.querySelectorAll('input[type="range"]').forEach((input) => { input.value = '0'; input.nextElementSibling.textContent = '0'; }); control.querySelector('[data-shadow-direction]').value = 'se'; image.effects = { blur: 0, brightness: 0, contrast: 0, grayscale: 0, sepia: 0, invert: 0, saturation: 0, hue: 0, shadow: null }; updateImagePreview(); });
      const close = (cancel) => { if (cancel) { image.effects = { blur: 0, brightness: 0, contrast: 0, grayscale: 0, sepia: 0, invert: 0, saturation: 0, hue: 0, shadow: null }; updateImagePreview(); } control.remove(); image.effectsControl = null; setEffectsToolbarActive(false); };
      control.querySelector('[data-cancel]').addEventListener('click', () => close(true));
      control.querySelector('[data-ok]').addEventListener('click', () => close(false));
      control.addEventListener('pointerdown', (event) => event.stopPropagation());
      const title = control.querySelector('.selection-effects-title');
      title.addEventListener('pointerdown', (event) => { event.preventDefault(); event.stopPropagation(); const bounds = control.getBoundingClientRect(); const offsetX = event.clientX - bounds.left, offsetY = event.clientY - bounds.top; const move = (next) => { const areaBounds = area.getBoundingClientRect(); control.style.left = `${Math.max(0, Math.min(area.clientWidth - control.offsetWidth, next.clientX - areaBounds.left - offsetX))}px`; control.style.top = `${Math.max(0, Math.min(area.clientHeight - control.offsetHeight, next.clientY - areaBounds.top - offsetY))}px`; control.dataset.moved = 'true'; }; const stop = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', stop); }; document.addEventListener('pointermove', move); document.addEventListener('pointerup', stop, { once: true }); });
      image.effectsControl = control;
      area.append(control);
      setEffectsToolbarActive(true);
      updateImagePreview();
    }
    function cancelImagePlacement() {
      if (!pendingImage) return;
      pendingImage.effectsControl?.remove();
      setEffectsToolbarActive(false);
      pendingImage.container.remove();
      URL.revokeObjectURL(pendingImage.url);
      pendingImage = null;
      imageDrag = null;
      imageResize = null;
      imageRotate = null;
      imageFile.value = '';
      updateBrushCursor();
    }
    function flipActiveImage() {
      const activeImage = pendingImage || selection;
      if (!activeImage) {
        showSelectionRequiredMessage();
        return false;
      }
      if (activeImage === selection) {
        convertLassoToRectangle();
        beginSelectionMutation();
        activeImage.detached = true;
        activeImage.rotateHandle.hidden = false;
        activeImage.effectsHandle.hidden = false;
        activeImage.resizeHandles.forEach((handle) => { handle.hidden = false; });
      }
      const axis = activeImage.nextFlipAxis || 'x';
      if (axis === 'y') activeImage.flipY = !activeImage.flipY;
      else activeImage.flipX = !activeImage.flipX;
      activeImage.nextFlipAxis = axis === 'y' ? 'x' : 'y';
      if (activeImage === pendingImage) updateImagePreview();
      else renderSelection();
      return true;
    }
    function convertLassoToRectangle() {
      if (!selection?.lassoPoints) return;
      const { x, y, width, height } = selection;
      selection.lassoPoints = null;
      selection.content.width = Math.max(1, Math.ceil(width));
      selection.content.height = Math.max(1, Math.ceil(height));
      selection.content.getContext('2d').drawImage(canvas, x, y, width, height, 0, 0, width, height);
      const preview = selection.container.querySelector('canvas');
      preview.width = selection.content.width;
      preview.height = selection.content.height;
      preview.getContext('2d').drawImage(selection.content, 0, 0);
      const backgroundContext = selection.background.getContext('2d');
      backgroundContext.clearRect(0, 0, canvas.width, canvas.height);
      backgroundContext.drawImage(canvas, 0, 0);
      backgroundContext.clearRect(x, y, width, height);
      selection.container.classList.remove('lasso-selection');
      selection.container.querySelector('.lasso-outline')?.remove();
      selection.resizeHandles.forEach((handle) => { handle.hidden = false; });
    }
