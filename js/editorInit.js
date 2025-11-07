// Inicializador principal do Editor - Kanva v0.8.1
window.addEventListener('DOMContentLoaded', () => {
  try {
    // Inicializa o Canvas (área de edição principal)
    if (typeof initCanvas === 'function') {
      initCanvas();
      console.log('[Kanva] Canvas inicializado');
    } else {
      console.warn('[Kanva] initCanvas() não encontrado.');
    }

    // Inicializa a Toolbar (barra de ferramentas inferior)
    if (typeof initToolbar === 'function') {
      initToolbar();
      console.log('[Kanva] Toolbar inicializada');
    } else {
      console.warn('[Kanva] initToolbar() não encontrado.');
    }

    // Inicializa o Painel de Camadas (lateral direita)
    if (typeof initLayersPanel === 'function') {
      initLayersPanel();
      console.log('[Kanva] Painel de camadas inicializado');
    } else {
      console.warn('[Kanva] initLayersPanel() não encontrado.');
    }

    console.log('%cKanva v0.8.1 pronto!', 'color:#60a5fa;font-weight:bold;');
  } catch (err) {
    console.error('[Kanva] Erro ao inicializar o editor:', err);
  }
});