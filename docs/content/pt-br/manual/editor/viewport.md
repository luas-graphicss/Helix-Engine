---
title: Viewport e navegação
description: Mover a câmera do editor, selecionar atores, usar os gizmos de transformação, o encaixe, a grade e os modos de exibição.
order: 2
---

O viewport é a janela para a cena. A câmera que você controla aqui é a **câmera do editor**: ela não existe no jogo e não é a câmera principal da cena, que é um ator como outro qualquer.

## Mover a câmera

| Ação | Mouse | Alternativa |
| --- | --- | --- |
| Orbitar ao redor do ponto de interesse | Arrastar com o botão esquerdo (sobre o vazio) ou com o direito | — |
| Deslocar (pan) | Arrastar com o botão do meio | `Shift` + arrastar com o esquerdo |
| Aproximar e afastar | Roda do mouse | — |
| Enquadrar a seleção | — | `F` ou duplo clique no ator |
| Voltar à vista inicial | Clique no centro do gizmo de eixos | — |
| Vistas ortogonais (frente, topo, lado) | Clique nos eixos do gizmo de eixos | — |

![Detalhe do canto inferior direito do viewport com o gizmo de eixos destacado.](/docs/figures/viewport/gizmo-de-orientacao.webp "O gizmo de eixos: X em vermelho, Y em verde, Z em azul. Clique num eixo para a vista ortogonal; no centro, para voltar à vista inicial.")

A velocidade de órbita, de deslocamento e de zoom, a inversão dos eixos e o campo de visão da câmera do editor ficam em **Helix ▸ Configuração ▸ Editor ▸ Câmera**.

> [!TIP]
> O zoom é relativo à distância do ponto de interesse: enquadre o que você quer editar com `F` antes de aproximar, e a roda passa a andar em passos adequados àquele tamanho.

## Selecionar

- **Clique** seleciona o ator sob o cursor. `Ctrl` + clique adiciona ou remove da seleção; `Shift` + clique seleciona um intervalo na hierarquia.
- **Clique no vazio** limpa a seleção; `Esc` também.
- **Clique direito** sobre um ator abre o menu de contexto com as operações daquele tipo de ator (luz, CSG, script, áudio, efeito).
- Atores **bloqueados** (`L`) não respondem ao clique no viewport, mas continuam selecionáveis pela hierarquia. `Alt+L` desbloqueia todos.
- Atores **ocultos** (`H`) saem do viewport e das consultas. `Shift+H` isola a seleção (oculta o resto); `Alt+H` mostra todos.

O ator selecionado por último é o **principal** da seleção: é ele que o inspetor mostra em detalhe e é em relação a ele que as operações booleanas e os alinhamentos agem.

## Ferramentas e gizmos

| Ferramenta | Tecla | O que faz |
| --- | --- | --- |
| Selecionar | `Q` | Só seleciona; sem gizmo. |
| Mover | `W` | Gizmo de setas: arraste um eixo, um plano (os quadrados) ou o centro (livre, no plano da tela). |
| Rotacionar | `E` | Gizmo de anéis: arraste um anel para girar num eixo, ou o anel externo para girar no plano da tela. |
| Escalar | `R` | Gizmo de cubos: um eixo por vez, ou o centro para escala uniforme. |
| Terreno | `T` | Troca o gizmo pelo pincel de terreno; veja [Esculpir](/helix/docs/pt-br/terreno/esculpir). |

![Detalhe da barra de ferramentas com as ferramentas de transformação destacadas.](/docs/figures/toolbar/transformar.webp "Da esquerda para a direita: Selecionar, Mover, Rotacionar, Escalar, os eixos (do ator ou do mundo), o encaixe e os passos de encaixe.")

![O gizmo de mover sobre um cubo: três setas coloridas e os quadrados dos planos.](/docs/figures/viewport/gizmo-mover.webp "Mover (W): arraste uma seta para andar num eixo, um quadrado para andar num plano.")

