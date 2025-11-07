# Kanva
O Kanva é um editor de design visual multiplataforma criado para funcionar de forma fluida em navegadores desktop e mobile. Ele permite criar projetos gráficos personalizados com suporte a texto, imagens, formas e camadas, em um ambiente leve e intuitivo — inspirado em ferramentas como Canva e Picsart.
Principais recursos:
	•	🎨 Canvas interativo com gestos de toque — suporte total a pan, zoom e rotação com dois dedos.
	•	🅰️ Edição avançada de texto — inclui contorno proporcional em em, ajuste de tamanho, cor, opacidade e fonte com pré-visualização em tempo real via Google Fonts.
	•	🖼️ Manipulação de imagens — arraste, escale e rotacione imagens diretamente no canvas.
	•	🧱 Painel de camadas — gerencie objetos com visibilidade, bloqueio, duplicação e reorder dinâmico.
	•	🧰 Toolbar inteligente — altera automaticamente as ferramentas conforme o tipo de objeto selecionado.
	•	📏 HUD em tempo real — mostra o zoom e a rotação atuais do projeto.
	•	⚙️ Sistema modular e expansível — dividido em arquivos independentes (canvas.js, toolbar.js, layersPanel.js, fontPicker.js, etc.), permitindo fácil manutenção e evolução.

Arquitetura:
A aplicação é composta por:
	•	index.html — tela inicial de seleção de tamanho e criação do projeto.
	•	editor.html — ambiente principal de edição.
	•	JS modularizado — controle separado de canvas, toolbar, camadas, fontes e inicialização.
	•	CSS adaptativo — design escuro moderno com efeito de vidro fosco e compatibilidade móvel.

Objetivo:
Oferecer uma plataforma leve e responsiva para criação de artes visuais diretamente no navegador, com foco em usabilidade mobile e edição em tempo real.