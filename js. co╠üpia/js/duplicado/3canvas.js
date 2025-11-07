// Kanva v0.13.5-pro — canvas.js
// -------------------------------------------------------------
// - Texto/contorno e edição como v0.13.4b (contorno em em, wrap, seleção)
// - Canvas (pan/zoom/rotação globais) restaurado ao comportamento ORIGINAL
//   → pinch usa multiplicação incremental por (newDist / pinchLastDist)
//   → rotação global por delta de ângulo incremental
//   → pan pelo delta do centro do gesto
// - Movimentação livre dos objetos (sem clamps)
// - Visibilidade/lock funcionando
// -------------------------------------------------------------

function initCanvas() {
  const canvas = document.getElementById('kanva');
  const ctx = canvas.getContext('2d', { alpha: false });
  const DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

  const defW = parseInt(getQueryParam?.('w','1080') ?? '1080', 10) || 1080;
  const defH = parseInt(getQueryParam?.('h','1080') ?? '1080', 10) || 1080;
  const project = { width: defW, height: defH };

  // Transformações globais do CANVAS
  let scale = 1, rotation = 0, translateX = 0, translateY = -20;

  // HUD
  const zoomDisplay = document.getElementById('zoomDisplay');
  const rotationDisplay = document.getElementById('rotationDisplay');

  // Objetos e seleção
  const objects = [];
  let activeObjId = null;

  // Constantes
  const SELECT_TOL_SCR = 16;
  const HANDLE_R_SCR   = 9;
  const ROT_RING_IN    = 22;
  const ROT_RING_OUT   = 40;
  const MARGIN_SCR     = 6;
  const MAX_FONT_SIZE  = 1024;
  const MIN_FONT_SIZE  = 6;
  const EPS            = 1e-4;
  const MAX_WRAP_W     = 8192;

  // Estado de drag
  let drag = null;
  let mouseDownPos = null;

  // Multitoque (canvas)
  let pinchLastDist = 0, pinchLastAngle = 0, pinchLastCenter = null;

  // Touch de 1 dedo (edição de objeto)
  let activeTouchId = null;
  let touchEditingActive = false;

  // Posições dos handles em tela (hit-test)
  const overlayHit = { TL:null,TR:null,BR:null,BL:null,E:null,ROTC:null,boxPath:null };

  // ------------- Utils -------------
  function setCanvasSize(){
    const w=window.innerWidth,h=window.innerHeight;
    canvas.style.width=w+'px'; canvas.style.height=h+'px';
    canvas.width=Math.floor(w*DPR); canvas.height=Math.floor(h*DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  function screenSize(){ return { w: canvas.width/DPR, h: canvas.height/DPR }; }

  function worldToScreen(wx,wy){
    const {w:SW,h:SH}=screenSize();
    const cos=Math.cos(rotation), sin=Math.sin(rotation);
    const rx=wx*cos - wy*sin, ry=wx*sin + wy*cos;
    return { x: SW/2 + translateX + rx*scale, y: SH/2 + translateY + ry*scale };
  }
  function screenToWorld(sx,sy){
    const {w:SW,h:SH}=screenSize();
    const dx=sx-(SW/2+translateX), dy=sy-(SH/2+translateY);
    const inv=1/scale, cos=Math.cos(-rotation), sin=Math.sin(-rotation);
    return { x:(dx*inv)*cos-(dy*inv)*sin, y:(dx*inv)*sin+(dy*inv)*cos };
  }
  function screenDeltaToWorld(dx,dy){
    const inv=1/scale, cos=Math.cos(-rotation), sin=Math.sin(-rotation);
    return { x:(dx*inv)*cos-(dy*inv)*sin, y:(dx*inv)*sin+(dy*inv)*cos };
  }
  function rotateAround(px,py,cx,cy,ang){
    const dx=px-cx, dy=py-cy, cos=Math.cos(ang), sin=Math.sin(ang);
    return { x: cx + dx*cos - dy*sin, y: cy + dx*sin + dy*cos };
  }

  // Layout de texto (wrap por caractere)
  function layoutTextCharWrap(obj){
    const text=String(obj.text||'');
    const maxW=Math.max(20, Math.min(MAX_WRAP_W, obj.width||400));
    const chars=[...text], lines=[]; let line='';
    ctx.save(); ctx.font = `${obj.size}px '${obj.font || "sans-serif"}'`;
    for(let i=0;i<chars.length;i++){
      const test=line+chars[i];
      const w=ctx.measureText(test).width;
      if(w<=maxW || line===''){ line=test; } else { lines.push(line); line=chars[i]; }
    }
    if(line) lines.push(line);
    const lineHeight=obj.size*1.2;
    const height=Math.max(lineHeight, lines.length*lineHeight);
    let widest=0; for(const l of lines) widest=Math.max(widest, ctx.measureText(l).width);
    ctx.restore();
    return { lines, width:Math.max(maxW, widest), height, lineHeight };
  }

  // Contorno em "em"
  function migrateOutlineToEm(o){
    if(!o.outline) return;
    if(typeof o.outline.em==='number') return;
    const baseSize=Math.max(1, o.size||48);
    const abs=Math.max(0, o.outline.width||0);
    const em=abs ? (abs/baseSize) : 0.06;
    o.outline={ color:o.outline.color||'#000', em };
  }
  function outlineWidth(o) {
  if (!o.outline) return 0;
  migrateOutlineToEm(o);
  const base = (o.outline.em || 0) * (o.size || 0);

  // Ajuste fino: fontes mais finas ganham um pequeno reforço no contorno
  if (o.font) {
    const f = o.font.toLowerCase();
    if (f.includes('light') || f.includes('thin')) return base * 1.5;
    if (f.includes('black') || f.includes('bold')) return base * 0.8;
  }
  return base;
}

  // Checker
  function drawChecker(size,c1,c2,width,height){
    const cols=Math.ceil(width/size), rows=Math.ceil(height/size);
    for(let y=0;y<rows;y++) for(let x=0;x<cols;x++){
      ctx.fillStyle=((x+y)%2===0)?c1:c2;
      ctx.fillRect(x*size - width/2, y*size - height/2, size, size);
    }
  }

  // Desenho principal
  function draw(){
    const {w:SW,h:SH}=screenSize();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,canvas.width,canvas.height);

    ctx.setTransform(DPR,0,0,DPR,0,0);
    ctx.translate(SW/2 + translateX, SH/2 + translateY);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);

    const PW=project.width, PH=project.height;

    // Fundo com sombra
    ctx.save();
    ctx.shadowColor="rgba(0,0,0,0.6)";
    ctx.shadowBlur=20;
    ctx.shadowOffsetY=8;
    ctx.fillStyle="#111827";
    ctx.fillRect(-PW/2, -PH/2, PW, PH);
    ctx.restore();

    // FILL dos objetos CLIPPED (e checker)
    ctx.save();
    ctx.beginPath(); ctx.rect(-PW/2, -PH/2, PW, PH); ctx.clip();
    drawChecker(40, "#f5f5f5", "#d1d1d1", PW, PH);


// === DESENHO UNIFICADO: respeita o z-order da lista objects ===
for (const o of objects) {
  if (o.visible === false) continue;

  ctx.save();
  ctx.translate(o.x, o.y);
  if (o.rotationLocal) ctx.rotate(o.rotationLocal);
  ctx.globalAlpha = o.opacity ?? 1;

  // 🖼️ Desenho de imagens
  if (o.type === 'Imagem' && o.image) {
    const w = o.width * (o.scale || 1);
    const h = o.height * (o.scale || 1);
    ctx.drawImage(o.image, -w / 2, -h / 2, w, h);
  }

  // 🅰️ Desenho de textos (com contorno e preenchimento)
  if (o.type === 'Texto') {
    migrateOutlineToEm(o);
    const lay = layoutTextCharWrap(o);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${o.size}px '${o.font || "sans-serif"}'`;

    // contorno
    const ow = outlineWidth(o);
    if (ow > 0) {
      ctx.lineWidth = ow;
      ctx.strokeStyle = o.outline?.color || '#000';
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      for (let i = 0; i < lay.lines.length; i++) {
        const y = (i - (lay.lines.length - 1) / 2) * lay.lineHeight;
        ctx.strokeText(lay.lines[i], 0, y);
      }
    }

    // preenchimento
    ctx.fillStyle = o.color || '#fff';
    for (let i = 0; i < lay.lines.length; i++) {
      const y = (i - (lay.lines.length - 1) / 2) * lay.lineHeight;
      ctx.fillText(lay.lines[i], 0, y);
    }
  }

  ctx.restore();
}


    // Seleção ativa (fora do clip)
const activeObj = objects.find(o => o.id === activeObjId && o.visible !== false);
if (activeObj) {
  if (activeObj.type === 'Texto') {
    const lay = layoutTextCharWrap(activeObj);
    drawSelectionAndOverlay(activeObj, lay);
  } else if (activeObj.type === 'Imagem') {
    drawImageSelection(activeObj);
  }
}
    // HUD
    if(zoomDisplay) zoomDisplay.textContent=`Zoom: ${(scale*100).toFixed(0)}%`;
    if(rotationDisplay){
      const deg=(rotation*180/Math.PI)%360;
      rotationDisplay.textContent=`Rot: ${(deg<0?deg+360:deg).toFixed(0)}°`;
    }
  }

  function fillHandle(x,y,rWorld){
    ctx.save();
    ctx.fillStyle="#111827";
    ctx.strokeStyle="#60a5fa";
    ctx.lineWidth=2/scale;
    ctx.beginPath(); ctx.arc(x,y,rWorld,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function drawSelectionAndOverlay(o, lay){
    const m = MARGIN_SCR/scale;
    const halfW=(o.width||lay.width)/2 + m;
    const halfH= lay.height/2 + m;

    const TL={x:-halfW,y:-halfH}, TR={x:halfW,y:-halfH},
          BR={x:halfW,y:halfH},  BL={x:-halfW,y:halfH};

    ctx.save();
    ctx.translate(o.x, o.y);
    const ang=o.rotationLocal||0; if(ang) ctx.rotate(ang);

    ctx.strokeStyle="#60a5fa";
    ctx.lineWidth=2/scale;
    ctx.setLineDash([8,6]);
    ctx.beginPath();
    ctx.moveTo(TL.x,TL.y); ctx.lineTo(TR.x,TR.y); ctx.lineTo(BR.x,BR.y); ctx.lineTo(BL.x,BL.y);
    ctx.closePath(); ctx.stroke();
    ctx.setLineDash([]);

    const r=HANDLE_R_SCR/scale;
    fillHandle(TL.x,TL.y,r);
    fillHandle(TR.x,TR.y,r);
    fillHandle(BR.x,BR.y,r);
    fillHandle(BL.x,BL.y,r);

    const E={x:(TR.x+BR.x)/2, y:(TR.y+BR.y)/2};
    fillHandle(E.x,E.y,r);

    const offset=48/scale;
    const topC={x:0,y:-halfH};
    const rotC={x:0,y:-halfH-offset};

    ctx.beginPath();
    ctx.arc(topC.x, topC.y, offset, -Math.PI, 0, false);
    ctx.strokeStyle="#60a5fa";
    ctx.lineWidth=2/scale;
    ctx.stroke();

    fillHandle(rotC.x, rotC.y, r*1.05);
    ctx.restore();

    // Atualiza overlayHit
    const rot = (p)=> rotateAround(p.x,p.y,0,0,o.rotationLocal||0);
    const wld = (p)=> ({ x:p.x + o.x, y:p.y + o.y });

    const TLw=wld(rot(TL)), TRw=wld(rot(TR)), BRw=wld(rot(BR)), BLw=wld(rot(BL));
    const Ew =wld(rot(E));
    const topCw=wld(rot(topC));
    const rotCw=wld(rot(rotC));

    overlayHit.TL = worldToScreen(TLw.x, TLw.y);
    overlayHit.TR = worldToScreen(TRw.x, TRw.y);
    overlayHit.BR = worldToScreen(BRw.x, BRw.y);
    overlayHit.BL = worldToScreen(BLw.x, BLw.y);
    overlayHit.E  = worldToScreen(Ew.x, Ew.y);
    overlayHit.ROTC = { top: worldToScreen(topCw.x, topCw.y), knob: worldToScreen(rotCw.x, rotCw.y) };
    overlayHit.boxPath = [TLw,TRw,BRw,BLw].map(p=>worldToScreen(p.x,p.y));
  }

// ======================================================
// Contorno de seleção para IMAGENS (com hit após rotação)
// ======================================================
function drawImageSelection(o) {
  const w = o.width * (o.scale || 1);
  const h = o.height * (o.scale || 1);
  const m = 8 / scale;        // mesma margem visual do desenho
  const r = 8 / scale;        // raio dos handles

  // --- Desenho visual (igual ao seu, rotacionado) ---
  const TL = { x: -w / 2 - m, y: -h / 2 - m };
  const TR = { x:  w / 2 + m, y: -h / 2 - m };
  const BR = { x:  w / 2 + m, y:  h / 2 + m };
  const BL = { x: -w / 2 - m, y:  h / 2 + m };

  ctx.save();
  ctx.translate(o.x, o.y);
  if (o.rotationLocal) ctx.rotate(o.rotationLocal);

  ctx.strokeStyle = "#60a5fa";
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

  fillHandle(TL.x, TL.y, r);
  fillHandle(TR.x, TR.y, r);
  fillHandle(BR.x, BR.y, r);
  fillHandle(BL.x, BL.y, r);

  // knob de rotação (mesma posição visual)
  const knobLocal = { x: 0, y: -h / 2 - 48 / scale };
  fillHandle(knobLocal.x, knobLocal.y, r * 1.1);

  ctx.restore();

  // --- Hit-test (agora respeita rotaçãoLocal) ---
  const ang = o.rotationLocal || 0;
  const cos = Math.cos(ang), sin = Math.sin(ang);

  // cantos da CAIXA VISUAL (com a mesma margem m) em MUNDO
  const cornersLocal = [TL, TR, BR, BL];
  const cornersWorld = cornersLocal.map(p => ({
    x: o.x + (p.x * cos - p.y * sin),
    y: o.y + (p.x * sin + p.y * cos)
  }));

  const [TLw, TRw, BRw, BLw] = cornersWorld;

  // centro do topo (para o "anel" de rotação) e posição do knob em MUNDO
  const topCenterLocal = { x: 0, y: -h / 2 - m };
  const topCenterWorld = {
    x: o.x + (topCenterLocal.x * cos - topCenterLocal.y * sin),
    y: o.y + (topCenterLocal.x * sin + topCenterLocal.y * cos)
  };
  const knobWorld = {
    x: o.x + (knobLocal.x * cos - knobLocal.y * sin),
    y: o.y + (knobLocal.x * sin + knobLocal.y * cos)
  };

  // popula overlayHit em COORDENADAS DE TELA
  overlayHit.TL = worldToScreen(TLw.x, TLw.y);
  overlayHit.TR = worldToScreen(TRw.x, TRw.y);
  overlayHit.BR = worldToScreen(BRw.x, BRw.y);
  overlayHit.BL = worldToScreen(BLw.x, BLw.y);

  overlayHit.ROTC = {
    top:  worldToScreen(topCenterWorld.x, topCenterWorld.y),
    knob: worldToScreen(knobWorld.x, knobWorld.y)
  };

  // área clicável do corpo (para move) — polígono rotacionado com margem
  overlayHit.boxPath = [TLw, TRw, BRw, BLw].map(p => worldToScreen(p.x, p.y));
}
  // Geometrias
  function near(p1,p2,tol){ return Math.hypot(p1.x-p2.x, p1.y-p2.y) <= tol; }
  function pointInQuad(px,py,quad){
    function area(a,b,c){ return Math.abs((a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y))/2); }
    const P={x:px,y:py}, A=quad[0],B=quad[1],C=quad[2],D=quad[3];
    const box = area(A,B,C)+area(A,C,D);
    const sum = area(P,A,B)+area(P,B,C)+area(P,C,D)+area(P,D,A);
    return Math.abs(sum - box) < 0.9;
  }

  // Hit nos handles
  function hitHandles(clientX, clientY){
    if(!activeObjId) return { mode:'none' };
    const tol = HANDLE_R_SCR + 4;
    const a = objects.find(o=>o.id===activeObjId);
    if(!a || a.visible===false || a.locked) return { mode:'none' };

    if(overlayHit.TL && near({x:clientX,y:clientY}, overlayHit.TL, tol)) return { mode:'scale', corner:'nw' };
    if(overlayHit.TR && near({x:clientX,y:clientY}, overlayHit.TR, tol)) return { mode:'scale', corner:'ne' };
    if(overlayHit.BR && near({x:clientX,y:clientY}, overlayHit.BR, tol)) return { mode:'scale', corner:'se' };
    if(overlayHit.BL && near({x:clientX,y:clientY}, overlayHit.BL, tol)) return { mode:'scale', corner:'sw' };

    if(overlayHit.E  && near({x:clientX,y:clientY}, overlayHit.E,  tol)) return { mode:'wrap-e' };

    if(overlayHit.ROTC){
      const tc = overlayHit.ROTC.top;
      const d = Math.hypot(clientX - tc.x, clientY - tc.y);
      if(d >= ROT_RING_IN && d <= ROT_RING_OUT) return { mode:'rotate' };
      const knob = overlayHit.ROTC.knob;
      if(near({x:clientX,y:clientY}, knob, tol)) return { mode:'rotate' };
    }
    if(overlayHit.boxPath && pointInQuad(clientX, clientY, overlayHit.boxPath)) return { mode:'move' };

    return { mode:'none' };
  }

  // ======================================================
// Hit seleção no corpo (Texto + Imagem) — versão Z-sync
// ======================================================
function hitSelect(worldX, worldY) {
  let found = null;

  // 🔹 percorre de cima pra baixo (último desenhado = topo visual)
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    if (o.visible === false || o.locked) continue;

    // 🖼️ IMAGEM
    if (o.type === 'Imagem' && o.image) {
      const w = o.width * (o.scale || 1);
      const h = o.height * (o.scale || 1);

      // converte o ponto clicado para o espaço local da imagem (respeitando rotação)
      const local = rotateAround(worldX, worldY, o.x, o.y, -(o.rotationLocal || 0));

      if (
        local.x >= o.x - w / 2 &&
        local.x <= o.x + w / 2 &&
        local.y >= o.y - h / 2 &&
        local.y <= o.y + h / 2
      ) {
        found = o;
        break; // 🟢 topmost encontrado
      }
    }

    // 🅰️ TEXTO
    if (o.type === 'Texto') {
      const lay = layoutTextCharWrap(o);
      const halfW = (o.width || lay.width) / 2;
      const halfH = lay.height / 2;
      const local = rotateAround(worldX, worldY, o.x, o.y, -(o.rotationLocal || 0));

      if (
        local.x >= o.x - halfW &&
        local.x <= o.x + halfW &&
        local.y >= o.y - halfH &&
        local.y <= o.y + halfH
      ) {
        found = o;
        break; // 🟢 topmost encontrado
      }
    }
  }

  return found;
}

  // Mouse
  canvas.addEventListener('mousedown', (e)=>{
    mouseDownPos = { x:e.clientX, y:e.clientY };

    // 1) handles/anel
    const hit = hitHandles(e.clientX, e.clientY);
    if(hit.mode !== 'none'){ beginDrag(e, hit); return; }

    // 2) corpo
    const rect=canvas.getBoundingClientRect();
    const wpos=screenToWorld(e.clientX-rect.left, e.clientY-rect.top);
    const found=hitSelect(wpos.x, wpos.y);
    if(found){
      activeObjId = found.id;
      window.dispatchEvent(new CustomEvent('kanva:select', { detail:{ type:found.type, id:found.id } }));
      draw();
      beginDrag(e, { mode:'move' });
    } else {
      if(activeObjId){
        activeObjId=null;
        window.dispatchEvent(new Event('kanva:deselect'));
        draw();
      }
    }
  });
  canvas.addEventListener('click', (e)=>{
    if(!mouseDownPos) return;
    const moved = Math.hypot(e.clientX-mouseDownPos.x, e.clientY-mouseDownPos.y);
    mouseDownPos=null;
    if(moved>3) return;
  });

  // Drag
  function beginDrag(e, hit){
  const obj = objects.find(o=>o.id===activeObjId);
  if(!obj || obj.locked || obj.visible===false) return;

  drag = {
    mode: hit.mode,
    corner: hit.corner||null,
    start: { x:e.clientX, y:e.clientY },
    objStart: {
      x: obj.x, y: obj.y,
      size: obj.size,
      width: Math.min(MAX_WRAP_W, obj.width||400),
      rot: obj.rotationLocal || 0,
      scale: (obj.scale ?? 1),
      imgW: obj.width  || 0,
      imgH: obj.height || 0
    },
    centerScr: worldToScreen(obj.x, obj.y),
    dist0: null,
    angle0: null,
    baseRotLocal: obj.rotationLocal || 0,
    // 🔹 novos campos
    anchorWorld: null,
    signX: 0,
    signY: 0
  };

  if(hit.mode==='scale'){
    const d0 = Math.hypot(e.clientX - drag.centerScr.x, e.clientY - drag.centerScr.y);
    drag.dist0 = Math.max(8, d0, EPS);

    if (obj.type === 'Imagem') {
      // define sinais do canto arrastado
      switch (hit.corner) {
        case 'nw': drag.signX = -1; drag.signY = -1; break;
        case 'ne': drag.signX = +1; drag.signY = -1; break;
        case 'sw': drag.signX = -1; drag.signY = +1; break;
        case 'se': drag.signX = +1; drag.signY = +1; break;
        default:   drag.signX =  0; drag.signY =  0; break;
      }
      // canto âncora = oposto ao arrastado (em LOCAL)
      const axLocal = -drag.signX * (drag.objStart.imgW * drag.objStart.scale) / 2;
      const ayLocal = -drag.signY * (drag.objStart.imgH * drag.objStart.scale) / 2;

      // converte âncora para MUNDO
      const ang = drag.objStart.rot || 0;
      const cos = Math.cos(ang), sin = Math.sin(ang);
      const axWorld = obj.x + (axLocal * cos - ayLocal * sin);
      const ayWorld = obj.y + (axLocal * sin + ayLocal * cos);
      drag.anchorWorld = { x: axWorld, y: ayWorld };
    }
  }

  if(hit.mode==='rotate'){
    drag.angle0 = Math.atan2(e.clientY - drag.centerScr.y, e.clientX - drag.centerScr.x);
  }

  window.addEventListener('mousemove', onDragMove, { passive:false });
  window.addEventListener('mouseup', onDragEnd, { passive:true });
}

  function onDragMove(e){
    if(!drag) return;
    e.preventDefault();

    const dx=e.clientX - drag.start.x;
    const dy=e.clientY - drag.start.y;

    const obj = objects.find(o=>o.id===activeObjId);
    if(!obj) return;

    switch(drag.mode){
      case 'move': {
        const d = screenDeltaToWorld(dx,dy);
        obj.x = drag.objStart.x + d.x;
        obj.y = drag.objStart.y + d.y;
        break;
      }
      case 'wrap-e': {
        const ang = (obj.rotationLocal||0) + rotation;
        const ux = Math.cos(ang), uy = Math.sin(ang);
        const proj = (dx*ux + dy*uy);
        const deltaWorld = proj / scale;
        const tentative = Math.max(20, Math.min(MAX_WRAP_W, drag.objStart.width + deltaWorld*2));
        obj.width = tentative;
        break;
      }
      case 'scale': {
  const c = drag.centerScr;
  const distNow = Math.hypot(e.clientX - c.x, e.clientY - c.y);
  const dist0   = Math.max(drag.dist0 || 1, EPS);

  if (obj.type === 'Texto') {
    // 🔤 TEXTO — comportamento original, preserva contorno EM
    const factor = Math.min(Math.max(distNow / dist0, 0.1), 50);
    const newSize  = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, drag.objStart.size * factor));
    const newWidth = Math.max(20, Math.min(MAX_WRAP_W, drag.objStart.width * factor));
    obj.size  = newSize;
    obj.width = newWidth;
    break;
  }

  if (obj.type === 'Imagem') {
  // 🖼️ IMAGEM — mesmo comportamento do TEXTO, porém com sensibilidade reduzida

  const c = drag.centerScr;
  const distNow = Math.hypot(e.clientX - c.x, e.clientY - c.y);
  const dist0   = Math.max(drag.dist0 || 1, EPS);

  // fator base de escala
  let factor = distNow / dist0;

  // 🔹 amortecimento: reduz a velocidade de variação
  // 0.25 = sensibilidade; menor → mais suave
  factor = 1 + (factor - 1) * 0.70;

  // limites de segurança
  factor = Math.min(Math.max(factor, 0.25), 4);

  // aplica escala proporcional em torno do centro
  obj.scale = drag.objStart.scale * factor;

  // redesenha
  break;
}
}
      case 'rotate': {
        const c=drag.centerScr;
        const angleNow = Math.atan2(e.clientY - c.y, e.clientX - c.x);
        const delta = angleNow - drag.angle0;
        obj.rotationLocal = drag.baseRotLocal + delta;
        break;
      }
    }

// 🔹 Atualiza o canvas completo
draw();

// 🔹 Reforça o contorno ativo (mantém visível durante drag)
const active = objects.find(o => o.id === activeObjId);
if (active) {
  if (active.type === 'Imagem') {
    drawImageSelection(active);
  } else if (active.type === 'Texto') {
    const lay = layoutTextCharWrap(active);
    drawSelectionAndOverlay(active, lay);
  }
}
}

  function onDragEnd(){
    window.removeEventListener('mousemove', onDragMove, { passive:false });
    window.removeEventListener('mouseup', onDragEnd, { passive:true });
    drag = null;
    draw();
  }

  // --- Touch helpers ---
  function getTouchById(touchList, id){
    for(let i=0;i<touchList.length;i++) if(touchList[i].identifier===id) return touchList[i];
    return null;
  }
  function beginDragFromPoint(clientX,clientY,hit){
    beginDrag({ clientX, clientY }, hit);
  }

  // 1 dedo = editar objeto
  canvas.addEventListener('touchstart', (e)=>{
    if(e.touches.length===1){
      const t=e.touches[0];
      if(pinchLastCenter) return; // se está em pinch, ignora
      // tenta handles
      const hit = hitHandles(t.clientX, t.clientY);
      if(hit.mode!=='none'){
        e.preventDefault();
        touchEditingActive = true;
        activeTouchId = t.identifier;
        beginDragFromPoint(t.clientX, t.clientY, hit);
        return;
      }
      // corpo
      const rect=canvas.getBoundingClientRect();
      const wpos=screenToWorld(t.clientX-rect.left, t.clientY-rect.top);
      const found=hitSelect(wpos.x, wpos.y);
      if(found){
        activeObjId=found.id;
        window.dispatchEvent(new CustomEvent('kanva:select', { detail:{ type:found.type, id:found.id } }));
        draw();
        e.preventDefault();
        touchEditingActive = true;
        activeTouchId = t.identifier;
        beginDragFromPoint(t.clientX, t.clientY, { mode:'move' });
      } else {
        if(activeObjId){
          activeObjId=null;
          window.dispatchEvent(new Event('kanva:deselect'));
          draw();
        }
      }
    }

    // início do multitoque (2 dedos) — ORIGINAL: zera referência incremental
    if(e.touches.length===2){
      const [t1, t2] = [e.touches[0], e.touches[1]];
      pinchLastDist   = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      pinchLastAngle  = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
      pinchLastCenter = { x:(t1.clientX + t2.clientX)/2, y:(t1.clientY + t2.clientY)/2 };
    }
  }, { passive:false });

  canvas.addEventListener('touchmove', (e)=>{
    // edição 1 dedo
    if(e.touches.length===1 && touchEditingActive){
      const t=getTouchById(e.touches, activeTouchId);
      if(!t) return;
      e.preventDefault();
      onDragMove({ clientX:t.clientX, clientY:t.clientY, preventDefault:()=>{} });
      return;
    }

    // 2 dedos = canvas (pan/zoom/rotação globais) — ORIGINAL
    if(e.touches.length===2){
      e.preventDefault();
      const [t1,t2]=[e.touches[0], e.touches[1]];
      const newDist   = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const newAngle  = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
      const newCenter = { x:(t1.clientX+t2.clientX)/2, y:(t1.clientY+t2.clientY)/2 };

      // pan incremental (delta do centro)
      if(pinchLastCenter){
        translateX += newCenter.x - pinchLastCenter.x;
        translateY += newCenter.y - pinchLastCenter.y;
      }

      // zoom incremental (multiplicativo)
      const ratio = newDist / Math.max(1, pinchLastDist);
      scale = Math.min(Math.max(scale * ratio, 0.2), 8);

      // rotação global incremental
      rotation += (newAngle - pinchLastAngle);

      // atualiza estado para próximo frame
      pinchLastDist = newDist;
      pinchLastAngle = newAngle;
      pinchLastCenter = newCenter;

      draw();
    }
  }, { passive:false });

  canvas.addEventListener('touchend', (e)=>{
    // término de edição 1 dedo
    const ended = e.changedTouches && getTouchById(e.changedTouches, activeTouchId);
    if(ended){
      touchEditingActive=false;
      activeTouchId=null;
      onDragEnd();
    }
    // fim de pinch
    if(e.touches.length<2) pinchLastCenter=null;
  }, { passive:true });

  canvas.addEventListener('touchcancel', ()=>{
    if(touchEditingActive){
      touchEditingActive=false; activeTouchId=null; onDragEnd();
    }
    pinchLastCenter=null;
  }, { passive:true });

  // Duplo toque = alterna entre 34% e 100%
let lastTapTime = 0, tapTimer = null;
canvas.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 1) return;
  const now = Date.now();
  if (now - lastTapTime < 280) {
    clearTimeout(tapTimer);
    // Inverte a lógica: primeiro duplo toque = 34%, segundo = 100%
    if (Math.abs(scale - 0.34) < 0.01) {
      scale = 1; // volta para 100%
    } else {
      scale = 0.34; // vai para 34%
    }
    translateX = 0;
    translateY = -20;
    rotation = 0;
    draw();
  } else {
    tapTimer = setTimeout(() => {}, 180);
  }
  lastTapTime = now;
}, { passive: true });

  // API pública
  window.addTextObject = function(){
    const obj = {
      id: 't'+Math.random().toString(36).slice(2,8),
      type: 'Texto',
      text: 'Novo texto',
      x: 0, y: 0,
      color: '#ffffff',
      size: 48,
      width: 400,         // wrap inicial
      rotationLocal: 0,
      visible: true,
      locked: false,
      outline: { color: '#000000', em: 0 } // 👈 contorno começa zerado
    };
    objects.push(obj);
    activeObjId = obj.id;
    if(window.addLayerFromObject) window.addLayerFromObject(obj);
    window.dispatchEvent(new CustomEvent('kanva:select', { detail:{ type:'Texto', id: obj.id } }));
    draw();
  };

  // Olho / cadeado p/ integração com Camadas
  window.toggleObjectVisibility = function(id, visible=true){
    const o = objects.find(x=>x.id===id); if(!o) return;
    o.visible = !!visible;
    if(!o.visible && activeObjId===id){
      activeObjId=null;
      window.dispatchEvent(new Event('kanva:deselect'));
    }
    draw();
  };
  window.toggleObjectLock = function(id, locked=true){
    const o = objects.find(x=>x.id===id); if(!o) return;
    o.locked = !!locked;
    if(o.locked && activeObjId===id){
      activeObjId=null;
      window.dispatchEvent(new Event('kanva:deselect'));
    }
    draw();
  };

  // Seleção externa (camadas/toolbar)
  window.addEventListener('kanva:select', (e)=>{
    const id=e.detail?.id; if(!id) return;
    const obj=objects.find(o=>o.id===id);
    if(obj && obj.visible!==false && !obj.locked){ activeObjId=id; draw(); }
  });
  window.addEventListener('kanva:deselect', ()=>{ activeObjId=null; draw(); });

  // Inicialização
  setCanvasSize();
  (function initialFit(){
    const {w:SW,h:SH}=screenSize();
    const pad=24 + 84;
    const fit=Math.min((SW-48)/project.width, (SH-pad)/project.height);
    scale=Math.max(0.1, fit);
    translateX=0; translateY=-20; rotation=0;
  })();
  draw();
  window.addEventListener('resize', ()=>{ setCanvasSize(); draw(); });

    // ------------------------------------------------------
  // 🔗 Expor acesso seguro aos objetos e seleção atuais
  // ------------------------------------------------------
  window.getActiveObject = function() {
    return objects.find(o => o.id === activeObjId) || null;
  };

  window.getAllObjects = function() {
    return objects;
  };





    // ------------------------------------------------------
  // 🔤 Funções adicionais do objeto de texto
  // ------------------------------------------------------

  // 1️⃣ Alterar texto diretamente (sem editor fullscreen)
  window.setTextObjectText = function(id, newText) {
    const o = objects.find(x => x.id === id && x.type === 'Texto');
    if (!o || o.locked) return;
    o.text = String(newText || '').trim() || 'Texto';
    draw();
  };

  // 2️⃣ Alterar cor principal
  window.setTextObjectColor = function(id, color) {
    const o = objects.find(x => x.id === id && x.type === 'Texto');
    if (!o || o.locked) return;
    o.color = color || '#ffffff';
    draw();
  };

  // 3️⃣ Alterar tamanho (font-size em px)
  window.setTextObjectSize = function(id, sizePx) {
    const o = objects.find(x => x.id === id && x.type === 'Texto');
    if (!o || o.locked) return;
    const s = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, sizePx));
    o.size = s;
    draw();
  };

  // 4️⃣ Alterar contorno (cor e espessura em EM)
  window.setTextObjectOutline = function(id, color, emWidth) {
    const o = objects.find(x => x.id === id && x.type === 'Texto');
    if (!o || o.locked) return;
    if (!o.outline) o.outline = { color: '#000', em: 0.06 };
    if (color) o.outline.color = color;
    if (typeof emWidth === 'number') o.outline.em = Math.max(0, emWidth);
    draw();
  };

// ======================================================
// 🟦 Atualiza a cor do contorno do texto
// ======================================================
window.setTextObjectOutlineColor = function (id, color) {
  const obj = getAllObjects?.().find(o => o.id === id && o.type === 'Texto');
  if (!obj) return;
  if (!obj.outline) obj.outline = {};
  obj.outline.color = color;
  window.redrawCanvas?.();
};

  // 5️⃣ Alterar opacidade (0–1)
  window.setTextObjectOpacity = function(id, alpha) {
    const o = objects.find(x => x.id === id && x.type === 'Texto');
    if (!o || o.locked) return;
    o.opacity = Math.min(1, Math.max(0, alpha));
    draw();
  };

  // 6️⃣ Alterar fonte (ainda simples, futura integração)
  window.setTextObjectFont = function(id, fontFamily) {
    const o = objects.find(x => x.id === id && x.type === 'Texto');
    if (!o || o.locked) return;
    o.font = fontFamily || 'sans-serif';
    draw();
  };

  // 7️⃣ Duplicar objeto texto
  window.duplicateTextObject = function(id) {
    const src = objects.find(o => o.id === id && o.type === 'Texto');
    if (!src) return;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = 't' + Math.random().toString(36).slice(2, 8);
    copy.x += 20;
    copy.y += 20;
    objects.push(copy);
    if (window.addLayerFromObject) window.addLayerFromObject(copy);
    activeObjId = copy.id;
    window.dispatchEvent(new CustomEvent('kanva:select', { detail: { type: 'Texto', id: copy.id } }));
    draw();
  };

  // 8️⃣ Excluir texto
window.deleteTextObject = function(id) {
  const idx = objects.findIndex(o => o.id === id && o.type === 'Texto');
  if (idx === -1) return;

  const wasActive = objects[idx].id === activeObjId;
  const deletedId = objects[idx].id;
  objects.splice(idx, 1);

  // 🔹 Remove a camada correspondente, se o painel de camadas existir
  if (typeof window.removeLayerById === 'function') {
    window.removeLayerById(deletedId);
  }

  if (wasActive) {
    activeObjId = null;
    window.dispatchEvent(new Event('kanva:deselect'));
  }

  draw();
};

// Expor o método draw globalmente para atualização externa
  window.redrawCanvas = draw;




  console.log('Kanva v0.13.5-pro — texto/contorno novos + canvas original (pan/zoom/rotação)');
}

// ======================================================
// Edição direta de texto (duplo toque + botão toolbar)
// ======================================================
// ======================================================
// Edição de texto fullscreen - versão estável
// ======================================================
function editTextObject(obj) {
  if (!obj || obj.type !== 'Texto' || obj.locked) return;

  const editor = document.getElementById('text-editor');
  if (!editor) return;

  // 🔹 Garante que o editor está visível antes do foco
  editor.style.display = 'block';
  editor.innerText = obj.text || '';
  requestAnimationFrame(() => {
    editor.classList.add('show');
    editor.focus();
  });

  document.body.style.overflow = 'hidden'; // bloqueia scroll do body

  // 🔹 Botão flutuante "✔️ Concluir"
  let btnDone = document.getElementById('text-done-btn');
  if (!btnDone) {
    btnDone = document.createElement('button');
    btnDone.id = 'text-done-btn';
    btnDone.innerHTML = '✔️ Concluir';
    btnDone.style.cssText = `
      position: fixed;
      bottom: 6vh;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255,255,255,0.15);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 10px;
      font-size: 18px;
      font-family: 'Inter', sans-serif;
      padding: 12px 24px;
      z-index: 100000;
      backdrop-filter: blur(6px);
      cursor: pointer;
      transition: background 0.25s ease;
    `;
    btnDone.onmouseenter = () => (btnDone.style.background = 'rgba(255,255,255,0.25)');
    btnDone.onmouseleave = () => (btnDone.style.background = 'rgba(255,255,255,0.15)');
    document.body.appendChild(btnDone);
  }
  btnDone.style.display = 'block';

  // 🔹 Função de saída
const saveAndClose = () => {
  if (!editor.classList.contains('show')) return;
  obj.text = editor.innerText.trim() || 'Texto';

  // Fecha visualmente o editor
  editor.classList.remove('show');
  editor.style.display = 'none';
  btnDone.style.display = 'none';
  document.body.style.overflow = '';

  // 🧹 Remove qualquer listener de clique residual do editor
  document.onclick = null;
  document.onmousedown = null;
  document.onmouseup = null;
  document.removeEventListener('click', () => {}, true);

  // Atualiza o canvas
  if (typeof window.redrawCanvas === 'function') window.redrawCanvas();

  // 🔹 Cria uma flag curta para evitar o clique duplo imediato
  window.__kanvaJustEdited = true;
  setTimeout(() => (window.__kanvaJustEdited = false), 500);
};

  // 🔹 Eventos
  btnDone.onclick = saveAndClose;
  editor.onblur = () => setTimeout(saveAndClose, 100);
  editor.onkeydown = e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      editor.innerText = obj.text; // restaura
      saveAndClose();
    }
  };

  // Impede clique interno de fechar
  editor.addEventListener('click', e => e.stopPropagation());

  // Clique fora salva
  document.addEventListener(
    'click',
    e => {
      if (editor.classList.contains('show') && !editor.contains(e.target) && e.target !== btnDone) {
        saveAndClose();
      }
    },
    { once: true }
  );
}
// ======================================================
// Duplo clique ou duplo toque → editar texto ativo
// ======================================================
const canvasEl = document.getElementById('kanva');
canvasEl.addEventListener('dblclick', () => {
  if (typeof activeObjId !== 'undefined' && activeObjId !== null) {
    const obj = window.kanvaObjects?.find(o => o.id === activeObjId)
      || (window.getActiveObject ? window.getActiveObject() : null);
    if (obj && obj.type === 'Texto' && !obj.locked) editTextObject(obj);
  }
});

// ======================================================
// Botão da toolbar (Editar Texto)
// ======================================================
window.editActiveText = function() {
  const obj = window.getActiveObject ? window.getActiveObject() : null;
  if (obj && obj.type === 'Texto' && !obj.locked) {
    editTextObject(obj);
  } else {
    showToast ? showToast('Selecione um texto para editar') : alert('Selecione um texto para editar');
  }
};













// ======================================================
// IMAGENS
// ======================================================

window.addImageObject = function (src) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = function () {
    const obj = {
      id: 'i' + Math.random().toString(36).slice(2, 8),
      type: 'Imagem',
      image: img,
      x: 0,
      y: 0,
      width: img.width,
      height: img.height,
      scale: 0.4,
      rotationLocal: 0,
      visible: true,
      locked: false,
      opacity: 1
    };
    window.getAllObjects?.().push(obj);
    if (window.addLayerFromObject) window.addLayerFromObject(obj);
    window.dispatchEvent(new CustomEvent('kanva:select', { detail: { type: 'Imagem', id: obj.id } }));
    window.redrawCanvas?.();
  };
  img.src = src;
};