![O gizmo de rotacionar sobre um cubo: três anéis coloridos.](/docs/figures/viewport/gizmo-rotacionar.webp "Rotacionar (E): cada anel gira o ator em torno de um eixo.")

![O gizmo de escalar sobre um cubo: três hastes terminadas em cubos.](/docs/figures/viewport/gizmo-escalar.webp "Escalar (R): um cubo por eixo; o centro escala uniformemente.")

Com uma ferramenta ativa, os campos numéricos do inspetor continuam editáveis: arrastar horizontalmente sobre um campo altera o valor com precisão, e `Alt` durante o arrasto torna o passo dez vezes menor.

### Espaço de transformação

O botão **Local / Mundo** na barra de ferramentas decide se o gizmo se alinha aos eixos do próprio ator ou aos do mundo. Em local, mover em X desloca o ator na direção para onde ele aponta; em mundo, no X da cena. A preferência padrão ao abrir um jogo fica em **Configuração ▸ Editor ▸ Ao abrir**.

### Encaixe

O botão **Encaixar** liga o encaixe na grade para mover (passos de 0,5 m por padrão), em ângulos para rotacionar (15°) e em frações para escalar (0,1). Manter `Ctrl` pressionado durante o arrasto inverte o estado do encaixe só para aquele movimento. Os passos são configuráveis no mesmo menu.

### Duplicar arrastando

`Ctrl+D` duplica a seleção no lugar. Segurar `Shift` enquanto começa um arrasto com o gizmo de mover duplica e já move a cópia: é a forma rápida de enfileirar postes, pilares e plataformas.

## Grade e auxiliares

![Detalhe do canto superior direito do viewport com os botões de exibição destacados.](/docs/figures/viewport/opcoes-de-exibicao.webp "Os botões do viewport: grade (G), sombras, céu físico, enquadrar a seleção (F) e maximizar o viewport.")

- `G` alterna a **grade** do chão (plano XZ, 1 m entre linhas, destaque a cada 10 m).
- **Exibir ▸ Sombras** e **Exibir ▸ Céu físico** ligam e desligam as duas etapas mais caras do viewport sem alterar a cena: são ajudas para editar em máquinas lentas.
- Luzes, câmeras, fontes de som e zonas aparecem como **ícones** e, quando selecionadas, desenham os seus volumes (cone da spot, alcance da pontual, frustum da câmera).
- O **HUD de orçamento do frame** (`F3`) mostra, por cima do viewport, o tempo de CPU por faixa, o de GPU por etapa, o estado do governador de qualidade e o que está pendente de carregar.

## Modos de exibição

![Detalhe do canto superior esquerdo do viewport com o menu Iluminado destacado.](/docs/figures/viewport/modo-de-visualizacao.webp "O menu de modo de exibição fica no canto superior esquerdo do viewport.")

O menu de modo de exibição, no canto superior esquerdo do viewport, troca como a cena é desenhada sem mudar nada nela:

| Modo | Para quê |
| --- | --- |
| Iluminado | O resultado final, com luzes, sombras, céu e pós-processamento. |
| Sem iluminação | Só a cor base dos materiais; bom para pintar texturas e conferir UVs. |
| Arame | As arestas das malhas; útil para ver a densidade da geometria e o LOD ativo. |
| Normais | As normais como cores; revela faces invertidas e suavização errada. |
| Complexidade | Quantas vezes cada pixel foi desenhado; para caçar transparência cara. |
| Colisão | Os volumes de colisão da física por cima da geometria. |

## Pegar cores no viewport

Qualquer campo de cor do inspetor tem um conta-gotas. Com ele ativo, o cursor vira uma mira e o clique lê a cor do pixel renderizado no viewport, já convertida para o espaço linear do material.

## Soltar arquivos

Arraste arquivos do seu computador para o viewport para importá-los: modelos viram atores na posição onde foram soltos; imagens, sons e vídeos entram na biblioteca. O diálogo de importação aparece antes para confirmar escala, materiais e destino. Veja [Importar ativos](/helix/docs/pt-br/ativos/importar).
