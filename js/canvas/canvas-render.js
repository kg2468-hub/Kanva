// ======================================================
// Kanva - canvas-render.js
// Responsável por desenhar todo o conteúdo do canvas
// ======================================================

function renderCanvas(ctx, state) {
  const { project, scale, rotation, translateX, translateY, objects, activeObjId } = state;
  const { width: PW, height: PH } = project;
  const SW = ctx.canvas.width / state.DPR;
  const SH = ctx.canvas.height / state.DPR;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.setTransform(state.DPR, 0, 0, state.DPR, 0, 0);
  ctx.translate(SW / 2 + translateX, SH / 2 + translateY);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);

  // === Fundo e papel ===
  renderBackground(ctx, PW, PH);

  // === Objetos (fill clipado) ===
  ctx.save();
  ctx.beginPath();
  ctx.rect(-PW / 2, -PH / 2, PW, PH);
  ctx.clip();
  for (const obj of objects) {
    if (!obj.visible) continue;
    if (obj.drawFill) obj.drawFill(ctx);
  }
  ctx.restore();

  // === Objetos (contorno fora do clip) ===
  for (const obj of objects) {
    if (!obj.visible) continue;
    if (obj.drawOutline) obj.drawOutline(ctx);
  }

  // === Seleção ativa ===
  const activeObj = objects.find(o => o.id === activeObjId && o.visible);
  if (activeObj) drawOverlay(ctx, activeObj, scale);

  // === HUD ===
  renderHUD(state);
}

// ------------------------------------------------------
// Fundo (papel + checker)
// ------------------------------------------------------
function renderBackground(ctx, PW, PH) {
  // sombra e fundo
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#111827';
  ctx.fillRect(-PW / 2, -PH / 2, PW, PH);
  ctx.restore();

  // checker
  const size = 40;
  const cols = Math.ceil(PW / size);
  const rows = Math.ceil(PH / size);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#f5f5f5' : '#d1d1d1';
      ctx.fillRect(x * size - PW / 2, y * size - PH / 2, size, size);
    }
  }
}

// ------------------------------------------------------
// HUD (zoom e rotação no canto da tela)
// ------------------------------------------------------
function renderHUD(state) {
  const zoomDisplay = document.getElementById('zoomDisplay');
  const rotationDisplay = document.getElementById('rotationDisplay');
  if (zoomDisplay) zoomDisplay.textContent = 'Zoom: ' + (state.scale * 100).toFixed(0) + '%';
  if (rotationDisplay) {
    const deg = (state.rotation * 180 / Math.PI) % 360;
    rotationDisplay.textContent = 'Rot: ' + ((deg < 0 ? deg + 360 : deg).toFixed(0)) + '°';
  }
}

// ------------------------------------------------------
// Expõe globalmente
// ------------------------------------------------------
window.renderCanvas = renderCanvas;
window.renderBackground = renderBackground;
window.renderHUD = renderHUD;