
    document.addEventListener('contextmenu', (event) => event.preventDefault());

    const canvas = document.getElementById('canvas');
    const area = document.getElementById('canvas-area');
    const canvasNavigator = document.getElementById('canvasNavigator');
    const canvasNavigatorPreview = document.getElementById('canvasNavigatorPreview');
    const canvasNavigatorViewport = document.getElementById('canvasNavigatorViewport');
    const canvasNavigatorClose = document.getElementById('canvasNavigatorClose');
    const ctx = canvas.getContext('2d');
    const color = document.getElementById('color');
    const wash = document.getElementById('wash');
    const lineWidth = document.getElementById('lineWidth');
    const brushCursor = document.getElementById('brushCursor');
    const textCursor = document.getElementById('textCursor');
    const fillCursor = document.getElementById('fillCursor');
    const fillCursorBucket = document.getElementById('fillCursorBucket');
    const colorPickerCursor = document.getElementById('colorPickerCursor');
    const colorPickerPreview = document.getElementById('colorPickerPreview');
    const colorPickerPreviewSwatch = document.getElementById('colorPickerPreviewSwatch');
    const colorPickerPreviewValue = document.getElementById('colorPickerPreviewValue');
    const textSize = document.getElementById('textSize');
    const imageFile = document.getElementById('imageFile');
    const instructionsDialog = document.getElementById('instructionsDialog');
    const terseHelp = document.getElementById('terseHelp');
    const verboseHelp = document.getElementById('verboseHelp');
    const helpTerse = document.getElementById('helpTerse');
    const helpVerbose = document.getElementById('helpVerbose');
    const floatHelp = document.getElementById('floatHelp');
    const clearDialog = document.getElementById('clearDialog');
    const downloadBackgroundDialog = document.getElementById('downloadBackgroundDialog');
    const preferencesDialog = document.getElementById('preferencesDialog');
    const preferencesForm = document.getElementById('preferencesForm');
    const preferenceSwatchSource = document.getElementById('preferenceSwatchSource');
    const preferencePickerSource = document.getElementById('preferencePickerSource');
    const preferenceSwatch = document.getElementById('preferenceSwatch');
    const preferenceSwatchPreview = document.getElementById('preferenceSwatchPreview');
    const preferenceColor = document.getElementById('preferenceColor');
    const preferenceSelectionMode = document.getElementById('preferenceSelectionMode');
    const preferenceWash = document.getElementById('preferenceWash');
    const preferenceMoreControls = document.getElementById('preferenceMoreControls');
    const preferenceTheme = document.getElementById('preferenceTheme');
    const preferenceLineWidth = document.getElementById('preferenceLineWidth');
    const preferenceTextSize = document.getElementById('preferenceTextSize');
    const drawTool = document.getElementById('drawTool');
    const textTool = document.getElementById('textTool');
    const fillButton = document.getElementById('fill');
    const selectButton = document.getElementById('select');
    const selectMode = document.getElementById('selectMode');
    const selectionMenu = document.getElementById('selectionMenu');
    const moreControls = document.getElementById('moreControls');
    const moreControlsRow = document.getElementById('moreControlsRow');
    const zoomPercentage = document.getElementById('zoomPercentage');
    const zoomHome = document.getElementById('zoomHome');
    const colorPickerButton = document.getElementById('colorPickerButton');
    const shapeConstrain = document.getElementById('shapeConstrain');
    moreControls.addEventListener('change', () => {
      moreControlsRow.hidden = !moreControls.checked;
      resize();
    });
    let selectionMode = 'rect';
    let lastSelectShortcutAt = 0;
    function setHelpView(view) {
      const terse = view === 'terse';
      terseHelp.hidden = !terse;
      verboseHelp.hidden = terse;
      helpTerse.setAttribute('aria-pressed', String(terse));
      helpVerbose.setAttribute('aria-pressed', String(!terse));
    }
    function makeFloatingHelpDraggable(panel, handle) {
      handle.addEventListener('pointerdown', (event) => {
        if (event.target.closest('button')) return;
        event.preventDefault();
        const bounds = panel.getBoundingClientRect();
        const offsetX = event.clientX - bounds.left;
        const offsetY = event.clientY - bounds.top;
        const move = (moveEvent) => {
          const left = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, moveEvent.clientX - offsetX));
          const top = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, moveEvent.clientY - offsetY));
          panel.style.left = `${left}px`;
          panel.style.top = `${top}px`;
        };
        const stop = () => {
          document.removeEventListener('pointermove', move);
          document.removeEventListener('pointerup', stop);
        };
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', stop, { once: true });
      });
    }
    function openFloatingHelp() {
      document.getElementById('floatingHelp')?.remove();
      const panel = document.createElement('section');
      panel.id = 'floatingHelp';
      panel.className = 'floating-help';
      if (!moreControlsRow.hidden) {
        panel.style.setProperty('--floating-help-top', `${Math.ceil(moreControlsRow.getBoundingClientRect().bottom) + 8}px`);
      }
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', 'Sketch Pad help');
      const titlebar = document.createElement('div');
      titlebar.className = 'floating-help-titlebar';
      titlebar.title = 'Double-click to collapse help';
      titlebar.textContent = 'Sketch Pad help';
      const closeX = document.createElement('button');
      closeX.type = 'button';
      closeX.className = 'floating-help-close-x';
      closeX.textContent = '\u00d7';
      closeX.title = 'Close';
      closeX.setAttribute('aria-label', 'Close floating help');
      const close = document.createElement('button');
      close.type = 'button';
      close.textContent = 'Close';
      close.addEventListener('click', () => panel.remove());
      closeX.addEventListener('click', () => panel.remove());
      titlebar.append(closeX);
      const content = document.createElement('div');
      content.className = 'dialog-content floating-help-content';
      const controls = document.createElement('div');
      controls.className = 'help-view-controls';
      controls.setAttribute('aria-label', 'Help detail level');
      const quick = document.createElement('button');
      const full = document.createElement('button');
      quick.type = full.type = 'button';
      quick.textContent = 'Quick guide';
      full.textContent = 'Full guide';
      const terseCopy = terseHelp.cloneNode(true);
      const verboseCopy = verboseHelp.cloneNode(true);
      terseCopy.removeAttribute('id');
      verboseCopy.removeAttribute('id');
      const setView = (view) => {
        const terse = view === 'terse';
        terseCopy.hidden = !terse;
        verboseCopy.hidden = terse;
        quick.setAttribute('aria-pressed', String(terse));
        full.setAttribute('aria-pressed', String(!terse));
      };
      quick.addEventListener('click', () => setView('terse'));
      full.addEventListener('click', () => setView('verbose'));
      controls.append(quick, full);
      content.append(controls, terseCopy, verboseCopy);
      const footer = document.createElement('div');
      footer.className = 'floating-help-footer';
      footer.append(close);
      panel.append(titlebar, content, footer);
      document.body.append(panel);
      setView(terseHelp.hidden ? 'verbose' : 'terse');
      titlebar.addEventListener('dblclick', (event) => {
        if (event.target.closest('button')) return;
        const collapsed = panel.classList.contains('collapsed');
        if (collapsed) {
          panel.classList.remove('collapsed');
          panel.style.width = panel.dataset.expandedWidth;
          panel.style.height = panel.dataset.expandedHeight;
          titlebar.title = 'Double-click to collapse help';
          return;
        }
        const bounds = panel.getBoundingClientRect();
        panel.dataset.expandedWidth = `${bounds.width}px`;
        panel.dataset.expandedHeight = `${bounds.height}px`;
        panel.style.width = panel.dataset.expandedWidth;
        panel.style.height = 'auto';
        panel.classList.add('collapsed');
        titlebar.title = 'Double-click to expand help';
      });
      makeFloatingHelpDraggable(panel, titlebar);
      instructionsDialog.close();
    }
    verboseHelp.querySelector('li:nth-child(2)').innerHTML = '<strong>Shift</strong> constrains drawing to horizontal, vertical, and 45-degree lines, and snaps image rotation; <strong>Ctrl/Cmd+Shift</strong> draws a square box; <strong>Ctrl/Cmd+Alt</strong> draws a rectangle from its starting corner; <strong>Ctrl/Cmd+Shift+X</strong> draws a perfect circle; and <strong>Ctrl/Cmd+Alt+X</strong> draws an ellipse. <strong>F</strong> toggles Fill. <strong>M</strong> mirrors the active image; <strong>Shift+M</strong> does magic. <strong>Arrow keys</strong>&mdash;or <strong>1/2/3/4</strong> for left/right/up/down outside text entry&mdash;change color or size.';
    document.getElementById('instructionsLink').addEventListener('click', () => {
      setHelpView('terse');
      instructionsDialog.showModal();
    });
    instructionsDialog.addEventListener('click', (event) => {
      if (event.target === instructionsDialog) instructionsDialog.close();
    });
    preferencesDialog.addEventListener('click', (event) => {
      if (event.target === preferencesDialog) preferencesDialog.close();
    });
    helpTerse.addEventListener('click', () => setHelpView('terse'));
    helpVerbose.addEventListener('click', () => setHelpView('verbose'));
    floatHelp.addEventListener('click', openFloatingHelp);
    const defaultTextSize = 28;
    const defaultPreferences = { source: 'swatch', swatch: '#3E6CA8', color: '#3E6CA8', selectionMode: 'rect', wash: false, moreControls: false, theme: 'light', lineWidth: 5, textSize: defaultTextSize };
    let isDrawing = false;
    let canvasZoom = 1;
    let zoomKeyHeld = false;
    let panKeyHeld = false;
    let canvasPanOffset = { x: 0, y: 0 };
    let canvasPan = null;
    let navigatorDrag = null;
    let navigatorPreviewPending = false;
    let fillMode = false;
    let colorPickerMode = false;
    let last;
    let editor;
    let textDrag;
    let strokePoints = [];
    let strokeColor;
    let strokeWidth;
    let strokeAlpha;
    let strokeBase;
    let constrainedBox;
    let shapeGesture;
    let queuedShape;
    let circleKeyPressed = false;
    let pendingImage;
    let importTarget;
    let imageDrag;
    let imageResize;
    let imageRotate;
    let selection;
    let selectionDraft;
    let selectionDraftElement;
    let selectionDrag;
    let selectionResize;
    let selectionRotate;
    let copiedSelection;
    let isPastingSelection = false;
    let pointerOverCanvas = false;
    let canvasGeneration = 0;
    function selectionToolActive() {
      return selectButton.classList.contains('active');
    }
    const snapshots = [];
    const redoSnapshots = [];
    const spectrumImage = new Image();
    let spectrumRotation = 0;
    let spectrumRotationTimer = null;
    let spectrumRotationSession = 0;
    const fillCursorSource = new Image();
    let fillCursorColor = '';
    fillCursorSource.onload = () => {
      fillCursorColor = '';
      recolorFillCursorBucket();
    };
    fillCursorSource.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAlUAAAIWCAYAAAB+ynhwAAAAxnpUWHRSYXcgcHJvZmlsZSB0eXBlIGV4aWYAAHjabVDbDcMgDPxnio7gFwbGIU0idYOOX4ONlES9iLNjk4t96fh+zvQaIJQkuVRtqmCQJo26JRUcfTKCTJ7IGSiqt3pCjQZZiS2yN6p6xFWPD1bEblm+CNV3NLZ7o4lHqg+h+BGPicYIewi1EGLyBoZA97VAWy3XFbYD7qh+0iAuvt4Seb5LMff2YQ4THYwMxszqA/A4mrhb0oyRi13EmYs9g5cnZsg/nxbSD/oDWTU9oNPtAAABhWlDQ1BJQ0MgcHJvZmlsZQAAeJx9kb9Lw0AcxV9bpSoVEQuKOGSoTnbxFx1LFYtgobQVWnUwufQXNGlIUlwcBdeCgz8Wqw4uzro6uAqC4A8Q/wBxUnSREr+XFFrEeHDch3f3HnfvAG+jwhSjKwooqqmn4jEhm1sV/K/oxSCGEcGsyAwtkV7MwHV83cPD17swz3I/9+fol/MGAzwCcZRpukm8QTy3aWqc94mDrCTKxOfEkzpdkPiR65LDb5yLNnt5ZlDPpOaJg8RCsYOlDmYlXSGeIQ7Jikr53qzDMuctzkqlxlr35C8M5NWVNNdpjiGOJSSQhAAJNZRRgYkwrSopBlK0H3Pxj9r+JLkkcpXByLGAKhSIth/8D353axSmp5ykQAzofrGsj3HAvws065b1fWxZzRPA9wxcqW1/tQFEPkmvt7XQETCwDVxctzVpD7jcAUaeNFEXbclH01soAO9n9E05YOgW6Ftzemvt4/QByFBXyzfAwSEwUaTsdZd393T29u+ZVn8/TXly/noFto8AAA5VaVRYdFhNTDpjb20uYWRvYmUueG1wAAAAAAA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/Pgo8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJYTVAgQ29yZSA0LjQuMC1FeGl2MiI+CiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiCiAgICB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIKICAgIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiCiAgICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgICB4bWxuczpHSU1QPSJodHRwOi8vd3d3LmdpbXAub3JnL3htcC8iCiAgICB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyIKICAgIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIKICAgeG1wTU06RG9jdW1lbnRJRD0iZ2ltcDpkb2NpZDpnaW1wOjQxMjZkMjg4LWRjYTYtNDE2YS1iYjFiLTRmNWIxMjUxMDQxNCIKICAgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDoxMjU5NGMyNC04NzA2LTQwODAtOTg3Mi05M2JjZjBlYjc5ZGIiCiAgIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDozMDMxMzViNy1mNjBmLTRjNDItYmM1ZC0wZmZkMTM3NDg2YzIiCiAgIGRjOkZvcm1hdD0iaW1hZ2UvcG5nIgogICBHSU1QOkFQST0iMi4wIgogICBHSU1QOlBsYXRmb3JtPSJXaW5kb3dzIgogICBHSU1QOlRpbWVTdGFtcD0iMTc4OTY5MjI4NDAwODQyNSIKICAgR0lNUDpWZXJzaW9uPSIyLjEwLjM2IgogICB0aWZmOk9yaWVudGF0aW9uPSIxIgogICB4bXA6Q3JlYXRvclRvb2w9IkdJTVAgMi4xMCIKICAgeG1wOk1ldGFkYXRhRGF0ZT0iMjAyNjowOToxN1QxOTo0NDo0MC0wNTowMCIKICAgeG1wOk1vZGlmeURhdGU9IjIwMjY6MDk6MTdUMTk6NDQ6NDAtMDU6MDAiPgogICA8eG1wTU06SGlzdG9yeT4KICAgIDxyZGY6U2VxPgogICAgIDxyZGY6bGkKICAgICAgc3RFdnQ6YWN0aW9uPSJzYXZlZCIKICAgICAgc3RFdnQ6Y2hhbmdlZD0iLyIKICAgICAgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDo2ZmNkMmMxOS1lNDRlLTRiNTAtYjEwZC04YWIwYzY5ZGJlNWYiCiAgICAgIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkdpbXAgMi4xMCAoV2luZG93cykiCiAgICAgIHN0RXZ0OndoZW49IjIwMjYtMDktMTdUMTg6NDA6NTkiLz4KICAgICA8cmRmOmxpCiAgICAgIHN0RXZ0OmFjdGlvbj0ic2F2ZWQiCiAgICAgIHN0RXZ0OmNoYW5nZWQ9Ii8iCiAgICAgIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6NjkxYTQ5OWUtMzczNy00NDQyLThiMDUtMjAwNWZmNDQ5Y2EyIgogICAgICBzdEV2dDpzb2Z0d2FyZUFnZW50PSJHaW1wIDIuMTAgKFdpbmRvd3MpIgogICAgICBzdEV2dDp3aGVuPSIyMDI2LTA5LTE3VDE5OjQ0OjQzIi8+CiAgICA8L3JkZjpTZXE+CiAgIDwveG1wTU06SGlzdG9yeT4KICA8L3JkZjpEZXNjcmlwdGlvbj4KIDwvcmRmOlJERj4KPC94OnhtcG1ldGE+CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAKPD94cGFja2V0IGVuZD0idyI/PlJU1JcAAAAEZ0FNQQAAsY8L/GEFAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH6gkSACwrGYb9zwAAIABJREFUeNrs3Xe8HUXd+PFPEgIhhNBLgGCAgBhqkDwioICASGiKhgcFhSDYUBQpwiPNQhEBpYk/QYoiYBABpRpEFEJvUhJCSSghkArpPef3x2w0CTfJzb07s+V83q/XvG6e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';
    spectrumImage.src = 'assets/canvas-spectrum.png';
    const spectrumReady = new Promise((resolve) => {
      if (spectrumImage.complete) { resolve(Boolean(spectrumImage.naturalWidth)); return; }
      spectrumImage.addEventListener('load', () => resolve(true), { once: true });
      spectrumImage.addEventListener('error', () => resolve(false), { once: true });
    });

    function readPreferences() {
      const saved = document.cookie.split('; ').find((item) => item.startsWith('sketchPadPreferences='));
      if (!saved) return { ...defaultPreferences };
      try {
        const value = JSON.parse(decodeURIComponent(saved.split('=').slice(1).join('=')));
        const swatches = [...document.querySelectorAll('.color-swatch')].map((swatch) => swatch.dataset.color);
        return {
          source: value.source === 'picker' ? 'picker' : 'swatch',
          swatch: swatches.includes(value.swatch) ? value.swatch : defaultPreferences.swatch,
          color: /^#[0-9a-f]{6}$/i.test(value.color) ? value.color : defaultPreferences.color,
          selectionMode: value.selectionMode === 'lasso' ? 'lasso' : 'rect',
          wash: Boolean(value.wash),
          moreControls: Boolean(value.moreControls),
          theme: value.theme === 'dark' ? 'dark' : 'light',
          lineWidth: Math.min(40, Math.max(1, Number(value.lineWidth) || defaultPreferences.lineWidth)),
          textSize: Math.min(72, Math.max(12, Number(value.textSize) || defaultPreferences.textSize)),
        };
      } catch (_) { return { ...defaultPreferences }; }
    }
    function savePreferences(preferences) {
      document.cookie = `sketchPadPreferences=${encodeURIComponent(JSON.stringify(preferences))}; max-age=31536000; path=/; SameSite=Lax`;
    }
    function toggleTheme() {
      const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = theme;
      const activeSwatch = document.querySelector('.color-swatch.active');
      if (activeSwatch) color.value = swatchDrawColor(activeSwatch);
      updateWashAppearance();
      preferenceTheme.value = theme;
      savePreferences({ ...readPreferences(), theme });
    }
    function applyPreferences(preferences) {
      document.documentElement.dataset.theme = preferences.theme;
      const selectedSwatch = document.querySelector(`.color-swatch[data-color="${preferences.swatch}"]`);
      color.value = preferences.source === 'swatch' && selectedSwatch ? swatchDrawColor(selectedSwatch) : preferences.color;
      selectionMode = preferences.selectionMode;
      updateSelectionToolButton();
      wash.checked = preferences.wash;
      moreControls.checked = preferences.moreControls;
      moreControls.dispatchEvent(new Event('change'));
      lineWidth.value = String(preferences.lineWidth);
      textSize.value = String(preferences.textSize);
      color.dispatchEvent(new Event('input'));
      lineWidth.dispatchEvent(new Event('input'));
      textSize.dispatchEvent(new Event('input'));
    }
    function populatePreferences(preferences) {
      preferenceSwatchSource.checked = preferences.source === 'swatch';
      preferencePickerSource.checked = preferences.source === 'picker';
      preferenceSwatch.value = preferences.swatch;
      preferenceColor.value = preferences.color;
      preferenceSelectionMode.value = preferences.selectionMode;
      preferenceWash.checked = preferences.wash;
      preferenceMoreControls.checked = preferences.moreControls;
      preferenceTheme.value = preferences.theme;
      preferenceLineWidth.value = preferences.lineWidth;
      preferenceTextSize.value = preferences.textSize;
      updatePreferenceSwatchPreview();
      updatePreferenceColorControls();
    }
    function updatePreferenceColorControls() {
      preferenceSwatch.disabled = !preferenceSwatchSource.checked;
      preferenceColor.disabled = !preferencePickerSource.checked;
    }
    function updatePreferenceSwatchPreview() {
      preferenceSwatchPreview.style.backgroundColor = preferenceSwatch.value;
    }

    function resize() {
      const image = canvas.width ? canvas.toDataURL() : null;
      canvas.width = area.clientWidth;
      canvas.height = area.clientHeight;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (image) {
        const restore = new Image();
        restore.onload = () => ctx.drawImage(restore, 0, 0, canvas.width, canvas.height);
        restore.src = image;
      }
      updateCanvasNavigator();
    }
    function updateCanvasNavigator() {
      const visible = canvasZoom > 1.001 && canvas.width > 0 && canvas.height > 0;
      canvasNavigator.hidden = !visible;
      if (!visible) return;
      canvasNavigator.style.aspectRatio = `${canvas.width} / ${canvas.height}`;
      const previewWidth = Math.min(240, canvas.width);
      const previewHeight = Math.max(1, Math.round(previewWidth * canvas.height / canvas.width));
      if (canvasNavigatorPreview.width !== previewWidth || canvasNavigatorPreview.height !== previewHeight) {
        canvasNavigatorPreview.width = previewWidth;
        canvasNavigatorPreview.height = previewHeight;
      }
      const previewContext = canvasNavigatorPreview.getContext('2d');
      previewContext.clearRect(0, 0, previewWidth, previewHeight);
      previewContext.drawImage(canvas, 0, 0, previewWidth, previewHeight);
      const areaBounds = area.getBoundingClientRect();
      const canvasBounds = canvas.getBoundingClientRect();
      const left = Math.max(areaBounds.left, canvasBounds.left);
      const top = Math.max(areaBounds.top, canvasBounds.top);
      const right = Math.min(areaBounds.right, canvasBounds.right);
      const bottom = Math.min(areaBounds.bottom, canvasBounds.bottom);
      if (right <= left || bottom <= top) {
        canvasNavigatorViewport.style.width = '0';
        canvasNavigatorViewport.style.height = '0';
        return;
      }
      const x = (left - canvasBounds.left) / canvasBounds.width;
      const y = (top - canvasBounds.top) / canvasBounds.height;
      const width = (right - left) / canvasBounds.width;
      const height = (bottom - top) / canvasBounds.height;
      canvasNavigatorViewport.style.left = `${x * 100}%`;
      canvasNavigatorViewport.style.top = `${y * 100}%`;
      canvasNavigatorViewport.style.width = `${width * 100}%`;
      canvasNavigatorViewport.style.height = `${height * 100}%`;
    }
    function requestCanvasNavigatorPreview() {
      if (navigatorPreviewPending) return;
      navigatorPreviewPending = true;
      requestAnimationFrame(() => {
        navigatorPreviewPending = false;
        updateCanvasNavigator();
      });
    }
    function setCanvasZoom(zoom, focalPoint = null) {
      const nextZoom = Math.min(3, Math.max(.25, Math.round(zoom * 100) / 100));
      if (nextZoom === canvasZoom) {
        updateCanvasTransform();
        area.classList.toggle('canvas-zoomed-out', canvasZoom < 1);
        zoomPercentage.value = `${Math.round(canvasZoom * 100)}%`;
        return;
      }
      let focalCanvasPoint = null;
      if (focalPoint) {
        const bounds = canvas.getBoundingClientRect();
        focalCanvasPoint = {
          x: (focalPoint.x - bounds.left) / bounds.width,
          y: (focalPoint.y - bounds.top) / bounds.height,
        };
      }
      canvasZoom = nextZoom;
      updateCanvasTransform();
      zoomPercentage.value = `${Math.round(canvasZoom * 100)}%`;
      area.classList.toggle('canvas-zoomed-out', canvasZoom < 1);
      if (focalCanvasPoint) {
        const bounds = canvas.getBoundingClientRect();
        canvasPanOffset.x += focalPoint.x - (bounds.left + focalCanvasPoint.x * bounds.width);
        canvasPanOffset.y += focalPoint.y - (bounds.top + focalCanvasPoint.y * bounds.height);
        updateCanvasTransform();
      }
    }
    function resetCanvasZoom() {
      canvasPanOffset = { x: 0, y: 0 };
      setCanvasZoom(1);
    }
    function updateCanvasTransform() {
      canvas.style.transform = `translate(${canvasPanOffset.x}px, ${canvasPanOffset.y}px) scale(${canvasZoom})`;
      updateCanvasNavigator();
    }
    function constrainCanvasPan() {
      if (canvasZoom <= 1) return;
      const areaBounds = area.getBoundingClientRect();
      const canvasBounds = canvas.getBoundingClientRect();
      let x = 0;
      let y = 0;
      if (canvasBounds.left > areaBounds.left) x = areaBounds.left - canvasBounds.left;
      else if (canvasBounds.right < areaBounds.right) x = areaBounds.right - canvasBounds.right;
      if (canvasBounds.top > areaBounds.top) y = areaBounds.top - canvasBounds.top;
      else if (canvasBounds.bottom < areaBounds.bottom) y = areaBounds.bottom - canvasBounds.bottom;
      if (x || y) {
        canvasPanOffset.x += x;
        canvasPanOffset.y += y;
        updateCanvasTransform();
      }
    }
    canvasNavigatorViewport.addEventListener('pointerdown', (event) => {
      if (canvasZoom <= 1) return;
      event.preventDefault();
      event.stopPropagation();
      navigatorDrag = { clientX: event.clientX, clientY: event.clientY, x: canvasPanOffset.x, y: canvasPanOffset.y };
      canvasNavigatorViewport.setPointerCapture(event.pointerId);
    });
    canvasNavigatorViewport.addEventListener('pointermove', (event) => {
      if (!navigatorDrag) return;
      const navigatorWidth = canvasNavigator.clientWidth;
      const navigatorHeight = canvasNavigator.clientHeight;
      if (!navigatorWidth || !navigatorHeight) return;
      const canvasBounds = canvas.getBoundingClientRect();
      canvasPanOffset.x = navigatorDrag.x - (event.clientX - navigatorDrag.clientX) * canvasBounds.width / navigatorWidth;
      canvasPanOffset.y = navigatorDrag.y - (event.clientY - navigatorDrag.clientY) * canvasBounds.height / navigatorHeight;
      updateCanvasTransform();
      constrainCanvasPan();
    });
    const finishNavigatorDrag = () => { navigatorDrag = null; };
    canvasNavigatorViewport.addEventListener('pointerup', finishNavigatorDrag);
    canvasNavigatorViewport.addEventListener('pointercancel', finishNavigatorDrag);
    canvasNavigatorViewport.addEventListener('lostpointercapture', finishNavigatorDrag);
    function isTextEntryTarget(target) {
      if (target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT') return true;
      return target?.tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'color', 'file'].includes(target.type);
    }
    function panModeActive() {
      return zoomKeyHeld || panKeyHeld;
    }
    function isZoomShortcut(event) {
      return event.code === 'KeyZ' || event.key?.toLowerCase() === 'z';
    }
    function primaryModifierPressed(event) {
      return event.ctrlKey || event.metaKey;
    }
    window.addEventListener('keydown', (event) => {
      if (!isZoomShortcut(event) || editor || event.ctrlKey || event.altKey || event.metaKey || (isTextEntryTarget(event.target) && event.target !== zoomPercentage)) return;
      if (event.target === zoomPercentage) event.preventDefault();
      zoomKeyHeld = true;
      updateBrushCursor();
    }, true);
    window.addEventListener('keyup', (event) => {
      if (!isZoomShortcut(event)) return;
      zoomKeyHeld = false;
      canvasPan = null;
      updateBrushCursor();
    }, true);
    window.addEventListener('wheel', (event) => {
      if (!zoomKeyHeld || !event.composedPath().includes(area)) return;
      event.preventDefault();
      const zoomDelta = event.deltaY < 0 ? .1 : -.1;
      let nextZoom = canvasZoom + zoomDelta;
      const movingTowardDefault = (canvasZoom < 1 && zoomDelta > 0) || (canvasZoom > 1 && zoomDelta < 0);
      if ((movingTowardDefault && Math.abs(nextZoom - 1) <= .101) || (canvasZoom - 1) * (nextZoom - 1) < 0) nextZoom = 1;
      setCanvasZoom(nextZoom, { x: event.clientX, y: event.clientY });
    }, { capture: true, passive: false });
    zoomPercentage.addEventListener('change', () => {
      const value = Number.parseFloat(zoomPercentage.value);
      if (Number.isFinite(value)) setCanvasZoom(value / 100);
      else zoomPercentage.value = `${Math.round(canvasZoom * 100)}%`;
    });
    zoomPercentage.addEventListener('click', () => zoomPercentage.select());
    zoomPercentage.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        zoomPercentage.blur();
      }
    });
    zoomHome.addEventListener('click', () => {
      resetCanvasZoom();
      zoomHome.blur();
    });
    canvasNavigatorClose.addEventListener('click', (event) => {
      event.preventDefault();
      resetCanvasZoom();
    });
