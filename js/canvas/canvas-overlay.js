// ======================================================
// Kanva - canvas-overlay.js
// Desenha a seleção, handles e anel de rotação do objeto ativo
// ======================================================

function drawOverlay(ctx, obj, scale) {
  if (!obj) return;

  const layout = layoutTextLike(obj, ctx);
  const halfW = (obj.width || layout.width) / 2;
  const halfH = layout.height / 2;
  const margin = 6 / scale;

  const TL = { x: -halfW - margin, y: -halfH - margin };
  const TR = { x: halfW + margin, y: -halfH - margin };
  const BR = { x: halfW + margin, y: halfH + margin };
  const BL = { x: -halfW - margin, y: halfH + margin };

  ctx.save();
  ctx.translate(obj.x, obj.y);
  if (obj.rotation) ctx.rotate(obj.rotation);

  // ---- Caixa de seleção ----
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 2 / scale;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(TL.x, TL.y);
  ctx.lineTo(TR.x, TR.y);
  ctx.lineTo(BR.x, BR.y);
  ctx.lineTo(BL.x, BL.y);
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  // ---- Handles (cantos) ----
  const r = 7 / scale;
  const handlePoints = [TL, TR, BR, BL];
  for (const p of handlePoints) drawHandle(ctx, p.x, p.y, r);

  // ---- Handle lateral (wrap) ----
  const E = { x: (TR.x + BR.x) / 2, y: (TR.y + BR.y) / 2 };
  drawHandle(ctx, E.x, E.y, r);

  // ---- Anel de rotação ----
  const offset = 48 / scale;
  const topC = { x: 0, y: -halfH - margin };
  const rotC = { x: 0, y: -halfH - margin - offset };

  ctx.beginPath();
  ctx.arc(topC.x, topC.y, offset, -Math.PI, 0, false);
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 2 / scale;
  ctx.stroke();

  drawHandle(ctx, rotC.x, rotC.y, r * 1.1);

  ctx.restore();
}

// ------------------------------------------------------
// Desenha um círculo de handle
// ------------------------------------------------------
function drawHandle(ctx, x, y, r) {
  ctx.save();
  ctx.fillStyle = '#111827';
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 2 / ctx.getTransform().a;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------
// Mede o tamanho atual do texto para calcular a seleção
// ------------------------------------------------------
function layoutTextLike(obj, ctx) {
  const text = String(obj.text || '');
  const maxW = Math.max(20, Math.min(8192, obj.width || 400));
  const chars = text.split('');
  const lines = [];
  let line = '';
  ctx.save();
  ctx.font = obj.size + 'px sans-serif';
  for (let i = 0; i < chars.length; i++) {
    const test = line + chars[i];
    const w = ctx.measureText(test).width;
    if (w <= maxW || line === '') {
      line = test;
    } else {
      lines.push(line);
      line = chars[i];
    }
  }
  if (line) lines.push(line);
  const lineHeight = obj.size * 1.2;
  const height = Math.max(lineHeight, lines.length * lineHeight);
  let widest = 0;
  for (const l of lines) widest = Math.max(widest, ctx.measureText(l).width);
  ctx.restore();
  return { lines, width: Math.max(maxW, widest), height, lineHeight };
}

// ------------------------------------------------------
// Disponibiliza globalmente
// ------------------------------------------------------
window.drawOverlay = drawOverlay;