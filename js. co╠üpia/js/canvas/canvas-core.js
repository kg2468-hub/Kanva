// ======================================================
// Kanva - canvas-core.js
// Núcleo principal do Kanva: inicializa contexto, estado e renderização
// ======================================================

function initCanvas() {
  const canvas = document.getElementById('kanva');
  if (!canvas) {
    console.error('❌ Canvas com id="kanva" não encontrado.');
    return;
  }

  const ctx = canvas.getContext('2d', { alpha: false });
  const DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

  // ------------------------------------------------------
  // Estado global do canvas
  // ------------------------------------------------------
  const state = {
    DPR,
    ctx,
    canvas,
    project: {
      width: parseInt(getQueryParam('w', 1080), 10) || 1080,
      height: parseInt(getQueryParam('h', 1080), 10) || 1080
    },
    scale: 1,
    rotation: 0,
    translateX: 0,
    translateY: -20,
    objects: [],
    activeObjId: null
  };

  // ------------------------------------------------------
  // Ajusta tamanho físico do canvas
  // ------------------------------------------------------
  function setCanvasSize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  // ------------------------------------------------------
  // Função de renderização principal
  // ------------------------------------------------------
  function draw() {
    renderCanvas(ctx, state);
  }

  // ------------------------------------------------------
  // Inicialização
  // ------------------------------------------------------
  setCanvasSize();

  // Zoom inicial (~34%) igual às versões antigas
  (function initialFit() {
    const SW = canvas.width / DPR;
    const SH = canvas.height / DPR;
    const pad = 24 + 84;
    const fit = Math.min((SW - 48) / state.project.width, (SH - pad) / state.project.height);
    state.scale = Math.max(0.1, fit);
    state.translateX = 0;
    state.translateY = -20;
    state.rotation = 0;
  })();

  // Conecta eventos e API
  attachCanvasEvents(state);
  registerCanvasAPI(state);

  // Redesenha
  draw();

  // Atualiza no redimensionamento da janela
  window.addEventListener('resize', function () {
    setCanvasSize();
    draw();
  });

  console.log('%cKanva iniciado ✅', 'color:#60a5fa;font-weight:bold;');
}

// ------------------------------------------------------
// Chama automaticamente quando a página carregar
// ------------------------------------------------------
document.addEventListener('DOMContentLoaded', function () {
  if (typeof initCanvas === 'function') {
    initCanvas();
  }
});

// ------------------------------------------------------
// Expõe globalmente
// ------------------------------------------------------
window.initCanvas = initCanvas;