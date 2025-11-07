// ======================================================
// Kanva - canvas-events.js
// Captura cliques, toques e gestos e aplica nos objetos
// ======================================================

function attachCanvasEvents(state) {
  const { canvas } = state;
  const ctx = state.ctx;
  let drag = null;
  let pinchLast = null;
  let lastTap = 0;
  let lastInputWasTouch = false; // evita "mousedown" fantasma após toque

  // ------------------------------------------------------
  // Utilitários de conversão
  // ------------------------------------------------------
  function screenDeltaToWorld(dx, dy) {
    const inv = 1 / state.scale;
    const cos = Math.cos(-state.rotation);
    const sin = Math.sin(-state.rotation);
    return {
      x: (dx * inv) * cos - (dy * inv) * sin,
      y: (dx * inv) * sin + (dy * inv) * cos
    };
  }

  function worldToScreen(wx, wy) {
    const SW = canvas.width / state.DPR;
    const SH = canvas.height / state.DPR;
    const cos = Math.cos(state.rotation);
    const sin = Math.sin(state.rotation);
    const rx = wx * cos - wy * sin;
    const ry = wx * sin + wy * cos;
    return {
      x: SW / 2 + state.translateX + rx * state.scale,
      y: SH / 2 + state.translateY + ry * state.scale
    };
  }

  function getActiveObj() {
    return state.objects.find(o => o.id === state.activeObjId);
  }

  // ------------------------------------------------------
  // Seleção e início de drag (mouse + toque final corrigido)
  // ------------------------------------------------------

  // 🖱️ Clique de mouse
  canvas.addEventListener('mousedown', e => {
    if (lastInputWasTouch) {
      lastInputWasTouch = false;
      return;
    }
    if (drag) return;

    const obj = hitTest(e);
    if (obj) {
      const isNewSelection = state.activeObjId !== obj.id;
      state.activeObjId = obj.id;

      const mode = detectHandleClick(e, obj);
      beginDrag(e, mode, false);

      if (isNewSelection) requestAnimationFrame(() => renderCanvas(ctx, state));
    } else {
      // Só limpa se for clique fora e sem drag ativo
      if (!drag && (!state.activeObjId || !state.objects.some(o => o.id === state.activeObjId))) {
        state.activeObjId = null;
        requestAnimationFrame(() => renderCanvas(ctx, state));
      }
    }
  });

  // 📱 Toque com um dedo
  canvas.addEventListener('touchstart', e => {
    lastInputWasTouch = true;
    if (e.touches.length !== 1 || drag) return;

    const t = e.touches[0];
    const fakeEvent = { clientX: t.clientX, clientY: t.clientY };
    const obj = hitTest(fakeEvent);

    if (obj) {
      const isNewSelection = state.activeObjId !== obj.id;
      state.activeObjId = obj.id;

      const mode = detectHandleClick(fakeEvent, obj);
      beginDrag(fakeEvent, mode, true);

      if (isNewSelection) requestAnimationFrame(() => renderCanvas(ctx, state));
    } else {
      if (!drag && (!state.activeObjId || !state.objects.some(o => o.id === state.activeObjId))) {
        state.activeObjId = null;
        requestAnimationFrame(() => renderCanvas(ctx, state));
      }
    }
  });

  // ------------------------------------------------------
  // Início do drag
  // ------------------------------------------------------
  function beginDrag(e, mode, isTouch) {
    const obj = getActiveObj();
    if (!obj || obj.locked || !obj.visible) return;

    drag = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      objStart: {
        x: obj.x,
        y: obj.y,
        size: obj.size,
        width: obj.width,
        rotation: obj.rotation
      },
      center: worldToScreen(obj.x, obj.y)
    };

    if (isTouch) {
      window.addEventListener('touchmove', onDragMoveTouch, { passive: false });
      window.addEventListener('touchend', onDragEndTouch, { passive: true });
    } else {
      window.addEventListener('mousemove', onDragMove, { passive: false });
      window.addEventListener('mouseup', onDragEnd, { passive: true });
    }
  }

  // ------------------------------------------------------
  // Movimento (mouse)
  // ------------------------------------------------------
  function onDragMove(e) {
    if (!drag) return;
    e.preventDefault();
    applyDrag(e.clientX, e.clientY);
  }

  function onDragEnd() {
    drag = null;
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
  }

  // ------------------------------------------------------
  // Movimento (toque)
  // ------------------------------------------------------
  function onDragMoveTouch(e) {
    if (!drag) return;
    const t = e.touches[0];
    if (!t) return;
    e.preventDefault();
    applyDrag(t.clientX, t.clientY);
  }

  function onDragEndTouch() {
    drag = null;
    window.removeEventListener('touchmove', onDragMoveTouch);
    window.removeEventListener('touchend', onDragEndTouch);
  }

  // ------------------------------------------------------
  // Aplica o movimento (com base no modo ativo)
  // ------------------------------------------------------
  function applyDrag(x, y) {
    const obj = getActiveObj();
    if (!obj) return;

    const dx = x - drag.startX;
    const dy = y - drag.startY;
    const delta = { x: 0, y: 0, scale: 1, angle: 0, width: 0 };

    switch (drag.mode) {
      case 'move': {
        const d = screenDeltaToWorld(dx, dy);
        delta.x = d.x;
        delta.y = d.y;
        break;
      }
      case 'scale': {
        const c = drag.center;
        const d0 = Math.hypot(drag.startX - c.x, drag.startY - c.y);
        const d1 = Math.hypot(x - c.x, y - c.y);
        delta.scale = d1 / Math.max(d0, 1);
        break;
      }
      case 'rotate': {
        const c = drag.center;
        const a0 = Math.atan2(drag.startY - c.y, drag.startX - c.x);
        const a1 = Math.atan2(y - c.y, x - c.x);
        delta.angle = a1 - a0;
        break;
      }
      case 'wrap-e':
        delta.width = dx / state.scale;
        break;
    }

    obj.onDrag(drag.mode, delta, drag.objStart);
    renderCanvas(ctx, state);
  }

  // ------------------------------------------------------
  // Detecta handle (escala, rotação, wrap)
  // ------------------------------------------------------
  function detectHandleClick(e, obj) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const handleSize = 22;
    const layout = layoutTextCharWrap(obj, ctx);
    const halfW = (obj.width || layout.width) / 2;
    const halfH = layout.height / 2;
    const pos = worldToScreen(obj.x, obj.y);
    const scale = state.scale;
    const margin = 6 / scale;

    const TL = { x: pos.x - (halfW + margin) * scale, y: pos.y - (halfH + margin) * scale };
    const TR = { x: pos.x + (halfW + margin) * scale, y: pos.y - (halfH + margin) * scale };
    const BR = { x: pos.x + (halfW + margin) * scale, y: pos.y + (halfH + margin) * scale };
    const E  = { x: pos.x + (halfW + margin) * scale, y: pos.y };

    function near(p) { return Math.hypot(mouseX - p.x, mouseY - p.y) < handleSize; }

    if (near(TR) || near(BR)) return 'scale';
    if (near(TL)) return 'rotate';
    if (near(E))  return 'wrap-e';
    return 'move';
  }

  // ------------------------------------------------------
  // Pinch zoom / rotação global
  // ------------------------------------------------------
  canvas.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const [t1, t2] = e.touches;
      const newDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const newAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);

      if (!pinchLast) {
        pinchLast = { dist: newDist, angle: newAngle };
        return;
      }

      state.scale = Math.min(Math.max(state.scale * (newDist / pinchLast.dist), 0.2), 8);
      state.rotation += (newAngle - pinchLast.angle);
      pinchLast = { dist: newDist, angle: newAngle };
      renderCanvas(ctx, state);
    }
  }, { passive: false });

  canvas.addEventListener('touchend', () => { pinchLast = null; }, { passive: true });

  // ------------------------------------------------------
  // Duplo toque: alterna zoom entre fit (~34%) e 100%
  // ------------------------------------------------------
  canvas.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    const now = Date.now();
    if (now - lastTap < 280) {
      e.preventDefault();
      const SW = canvas.width / state.DPR;
      const SH = canvas.height / state.DPR;
      const pad = 24 + 84;
      const fit = Math.min((SW - 48) / state.project.width, (SH - pad) / state.project.height);
      state.scale = Math.abs(state.scale - 1) < 0.02 ? Math.max(0.1, fit) : 1;
      state.translateX = 0;
      state.translateY = -20;
      state.rotation = 0;
      renderCanvas(ctx, state);
    }
    lastTap = now;
  }, { passive: false });

  // ------------------------------------------------------
  // Detecta qual objeto foi clicado/toque
  // ------------------------------------------------------
  function hitTest(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / state.DPR;
    const y = (e.clientY - rect.top) / state.DPR;

    const dx = x - (canvas.width / state.DPR) / 2 - state.translateX;
    const dy = y - (canvas.height / state.DPR) / 2 - state.translateY;
    const cos = Math.cos(-state.rotation);
    const sin = Math.sin(-state.rotation);
    const wx = (dx * cos - dy * sin) / state.scale;
    const wy = (dx * sin + dy * cos) / state.scale;

    for (let i = state.objects.length - 1; i >= 0; i--) {
      const obj = state.objects[i];
      if (!obj.visible || obj.locked) continue;
      const layout = layoutTextCharWrap(obj, ctx);
      const halfW = (obj.width || layout.width) / 2;
      const halfH = layout.height / 2;
      const ang = -(obj.rotation || 0);
      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);
      const lx = (wx - obj.x) * cosA - (wy - obj.y) * sinA;
      const ly = (wx - obj.x) * sinA + (wy - obj.y) * cosA;
      if (lx > -halfW && lx < halfW && ly > -halfH && ly < halfH) return obj;
    }
    return null;
  }
}

// ------------------------------------------------------
// Exporta globalmente
// ------------------------------------------------------
window.attachCanvasEvents = attachCanvasEvents;