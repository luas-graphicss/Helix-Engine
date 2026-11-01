---
title: Salvar, recuperar e compartilhar
description: Entenda a gravação automática, volte a um salvamento anterior, baixe o jogo como arquivo, importe-o em outro navegador e faça backup de tudo.
order: 3
---

Este capítulo é curto e vale ouro: é o que garante que você nunca perca um jogo. Continue no jogo dos capítulos anteriores.

## 1. Veja a gravação acontecer

Mova uma plataforma e olhe a barra de estado, no rodapé: o indicador passa a **alterações pendentes**, depois **gravando**, depois **gravado**, em cerca de dois segundos. Isso é a **recuperação automática**: a cena é gravada no armazenamento do navegador a cada pausa de 1,5 s na edição (e ao menos a cada 20 s em edição contínua).

Não há botão de salvar a cena porque ela já está salva. O que tem `Ctrl+S` são os **documentos** abertos em editores próprios: scripts, telas de interface, efeitos, animações.

## 2. Volte no tempo

Abra **Helix ▸ Salvamentos automáticos** (`Ctrl+Alt+H`). A lista mostra os **instantâneos** do jogo: versões completas da cena tiradas a cada 10 minutos de edição (até 12 por jogo, por padrão). Como você acabou de começar, há um ou dois.

1. Mova algumas plataformas para lugares absurdos.
2. Em Salvamentos automáticos, escolha o instantâneo mais recente e clique em **Restaurar**.
3. A cena volta. E a versão que você acabou de abandonar virou um instantâneo novo, no topo da lista: restaurar nunca perde nada.

Para o dia a dia, `Ctrl+Z` basta. Os instantâneos são para quando você percebe o erro meia hora depois.

## 3. Baixe o jogo

**Helix ▸ Baixar cópia do jogo** (`Ctrl+Shift+S`). O navegador baixa um arquivo `.helix` com a cena, todos os ativos, os scripts e a miniatura. É o seu jogo inteiro num arquivo.

Faça isso sempre que terminar uma sessão importante. O armazenamento do navegador é confiável, mas é do navegador: limpar os dados do site, trocar de perfil ou de máquina deixa a tela inicial vazia.

## 4. Importe em outro lugar

Abra uma janela anônima (ou outro navegador) em `/editor`. A tela inicial está vazia. Clique em **Importar jogo ou backup…**, escolha o `.helix` que baixou, e o jogo aparece em **Meus jogos**, idêntico. Arrastar o arquivo para a tela tem o mesmo efeito.

![A tela inicial com o botão Importar jogo ou backup destacado.](/docs/figures/tela-inicial/importar.webp "Importar jogo ou backup… aceita um .helix ou um arquivo de backup.")

> [!WARNING]
> A janela anônima descarta tudo ao fechar. Ela é boa para testar a importação, não para trabalhar.

## 5. Faça backup de tudo

Quando tiver mais de um jogo, **Backup de todos os jogos**, na barra lateral da tela inicial, gera um único arquivo com todos eles. **Importar jogo ou backup…** aceita esse arquivo e restaura todos, perguntando o que fazer com os que já existem.

![A tela inicial com o botão Backup de todos os jogos destacado.](/docs/figures/tela-inicial/backup.webp "Backup de todos os jogos, no rodapé da barra lateral.")

## 6. Exclua e recupere

Na tela inicial, abra o menu do cartão de um jogo e escolha **Excluir**. O jogo vai para a **Lixeira**, na barra lateral, de onde pode ser **restaurado** ou **apagado de vez**. Nada é apagado de verdade sem passar por lá.

![A seção Lixeira da tela inicial.](/docs/figures/tela-inicial/lixeira.webp "A Lixeira: os jogos excluídos ficam aqui até serem restaurados ou apagados de vez.")

## 7. Guarde a configuração

Os atalhos personalizados, o arranjo de painéis e as preferências da engine não vivem no jogo: vivem na engine, no navegador. **Helix ▸ Configuração ▸ Exportar** gera um arquivo com tudo isso, e **Importar** o traz de volta em outra máquina.

## O que você aprendeu

- A cena é gravada automaticamente; documentos são salvos com `Ctrl+S`.
- Instantâneos são versões completas, restauráveis sem perda.
- O `.helix` é o jogo inteiro num arquivo; o backup é todos os jogos num arquivo.
- A lixeira segura o que você exclui.
- A configuração da engine é exportável à parte.

Você terminou **Primeiros passos**. Em [Construindo o mundo](/helix/docs/pt-br/tutorial/construindo-o-mundo), o jogo ganha um nível de verdade: primitivas, CSG, materiais, um terreno esculpido e um ponto de partida bem colocado.
