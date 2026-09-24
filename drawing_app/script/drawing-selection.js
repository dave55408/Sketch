    function selectionRect(first, second) {
      return { x: Math.min(first.x, second.x), y: Math.min(first.y, second.y), width: Math.abs(second.x - first.x), height: Math.abs(second.y - first.y) };
    }
    function lassoRect(points) {
      const xValues = points.map((point) => point.x);
      const yValues = points.map((point) => point.y);
      const x = Math.min(...xValues), y = Math.min(...yValues);
      return { x, y, width: Math.max(...xValues) - x, height: Math.max(...yValues) - y };
    }
    function updateSelectionPreview() {
      if (!selection) return;
      const { container, x, y, width, height } = selection;
      container.style.left = `${x}px`;
      container.style.top = `${y}px`;
      container.style.width = `${width}px`;
      container.style.height = `${height}px`;
      container.style.transform = `rotate(${selection.rotation || 0}deg)`;
      if (selection.blurControl && !selection.blurControl.dataset.moved) {
        positionEffectsControl(selection.blurControl, x, y);
      }
    }
    function positionEffectsControl(control, targetX, targetY) {
      control.style.left = `${Math.max(4, targetX - control.offsetWidth * .8)}px`;
      control.style.top = `${Math.max(4, targetY - control.offsetHeight * .15)}px`;
    }
    function addShadowDirectionTooltips(select) {
      const names = { none: 'No offset', n: 'Up', ne: 'Upper-right', e: 'Right', se: 'Lower-right', s: 'Down', sw: 'Lower-left', w: 'Left', nw: 'Upper-left' };
      const update = () => { select.title = `Shadow offset: ${names[select.value]}`; };
      [...select.options].forEach((option) => {
        option.title = names[option.value];
        if (option.value === 'none') option.text = '.';
        if (['ne', 'e', 'se'].includes(option.value)) option.text = `\u00a0${option.text}`;
        if (['nw', 'w', 'sw'].includes(option.value)) option.text = `${option.text}\u00a0`;
      });
      select.addEventListener('change', update);
      update();
    }
    function updateSelectionDraft() {
      if (!selectionDraftElement || !selectionDraft) return;
      if (selectionDraft.freehand) {
        const rect = lassoRect(selectionDraft.points);
        selectionDraftElement.style.left = `${rect.x}px`;
        selectionDraftElement.style.top = `${rect.y}px`;
        selectionDraftElement.style.width = `${rect.width}px`;
        selectionDraftElement.style.height = `${rect.height}px`;
        const points = selectionDraft.points.map((point) => `${point.x - rect.x},${point.y - rect.y}`).join(' ');
        selectionDraftElement.querySelector('polyline').setAttribute('points', points);
        selectionDraftElement.setAttribute('viewBox', `0 0 ${Math.max(1, rect.width)} ${Math.max(1, rect.height)}`);
        return;
      }
      const rect = selectionRect(selectionDraft.start, selectionDraft.end);
      selectionDraftElement.style.left = `${rect.x}px`;
      selectionDraftElement.style.top = `${rect.y}px`;
      selectionDraftElement.style.width = `${rect.width}px`;
      selectionDraftElement.style.height = `${rect.height}px`;
    }
    function renderSelection() {
      if (!selection) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(selection.background, 0, 0);
      if (selection.shadow) drawSelectionShadow(ctx, selection, selection.shadow);
      ctx.save();
      ctx.translate(selection.x + selection.width / 2, selection.y + selection.height / 2);
      ctx.rotate((selection.rotation || 0) * Math.PI / 180);
      ctx.scale(selection.flipX ? -1 : 1, selection.flipY ? -1 : 1);
      ctx.drawImage(selection.content, -selection.width / 2, -selection.height / 2, selection.width, selection.height);
      ctx.restore();
      if (selection.marqueeStroke) drawSelectionMarqueeStroke(ctx, selection, selection.marqueeStroke);
      updateSelectionPreview();
      requestCanvasNavigatorPreview();
    }
    function drawSelectionShadow(context, selectionState, style) {
      const shadow = document.createElement('canvas');
      shadow.width = selectionState.content.width;
      shadow.height = selectionState.content.height;
      const shadowContext = shadow.getContext('2d');
      shadowContext.fillStyle = style.color;
      if (selectionState.lassoPoints) {
        traceSelectionPath(shadowContext, selectionState.lassoPoints, selectionState.x, selectionState.y);
        shadowContext.fill();
      } else {
        shadowContext.fillRect(0, 0, shadow.width, shadow.height);
      }
      const vectors = { none: [0, 0], n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0], nw: [-1, -1] };
      const [horizontal, vertical] = vectors[style.direction] || vectors.se;
      context.save();
      context.translate(selectionState.x + selectionState.width / 2, selectionState.y + selectionState.height / 2);
      context.rotate((selectionState.rotation || 0) * Math.PI / 180);
      context.scale(selectionState.flipX ? -1 : 1, selectionState.flipY ? -1 : 1);
      context.beginPath();
      context.rect(-canvas.width * 2, -canvas.height * 2, canvas.width * 4, canvas.height * 4);
      if (selectionState.lassoPoints) {
        const points = selectionState.lassoPoints;
        context.moveTo(points[0].x - selectionState.x - selectionState.width / 2, points[0].y - selectionState.y - selectionState.height / 2);
        points.slice(1).forEach((point) => context.lineTo(point.x - selectionState.x - selectionState.width / 2, point.y - selectionState.y - selectionState.height / 2));
        context.closePath();
      } else {
        context.rect(-selectionState.width / 2, -selectionState.height / 2, selectionState.width, selectionState.height);
      }
      context.clip('evenodd');
      context.globalAlpha = style.alpha;
      context.filter = style.blur ? `blur(${style.blur}px)` : 'none';
      if (style.direction === 'none') {
        context.beginPath();
        if (selectionState.lassoPoints) traceSmoothLassoPath(context, selectionState.lassoPoints, selectionState.x + selectionState.width / 2, selectionState.y + selectionState.height / 2);
        else context.rect(-selectionState.width / 2, -selectionState.height / 2, selectionState.width, selectionState.height);
        context.strokeStyle = style.color;
        context.lineWidth = Math.max(1, style.width * 2);
        context.lineJoin = selectionState.lassoPoints ? 'round' : 'miter';
        context.stroke();
      } else {
        context.drawImage(shadow, -selectionState.width / 2 + horizontal * style.width, -selectionState.height / 2 + vertical * style.width, selectionState.width, selectionState.height);
      }
      context.restore();
    }
    function drawSelectionMarqueeStroke(context, selectionState, style) {
      context.save();
      context.translate(selectionState.x + selectionState.width / 2, selectionState.y + selectionState.height / 2);
      context.rotate((selectionState.rotation || 0) * Math.PI / 180);
      context.beginPath();
      if (selectionState.lassoPoints) {
        traceSmoothLassoPath(context, selectionState.lassoPoints, selectionState.x + selectionState.width / 2, selectionState.y + selectionState.height / 2);
      } else {
        context.rect(-selectionState.width / 2, -selectionState.height / 2, selectionState.width, selectionState.height);
      }
      context.strokeStyle = style.color;
      context.lineWidth = style.width;
      context.lineJoin = selectionState.lassoPoints ? 'round' : 'miter';
      context.globalAlpha = style.alpha;
      context.stroke();
      context.restore();
    }
    function beginSelectionMutation() {
      if (!selection || selection.changed) return;
      save();
      selection.changed = true;
      renderSelection();
    }
    function detachSelection() {
      if (!selection || selection.detached) return;
      selection.detached = true;
      selection.rotateHandle.hidden = false;
      selection.effectsHandle.hidden = false;
      selection.resizeHandles.forEach((handle) => { handle.hidden = false; });
    }
    function refreshUnmovedSelection() {
      if (!selection || selection.changed) return;
      const { x, y, width, height } = selection;
      selection.content.width = Math.max(1, Math.ceil(width));
      selection.content.height = Math.max(1, Math.ceil(height));
      const contentContext = selection.content.getContext('2d');
      if (selection.lassoPoints) { contentContext.save(); traceSelectionPath(contentContext, selection.lassoPoints, x, y); contentContext.clip(); }
      contentContext.drawImage(canvas, x, y, width, height, 0, 0, width, height);
      if (selection.lassoPoints) contentContext.restore();
      const preview = selection.container.querySelector('canvas');
      preview.width = selection.content.width;
      preview.height = selection.content.height;
      preview.getContext('2d').drawImage(selection.content, 0, 0);
      selection.background.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      selection.background.getContext('2d').drawImage(canvas, 0, 0);
      const backgroundContext = selection.background.getContext('2d');
      clearSelectionFromBackground(backgroundContext, { x, y, width, height }, selection.lassoPoints);
    }
    function resizeLassoPath(previous) {
      if (!selection?.lassoPoints) return;
      selection.lassoPoints = selection.lassoPoints.map((point) => ({
        x: selection.x + (point.x - previous.x) * selection.width / previous.width,
        y: selection.y + (point.y - previous.y) * selection.height / previous.height,
      }));
      const outline = selection.container.querySelector('.lasso-outline');
      outline.setAttribute('viewBox', `0 0 ${selection.width} ${selection.height}`);
      outline.querySelector('polygon').setAttribute('points', selection.lassoPoints.map((point) => `${point.x - selection.x},${point.y - selection.y}`).join(' '));
    }
    function removeSelection() {
      if (!selection) return;
      selection.blurControl?.remove();
      setEffectsToolbarActive(false);
      selection.container.remove();
      selection = null;
      selectionRotate = null;
    }
    function commitSelection() {
      if (!selection) return;
      renderSelection();
      removeSelection();
    }
    function eraseSelection() {
      if (!selection) return;
      save();
      const { x, y, width, height, rotation = 0, flipX, flipY, lassoPoints, detached } = selection;
      ctx.save();
      if (lassoPoints && !detached) {
        traceSelectionPath(ctx, lassoPoints);
        ctx.clip();
        ctx.clearRect(x, y, width, height);
      } else {
        ctx.translate(x + width / 2, y + height / 2);
        ctx.rotate(rotation * Math.PI / 180);
        ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
        ctx.clearRect(-width / 2, -height / 2, width, height);
      }
      ctx.restore();
      removeSelection();
    }
    function traceSelectionPath(context, points, offsetX = 0, offsetY = 0) {
      context.beginPath();
      context.moveTo(points[0].x - offsetX, points[0].y - offsetY);
      points.slice(1).forEach((point) => context.lineTo(point.x - offsetX, point.y - offsetY));
      context.closePath();
    }
    function traceSmoothLassoPath(context, points, offsetX = 0, offsetY = 0) {
      if (points.length < 3) { traceSelectionPath(context, points, offsetX, offsetY); return; }
      const local = (point) => ({ x: point.x - offsetX, y: point.y - offsetY });
      const midpoint = (first, second) => ({ x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 });
      const first = local(points[0]);
      const last = local(points.at(-1));
      const start = midpoint(last, first);
      context.moveTo(start.x, start.y);
      points.forEach((point, index) => {
        const current = local(point);
        const next = local(points[(index + 1) % points.length]);
        const end = midpoint(current, next);
        context.quadraticCurveTo(current.x, current.y, end.x, end.y);
      });
      context.closePath();
    }
    function clearSelectionFromBackground(context, rect, lassoPoints) {
      if (!lassoPoints) {
        context.clearRect(rect.x, rect.y, rect.width, rect.height);
        return;
      }
      context.save();
      traceSelectionPath(context, lassoPoints);
      context.clip();
      context.clearRect(rect.x, rect.y, rect.width, rect.height);
      context.restore();
      // Canvas clips anti-alias their edges. Remove one extra pixel around the
      // path so partially covered source pixels do not remain after a move.
      context.save();
      context.globalCompositeOperation = 'destination-out';
      context.lineWidth = 2;
      context.lineJoin = 'round';
      traceSelectionPath(context, lassoPoints);
      context.stroke();
      context.restore();
    }
    function createSelection(rect, lassoPoints = null, backgroundSource = null) {
      if (rect.width < 3 || rect.height < 3) return;
      removeSelection();
      const source = document.createElement('canvas');
      source.width = Math.ceil(rect.width); source.height = Math.ceil(rect.height);
      const sourceContext = source.getContext('2d');
      if (lassoPoints) { sourceContext.save(); traceSelectionPath(sourceContext, lassoPoints, rect.x, rect.y); sourceContext.clip(); }
      sourceContext.drawImage(canvas, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
      if (lassoPoints) sourceContext.restore();
      const background = document.createElement('canvas');
      background.width = canvas.width; background.height = canvas.height;
      const backgroundContext = background.getContext('2d');
      backgroundContext.drawImage(backgroundSource || canvas, 0, 0);
      if (!backgroundSource) clearSelectionFromBackground(backgroundContext, rect, lassoPoints);
      const container = document.createElement('div');
      container.className = `selection-preview${lassoPoints ? ' lasso-selection' : ''}`;
      const preview = document.createElement('canvas');
      preview.width = source.width; preview.height = source.height;
      preview.getContext('2d').drawImage(source, 0, 0);
      container.append(preview);
      if (lassoPoints) {
        const outline = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        outline.classList.add('lasso-outline');
        outline.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', lassoPoints.map((point) => `${point.x - rect.x},${point.y - rect.y}`).join(' '));
        outline.append(polygon);
        container.append(outline);
      }
      const rotateHandle = document.createElement('div');
      rotateHandle.className = 'image-rotate-handle';
      rotateHandle.hidden = true;
      rotateHandle.setAttribute('aria-label', 'Rotate moved selection');
      rotateHandle.addEventListener('pointerdown', (event) => {
        event.preventDefault(); event.stopPropagation();
        const point = coordinates(event);
        const centerX = selection.x + selection.width / 2;
        const centerY = selection.y + selection.height / 2;
        selectionRotate = { x: centerX, y: centerY, rotation: selection.rotation || 0, angle: Math.atan2(point.y - centerY, point.x - centerX) };
      });
      container.append(rotateHandle);
      const effectsHandle = document.createElement('button');
      effectsHandle.type = 'button';
      effectsHandle.className = 'image-effects-handle';
      effectsHandle.hidden = true;
      effectsHandle.title = 'Selection effects';
      effectsHandle.setAttribute('aria-label', 'Selection effects');
      effectsHandle.addEventListener('pointerdown', (event) => { event.preventDefault(); event.stopPropagation(); });
      effectsHandle.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); showSelectionBlurControl(); });
      container.append(effectsHandle);
      const resizeHandles = [];
      ['nw', 'ne', 'sw', 'se', 'n', 'e', 's', 'w'].forEach((corner) => {
        const handle = document.createElement('div');
        handle.className = 'image-resize-handle'; handle.dataset.corner = corner;
        handle.hidden = Boolean(lassoPoints);
        handle.addEventListener('pointerdown', (event) => {
          event.preventDefault(); event.stopPropagation();
          selectionResize = {
            corner,
            point: coordinates(event),
            x: selection.x,
            y: selection.y,
            width: selection.width,
            height: selection.height,
            scaleContents: selection.detached,
          };
        });
        container.append(handle);
        resizeHandles.push(handle);
      });
      container.addEventListener('pointerdown', (event) => {
        if (event.target.classList.contains('image-resize-handle')) return;
        event.preventDefault(); beginSelectionMutation(); detachSelection();
        const point = coordinates(event);
        selectionDrag = { offsetX: point.x - selection.x, offsetY: point.y - selection.y };
      });
      area.append(container);
      selection = { ...rect, content: source, background, container, rotateHandle, effectsHandle, resizeHandles, changed: false, detached: false, rotation: 0, flipX: false, flipY: false, nextFlipAxis: 'x', lassoPoints, marqueeStroke: null, shadow: null, blurSource: null, blurControl: null, colorAdjustments: null };
      updateSelectionPreview();
    }
    function copySelection() {
      if (!selection) {
        showSelectionRequiredMessage();
        return;
      }
      const copy = document.createElement('canvas');
      const angle = (selection.rotation || 0) * Math.PI / 180;
      const copyWidth = Math.max(1, Math.ceil(Math.abs(selection.width * Math.cos(angle)) + Math.abs(selection.height * Math.sin(angle))));
      const copyHeight = Math.max(1, Math.ceil(Math.abs(selection.width * Math.sin(angle)) + Math.abs(selection.height * Math.cos(angle))));
      copy.width = copyWidth;
      copy.height = copyHeight;
      const copyContext = copy.getContext('2d');
      copyContext.translate(copyWidth / 2, copyHeight / 2);
      copyContext.rotate(angle);
      copyContext.scale(selection.flipX ? -1 : 1, selection.flipY ? -1 : 1);
      copyContext.drawImage(selection.content, -selection.width / 2, -selection.height / 2, selection.width, selection.height);
      copiedSelection = copy;
      if (!navigator.clipboard?.write || !window.ClipboardItem) return;
      // Give ClipboardItem the PNG promise immediately, while this key event still has user activation.
      navigator.clipboard.write([new ClipboardItem({
        'image/png': new Promise((resolve) => copy.toBlob(resolve, 'image/png')),
      })]).catch(() => { });
    }
    function cutSelection() {
      if (!selection) {
        showSelectionRequiredMessage();
        return;
      }
      copySelection();
      save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(selection.background, 0, 0);
      removeSelection();
    }
    function pasteImageFile(file, isSelectionPaste = false) {
      isPastingSelection = isSelectionPaste;
      const transfer = new DataTransfer();
      transfer.items.add(file);
      imageFile.files = transfer.files;
      imageFile.dispatchEvent(new Event('change'));
    }
    async function pasteSelection() {
      if (pendingImage) placePendingImage();
      // A paste starts a new import-style placement, so the prior marquee is no longer active.
      removeSelection();
      try {
        if (navigator.clipboard?.read) {
          const items = await navigator.clipboard.read();
          const item = items.find((candidate) => candidate.types.some((type) => type.startsWith('image/')));
          const type = item?.types.find((candidate) => candidate.startsWith('image/'));
          if (type) { pasteImageFile(new File([await item.getType(type)], 'selection.png', { type }), true); return; }
          alert('Nothing available to paste.');
          return;
        }
      } catch (_) { /* Use the in-page copy fallback below. */ }
      if (!copiedSelection) {
        alert('Nothing available to paste.');
        return;
      }
      const blob = await new Promise((resolve) => copiedSelection.toBlob(resolve, 'image/png'));
      if (blob) pasteImageFile(new File([blob], 'selection.png', { type: 'image/png' }), true);
    }
    function smoothStroke() {
      if (strokePoints.length < 2) return;
      const background = snapshots[snapshots.length - 1];
      const points = [...strokePoints];
      const savedColor = strokeColor;
      const savedWidth = strokeWidth;
      const savedAlpha = strokeAlpha;
      const generation = canvasGeneration;
      const image = new Image();
      image.onload = () => {
        if (generation !== canvasGeneration) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        if (points.length === 2) {
          ctx.lineTo(points[1].x, points[1].y);
        } else {
          for (let index = 1; index < points.length - 1; index += 1) {
            const current = points[index];
            const next = points[index + 1];
            ctx.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
          }
          const lastPoint = points[points.length - 1];
          ctx.lineTo(lastPoint.x, lastPoint.y);
        }
        ctx.strokeStyle = savedColor;
        ctx.lineWidth = savedWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = savedAlpha;
        ctx.stroke();
        ctx.globalAlpha = 1;
      };
      image.src = background;
    }
    function drawDot(point) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, Number(strokeWidth) / 2, 0, Math.PI * 2);
      ctx.fillStyle = strokeColor;
      ctx.globalAlpha = strokeAlpha;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    function positionTextMoveHandle() {
      if (!editor?.moveHandle) return;
      editor.moveHandle.style.left = `${Number(editor.dataset.x) - 23.2}px`;
      editor.moveHandle.style.top = `${Number(editor.dataset.y) + editor.offsetHeight / 2 - 9.6}px`;
    }
    function redrawWashStroke() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(strokeBase, 0, 0);
      ctx.beginPath();
      ctx.moveTo(strokePoints[0].x, strokePoints[0].y);
      strokePoints.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = strokeAlpha;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    function commitText() {
      if (!editor) return;
      const words = editor.value.trim();
      const x = Number(editor.dataset.x);
      const y = Number(editor.dataset.y);
      const editorStyle = getComputedStyle(editor);
      const fontSizeValue = Number.parseFloat(editorStyle.fontSize);
      const lineHeightValue = Number.parseFloat(editorStyle.lineHeight) || fontSizeValue * 1.25;
      const textX = x + Number.parseFloat(editorStyle.borderLeftWidth) + Number.parseFloat(editorStyle.paddingLeft);
      const lineTop = y + Number.parseFloat(editorStyle.borderTopWidth) + Number.parseFloat(editorStyle.paddingTop) + (lineHeightValue - fontSizeValue) / 2;
      editor.moveHandle?.remove();
      editor.remove();
      editor = null;
      if (!words) return;
      save();
      ctx.fillStyle = color.value;
      ctx.globalAlpha = wash.checked ? .3 : 1;
      ctx.font = `${fontSizeValue}px Arial, sans-serif`;
      const metrics = ctx.measureText(words);
      ctx.textBaseline = 'alphabetic';
      const visibleAscent = metrics.actualBoundingBoxAscent || fontSizeValue * .75;
      const fontAscent = metrics.fontBoundingBoxAscent || fontSizeValue * .8;
      const baseline = lineTop + (visibleAscent + fontAscent) / 2 + (fontSizeValue <= 30 ? 1 : 2);
      ctx.fillText(words, textX, baseline);
      ctx.globalAlpha = 1;
    }
    function addText(point) {
      commitText();
      editor = document.createElement('input');
      editor.className = 'text-box';
      editor.type = 'text';
      editor.maxLength = 120;
      editor.setAttribute('aria-label', 'Text to place on canvas');
      editor.style.left = `${point.x}px`;
      editor.style.top = `${point.y}px`;
      editor.style.fontSize = `${textSize.value}px`;
      editor.dataset.x = point.x;
      editor.dataset.y = point.y;
      area.append(editor);
      const moveHandle = document.createElement('div');
      moveHandle.className = 'text-move-handle';
      moveHandle.setAttribute('aria-label', 'Move text');
      editor.moveHandle = moveHandle;
      moveHandle.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const handlePoint = coordinates(event);
        textDrag = { offsetX: handlePoint.x - Number(editor.dataset.x), offsetY: handlePoint.y - Number(editor.dataset.y) };
        editor.focus();
      });
      area.append(moveHandle);
      positionTextMoveHandle();
      editor.focus();
      editor.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); commitText(); }
        if (event.key === 'Escape') { editor.moveHandle?.remove(); editor.remove(); editor = null; }
      });
      const thisEditor = editor;
      editor.addEventListener('blur', () => setTimeout(() => {
        if (editor === thisEditor && !textDrag && document.activeElement !== thisEditor) {
          commitText();
          selectTool(false);
        }
      }));
    }
    canvas.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (panModeActive()) {
        canvasPan = { clientX: event.clientX, clientY: event.clientY, x: canvasPanOffset.x, y: canvasPanOffset.y };
        canvas.setPointerCapture(event.pointerId);
        updateBrushCursor();
        return;
      }
      if (colorPickerMode) {
        pickCanvasColor(coordinates(event));
        return;
      }
      if (editor) {
        const point = coordinates(event);
        commitText();
        if (textTool.checked && point.x <= canvas.clientWidth - 200) addText(point);
        else selectTool(false);
        return;
      }
      if (fillMode) {
        commitText();
        cancelImagePlacement();
        removeSelection();
        fillContainedArea(coordinates(event));
        return;
      }
      if (pendingImage) {
        placePendingImage();
        return;
      }
      if (selectionToolActive()) {
        commitText();
        removeSelection();
        const point = coordinates(event);
        const freehand = selectionMode === 'lasso';
        selectionDraft = { start: point, end: point, points: [point], freehand };
        selectionDraftElement = freehand ? document.createElementNS('http://www.w3.org/2000/svg', 'svg') : document.createElement('div');
        if (freehand) selectionDraftElement.setAttribute('class', 'lasso-draft');
        else selectionDraftElement.className = 'selection-draft';
        if (freehand) {
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
          path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#111827');
          path.setAttribute('stroke-width', '2'); path.setAttribute('stroke-dasharray', '6 6');
          selectionDraftElement.append(path);
        }
        area.append(selectionDraftElement);
        updateSelectionDraft();
        return;
      }
      if (textTool.checked) {
        const point = coordinates(event);
        if (point.x <= canvas.clientWidth - 200) addText(point);
        return;
      }
      commitText();
      save();
      isDrawing = true;
      last = coordinates(event);
      strokePoints = [last];
      constrainedBox = null;
      shapeGesture = queuedShape || (primaryModifierPressed(event) && (event.shiftKey || event.altKey)
        ? { shiftKey: event.shiftKey, altKey: false, isEllipse: circleKeyPressed && (event.shiftKey || event.altKey) }
        : null);
      queuedShape = null;
      strokeColor = color.value;
      strokeWidth = lineWidth.value;
      strokeAlpha = wash.checked ? .3 : 1;
      strokeBase = document.createElement('canvas');
      strokeBase.width = canvas.width;
      strokeBase.height = canvas.height;
      strokeBase.getContext('2d').drawImage(canvas, 0, 0);
    });
    canvas.addEventListener('pointerenter', (event) => {
      pointerOverCanvas = event.pointerType !== 'touch';
      updateBrushCursor(coordinates(event));
    });
    canvas.addEventListener('pointerleave', () => {
      pointerOverCanvas = false;
      colorPickerPreview.hidden = true;
      updateBrushCursor();
    });
    canvas.addEventListener('pointermove', (event) => {
      if (canvasPan) {
        canvasPanOffset.x = canvasPan.x + event.clientX - canvasPan.clientX;
        canvasPanOffset.y = canvasPan.y + event.clientY - canvasPan.clientY;
        updateCanvasTransform();
        updateBrushCursor();
        return;
      }
      updateBrushCursor(coordinates(event));
      if (colorPickerMode) {
        updateColorPickerPreview(coordinates(event));
        return;
      }
      if (selectionDraft) {
        const point = coordinates(event);
        selectionDraft.end = point;
        if (selectionDraft.freehand && Math.hypot(point.x - selectionDraft.points.at(-1).x, point.y - selectionDraft.points.at(-1).y) >= 2) selectionDraft.points.push(point);
        updateSelectionDraft();
        return;
      }
      if (!isDrawing) return;
      const pointer = coordinates(event);
      if (shapeGesture && (shapeGesture.fromToolbar || (primaryModifierPressed(event) && (event.shiftKey || event.altKey)))) {
        const modifiers = shapeGesture.fromToolbar ? { ...shapeGesture, shiftKey: event.shiftKey || shapeConstrain.checked } : shapeGesture;
        constrainedBox = calculateConstrainedBox(strokePoints[0], pointer, modifiers);
        drawConstrainedBox(constrainedBox, shapeGesture.isEllipse);
        last = pointer;
        requestCanvasNavigatorPreview();
        return;
      }
      shapeGesture = null;
      if (constrainedBox) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(strokeBase, 0, 0);
        constrainedBox = null;
        strokePoints = [strokePoints[0], last];
      }
      const next = event.shiftKey ? constrainLinePoint(strokePoints[0], pointer) : pointer;
      strokePoints.push(next);
      if (strokeAlpha < 1) {
        redrawWashStroke();
        last = next;
        requestCanvasNavigatorPreview();
        return;
      }
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(next.x, next.y);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.globalAlpha = strokeAlpha;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineCap = 'round';
      last = next;
      requestCanvasNavigatorPreview();
    });
    function finishPointerAction() {
      if (canvasPan) {
        canvasPan = null;
        updateBrushCursor();
        return;
      }
      imageDrag = null;
      imageResize = null;
      imageRotate = null;
      if (textDrag && editor) {
        textDrag = null;
        editor.focus();
      }
      selectionDrag = null;
      selectionResize = null;
      selectionRotate = null;
      if (selectionDraft) {
        createSelection(selectionDraft.freehand ? lassoRect(selectionDraft.points) : selectionRect(selectionDraft.start, selectionDraft.end), selectionDraft.freehand && selectionDraft.points.length >= 3 ? selectionDraft.points : null);
        selectionDraft = null;
        selectionDraftElement?.remove();
        selectionDraftElement = null;
      }
      if (!isDrawing) return;
      isDrawing = false;
      const completedToolbarShape = shapeGesture?.fromToolbar;
      shapeGesture = null;
      if (constrainedBox) {
        constrainedBox = null;
        if (completedToolbarShape) {
          document.querySelectorAll('#boxButton, #circleButton').forEach((button) => button.classList.remove('shape-active'));
          shapeConstrain.checked = false;
        }
        return;
      }
      if (strokePoints.length === 1) drawDot(strokePoints[0]);
      else smoothStroke();
      requestCanvasNavigatorPreview();
      if (completedToolbarShape) {
        document.querySelectorAll('#boxButton, #circleButton').forEach((button) => button.classList.remove('shape-active'));
        shapeConstrain.checked = false;
      }
    }
