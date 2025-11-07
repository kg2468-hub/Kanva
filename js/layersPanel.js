// ======================================================
// Painel de Camadas v1.5.1-patch
// ------------------------------------------------------
// • Corrige abertura do painel (classe .open)
// • Thumb arrasta, corpo abre menu contextual
// • Linha azul estável, animação suave
// • Sincronização total com Canvas
// ======================================================
function initLayersPanel() {
  const overlay = document.createElement('div');
  overlay.className = 'layers-overlay';
  document.body.appendChild(overlay);

  const panel = document.createElement('div');
  panel.className = 'layers-panel';
  panel.innerHTML = `
    <div class="layers-header">
      <span>Camadas</span>
      <button class="btn-close" id="close-layers" aria-label="Fechar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    <div class="layers-list" id="layers-list"></div>`;
  document.body.appendChild(panel);

  const ctx = document.createElement('div');
  ctx.className = 'layer-context';
  ctx.innerHTML = `
    <div class="ctx-item" data-action="rename">
      <svg viewBox="0 0 24 24">
        <path d="M4 20h16M5 15l9-9a2.8 2.8 0 114 4l-9 9H5v-4Z"
              stroke="currentColor" stroke-width="1.6" fill="none"/>
      </svg>Renomear
    </div>
    <div class="ctx-item" data-action="duplicate">
      <svg viewBox="0 0 24 24">
        <path d="M8 8h10v10H8z" stroke="currentColor"
              stroke-width="1.6" fill="none"/>
        <path d="M6 6h10v10" stroke="currentColor"
              stroke-width="1.6"/>
      </svg>Duplicar
    </div>
    <div class="ctx-item" data-action="delete">
      <svg viewBox="0 0 24 24">
        <path d="M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12"
              stroke="currentColor" stroke-width="1.6" fill="none"/>
      </svg>Excluir
    </div>`;
  document.body.appendChild(ctx);

  const list = document.getElementById('layers-list');
  let layers = [];
  let activeId = null;
  let draggingEl = null;
  let dropIndicator = null;

  // --- SVG helpers ---------------------------------------------------
  const eyeSVG = on => on
    ? `<svg viewBox="0 0 24 24" fill="none"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"
         stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12"
         r="3.2" stroke="currentColor" stroke-width="1.8"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none"><path d="M3 3l18 18"
         stroke="currentColor" stroke-width="1.8"/><path d="M2 12s4-7 10-7
         c2.3 0 4.3.9 6 2.1M22 12s-4 7-10 7c-2.3 0-4.3-.9-6-2.1"
         stroke="currentColor" stroke-width="1.8" opacity=".8"/><circle cx="12"
         cy="12" r="3.2" stroke="currentColor" stroke-width="1.8"
         opacity=".8"/></svg>`;

  const lockSVG = on => on
    ? `<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="11"
         width="16" height="9" rx="2" stroke="currentColor"
         stroke-width="1.8"/><path d="M8 11V8a4 4 0 118 0v3"
         stroke="currentColor" stroke-width="1.8"/><circle cx="12"
         cy="15.5" r="1.2" fill="currentColor"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="11"
         width="16" height="9" rx="2" stroke="currentColor"
         stroke-width="1.8"/><path d="M8 11V9a4 4 0 017.5-1.5"
         stroke="currentColor" stroke-width="1.8"/></svg>`;

  // --- Canvas sync ---------------------------------------------------
  function syncOrderWithCanvas() {
    const objs = window.getAllObjects?.();
    if (!objs) return;
  
    // 🔹 Reordena de acordo com as camadas (layers[0] é o topo visual)
    const ordered = [];
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      const o = objs.find(o => o.id === l.id);
      if (o) ordered.push(o);
    }
  
    // 🔹 Substitui completamente o array original mantendo a referência
    objs.length = 0;
    for (const o of ordered) objs.push(o);
  
    // 🔹 Redesenha
    if (typeof window.redrawCanvas === "function") {
      window.redrawCanvas();
    } else if (typeof window.draw === "function") {
      window.draw();
    }
  }
  
  // Expor função globalmente
  window.syncOrderWithCanvas = syncOrderWithCanvas;
  
  // --- Add layer -----------------------------------------------------
  window.addLayerFromObject = obj => {
    layers.unshift({
      id: obj.id,
      name: obj.text || obj.type,
      type: obj.type,
      visible: true,
      locked: false
    });
    activeId = obj.id;
    render();
  };

  // --- Context menu --------------------------------------------------
  function openContext(x, y, id) {
    ctx.style.left = Math.min(window.innerWidth - 200, x) + 'px';
    ctx.style.top = Math.min(window.innerHeight - 150, y) + 'px';
    ctx.classList.add('open');
    const objs = window.getAllObjects?.() ?? [];

    const close = ev => {
      if (!ctx.contains(ev.target)) {
        ctx.classList.remove('open');
        document.removeEventListener('mousedown', close, true);
        document.removeEventListener('touchstart', close, true);
      }
    };
    document.addEventListener('mousedown', close, true);
    document.addEventListener('touchstart', close, true);

    ctx.querySelectorAll('.ctx-item').forEach(it => {
      it.onclick = () => {
        const act = it.dataset.action;
        const lay = layers.find(l => l.id === id);
        const obj = objs.find(o => o.id === id);
        if (act === 'duplicate' && obj) {
          const newObj = structuredClone(obj);
          newObj.id = 't' + Math.random().toString(36).slice(2, 8);
          newObj.x += 20; newObj.y += 20;
          objs.push(newObj);
          window.addLayerFromObject?.(newObj);
          window.redrawCanvas?.();
        }
        if (act === 'delete') {
          layers = layers.filter(l => l.id !== id);
          const idx = objs.findIndex(o => o.id === id);
          if (idx >= 0) objs.splice(idx, 1);
          if (window.syncOrderWithCanvas) window.syncOrderWithCanvas();
          else window.redrawCanvas?.();
          activeId = null;
          render();
          window.dispatchEvent(new Event('kanva:deselect'));
        }
        if (act === 'rename' && lay) {
          const n = prompt('Novo nome:', lay.name || '');
          if (n) { lay.name = n; render(); }
        }
        ctx.classList.remove('open');
      };
    });
  }

  // --- Build item ----------------------------------------------------
  function buildItem(layer) {
    const el = document.createElement('div');
    el.className = 'layer-item';
    el.dataset.id = layer.id;
    if (layer.id === activeId) el.classList.add('selected');
    el.innerHTML = `
      <div class="layer-thumb" draggable="true"></div>
      <div class="layer-meta"><div class="layer-name">${layer.name}</div>
      <div class="layer-type">${layer.type}</div></div>
      <button class="layer-btn btn-visibility">${eyeSVG(layer.visible)}</button>
      <button class="layer-btn btn-lock">${lockSVG(layer.locked)}</button>`;

    const thumb = el.querySelector('.layer-thumb');
    const btnEye = el.querySelector('.btn-visibility');
    const btnLock = el.querySelector('.btn-lock');

    btnEye.onclick = e => {
      e.stopPropagation();
      layer.visible = !layer.visible;
      btnEye.innerHTML = eyeSVG(layer.visible);
      window.toggleObjectVisibility?.(layer.id, layer.visible);
    };
    btnLock.onclick = e => {
      e.stopPropagation();
      layer.locked = !layer.locked;
      btnLock.innerHTML = lockSVG(layer.locked);
      window.toggleObjectLock?.(layer.id, layer.locked);
    };

    el.onclick = () => {
      activeId = layer.id;
      render();
      window.dispatchEvent(new CustomEvent('kanva:select',
        { detail: { type: layer.type, id: layer.id } }));
    };

    // Long press abre menu (fora da thumb)
    let timer;
    el.addEventListener('touchstart', e => {
      if (e.target.closest('.layer-thumb') || e.target.closest('.layer-btn')) return;
      const t = e.touches[0];
      timer = setTimeout(() => openContext(t.clientX, t.clientY, layer.id), 550);
    }, { passive: true });
    ['touchmove', 'touchend', 'touchcancel']
      .forEach(ev => el.addEventListener(ev, () => clearTimeout(timer)));

    // Drag (thumb)
    thumb.addEventListener('dragstart', e => {
      draggingEl = el;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', layer.id);
      el.classList.add('dragging');
      if (!dropIndicator) {
        dropIndicator = document.createElement('div');
        dropIndicator.className = 'drop-indicator';
        list.appendChild(dropIndicator);
      }
    });

    el.addEventListener('dragover', e => {
      e.preventDefault();
    
      // garante que existe o indicador
      if (!dropIndicator) {
        dropIndicator = document.createElement('div');
        dropIndicator.className = 'drop-indicator';
        list.appendChild(dropIndicator);
      }
    
      const rect = el.getBoundingClientRect();
      const insertAbove = e.clientY < rect.top + rect.height / 2;
    
      // identifica a camada sendo arrastada
      let draggedId = e.dataTransfer?.getData('text/plain');
      if (!draggedId && draggingEl) {
        draggedId = draggingEl.dataset.id;
      }
    
      const fromIndex = draggedId ? layers.findIndex(l => l.id === draggedId) : -1;
      const hoverIndex = layers.findIndex(l => l.id === layer.id);
    
      // 👉 Regra de validade alinhada com o drop atual:
      // drop atual move sempre para hoverIndex.
      // É "inválido" quando:
      // - não sabemos quem arrasta
      // - índice inválido
      // - soltando em si mesmo (fromIndex === hoverIndex)
      let isValid = true;
      if (!draggedId || fromIndex === -1 || hoverIndex === -1 || fromIndex === hoverIndex) {
        isValid = false;
      }
    
      // Estilo base da linha
      dropIndicator.style.display = 'block';
      dropIndicator.style.height = '2px';
      dropIndicator.style.borderRadius = '2px';
      dropIndicator.style.transition = 'background 0.12s ease, box-shadow 0.12s ease';
    
      if (isValid) {
        // ✅ moverá a camada → azul
        dropIndicator.style.background = '#3b82f6';
        dropIndicator.style.boxShadow = '0 0 6px rgba(59,130,246,0.6)';
      } else {
        // ❌ não muda posição / inválido → vermelho
        dropIndicator.style.background = '#ef4444';
        dropIndicator.style.boxShadow = '0 0 6px rgba(239,68,68,0.6)';
      }
    
      // posição visual (mantida como antes)
      if (insertAbove) {
        el.before(dropIndicator);
      } else {
        el.after(dropIndicator);
      }
    });
    


    el.addEventListener('drop', e => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData('text/plain');
      if (!draggedId || draggedId === layer.id) return;
      const from = layers.findIndex(l => l.id === draggedId);
      const to = layers.findIndex(l => l.id === layer.id);
      const [moved] = layers.splice(from, 1);
      layers.splice(to, 0, moved);
      dropIndicator.style.display = 'none';
      render();
      syncOrderWithCanvas();
    });

    thumb.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      dropIndicator && (dropIndicator.style.display = 'none');
    });

    return el;
  }

  // --- Render --------------------------------------------------------
  function render() {
    list.innerHTML = '';
    layers.forEach(l => list.appendChild(buildItem(l)));
  }

  // --- Painel (corrigido!) ------------------------------------------
  function openPanel(open = true) {
    overlay.classList.toggle('open', !!open);
    panel.classList.toggle('open', !!open); // <<< essencial
    if (!open) ctx.classList.remove('open');
  }
  document.getElementById('close-layers').onclick = () => openPanel(false);
  overlay.onclick = () => openPanel(false);
  window.toggleLayersPanel = open => openPanel(open);

  // --- Eventos globais -----------------------------------------------
  window.addEventListener('kanva:select', e => {
    activeId = e.detail?.id || null; render();
  });
  window.addEventListener('kanva:deselect', () => { activeId = null; render(); });

  // --- Remoção de camada via Canvas ----------------------------------
  window.removeLayerById = function(id) {
    const idx = layers.findIndex(l => l.id === id);
    if (idx !== -1) {
      layers.splice(idx, 1);
      if (activeId === id) activeId = null;
      render();
    }
  };

  render();
}

  // Expor função de sincronização globalmente
  window.syncOrderWithCanvas = syncOrderWithCanvas;
