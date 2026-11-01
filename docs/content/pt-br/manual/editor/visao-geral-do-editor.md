---
title: A janela do editor
description: A barra de menus, as áreas de trabalho, o viewport e os painéis: como o editor está organizado e onde cada coisa fica.
order: 1
---

Com um jogo aberto, a janela se divide em regiões fixas: a **barra de menus** no topo, a **barra de ferramentas** logo abaixo, o **viewport** no centro, os **painéis** nas laterais e na base, e a **barra de comando** e a **barra de estado** no rodapé. O que muda entre uma área de trabalho e outra é o conteúdo do centro e os painéis que fazem sentido para ele.

![A janela do editor com o template Baseplate aberto: Hierarquia à esquerda, viewport ao centro, Inspetor à direita, Ativos na base.](/docs/figures/editor/visao-geral.webp "O editor na área de trabalho Cena, com o template Baseplate recém-criado.")

## A barra de menus

![A barra de menus destacada no topo da janela do editor.](/docs/figures/editor/barra-de-menus.webp "A barra de menus: o logotipo Helix e os menus Arquivo, Editar, Interface, Código, Simular, Exibir e Ajuda. À direita, o nome do jogo e da cena.")

| Menu | O que reúne |
| --- | --- |
| **Helix** (o logotipo) | O jogo como um todo: novo, abrir recente, renomear, baixar cópia, compilar, salvamentos automáticos, atalhos, configuração, funcionalidades beta e sobre. |
| **Arquivo** | Importar ativos, exportar a seleção, a biblioteca e as pastas. |
| **Editar** | Desfazer, refazer, duplicar, copiar, colar, agrupar, renomear, excluir. O conteúdo muda conforme a área de trabalho. |
| **Interface** | Abrir o designer de telas, criar uma tela nova, alternar entre Design e Testar. |
| **Código** | Abrir o editor de código, novo script, executar, compilar, barra de comando. |
| **Simular** | Simular física, avançar um passo, parar e restaurar, e se o personagem do jogador entra na simulação. |
| **Exibir** | Grade, sombras, céu físico, enquadrar seleção, editor de materiais, os painéis e a escala da interface. |
| **Ajuda** | Documentação (`F1`), tutoriais (`Shift+F1`), fórum e atalhos de teclado. |

Todo item com atalho mostra a combinação à direita; a combinação exibida respeita o que você personalizou em **Helix ▸ Personalizar atalhos**.

## A barra de ferramentas

![A barra de ferramentas destacada, entre a barra de menus e o viewport.](/docs/figures/editor/barra-de-ferramentas.webp "A barra de ferramentas atravessa a janela inteira, logo abaixo dos menus.")

Da esquerda para a direita, ela reúne:

| Grupo | O que faz |
| --- | --- |
| Desfazer e refazer | As duas setas, equivalentes a `Ctrl+Z` e `Ctrl+Y`. |
| **Cena**, **Interface** e **Código** | As abas das áreas de trabalho. |
| **Adicionar** | Cria um ator novo: primitivas, luzes, câmera, grupo, terreno, efeito, fonte de som. |
| Ferramentas de transformação | Selecionar, Mover, Rotacionar e Escalar, o espaço de transformação (local ou mundial), o encaixe e os seus passos (`0.5u · 15°`). |
| **Materiais** | Abre o editor de materiais (`M`). |
| Simulação | Simular, avançar um passo e parar e restaurar. |
| Painéis e arranjo | O modo debug (o jogo de teste da API), os botões que abrem e fecham cada painel e o que maximiza o viewport (`Ctrl+Shift+Espaço`). |

![Detalhe da barra de ferramentas com as ferramentas de transformação destacadas.](/docs/figures/toolbar/transformar.webp "As ferramentas de transformação, o espaço local/mundial, o encaixe e os passos de encaixe.")

## As áreas de trabalho

![Detalhe da barra de ferramentas com as abas Cena, Interface e Código destacadas.](/docs/figures/toolbar/espacos-de-trabalho.webp "As três áreas de trabalho ficam na barra de ferramentas; a ativa aparece em relevo.")

