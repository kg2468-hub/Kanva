// ======================================================
// Kanva - canvas-api.js
// Ponte entre o Canvas e a interface do editor
// ======================================================

function registerCanvasAPI(state) {
  const ctx = state.ctx;

  // --------------------------------------------------
  // Adiciona novo texto
  // --------------------------------------------------
  window.addTextObject = function (text) {
    const obj = new TextObject(text || 'Novo texto', { x: 0, y: 0, color: '#fff', size: 48 });
    state.objects.unshift(obj);
    state.activeObjId = obj.id;

    // Atualiza painel de camadas (se existir)
    if (typeof window.addLayerFromObject === 'function') {
      window.addLayerFromObject(obj);
    }

    renderCanvas(ctx, state);
    window.dispatchEvent(new CustomEvent('kanva:select', {
      detail: { type: obj.type, id: obj.id }
    }));
  };

  // --------------------------------------------------
  // Mostrar / ocultar objeto
  // --------------------------------------------------
  window.toggleObjectVisibility = function (id, visible) {
    const o = state.objects.find(x => x.id === id);
    if (!o) return;
    o.visible = visible !== false;

    if (!o.visible && state.activeObjId === id) {
      state.activeObjId = null;
      window.dispatchEvent(new Event('kanva:deselect'));
    }

    renderCanvas(ctx, state);
  };

  // --------------------------------------------------
  // Bloquear / desbloquear objeto
  // --------------------------------------------------
  window.toggleObjectLock = function (id, locked) {
    const o = state.objects.find(x => x.id === id);
    if (!o) return;
    o.locked = locked === true;

    if (o.locked && state.activeObjId === id) {
      state.activeObjId = null;
      window.dispatchEvent(new Event('kanva:deselect'));
    }

    renderCanvas(ctx, state);
  };

  // --------------------------------------------------
  // Seleção externa (ex.: clique em camada)
  // --------------------------------------------------
  window.addEventListener('kanva:select', e => {
    const id = e.detail && e.detail.id;
    if (!id) return;
    const obj = state.objects.find(o => o.id === id);
    if (obj && obj.visible && !obj.locked) {
      state.activeObjId = id;
      renderCanvas(ctx, state);
    }
  });

  window.addEventListener('kanva:deselect', () => {
    state.activeObjId = null;
    renderCanvas(ctx, state);
  });
}

// ------------------------------------------------------
// Exporta globalmente
// ------------------------------------------------------
window.registerCanvasAPI = registerCanvasAPI;