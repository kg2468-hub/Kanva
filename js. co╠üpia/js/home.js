// Kanva v0.8.1 - Tela inicial (Home)
// Responsável por criar novo projeto e redirecionar ao editor

(function(){
  // Elementos principais
  const cards = document.querySelectorAll('.size-card');
  const w = document.getElementById('w');
  const h = document.getElementById('h');
  const start = document.getElementById('start');

  // Quando o usuário clicar em um card de tamanho rápido
  cards.forEach(card => {
    card.addEventListener('click', () => {
      const width = card.getAttribute('data-w');
      const height = card.getAttribute('data-h');
      goToEditor(width, height);
    });
  });

  // Quando o usuário clicar no botão "Criar projeto"
  start.addEventListener('click', () => {
    const cw = Math.max(1, parseInt(w.value || '1080', 10));
    const ch = Math.max(1, parseInt(h.value || '1080', 10));
    goToEditor(cw, ch);
  });

  // Função auxiliar: redireciona para o editor com parâmetros
  function goToEditor(width, height) {
    location.href = `editor.html?w=${width}&h=${height}`;
  }

  console.log('%cKanva v0.8.1 – Home carregada', 'color:#60a5fa;font-weight:bold;');
})();