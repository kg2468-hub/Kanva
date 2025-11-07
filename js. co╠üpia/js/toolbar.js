// ======================================================
// Toolbar v1.4-pro — UI Shield + clique fora inteligente + integração total
// ======================================================
//
// • Novo: UI Shield (overlay) sobre o canvas para capturar clique fora com intenção
// • Fecha painel anterior ao abrir outro
// • Sliders destravados após edição de texto
// • Sem listeners globais confusos; foco explícito nos inputs
// ======================================================


// ======================================================
// Kanva Toolbar Global Patch — prevenção de clique residual após edição de texto
// ======================================================

window.__kanvaJustEdited = false;

window.addEventListener('kanva:textEdited', () => {
  window.__kanvaJustEdited = true;
  setTimeout(() => (window.__kanvaJustEdited = false), 400);
});


// ======================================================
// Funções globais de detecção de clique UI/canvas
// ======================================================

function isProjectUI(target) {
  return !!(
    target.closest('#toolbar') ||
    target.closest('#toolbar-scroll') ||
    target.closest('.tool-btn') ||
    target.closest('.slider-panel') ||
    target.closest('.color-panel') ||
    target.closest('.layers-panel') ||
    target.closest('.layers-overlay') ||
    target.closest('.layer-context') ||
    target.closest('#text-editor') ||
    target.closest('#text-done-btn')
  );
}

function isCanvasClick(target) {
  const canvas = document.getElementById('kanva');
  return target === canvas;
}


// ======================================================
// UI Shield — overlay para capturar "clique no background"
// ======================================================

function ensureUIShield() {
  let shield = document.getElementById('kanva-ui-shield');
  if (shield) return shield;

  shield = document.createElement('div');
  shield.id = 'kanva-ui-shield';
  shield.style.cssText = `
    position:fixed; inset:0;
    pointer-events:none;
    z-index: 999;
    background: transparent;
  `;
  document.body.appendChild(shield);
  return shield;
}

function showUIShield() {
  const shield = ensureUIShield();
  shield.style.pointerEvents = 'auto';
  shield.onclick = () => {
    closeAllPanels();
    hideUIShield();
  };
}

function hideUIShield() {
  const shield = ensureUIShield();
  shield.style.pointerEvents = 'none';
  shield.onclick = null;
}

function closeAllPanels() {
  document.querySelectorAll('.slider-panel, .color-panel').forEach(p => p.remove());
}


// ======================================================
// Inicialização da Toolbar
// ======================================================

