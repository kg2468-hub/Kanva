// ======================================================
// Kanva - baseObject.js
// Classe base genérica para todos os objetos do canvas
// ======================================================

function CanvasObject(type, x = 0, y = 0) {
  this.id = 'obj-' + Math.random().toString(36).slice(2, 8);
  this.type = type;
  this.x = x;
  this.y = y;
  this.visible = true;
  this.locked = false;
  this.rotation = 0;
}

// -------- Métodos padrão (serão herdados) --------
CanvasObject.prototype.drawFill = function (ctx) {};
CanvasObject.prototype.drawOutline = function (ctx) {};
CanvasObject.prototype.hitTest = function (x, y) { return false; };
CanvasObject.prototype.onDrag = function (mode, delta) {};

CanvasObject.prototype.serialize = function () {
  return JSON.parse(JSON.stringify(this));
};

CanvasObject.prototype.clone = function () {
  const copy = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
  copy.id = 'obj-' + Math.random().toString(36).slice(2, 8);
  return copy;
};

// Deixa disponível globalmente
window.CanvasObject = CanvasObject;
window.TextObject = TextObject;
window.layoutTextCharWrap = layoutTextCharWrap;
window.outlineWidth = outlineWidth;