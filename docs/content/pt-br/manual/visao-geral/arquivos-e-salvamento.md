---
title: Arquivos e salvamento
description: Como a engine grava o jogo enquanto você edita, o que é o arquivo .helix, os salvamentos automáticos restauráveis e o que acompanha o jogo quando ele sai do navegador.
order: 5
---

Não existe um botão "salvar o jogo" na engine. A cena é gravada automaticamente no armazenamento do navegador a cada pausa na edição; os documentos abertos em editores próprios (telas, efeitos, animações, scripts) são salvos com `Ctrl+S` na biblioteca. Este artigo explica os dois mecanismos e os arquivos que saem da engine.

## Recuperação automática

Cada comando no editor (mover um ator, trocar um material, pintar uma camada) muda a cena em memória e marca o jogo como alterado. A engine espera uma pausa e grava:

| Configuração | Padrão | O que faz |
| --- | --- | --- |
| Recuperação automática | ligada | Grava a cena no banco do jogo depois de cada pausa na edição. Desligada, só sair do jogo grava. |
| Pausa antes de gravar | 1,5 s | Tempo sem edições que a engine espera. Arrastar um objeto gera dezenas de comandos e uma só gravação. |
| Espera máxima em edição contínua | 20 s | Mesmo sem pausa, uma gravação acontece ao menos a cada tanto tempo. |

Essas opções ficam em **Helix ▸ Configuração ▸ Projeto**. O indicador na barra de título mostra quando há alterações aguardando gravação e quando a última gravação terminou.

> [!TIP]
> Fechar a aba no meio de uma edição é seguro: o navegador conclui a gravação pendente antes de descarregar a página, e a engine registra um salvamento de emergência se isso falhar.

## Salvamentos automáticos restauráveis

Além da gravação corrente, a engine guarda **instantâneos** periódicos da cena, para voltar no tempo depois de um erro que o desfazer já não alcança:

- um instantâneo novo é tirado quando a versão gravada tem ao menos o **intervalo entre instantâneos** (padrão: 10 minutos);
- a engine mantém até **N instantâneos por jogo** (padrão: 12); além disso os mais antigos saem;
- a lista fica em **Helix ▸ Salvamentos automáticos** (`Ctrl+Alt+H`) e no menu **Histórico** do cartão do jogo na tela inicial.

Restaurar um instantâneo substitui a cena atual, mas antes grava a cena atual como um instantâneo novo: não há como perder o estado de onde você veio.

## Desfazer e refazer

`Ctrl+Z` e `Ctrl+Shift+Z` (ou `Ctrl+Y`) percorrem o histórico de comandos da sessão. O histórico é da aba: ele não sobrevive a recarregar a página, e é separado por área de trabalho (a cena, cada tela de interface e cada documento têm o seu).

## Documentos salvos com Ctrl+S

Telas de interface, efeitos, animações, clipes de áudio e scripts são editados em documentos próprios. Eles são **rascunhos** até você salvar na biblioteca com `Ctrl+S` (ou **Salvar todos os scripts**, `Ctrl+Alt+S`, no Código). A aba do documento mostra um ponto enquanto há alterações não salvas, e fechar a aba com alterações pergunta o que fazer.

A cena referencia a versão salva do documento. Um script com alterações não salvas continua rodando com a versão anterior até você salvar; com a simulação ligada, salvar aciona `onHotReload`.

## O arquivo .helix

**Helix ▸ Baixar cópia do jogo** (`Ctrl+Shift+S`) gera um único arquivo `.helix` com tudo o que o jogo precisa:

- a cena (atores, componentes, céu, física, jogador e configurações do jogo);
- a biblioteca completa: ativos importados, scripts, telas, efeitos, animações, prefabs;
- os metadados: nome, identificador, versão da engine que gravou e a miniatura.

O arquivo é autocontido. Abri-lo em outro navegador recria o jogo inteiro. A engine lê arquivos de versões anteriores e os migra ao abrir; arquivos de versões mais novas que a engine instalada são recusados com um aviso em vez de abertos pela metade.

> [!WARNING]
> O `.helix` é um formato da engine, não um formato de intercâmbio. Para levar um modelo para outra ferramenta, exporte a malha pelo menu de contexto do ator; para levar o jogo para quem joga, use **Compilar jogo para computador**.

## O que acompanha o jogo compilado

O executável gerado em **Helix ▸ Compilar** leva a mesma cena e a mesma biblioteca do `.helix`, mais o runtime. Scripts são compilados para a forma que o runtime executa; ativos são empacotados tal como estão. Veja [Compilar e distribuir](/helix/docs/pt-br/distribuicao) para o processo completo.

## Saves do jogador

Os dados que o **jogo** grava enquanto alguém joga (progresso, opções, pontuação) não são a cena. A API `helix.save` guarda esses dados por jogo, em um espaço separado da biblioteca: no navegador, no IndexedDB do jogo; no executável, numa pasta do usuário. Eles sobrevivem a recompilar o jogo e não entram no `.helix`.
