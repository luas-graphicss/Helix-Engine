---
title: Seu primeiro jogo em dez minutos
description: Abra a engine, crie um jogo a partir do template Baseplate, coloque uma plataforma, dê a ela um material e ande com o personagem por cima.
order: 1
---

Ao final deste capítulo você terá um jogo com uma plataforma flutuante, um personagem que anda e pula, e saberá se mover no editor. Nada de código ainda: isso fica para [Programando](/helix/docs/pt-br/tutorial/programando).

## 1. Abra a engine

Vá a `/editor`. A **tela inicial** aparece com os templates no alto e os seus jogos abaixo (vazia, por enquanto). Se o navegador bloquear o armazenamento, a tela avisa; veja [Requisitos](/helix/docs/pt-br/visao-geral/requisitos) se isso acontecer.

![A tela inicial com a seção de templates destacada.](/docs/figures/tela-inicial/templates.webp "Os templates ficam no alto da tela inicial; o Baseplate é o primeiro.")

## 2. Crie um jogo com o template Baseplate

Clique em **Criar jogo** no cartão **Baseplate**. O editor abre com uma plataforma, alguns objetos de referência e um manequim na escala de uma pessoa. O jogo já está guardado no navegador com um nome provisório; renomeie agora por **Helix ▸ Renomear** se quiser (algo como "Meu primeiro jogo").

![O editor recém-aberto com o template Baseplate.](/docs/figures/editor/visao-geral.webp "O editor com o Baseplate: a plataforma quadriculada, a escadaria, as rampas, os blocos e o manequim no centro.")

Olhe a janela:

- no centro, o **viewport** com a cena;
- à esquerda, a **Hierarquia**, com os atores do template;
- à direita, o **Inspetor**, vazio porque nada está selecionado;
- embaixo, os **Ativos** e o **Console**.

## 3. Aprenda a mover a câmera

Com o cursor sobre o viewport:

| Faça | Acontece |
| --- | --- |
| Arraste com o botão direito | A câmera orbita ao redor do ponto de interesse. |
| Arraste com o botão do meio (ou `Shift` + esquerdo) | A câmera desloca. |
| Role a roda | Aproxima e afasta. |
| Clique no manequim e pressione `F` | A câmera enquadra o manequim. |

Passe um minuto nisso. Clique em alguns atores da Hierarquia e pressione `F` a cada um; repare que o Inspetor muda para mostrar o ator selecionado.

## 4. Coloque uma plataforma

![Detalhe da barra de ferramentas com o botão Adicionar destacado.](/docs/figures/toolbar/adicionar.webp "O botão Adicionar, na barra de ferramentas, cria o mesmo que o menu de contexto da Hierarquia.")

![As oito formas geométricas da engine enfileiradas sobre a grade.](/docs/figures/cena/primitivas.webp "As formas que a engine gera: cubo, cubo arredondado, plano, esfera, cilindro, cone, toro e cápsula. O menu Adicionar oferece todas menos o cubo arredondado, que fica em helix.mesh.roundedBox().")

1. Clique com o botão direito num espaço vazio da Hierarquia e escolha **Adicionar ▸ Primitiva ▸ Caixa** (ou use o botão **Adicionar** da barra de ferramentas). Uma caixa de 1 m aparece na origem, selecionada.
2. No Inspetor, em **Transformação**, digite a escala `6`, `0.4`, `3` e a posição `0`, `3`, `-6`. A caixa vira uma laje flutuante a três metros do chão, à frente do manequim.
3. Pressione `F2` e renomeie para `Plataforma`.

Agora com o gizmo: pressione `W` (Mover). Arraste a seta verde para cima e para baixo e veja a posição Y mudar no Inspetor. Arraste de volta para 3, ou digite o valor.

![O gizmo de mover sobre um cubo, com as setas dos três eixos.](/docs/figures/viewport/gizmo-mover.webp "O gizmo de mover: a seta verde é o eixo Y, para cima.")

> [!TIP]
> Segure `Ctrl` durante o arrasto para encaixar na grade em passos de 0,5 m. `Ctrl+Z` desfaz qualquer coisa.

## 5. Dê um material à plataforma

1. Com a Plataforma selecionada, no Inspetor, abra a seção **Material**.
2. Clique na amostra de **Cor base** e escolha um laranja. Ajuste **Rugosidade** para 0,6 e deixe **Metálico** em 0.
3. Pressione `M` para abrir o **editor de materiais**: a mesma superfície, numa esfera de pré-visualização, com todos os canais. Feche-o por enquanto.

![Detalhe da barra de ferramentas com o botão Materiais destacado.](/docs/figures/toolbar/materiais.webp "O botão Materiais, na barra de ferramentas, abre o mesmo editor que a tecla M.")

A plataforma agora é laranja e fosca. Materiais são do ator; para reaproveitar o mesmo material em vários atores, salve-o na biblioteca pelo botão **Salvar como ativo** na seção Material.

## 6. Simule e ande

![Detalhe da barra de ferramentas com os botões de simulação destacados.](/docs/figures/toolbar/simular.webp "Os botões Simular, Avançar um passo e Parar e restaurar, na barra de ferramentas.")

1. Confira que **Simular ▸ Personagem do jogador ao simular** está marcado (o template Baseplate já marca).
2. Pressione `Ctrl+P`. O viewport ganha uma moldura, o personagem aparece no `PlayerStart` e a câmera do jogo assume.
3. Ande com `W`, `A`, `S`, `D`, olhe com o mouse, pule com `Espaço`, corra com `Shift`.
4. Vá até a plataforma e pule nela. Ela é sólida porque toda primitiva nasce com um colisor estático.
5. Pressione `Esc` para devolver o mouse ao editor e `Ctrl+Shift+P` para **parar e restaurar**.

Repare que, ao parar, tudo voltou ao estado de antes: o personagem sumiu e a cena está como você a deixou. A simulação nunca grava nada.

## 7. Salve? Não precisa

O jogo já está salvo. Cada alteração foi gravada no armazenamento do navegador 1,5 s depois de você parar de editar (o indicador na barra de estado mostra). Feche a aba, abra `/editor` de novo e o jogo estará lá, com a miniatura do último quadro.

Se quiser um arquivo, **Helix ▸ Baixar cópia do jogo** (`Ctrl+Shift+S`) gera o `.helix`.

## O que você aprendeu

- A tela inicial e os templates.
- Orbitar, deslocar, aproximar e enquadrar com a câmera do editor.
- Criar uma primitiva, movê-la com o gizmo e com o Inspetor, renomear.
- Editar o material de um ator.
- Simular com o personagem e parar e restaurar.
- Que a gravação é automática.

No [próximo capítulo](/helix/docs/pt-br/tutorial/primeiros-passos/explorando-o-editor), você vai conhecer os painéis que ficaram fechados e organizar a cena.