function initToolbar() {
  const scroll = document.getElementById('toolbar-scroll');
  const btnLayers = document.getElementById('btn-layers');
  if (!scroll) return;

  function clearToolbar() {
    scroll.innerHTML = '';
  }

  function createButton(key, label, svg, onClick) {
    const btn = document.createElement('button');
    btn.className = 'tool-btn';
    btn.dataset.tool = key;
    btn.innerHTML = `<div class="icon">${svg}</div><div class="label">${label}</div>`;
    btn.onclick = () => {
      closeAllPanels();
      hideUIShield();
      onClick();
    };
    scroll.appendChild(btn);
    return btn;
  }

  // Ferramentas principais (modo geral)
  function renderGeneralTools() {
    clearToolbar();
    const tools = [
      {
        key: 'text',
        label: 'Texto',
        svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M4 6h16M9 6v12M15 6v12M6 18h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>`,
        action: () => handleToolClick('text', 'Texto')
      },
      {
        key: 'shape',
        label: 'Forma',
        svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="4" width="7" height="7" stroke="currentColor" stroke-width="1.8"/>
          <circle cx="16.5" cy="9.5" r="3.5" stroke="currentColor" stroke-width="1.8"/>
          <path d="M14 14l6 6H8l6-6Z" stroke="currentColor" stroke-width="1.8"/>
        </svg>`,
        action: () => handleToolClick('shape', 'Forma')
      },
      {
        key: 'image',
        label: 'Imagem',
        svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="3.5" y="5" width="17" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/>
          <path d="M6 15l3-3 3 3 4-4 2 2" stroke="currentColor" stroke-width="1.8"/>
          <circle cx="9" cy="9" r="1.4" fill="currentColor"/>
        </svg>`,
        action: () => handleToolClick('image', 'Imagem')
      },
      {
        key: 'bg',
        label: 'Fundo',
        svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="3.5" y="3.5" width="17" height="17" rx="2" stroke="currentColor" stroke-width="1.8"/>
          <path d="M3.5 12h17M12 3.5v17" stroke="currentColor" stroke-width="1.8"/>
        </svg>`,
        action: () => handleToolClick('bg', 'Fundo')
      }
    ];
    tools.forEach(t => createButton(t.key, t.label, t.svg, t.action));
  }

  // Ferramentas modo Texto (ícones atualizados)
  function renderTextTools() {
    clearToolbar();
    const tools = [
      {
        key: 'edit',
        label: 'Editar',
        svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M4 20h16M5 15l9-9a2.8 2.8 0 114 4l-9 9H5v-4Z" stroke="currentColor" stroke-width="1.8"/>
        </svg>`,
        action: () => editActiveText?.() || showToast('Selecione um texto para editar')
      },
      {
  key: 'font',
  label: 'Fonte',
  svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M5 6h14M12 6v12M8 18h8" 
          stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`,
  action: () => openFontPicker()
},
  {
  key: 'color',
  label: 'Cor',
  svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M12 3a9 9 0 100 18 2 2 0 010-4h2a4 4 0 004-4 9 9 0 00-9-10Z" 
          stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="8.5" cy="10.5" r="1.2" fill="currentColor"/>
    <circle cx="12" cy="6.5" r="1.2" fill="currentColor"/>
    <circle cx="15.5" cy="10" r="1.2" fill="currentColor"/>
  </svg>`,
  action: () => {
    const obj = getActiveObject?.();
    if (!obj) return showToast('Selecione um texto');
    openColorPanel('Cor do texto', obj.color || '#ffffff', color => {
      if (window.setTextObjectColor) setTextObjectColor(obj.id, color);
    });
  }
},
      {
        key: 'size',
        label: 'Tamanho',
        svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M4 20h16M12 5v14M8 9l4-4 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>`,
        action: () => openSliderPanel('Tamanho do texto', 6, 600, getActiveObject()?.size || 48, val => {
          const obj = getActiveObject?.();
          if (obj && window.setTextObjectSize) setTextObjectSize(obj.id, val);
        })
      },
      {
        key: 'outline',
        label: 'Contorno',
        svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2"/>
          <path d="M6 6l12 12" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>
        </svg>`,
        action: () => {
          const obj = getActiveObject?.();
          if (!obj) return showToast('Selecione um texto');
          const width = obj.outline?.em ?? 0.06;
          openSliderPanel('Espessura do contorno', 0, 0.3, width, val => {
            setTextObjectOutline(obj.id, undefined, val);
          });
        }
      },
      {
        key: 'outlineColor',
        label: 'Cor do contorno',
        svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8"/>
          <circle cx="12" cy="12" r="3.5" fill="currentColor"/>
        </svg>`,
        action: () => {
          const obj = getActiveObject?.();
          if (!obj) return showToast('Selecione um texto');
          const current = obj.outline?.color || '#000000';
          openColorPanel('Cor do contorno', current, color => {
            if (window.setTextObjectOutlineColor) setTextObjectOutlineColor(obj.id, color);
          });
        }
      },
      {
        key: 'opacity',
        label: 'Opacidade',
        svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.6"/>
          <path d="M4 12a8 8 0 0116 0c0 4.4-3.6 8-8 8a8 8 0 01-8-8z" fill="currentColor" opacity=".2"/>
        </svg>`,
        action: () => openSliderPanel('Opacidade', 0, 1, getActiveObject()?.opacity ?? 1, val => {
          const obj = getActiveObject?.();
          if (obj && window.setTextObjectOpacity) setTextObjectOpacity(obj.id, val);
        })
      },
      {
        key: 'duplicate',
        label: 'Duplicar',
        svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="8" y="8" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.8"/>
          <path d="M4 4h10v10" stroke="currentColor" stroke-width="1.8"/>
        </svg>`,
        action: () => {
          const obj = getActiveObject?.();
          if (!obj) return showToast('Selecione um texto');
          duplicateTextObject?.(obj.id);
        }
      },
      {
        key: 'delete',
        label: 'Excluir',
        svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M6 7h12M10 7V5h4v2M8 7l1 12h6l1-12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>`,
        action: () => {
          const obj = getActiveObject?.();
          if (obj && confirm('Excluir este texto?')) deleteTextObject?.(obj.id);
        }
      }
    ];
    tools.forEach(t => createButton(t.key, t.label, t.svg, t.action));
  }

  if (btnLayers) btnLayers.onclick = () => {
    closeAllPanels();
    hideUIShield();
    window.toggleLayersPanel?.(true);
  };

  renderGeneralTools();

  window.addEventListener('kanva:select', e => {
    const type = e.detail?.type;
    highlightActiveMode(type);
    if (type === 'Texto') renderTextTools();
    else renderGeneralTools();
  });

  window.addEventListener('kanva:deselect', () => {
    removeActiveHighlight();
    renderGeneralTools();
  });

  function highlightActiveMode(type) {
    removeActiveHighlight();
    const btn = document.querySelector(`.tool-btn[data-tool="${type?.toLowerCase()}"]`);
    if (btn) {
      btn.classList.add('active');
      btn.style.color = '#60a5fa';
    }
  }

  function removeActiveHighlight() {
    document.querySelectorAll('.tool-btn.active').forEach(b => {
      b.classList.remove('active');
      b.style.color = '';
    });
  }
}


// ======================================================
// Lógica de clique das ferramentas gerais
// ======================================================
function handleToolClick(tool, label) {
  switch (tool) {
    // 🟦 Adicionar texto
    case 'text':
      if (window.addTextObject) window.addTextObject();
      else showToast('Função de texto não disponível.');
      break;

    // 🖼️ Adicionar imagem
    case 'image': {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';

      input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = ev => {
          if (window.addImageObject) {
            window.addImageObject(ev.target.result);
          } else {
            showToast('Função de imagem não disponível.');
          }
        };
        reader.readAsDataURL(file);
      };

      document.body.appendChild(input);
      input.click();
      document.body.removeChild(input);
      break;
    }

    // ⚙️ Demais ferramentas (Forma, Fundo, etc.)
    default:
      showToast(`Ferramenta "${label}" em breve 🔧`);
  }
}

// ======================================================
// Toast simples
// ======================================================
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = `
      position:fixed;bottom:100px;left:50%;transform:translateX(-50%);
      background:rgba(30,30,40,0.9);color:#fff;padding:10px 18px;
      border-radius:8px;font-size:14px;z-index:2000;opacity:0;transition:opacity .3s;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => (toast.style.opacity = '0'), 2000);
}


// ======================================================
// Painel de slider — com UI Shield e foco explícito
// ======================================================
function openSliderPanel(title, min, max, value, onChange) {
  closeAllPanels();
  showUIShield();
  document.onclick = null;

  const panel = document.createElement('div');
  panel.id = 'slider-panel';
  panel.className = 'slider-panel';
  panel.style.zIndex = 2001;
  panel.innerHTML = `
    <h3>${title}</h3>
    <input type="range" min="${min}" max="${max}" step="${(max - min) / 100}" value="${value}">
    <div class="value">${Number(value).toFixed(2)}</div>
  `;
  document.body.appendChild(panel);

  const range = panel.querySelector('input');
  const valDisplay = panel.querySelector('.value');

  requestAnimationFrame(() => {
    panel.classList.add('show');
    try { document.activeElement && document.activeElement.blur(); } catch {}
    range.focus();
  });

  range.oninput = () => {
    window.__kanvaJustEdited = false;
    const val = parseFloat(range.value);
    valDisplay.textContent = Number(val).toFixed(2);
    if (onChange) onChange(val);
  };

  panel.addEventListener('mousedown', e => e.stopPropagation());
  panel.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
}


// ======================================================
// Painel de cor — com UI Shield e fechamento unificado
// ======================================================
function openColorPanel(title, startColor, onChange) {
  closeAllPanels();
  showUIShield();
  document.onclick = null;

  const panel = document.createElement('div');
  panel.id = 'color-panel';
  panel.className = 'color-panel';
  panel.style.zIndex = 2001;
  panel.innerHTML = `
    <h3>${title}</h3>
    <input type="color" value="${startColor || '#ffffff'}">
    <div class="value">${startColor || '#ffffff'}</div>
  `;
  document.body.appendChild(panel);

  const input = panel.querySelector('input');
  const valDisplay = panel.querySelector('.value');

  requestAnimationFrame(() => {
    panel.classList.add('show');
    try { document.activeElement && document.activeElement.blur(); } catch {}
    input.focus();
  });

  input.oninput = () => {
    window.__kanvaJustEdited = false;
    const color = input.value;
    valDisplay.textContent = color;
    if (onChange) onChange(color);
  };

  panel.addEventListener('mousedown', e => e.stopPropagation());
  panel.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
}