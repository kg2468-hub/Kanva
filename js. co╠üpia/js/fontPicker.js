// ======================================================
// Font Picker v2.1-pro — Google Fonts com preview real
// ------------------------------------------------------
// ✅ Integração completa com Google Fonts API
// ✅ Prévia real das fontes no modal
// ✅ Busca instantânea e rolagem suave
// ✅ Aplica no texto ativo automaticamente
// ✅ Inclui fontes locais e do sistema
// ======================================================

const GOOGLE_FONTS_API_KEY = "AIzaSyC44lCu9BBtP4Y9uLNphhYeWp215e4niIY";
const GOOGLE_FONTS_ENDPOINT = `https://www.googleapis.com/webfonts/v1/webfonts?key=${GOOGLE_FONTS_API_KEY}&sort=popularity`;

// ------------------------------------------------------
// 🔹 Carrega fontes disponíveis (Google + locais + sistema)
// ------------------------------------------------------
async function loadAvailableFonts() {
  const fonts = [];

  // 🔸 Fontes padrão do sistema
  const defaultFonts = [
    { name: "Arial", display: "Arial" },
    { name: "Georgia", display: "Georgia" },
    { name: "Courier New", display: "Courier New" },
    { name: "Verdana", display: "Verdana" },
    { name: "Tahoma", display: "Tahoma" },
    { name: "Times New Roman", display: "Times New Roman" },
    { name: "Helvetica", display: "Helvetica" },
  ];
  fonts.push(...defaultFonts);

  // 🔸 Fontes locais (pasta /assets/fonts/custom/)
  const localList = ["Roboto-Regular.ttf", "Lato-Bold.ttf"];
  for (const f of localList) {
    const url = `./assets/fonts/custom/${f}`;
    const name = f.split(".")[0].replace(/[-_]/g, " ");
    try {
      const ff = new FontFace(name, `url(${url})`);
      await ff.load();
      document.fonts.add(ff);
      fonts.unshift({ name, display: name });
    } catch {
      console.warn("⚠️ Fonte local não carregada:", f);
    }
  }

  // 🔸 Fontes do Google Fonts API
  try {
    const res = await fetch(GOOGLE_FONTS_ENDPOINT);
    const data = await res.json();
    if (data.items) {
      const googleFonts = data.items.slice(0, 250).map((f) => ({
        name: f.family,
        display: f.family,
        category: f.category,
      }));
      fonts.push(...googleFonts);
    }
  } catch (err) {
    console.error("❌ Erro ao carregar Google Fonts:", err);
  }

  return fonts;
}

// ------------------------------------------------------
// 🔹 Cria o modal do seletor de fontes
// ------------------------------------------------------
async function openFontPicker() {
  const fonts = await loadAvailableFonts();
  document.querySelector("#font-picker")?.remove();

  // 🔸 Fundo escuro
  const modal = document.createElement("div");
  modal.id = "font-picker";
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 3000;
    animation: fadeIn .25s ease;
  `;

  // 🔸 Caixa principal
  const box = document.createElement("div");
  box.className = "font-picker-box";
  box.style.cssText = `
    background: rgba(25,27,33,0.95);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    padding: 20px 20px 14px;
    border-radius: 14px;
    width: min(92vw, 420px);
    max-height: 75vh;
    display: flex;
    flex-direction: column;
    color: #fff;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  `;

  // 🔸 Cabeçalho + campo de busca
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <h3 style="margin:0;font-size:16px;font-weight:600;">Escolher Fonte</h3>
      <button id="close-font-picker" style="background:none;border:none;color:#9ca3af;font-size:18px;cursor:pointer;">✕</button>
    </div>
    <input id="font-search" type="text" placeholder="Buscar fonte..." 
      style="
        width:100%;
        padding:10px 12px;
        border-radius:8px;
        border:1px solid rgba(255,255,255,0.1);
        background:rgba(255,255,255,0.05);
        color:#fff;
        margin-bottom:12px;
        font-size:14px;
        outline:none;
      "/>
    <div class="font-list" style="overflow-y:auto;flex:1;scroll-behavior:smooth;"></div>
  `;

  const list = box.querySelector(".font-list");
  const input = box.querySelector("#font-search");

  // ------------------------------------------------------
  // 🔸 Renderiza a lista (com filtro e preview real)
  // ------------------------------------------------------
  function renderList(filter = "") {
    list.innerHTML = "";
    const filtered = fonts.filter((f) =>
      f.display.toLowerCase().includes(filter.toLowerCase())
    );

    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "Nenhuma fonte encontrada 😕";
      empty.style.cssText = "text-align:center;color:#9ca3af;font-size:14px;";
      list.appendChild(empty);
      return;
    }

    filtered.forEach((f) => {
      // 🔹 Carrega o CSS da fonte para o preview real
      if (!document.querySelector(`link[data-font='${f.name}']`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.dataset.font = f.name;
        link.href = `https://fonts.googleapis.com/css2?family=${f.name.replace(/ /g, "+")}&display=swap`;
        document.head.appendChild(link);
      }

      const item = document.createElement("div");
      item.className = "font-item";
      item.innerHTML = `
        <div class="font-title">${f.display}</div>
        <div class="font-preview" style="font-family:'${f.name}', sans-serif;">Exemplo de texto</div>
      `;
      item.style.cssText = `
        padding: 10px 14px;
        border-radius: 10px;
        cursor: pointer;
        margin-bottom: 8px;
        background: rgba(255,255,255,0.03);
        transition: background 0.2s;
      `;

      // Título e preview
      const title = item.querySelector(".font-title");
      title.style.cssText = `font-size:14px;color:#9ca3af;margin-bottom:4px;`;

      // Interações
      item.onmouseenter = () => (item.style.background = "rgba(255,255,255,0.08)");
      item.onmouseleave = () => (item.style.background = "rgba(255,255,255,0.03)");

      // Seleção da fonte
      item.onclick = async () => {
        const obj = window.getActiveObject?.();
        if (obj) {
          // Carrega CSS da fonte se ainda não estiver
          if (!document.querySelector(`link[data-font='${f.name}']`)) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.dataset.font = f.name;
            link.href = `https://fonts.googleapis.com/css2?family=${f.name.replace(/ /g, "+")}&display=swap`;
            document.head.appendChild(link);
          }

          // Aplica a fonte ao texto ativo
          window.setTextObjectFont?.(obj.id, f.name);
          window.redrawCanvas?.();
        }
        modal.remove();
      };

      list.appendChild(item);
    });
  }

  renderList();

  // 🔍 Busca em tempo real
  input.addEventListener("input", () => renderList(input.value));

  // 🔸 Fechar modal
  box.querySelector("#close-font-picker").onclick = () => modal.remove();
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };

  modal.appendChild(box);
  document.body.appendChild(modal);
}

console.log("✅ Font Picker v2.1-pro — Google Fonts + preview real carregado");