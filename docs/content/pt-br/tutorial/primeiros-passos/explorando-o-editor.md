---
title: Explorando o editor
description: Organize a cena em grupos, use os painéis de Luzes e Ambiente para mudar a hora do dia, aprenda os atalhos que valem a pena decorar e personalize o arranjo.
order: 2
---

Continue no jogo do [capítulo anterior](/helix/docs/pt-br/tutorial/primeiros-passos/primeiro-jogo). Agora que a câmera obedece, vamos conhecer o resto da janela.

## 1. Organize a Hierarquia

O template Baseplate já agrupa os seus atores (`Mundo`, `Iluminação`, `CameraPrincipal`). Vamos colocar a sua plataforma no lugar certo:

![O painel Hierarquia com a árvore de atores do Baseplate destacada.](/docs/figures/hierarquia/arvore.webp "A Hierarquia do Baseplate: Iluminação, CameraPrincipal e a pasta Mundo com as referências.")

1. Arraste `Plataforma` para cima de `Mundo` na Hierarquia. Ela vira filha do grupo e nada se move no viewport: a engine preserva a transformação mundial ao trocar de pai.
2. Selecione `Plataforma`, pressione `Ctrl+D` para duplicar e mova a cópia com o gizmo (`W`) para `0`, `5`, `-12`. Faça mais uma em `0`, `7`, `-18`. Uma escada de plataformas.
3. Selecione as três (clique na primeira, `Shift` + clique na última) e pressione `Ctrl+G`. Renomeie o grupo para `Plataformas` com `F2`.

Agora experimente, com o grupo selecionado: `H` oculta tudo; `H` de novo mostra. `Shift+H` isola (esconde todo o resto); `Alt+H` desfaz. `L` bloqueia: tente clicar numa plataforma no viewport e veja que o clique passa por ela; `Alt+L` desbloqueia.

## 2. Mude a hora do dia

Abra o painel **Ambiente** (menu **Exibir ▸ Painéis ▸ Ambiente**). Ele controla o céu, que no template é um **céu físico** com sol e atmosfera:

1. Arraste **Hora** de 12 h para 18 h. O sol baixa, a luz fica alaranjada, as sombras se alongam. O céu alimenta a luz ambiente, então a cena inteira muda de clima.
2. Ligue **Nuvens** e ajuste a **Cobertura**.
3. Em **Névoa**, suba a **Densidade** devagar até as plataformas mais distantes ficarem levemente esmaecidas.

Pressione `G` para esconder a grade e ver melhor. Tudo isso é a cena: fica gravado e vai para o jogo.

## 3. Ajuste uma luz

Abra **Luzes** (`Ctrl+Shift+L`). O painel lista todas as luzes da cena numa tabela, com intensidade, cor e sombras editáveis sem precisar selecionar cada uma:

1. Encontre `LuzDirecional` (o sol) e reduza a intensidade para 2. Como o céu físico já ilumina, o sol direto é só a parte dura.
2. Clique duas vezes na linha para selecioná-la e enquadrá-la (`F`). No viewport, a luz direcional é um ícone com uma seta; rotacione com `E` e veja as sombras acompanharem.

Para acrescentar uma luz pontual: botão direito em `Iluminação` na Hierarquia ▸ **Adicionar ▸ Luz ▸ Pontual**. Posicione-a sob a primeira plataforma, dê a ela uma cor quente e um alcance de 6 m.

## 4. Ajuste o arranjo dos painéis

![Detalhe da barra de ferramentas com os botões de painéis destacados.](/docs/figures/toolbar/paineis-e-layout.webp "Cada botão do canto direito da barra de ferramentas abre ou fecha um painel.")

- Arraste a aba **Luzes** para a zona da base, ao lado de **Ativos**. Arraste a borda entre o viewport e a base para dar mais espaço a um ou outro.
- Pressione `Ctrl+Shift+Espaço`: todos os painéis somem e o viewport ocupa a janela. De novo, e voltam.
- **Exibir ▸ Painéis ▸ Restaurar o arranjo padrão** desfaz qualquer bagunça.

O arranjo é guardado por jogo e por área de trabalho.

## 5. Os atalhos que valem decorar

Você já usou vários. Estes são os que pagam o esforço de decorar na primeira semana:

| Atalho | Ação |
| --- | --- |
| `Q` `W` `E` `R` | Selecionar, Mover, Rotacionar, Escalar |
| `F` | Enquadrar a seleção |
| `Ctrl+D` | Duplicar |
| `Ctrl+G` | Agrupar |
| `H`, `Shift+H`, `Alt+H` | Ocultar, isolar, mostrar todos |
| `G` | Grade |
| `Ctrl+P`, `Ctrl+Shift+P` | Simular, parar e restaurar |
| `Ctrl+Alt+C` | Editor de código |
| `F1` | Esta documentação |

A lista completa está em [Atalhos de teclado](/helix/docs/pt-br/editor/atalhos). Se algum não lhe cai bem, **Helix ▸ Personalizar atalhos** (`Ctrl+Alt+K`) troca.

## 6. Veja o custo do frame

Pressione `F3`. O HUD de orçamento aparece sobre o viewport: tempo de CPU por faixa, de GPU por etapa e o nível de qualidade em vigor. Ligue e desligue **Exibir ▸ Sombras** e veja a etapa "sombras" sumir do orçamento. É o reflexo de olhar aqui sempre que o jogo ficar lento. `F3` de novo esconde.

## 7. Simule de novo

`Ctrl+P` e suba a escada de plataformas pulando. Agora é noite de fim de tarde e há uma luz quente sob a primeira plataforma. `Ctrl+Shift+P` para voltar.

## O que você aprendeu

- Reorganizar a hierarquia preservando posições; duplicar, agrupar, ocultar, isolar e bloquear.
- O painel Ambiente: hora, nuvens, névoa.
- O painel Luzes e a luz pontual.
- Mover painéis, maximizar o viewport e restaurar o arranjo.
- Os atalhos essenciais e o HUD de orçamento.

No [próximo capítulo](/helix/docs/pt-br/tutorial/primeiros-passos/salvar-e-compartilhar), você vai aprender a guardar, baixar, importar e recuperar jogos, e a não perder trabalho nunca.
