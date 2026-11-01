---
title: Simular e testar
description: Ligar a física e os scripts dentro do editor, avançar passo a passo, controlar a velocidade do tempo e voltar a cena ao estado de antes.
order: 5
---

Simular é rodar o jogo dentro do editor, com a cena que está na tela. A física integra, os scripts executam o ciclo de vida, o personagem do jogador anda, as telas de interface respondem. Quando você para, tudo volta exatamente ao que era.

## Os três estados

| Estado | Como chegar | O que acontece |
| --- | --- | --- |
| **Parado** | padrão; `Ctrl+Shift+P` a partir dos outros | A cena está em edição. Nenhum script roda; a física está congelada. |
| **Simulando** | `Ctrl+P` ou **Simular ▸ Simular física** | A física integra com passo fixo; `onUpdate`, `onFixedUpdate` e os demais ganchos rodam; o tempo (`helix.time`) anda. |
| **Pausado** | `Ctrl+P` durante a simulação | Tudo congelado no estado atual, mas ainda em simulação: dá para inspecionar valores, mover a câmera do editor e avançar um passo. |

![Detalhe da barra de ferramentas com os botões de simulação destacados.](/docs/figures/toolbar/simular.webp "Os botões de simulação na barra de ferramentas: Simular, Avançar um passo e Parar e restaurar.")

A barra de ferramentas mostra os botões correspondentes; o viewport ganha uma moldura colorida enquanto a simulação está ligada, para que não haja dúvida sobre o estado.

## Avançar um passo

**Simular ▸ Avançar um passo** integra exatamente um passo fixo de física e um frame de scripts, e volta a pausar. É a forma de ver um contato acontecer quadro a quadro ou de acompanhar o valor de uma variável no Console sem que ele role para longe.

## Parar e restaurar

`Ctrl+Shift+P` encerra a simulação e **restaura a cena** ao estado de quando ela começou: posições, componentes, atores criados e destruídos por scripts, tudo. É uma garantia da engine, não um "desfazer": nada do que aconteceu na simulação entra no histórico nem na gravação automática.

> [!IMPORTANT]
> Alterações feitas **no inspetor durante a simulação** também são descartadas ao parar. Para experimentar um valor e mantê-lo, anote-o (ou copie os valores do componente pelo menu dele) e aplique depois de parar.

## O personagem do jogador

**Simular ▸ Personagem do jogador ao simular** decide se o personagem jogável entra na simulação. Ligado, ele aparece no ponto de partida (o ator `PlayerStart`, ou a origem se não houver um), a câmera do jogo assume o viewport e o teclado controla o personagem (`WASD`, `Espaço` para pular, `Shift` para correr). Desligado, a câmera do editor permanece e você observa a cena de fora: é o modo para testar física, partículas e scripts que não dependem do jogador.

Durante a simulação com o personagem, `Esc` devolve o controle do mouse ao editor sem parar a simulação.

## Velocidade do tempo

O controle de **escala de tempo** na barra de ferramentas (ou `helix.time.scale` na API) acelera ou desacelera a simulação: 0,25× para estudar um salto, 4× para esperar um ciclo longo. `onFixedUpdate` continua recebendo o passo fixo nominal e roda mais ou menos vezes por frame; `onUpdate` recebe `dt` já escalado.

## Scripts durante a simulação

- O ciclo de vida completo roda: `onLoad` na compilação, `onStart` no primeiro frame, `onUpdate` e `onFixedUpdate` a cada frame e passo, `onStop` ao parar.
- Salvar um script com a simulação ligada **recarrega a quente**: a engine chama `onBeforeHotReload` no script antigo, troca o código e entrega o estado devolvido a `onHotReload` no novo. Variáveis não preservadas ali voltam ao valor inicial.
- Erros aparecem no Console com arquivo e linha, e o script que falhou é desativado até o próximo salvamento; o resto continua.
- A **barra de comando** executa linhas dentro da simulação, com acesso a tudo: `helix.scene.find("Bola").rigidBody:applyImpulse({x=0,y=5,z=0})`.

## O que a simulação não é

A simulação roda a cena do editor com o runtime da engine, mas em alguns pontos difere do jogo compilado:

| No editor | No jogo compilado |
| --- | --- |
| A câmera do editor existe e pode assumir o viewport. | Só as câmeras da cena. |
| `helix.isEditor` é `true`. | `false`. |
| Os painéis continuam ativos e consomem tempo de CPU. | Só o jogo. |
| Scripts de ferramenta (`helix.editor`) estão disponíveis. | Não existem. |
| A resolução é a do viewport, com o governador de qualidade do editor. | A da janela, com as opções gráficas do jogador. |

Para testar o jogo como quem joga, use **Helix ▸ Compilar jogo para computador** com o perfil **Desenvolvimento**, que mantém o Console e o HUD acessíveis.

## Multiplayer no editor

Com o multiplayer ligado em **Configuração do jogo ▸ Rede**, a simulação sobe um servidor local e um cliente na mesma aba; o seletor de contexto na barra de ferramentas alterna o inspetor e o Console entre os dois lados. Veja [Multiplayer](/helix/docs/pt-br/scripting/multiplayer).