| Área | Centro da janela | Painéis típicos |
| --- | --- | --- |
| **Cena** | O viewport 3D com a barra de ferramentas. | Hierarquia, Inspetor, Ativos, Luzes, Terreno, Física, Ambiente, Pós-processamento, Personagem, Console. |
| **Interface** | A prancheta do designer de telas, com o aparelho emulado. | Camadas (a hierarquia da tela), Inspetor, a paleta Interface, Ativos. |
| **Código** | O editor de texto com abas e a barra de comando. | Scripts, Console, Ativos. |

Alterne pelo menu **Interface**, pelo menu **Código** (`Ctrl+Alt+C`) ou pelas abas na barra de ferramentas. A cena continua viva nas três: um script executado na área Código afeta o viewport na hora.

## O viewport

![O viewport destacado no centro da janela do editor.](/docs/figures/editor/viewport.webp "O viewport ocupa o centro; os painéis ao redor podem ser fechados para dar-lhe a janela inteira.")

O viewport desenha a cena com a câmera do editor, que é independente da câmera do jogo. Na sua borda superior ficam o menu de **modo de exibição** (Iluminado, Sem iluminação, Arame…) e, à direita, os botões de grade (`G`), sombras, céu físico, enquadrar a seleção (`F`) e maximizar o viewport. No canto inferior direito, o gizmo de eixos mostra a orientação e permite saltar para as vistas ortogonais. Os detalhes estão em [Viewport e navegação](/helix/docs/pt-br/editor/viewport).

## Os painéis

![A Hierarquia destacada na zona esquerda da janela do editor.](/docs/figures/editor/hierarquia.webp "A zona esquerda, com a Hierarquia: a árvore de atores da cena.")

![O Inspetor destacado na zona direita da janela do editor.](/docs/figures/editor/inspetor.webp "A zona direita, com o Inspetor. Sem seleção ele fica vazio; selecione um ator para ver as propriedades.")

![Os painéis Ativos e Console destacados na base da janela do editor.](/docs/figures/editor/ativos-e-console.webp "A zona da base, com as abas Ativos e Console.")

Cada painel é uma aba que pode ser aberta, fechada e movida entre as três zonas (esquerda, direita e base). O menu **Exibir ▸ Painéis** lista todos com os seus atalhos; `Ctrl+Shift+Espaço` esconde todos e maximiza o viewport. O arranjo é guardado por área de trabalho e restaurado na próxima abertura do jogo. A lista completa está em [Painéis](/helix/docs/pt-br/editor/paineis).

![Detalhe da barra de ferramentas com os botões de painéis e arranjo destacados.](/docs/figures/toolbar/paineis-e-layout.webp "No canto direito da barra de ferramentas, cada botão mostra ou esconde um painel.")

## A barra de comando e a barra de estado

![A barra de comando e a barra de estado destacadas no rodapé do editor.](/docs/figures/editor/comandos-e-status.webp "O rodapé: a barra de comando (com o prompt e os comandos help, scripts, lang e clear) e, abaixo dela, a barra de estado.")

Acima do rodapé fica a **barra de comando** (`Ctrl+K` leva o foco; `Ctrl+Shift+K` mostra e oculta), que executa uma linha na linguagem base do jogo; veja [Painéis ▸ Barra de comando](/helix/docs/pt-br/editor/paineis).

Na **barra de estado**, da esquerda para a direita: a última mensagem do editor, o estado da gravação automática (alterações pendentes, gravando, gravado), o relógio, os quadros por segundo e as notificações. O número de atores da cena e de selecionados aparece no rodapé da Hierarquia. `F3` abre o HUD de orçamento do frame por cima do viewport, com o detalhamento por etapa.

## Escala da interface

**Exibir ▸ Escala da interface** aumenta ou reduz todo o editor em passos de 10 %, útil em monitores de alta densidade ou para apresentar. A escala é uma preferência da engine, não do jogo.

> [!TIP]
> Perdeu um painel ou desarrumou tudo? **Exibir ▸ Painéis ▸ Restaurar o arranjo padrão** volta à disposição original da área de trabalho atual sem tocar nas outras.
