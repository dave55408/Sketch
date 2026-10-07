    function undoLast() {
      stopSpectrumRotation();
      removeSelection();
      const snapshot = snapshots.pop();
      if (!snapshot) return;
      redoSnapshots.push(canvas.toDataURL());
      canvasGeneration += 1;
      restoreSnapshot(snapshot);
    }
    function redoLast() {
      removeSelection();
      const snapshot = redoSnapshots.pop();
      if (!snapshot) return;
      snapshots.push(canvas.toDataURL());
      canvasGeneration += 1;
      restoreSnapshot(snapshot);
    }
    function restoreSnapshot(snapshot) {
      const image = new Image();
      image.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height); };
      image.src = snapshot;
    }
    function clearCanvas() {
      selectTool(false);
      removeSelection();
      save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    async function applySpectrumToCanvas(session = spectrumRotationSession) {
      const spectrumLoaded = await spectrumReady;
      if (session !== spectrumRotationSession) return;
      spectrumRotation = (spectrumRotation + 1) % 4;
      const rotation = spectrumRotation;
      if (pendingImage) placePendingImage();
      removeSelection();
      const spectrumCanvas = document.createElement('canvas');
      spectrumCanvas.width = canvas.width;
      spectrumCanvas.height = canvas.height;
      const spectrumContext = spectrumCanvas.getContext('2d');
      let spectrumPixels;
      if (spectrumLoaded) {
        spectrumContext.drawImage(spectrumImage, 0, 0, canvas.width, canvas.height);
        try { spectrumPixels = spectrumContext.getImageData(0, 0, canvas.width, canvas.height).data; }
        catch (_) { /* Use the generated spectrum below. */ }
      }
      if (!spectrumPixels) {
        const fallbackCanvas = document.createElement('canvas');
        fallbackCanvas.width = canvas.width;
        fallbackCanvas.height = canvas.height;
        const fallbackContext = fallbackCanvas.getContext('2d');
        const fallbackPixels = fallbackContext.createImageData(canvas.width, canvas.height);
        const corners = { topLeft: [242, 11, 25], topRight: [246, 255, 18], bottomLeft: [18, 0, 238], bottomRight: [0, 245, 213] };
        for (let y = 0; y < canvas.height; y += 1) {
          const vertical = y / Math.max(1, canvas.height - 1);
          for (let x = 0; x < canvas.width; x += 1) {
            const horizontal = x / Math.max(1, canvas.width - 1);
            const index = (y * canvas.width + x) * 4;
            for (let channel = 0; channel < 3; channel += 1) {
              const top = corners.topLeft[channel] * (1 - horizontal) + corners.topRight[channel] * horizontal;
              const bottom = corners.bottomLeft[channel] * (1 - horizontal) + corners.bottomRight[channel] * horizontal;
              fallbackPixels.data[index + channel] = top * (1 - vertical) + bottom * vertical;
            }
            fallbackPixels.data[index + 3] = 255;
          }
        }
        spectrumPixels = fallbackPixels.data;
      }
      let pixels;
      try { pixels = ctx.getImageData(0, 0, canvas.width, canvas.height); }
      catch (_) { return; }
      const spectrumOpacity = 1;
      const maxX = Math.max(1, canvas.width - 1);
      const maxY = Math.max(1, canvas.height - 1);
      for (let index = 0; index < pixels.data.length; index += 4) {
        const red = pixels.data[index];
        const green = pixels.data[index + 1];
        const blue = pixels.data[index + 2];
        const alpha = pixels.data[index + 3];
        if (!alpha || (red === 255 && green === 255 && blue === 255)) continue;
        const x = (index / 4) % canvas.width;
        const y = Math.floor(index / 4 / canvas.width);
        let sourceX = x;
        let sourceY = y;
        if (rotation === 1) {
          sourceX = y / maxY * maxX;
          sourceY = (maxX - x) / maxX * maxY;
        } else if (rotation === 2) {
          sourceX = maxX - x;
          sourceY = maxY - y;
        } else if (rotation === 3) {
          sourceX = (maxY - y) / maxY * maxX;
          sourceY = x / maxX * maxY;
        }
        const spectrumIndex = (Math.round(sourceY) * canvas.width + Math.round(sourceX)) * 4;
        pixels.data[index] = red * (1 - spectrumOpacity) + spectrumPixels[spectrumIndex] * spectrumOpacity;
        pixels.data[index + 1] = green * (1 - spectrumOpacity) + spectrumPixels[spectrumIndex + 1] * spectrumOpacity;
        pixels.data[index + 2] = blue * (1 - spectrumOpacity) + spectrumPixels[spectrumIndex + 2] * spectrumOpacity;
      }
      ctx.putImageData(pixels, 0, 0);
    }
    function toggleSpectrumRotation() {
      if (spectrumRotationTimer !== null) {
        stopSpectrumRotation();
        return;
      }
      save();
      const session = ++spectrumRotationSession;
      applySpectrumToCanvas(session);
      spectrumRotationTimer = setInterval(() => applySpectrumToCanvas(session), 750);
    }
    function stopSpectrumRotation() {
      if (spectrumRotationTimer !== null) clearInterval(spectrumRotationTimer);
      spectrumRotationTimer = null;
      spectrumRotationSession += 1;
    }
    function resetSketchPad({ preserveText = false } = {}) {
      isDrawing = false;
      resetCanvasZoom();
      spectrumRotation = 0;
      stopSpectrumRotation();
      strokePoints = [];
      if (editor && !preserveText) {
        editor.moveHandle?.remove();
        editor.remove();
        editor = null;
      }
      cancelImagePlacement();
      removeSelection();
      selectionDraftElement?.remove();
      selectionDraftElement = null;
      selectionDraft = null;
      selectButton.classList.remove('active');
      selectButton.setAttribute('aria-pressed', 'false');
      selectionMode = 'rect';
      selectionMenu.hidden = true;
      selectMode.setAttribute('aria-expanded', 'false');
      updateSelectionToolButton();
      color.value = '#3E6CA8';
      wash.checked = false;
      lineWidth.value = '5';
      textSize.value = String(defaultPreferences.textSize);
      drawTool.checked = !preserveText;
      textTool.checked = preserveText;
      document.querySelectorAll('.color-swatch').forEach((swatch) => {
        swatch.classList.toggle('active', swatch.dataset.color === color.value);
      });
      document.getElementById('widthNumber').textContent = lineWidth.value;
      document.getElementById('textNumber').textContent = textSize.value;
      updateWashAppearance();
      updateBrushCursor();
      if (preserveText && editor) {
        editor.value = editor.defaultValue;
        editor.focus();
      }
    }
    document.getElementById('clear').addEventListener('click', () => clearDialog.showModal());
    clearDialog.addEventListener('close', () => {
      if (clearDialog.returnValue === 'confirm') clearCanvas();
    });
    document.getElementById('preferencesLink').addEventListener('click', () => {
      populatePreferences(readPreferences());
      preferencesDialog.showModal();
    });
    [preferenceSwatchSource, preferencePickerSource].forEach((control) => control.addEventListener('change', updatePreferenceColorControls));
    preferenceSwatch.addEventListener('change', updatePreferenceSwatchPreview);
    preferencesForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const preferences = {
        source: preferencePickerSource.checked ? 'picker' : 'swatch',
        swatch: preferenceSwatch.value,
        color: preferenceColor.value,
        selectionMode: preferenceSelectionMode.value,
        wash: preferenceWash.checked,
        moreControls: preferenceMoreControls.checked,
        theme: preferenceTheme.value,
        lineWidth: Math.min(40, Math.max(1, Number(preferenceLineWidth.value) || defaultPreferences.lineWidth)),
        textSize: Math.min(72, Math.max(12, Number(preferenceTextSize.value) || defaultPreferences.textSize)),
      };
      savePreferences(preferences);
      applyPreferences(preferences);
      preferencesDialog.close();
    });
    document.getElementById('cancelPreferences').addEventListener('click', () => preferencesDialog.close());
    document.getElementById('restorePreferences').addEventListener('click', () => {
      populatePreferences(defaultPreferences);
    });
    function exitSelectMode() {
      selectButton.classList.remove('active');
      selectButton.setAttribute('aria-pressed', 'false');
      selectTool(false);
      updateBrushCursor();
    }
    selectButton.addEventListener('click', () => {
      setFillMode(false);
      cancelImagePlacement();
      commitText();
      const active = !selectButton.classList.contains('active');
      selectButton.classList.toggle('active', active);
      selectButton.setAttribute('aria-pressed', String(active));
      if (active) { drawTool.checked = false; textTool.checked = false; }
      else exitSelectMode();
      updateBrushCursor();
    });
    selectButton.addEventListener('dblclick', (event) => {
      event.preventDefault();
      selectionMode = selectionMode === 'rect' ? 'lasso' : 'rect';
      selectionMenu.hidden = true;
      selectMode.setAttribute('aria-expanded', 'false');
      updateSelectionToolButton();
      if (!selectionToolActive()) selectButton.click();
    });
    function updateSelectionToolButton() {
      const freehand = selectionMode === 'lasso';
      const label = freehand ? 'Freehand Select Tool' : 'Rect Select Tool';
      selectButton.title = label;
      selectButton.setAttribute('aria-label', freehand ? 'Freehand select' : 'Rectangular select');
      selectButton.innerHTML = `<img src="assets/${freehand ? 'noun_Lasso_6450319_@700.png' : 'noun_Missing_3934125_@700.png'}" alt="">`;
      selectionMenu.querySelectorAll('[data-selection-mode]').forEach((item) => {
        item.setAttribute('aria-current', String(item.dataset.selectionMode === selectionMode));
      });
    }
    selectMode.addEventListener('click', () => {
      const open = selectionMenu.hidden;
      selectionMenu.hidden = !open;
      selectMode.setAttribute('aria-expanded', String(open));
    });
    selectionMenu.addEventListener('click', (event) => {
      const item = event.target.closest('[data-selection-mode]');
      if (!item) return;
      selectionMode = item.dataset.selectionMode;
      selectionMenu.hidden = true;
      selectMode.setAttribute('aria-expanded', 'false');
      updateSelectionToolButton();
      if (!selectionToolActive()) selectButton.click();
    });
    document.addEventListener('pointerdown', (event) => {
      if (!event.target.closest('.selection-control')) {
        selectionMenu.hidden = true;
        selectMode.setAttribute('aria-expanded', 'false');
      }
    });
    updateSelectionToolButton();
    document.getElementById('import').addEventListener('click', () => {
      cancelImagePlacement();
      isPastingSelection = false;
      importTarget = selection && {
        x: selection.x,
        y: selection.y,
        width: selection.width,
        height: selection.height,
        lassoPoints: selection.lassoPoints?.map((point) => ({ ...point })) || null,
      };
      if (importTarget) {
        importTarget.background = document.createElement('canvas');
        importTarget.background.width = canvas.width;
        importTarget.background.height = canvas.height;
        importTarget.background.getContext('2d').drawImage(canvas, 0, 0);
      }
      imageFile.click();
    });
    imageFile.addEventListener('change', () => {
      const [file] = imageFile.files;
      if (!file) {
        importTarget = null;
        return;
      }
      const isSelectionPaste = isPastingSelection;
      isPastingSelection = false;
      const target = importTarget;
      importTarget = null;
      if (target) removeSelection();
      const image = new Image();
      const imageUrl = URL.createObjectURL(file);
      image.onload = () => {
        const container = document.createElement('div');
        container.className = 'image-preview selection-preview';
        const preview = new Image();
        preview.src = imageUrl;
        preview.draggable = false;
        container.append(preview);
        const rotateHandle = document.createElement('div');
        rotateHandle.className = 'image-rotate-handle';
        rotateHandle.setAttribute('aria-label', 'Rotate image');
        rotateHandle.addEventListener('pointerdown', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const point = coordinates(event);
          imageRotate = {
            point,
            x: pendingImage.x,
            y: pendingImage.y,
            rotation: pendingImage.rotation,
            angle: Math.atan2(point.y - pendingImage.y, point.x - pendingImage.x),
          };
        });
        container.append(rotateHandle);
        const effectsHandle = document.createElement('button');
        effectsHandle.type = 'button';
        effectsHandle.className = 'image-effects-handle';
        effectsHandle.title = 'Image effects';
        effectsHandle.setAttribute('aria-label', 'Image effects');
        effectsHandle.addEventListener('pointerdown', (event) => { event.preventDefault(); event.stopPropagation(); });
        effectsHandle.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); showImageEffectsControl(); });
        container.append(effectsHandle);
        ['nw', 'ne', 'sw', 'se', 'n', 'e', 's', 'w'].forEach((corner) => {
          const handle = document.createElement('div');
          handle.className = 'image-resize-handle';
          handle.dataset.corner = corner;
          handle.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const point = coordinates(event);
            const { width, height } = pendingImageDimensions();
            imageResize = { corner, point, width, height, x: pendingImage.x, y: pendingImage.y, scaleX: pendingImage.scaleX, scaleY: pendingImage.scaleY };
          });
          container.append(handle);
        });
        area.append(container);
        const baseScale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight, 1);
        pendingImage = {
          image,
          url: imageUrl,
          container,
          x: target ? target.x + image.naturalWidth / 2 : canvas.width / 2,
          y: target ? target.y + image.naturalHeight / 2 : canvas.height / 2,
          scaleX: target ? 1 / baseScale : 1,
          scaleY: target ? 1 / baseScale : 1,
          rotation: 0,
          flipX: false,
          flipY: false,
          nextFlipAxis: 'x',
          crop: target,
          effects: { blur: 0, brightness: 0, contrast: 0, grayscale: 0, sepia: 0, invert: 0, saturation: 0, hue: 0, shadow: null },
          effectsControl: null,
        };
        updateBrushCursor();
        container.addEventListener('pointerdown', (event) => {
          if (event.target.closest('button')) return;
          event.preventDefault();
          const point = coordinates(event);
          imageDrag = { offsetX: point.x - pendingImage.x, offsetY: point.y - pendingImage.y };
        });
        container.addEventListener('dblclick', (event) => {
          event.preventDefault();
          pendingImage.scaleY = pendingImage.scaleX;
          updateImagePreview();
        });
        updateImagePreview();
      };
      image.onerror = () => {
        URL.revokeObjectURL(imageUrl);
        imageFile.value = '';
      };
      image.src = imageUrl;
    });
    function placePendingImage() {
      if (!pendingImage) return;
      commitText();
      save();
      const crop = pendingImage.crop;
      const { width, height } = pendingImageDimensions();
      ctx.save();
      if (pendingImage.crop) {
        if (pendingImage.crop.lassoPoints) traceSelectionPath(ctx, pendingImage.crop.lassoPoints);
        else ctx.rect(pendingImage.crop.x, pendingImage.crop.y, pendingImage.crop.width, pendingImage.crop.height);
        ctx.clip();
      }
      ctx.translate(pendingImage.x, pendingImage.y);
      ctx.rotate(pendingImage.rotation * Math.PI / 180);
      ctx.scale(pendingImage.flipX ? -1 : 1, pendingImage.flipY ? -1 : 1);
      ctx.filter = imageEffectsFilter(pendingImage.effects);
      ctx.drawImage(pendingImage.image, -width / 2, -height / 2, width, height);
      ctx.restore();
      cancelImagePlacement();
      if (crop) createSelection(crop, crop.lassoPoints, crop.background);
    }
    document.addEventListener('pointermove', (event) => {
      if (textDrag && editor) {
        const point = coordinates(event);
        const x = point.x - textDrag.offsetX;
        const y = point.y - textDrag.offsetY;
        editor.dataset.x = x;
        editor.dataset.y = y;
        editor.style.left = `${x}px`;
        editor.style.top = `${y}px`;
        positionTextMoveHandle();
        return;
      }
      if (imageRotate && pendingImage) {
        const point = coordinates(event);
        const angle = Math.atan2(point.y - imageRotate.y, point.x - imageRotate.x);
        const delta = angle - imageRotate.angle;
        let rotation = imageRotate.rotation + delta * 180 / Math.PI;
        if (event.shiftKey) rotation = imageRotate.rotation + Math.round(delta / (Math.PI / 2)) * 90;
        pendingImage.rotation = rotation;
        updateImagePreview();
        return;
      }
      if (selectionRotate && selection) {
        const point = coordinates(event);
        const angle = Math.atan2(point.y - selectionRotate.y, point.x - selectionRotate.x);
        const delta = angle - selectionRotate.angle;
        let rotation = selectionRotate.rotation + delta * 180 / Math.PI;
        if (event.shiftKey) rotation = selectionRotate.rotation + Math.round(delta / (Math.PI / 2)) * 90;
        selection.rotation = rotation;
        renderSelection();
        return;
      }
      if (selectionResize && selection) {
        const point = coordinates(event);
        const { corner, x, y, width, height, scaleContents } = selectionResize;
        const right = x + width, bottom = y + height;
        let next = { x, y, width, height };
        if (corner.includes('w')) { next.x = Math.min(point.x, right - 3); next.width = right - next.x; }
        if (corner.includes('e')) next.width = Math.max(3, point.x - x);
        if (corner.includes('n')) { next.y = Math.min(point.y, bottom - 3); next.height = bottom - next.y; }
        if (corner.includes('s')) next.height = Math.max(3, point.y - y);
        // Before a selection moves, resizing adjusts only the marquee. Once it is
        // detached, preserve its captured pixels and scale them into the new bounds.
        if (scaleContents) {
          const isCorner = corner.length === 2;
          if (isCorner) {
            const horizontalDirection = corner.includes('e') ? 1 : -1;
            const verticalDirection = corner.includes('s') ? 1 : -1;
            const widthRatio = (width + horizontalDirection * (point.x - selectionResize.point.x)) / width;
            const heightRatio = (height + verticalDirection * (point.y - selectionResize.point.y)) / height;
            const scale = Math.max(3 / width, 3 / height, Math.max(widthRatio, heightRatio));
            next.width = width * scale;
            next.height = height * scale;
            if (corner.includes('w')) next.x = right - next.width;
            if (corner.includes('n')) next.y = bottom - next.height;
          }
          Object.assign(selection, next);
          renderSelection();
          return;
        }
        if (selection.changed) {
          renderSelection();
          selection.changed = false;
        }
        Object.assign(selection, next);
        resizeLassoPath({ x, y, width, height });
        refreshUnmovedSelection();
        updateSelectionPreview();
        return;
      }
      if (selectionDrag && selection) {
        const point = coordinates(event);
        if (!selection.detached && Math.hypot(point.x - selection.x - selectionDrag.offsetX, point.y - selection.y - selectionDrag.offsetY) > 1) detachSelection();
        selection.x = point.x - selectionDrag.offsetX;
        selection.y = point.y - selectionDrag.offsetY;
        renderSelection();
        return;
      }
      if (imageResize && pendingImage) {
        const point = coordinates(event);
        const hasHorizontalHandle = imageResize.corner.includes('e') || imageResize.corner.includes('w');
        const hasVerticalHandle = imageResize.corner.includes('n') || imageResize.corner.includes('s');
        const horizontalDirection = imageResize.corner.includes('e') ? 1 : -1;
        const verticalDirection = imageResize.corner.includes('s') ? 1 : -1;
        const widthRatio = (imageResize.width + horizontalDirection * (point.x - imageResize.point.x)) / imageResize.width;
        const heightRatio = (imageResize.height + verticalDirection * (point.y - imageResize.point.y)) / imageResize.height;
        if (hasHorizontalHandle && hasVerticalHandle) {
          const scaleRatio = Math.max(.1 / imageResize.scaleX, Math.min(5 / imageResize.scaleX, Math.max(widthRatio, heightRatio)));
          pendingImage.scaleX = imageResize.scaleX * scaleRatio;
          pendingImage.scaleY = imageResize.scaleY * scaleRatio;
        } else if (hasHorizontalHandle) {
          pendingImage.scaleX = Math.max(.1, Math.min(5, imageResize.scaleX * widthRatio));
          pendingImage.scaleY = imageResize.scaleY;
        } else {
          pendingImage.scaleX = imageResize.scaleX;
          pendingImage.scaleY = Math.max(.1, Math.min(5, imageResize.scaleY * heightRatio));
        }
        const { width, height } = pendingImageDimensions();
        if (hasHorizontalHandle) {
          const fixedX = imageResize.x - horizontalDirection * imageResize.width / 2;
          pendingImage.x = fixedX + horizontalDirection * width / 2;
        } else pendingImage.x = imageResize.x;
        if (hasVerticalHandle) {
          const fixedY = imageResize.y - verticalDirection * imageResize.height / 2;
          pendingImage.y = fixedY + verticalDirection * height / 2;
        } else pendingImage.y = imageResize.y;
        updateImagePreview();
        return;
      }
      if (!imageDrag || !pendingImage) return;
      const point = coordinates(event);
      pendingImage.x = point.x - imageDrag.offsetX;
      pendingImage.y = point.y - imageDrag.offsetY;
      updateImagePreview();
    });
    function downloadCanvas(backgroundColor) {
      commitText();
      const link = document.createElement('a');
      const now = new Date();
      const pad = (number) => String(number).padStart(2, '0');
      const period = now.getHours() >= 12 ? 'pm' : 'am';
      const hour = now.getHours() % 12 || 12;
      const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(hour)}-${pad(now.getMinutes())}${period}`;
      link.download = `Sketch_${timestamp}.png`;
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const exportContext = exportCanvas.getContext('2d');
      exportContext.fillStyle = backgroundColor;
      exportContext.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      exportContext.drawImage(canvas, 0, 0);
      link.href = exportCanvas.toDataURL('image/png');
      link.click();
    }
    document.getElementById('download').addEventListener('click', () => {
      if (document.documentElement.dataset.theme === 'dark') {
        commitText();
        downloadBackgroundDialog.showModal();
        return;
      }
      downloadCanvas('#ffffff');
    });
    downloadBackgroundDialog.addEventListener('close', () => {
      if (downloadBackgroundDialog.returnValue === 'dark') downloadCanvas('#121212');
      if (downloadBackgroundDialog.returnValue === 'white') downloadCanvas('#ffffff');
    });
    window.addEventListener('resize', resize);
    resize();
    applyPreferences(readPreferences());
  
