// ======================================================
// Kanva - textObject.js
// Objeto de texto: renderização e edição específicas
// ======================================================

function TextObject(text, opts) {
  if (!opts) opts = {};
  CanvasObject.call(this, 'text', opts.x || 0, opts.y || 0);

  this.text = text || 'Novo texto';
  this.color = opts.color || '#ffffff';
  this.size = opts.size || 48;
  this.width = opts.width || 400;
  this.outline = opts.outline || { color: '#000000', em: 0.06 };
}

// ---------- Herança ----------
TextObject.prototype = Object.create(CanvasObject.prototype);
TextObject.prototype.constructor = TextObject;

// ---------- Renderização ----------
TextObject.prototype.drawFill = function (ctx) {
  const layout = layoutTextCharWrap(this, ctx);
  ctx.save();
  ctx.translate(this.x, this.y);
  if (this.rotation) ctx.rotate(this.rotation);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = this.size + 'px sans-serif';
  ctx.fillStyle = this.color;
  for (let i = 0; i < layout.lines.length; i++) {
    const y = (i - (layout.lines.length - 1) / 2) * layout.lineHeight;
    ctx.fillText(layout.lines[i], 0, y);
  }
  ctx.restore();
};

TextObject.prototype.drawOutline = function (ctx) {
  const layout = layoutTextCharWrap(this, ctx);
  const ow = outlineWidth(this);
  if (ow <= 0) return;

  ctx.save();
  ctx.translate(this.x, this.y);
  if (this.rotation) ctx.rotate(this.rotation);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = this.size + 'px sans-serif';
  ctx.lineWidth = ow;
  ctx.strokeStyle = this.outline.color || '#000';
  for (let i = 0; i < layout.lines.length; i++) {
    const y = (i - (layout.lines.length - 1) / 2) * layout.lineHeight;
    ctx.strokeText(layout.lines[i], 0, y);
  }
  ctx.restore();
};

// ---------- Edição (mover, escalar, rotacionar, wrap) ----------
TextObject.prototype.onDrag = function (mode, delta, start) {
  switch (mode) {
    case 'move':
      this.x = start.x + delta.x;
      this.y = start.y + delta.y;
      break;

    case 'scale':
      const scaleFactor = delta.scale;
      this.size = Math.max(6, start.size * scaleFactor);
      this.width = Math.max(20, start.width * scaleFactor);
      break;

    case 'rotate':
      this.rotation = start.rotation + delta.angle;
      break;

    case 'wrap-e':
      this.width = Math.max(20, start.width + delta.width);
      break;
  }
};

// ---------- Layout de texto com quebra automática ----------
function layoutTextCharWrap(obj, ctx) {
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

// ---------- Contorno em "em" ----------
function outlineWidth(o) {
  if (!o.outline) return 0;
  const em = o.outline.em || 0.06;
  return em * (o.size || 0);
}

// ---------- Exporta globalmente ----------
window.TextObject = TextObject;
window.layoutTextCharWrap = layoutTextCharWrap;
window.outlineWidth = outlineWidth;