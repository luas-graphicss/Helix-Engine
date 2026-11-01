---
title: O editor de código
description: A área de trabalho Código: o painel Scripts, as abas, os modelos de script, executar e compilar, busca, autocompletar e a barra de comando.
order: 2
---

`Ctrl+Alt+C` abre a área de trabalho **Código** em qualquer lugar do editor. A cena continua viva por trás: o que você executa aqui age nela na hora, e o que a simulação faz aparece no Console abaixo do texto.

## O painel Scripts

À esquerda, o painel **Scripts** (`Ctrl+Shift+Y`) lista os scripts da biblioteca em pastas, com a sigla da linguagem e um indicador de estado: compilado, com erros, não salvo, desativado. Clicar abre numa aba; arrastar um script sobre um ator na Hierarquia o anexa ao ator.

O botão **Novo** (`Alt+N`) cria um script na linguagem base a partir de um modelo:

| Modelo | Para quê | O que vem pronto |
| --- | --- | --- |
| **Em branco** | Qualquer coisa. | Vazio, com o cabeçalho de comentário. |
| **Ator** | Anexar a um ator. | `onStart`, `onUpdate` e um exemplo de propriedade exposta. |
| **Módulo** | Código compartilhado via `require`. | Uma tabela ou classe exportada, sem ganchos de ciclo de vida. |
| **Jogo** | O script de entrada. | `onLoad` com a configuração inicial, `helix.events.on("play.started")`. |
| **Interface** | A lógica de uma tela. | Encontra a tela, liga os eventos dos botões. |
| **Shader** | Um material ou passe personalizado. | O esqueleto do fragmento em GLSL (ou WGSL) com os uniformes padrão. |

Os seis modelos existem em todas as linguagens e compilam sem avisos.

## Abas e salvamento

Cada script abre numa aba. `Ctrl+PageDown` e `Ctrl+PageUp` percorrem as abas; `Alt+W` fecha a atual. Uma aba com alterações mostra um ponto; `Ctrl+S` salva o script na biblioteca e `Ctrl+Alt+S` salva todos.

Salvar **recompila** o script. Se a simulação estiver ligada e o script estiver anexado a um ator vivo, a engine faz a recarga a quente: `onBeforeHotReload` no código antigo, troca, `onHotReload(state)` no novo. Se não estiver, a versão nova só roda na próxima simulação.

## Executar e compilar

| Ação | Atalho | O que faz |
| --- | --- | --- |
| **Executar o script** | `Ctrl+Enter`, `F5` | Salva (se preciso) e executa o script da aba atual uma vez, na cena, como um script solto: sem `helix.self`. Serve para ferramentas e experimentos. |
| **Compilar o projeto** | `Ctrl+Shift+B` | Compila todos os scripts do jogo e lista erros e avisos no Console, sem executar nada. |

Erros de compilação e de execução chegam ao Console com o nome do script e a linha; clicar na mensagem leva ao ponto no texto, e a linha fica marcada na margem até o próximo salvamento.

## O texto

O editor de texto oferece o que se espera de um editor moderno, com as preferências em **Configuração ▸ Código**:

- realce de sintaxe para todas as linguagens da engine, com o mesmo tema desta documentação;
- **autocompletar** da API `helix` a partir do manifesto, com a assinatura e a descrição de cada membro ao passar o mouse;
- indentação automática no padrão da linguagem (espaços ou tabulação, tamanho configurável), fechamento de pares e comentário de linha com `Ctrl+/`;
- dobramento de blocos, mini-mapa opcional, régua de coluna e quebra de linha;
- múltiplos cursores (`Ctrl` + clique, `Ctrl+Alt+↑/↓`) e seleção da próxima ocorrência (`Ctrl+D` dentro do texto);
- **buscar** (`Ctrl+F`) e **buscar e substituir** (`Ctrl+H`), com expressões regulares e diferenciação de maiúsculas.

Dentro do campo de texto, as teclas pertencem ao editor de texto; fora dele (com o foco no painel Scripts ou nas abas) valem os atalhos do escopo Código.

## A barra de comando

Na base do Console vive a **barra de comando**. `Ctrl+K` leva o foco a ela; `Ctrl+Shift+K` a mostra e oculta. Ela executa uma linha na linguagem base, dentro da cena atual, e imprime o resultado:

```luau
helix.scene.find("Bola").rigidBody:applyImpulse({ x = 0, y = 5, z = 0 })
```

```python
[e.name for e in helix.scene.query(kind="light")]
```

Antes de interpretar a linha, a barra reconhece quatro comandos próprios: `help`, `scripts`, `lang` e `clear` (veja [Painéis ▸ Barra de comando](/helix/docs/pt-br/editor/paineis#barra-de-comando)). O histórico é guardado por jogo e percorrido com `↑` e `↓`.

> [!TIP]
> Com a simulação ligada, a barra é a forma mais rápida de testar uma hipótese: aplique um impulso, mude a gravidade, ligue um efeito. Nada do que ela faz na simulação é gravado.

## Anexar um script a um ator

Um script vira comportamento quando está anexado a um ator. Há três caminhos:

1. arrastar o script do painel Scripts (ou dos Ativos) para o ator na Hierarquia ou no viewport;
2. no Inspetor, **Adicionar componente ▸ Script** e escolher na biblioteca;
3. pelo código: `entity:addScript("Patrulha")`.

No Inspetor, cada script anexado tem o interruptor **ativado**, o seletor de **contexto** (compartilhado, cliente ou servidor) e os campos das **propriedades expostas**. O mesmo script pode estar em quantos atores quiser, cada instância com os seus valores.

## Scripts de ferramenta

Um script que usa `helix.editor` é uma **ferramenta**: roda só dentro do editor, nunca entra no jogo compilado. Ferramentas acrescentam itens de menu, painéis e atalhos, e toda alteração que fazem na cena passa pelo histórico, então `Ctrl+Z` desfaz o que uma ferramenta fez. Veja a [referência de `helix.editor`](/helix/docs/pt-br/referencia/ferramentas).
