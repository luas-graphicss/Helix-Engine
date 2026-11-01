---
title: Painéis
description: Todos os painéis do editor, o que cada um faz, onde fica por padrão e o atalho para abrir e fechar.
order: 4
---

Os painéis são as abas ao redor do viewport. Cada um cuida de um sistema; abrir um painel que já está aberto o traz à frente da sua zona, e o atalho dele alterna entre aberto e fechado. O menu **Exibir ▸ Painéis** lista todos.

![Detalhe da barra de ferramentas com os botões de painéis destacados.](/docs/figures/toolbar/paineis-e-layout.webp "Os botões no canto direito da barra de ferramentas abrem e fecham cada painel; o último maximiza o viewport.")

## Lista

| Painel | Atalho | Zona padrão | O que faz |
| --- | --- | --- | --- |
| Hierarquia | `Ctrl+Shift+E` | esquerda | A árvore de atores da cena. Na área Interface vira **Camadas**, a árvore da tela. |
| Inspetor | — | direita | As propriedades do ator, do elemento ou do documento selecionado. Sempre aberto. |
| Ativos | `Ctrl+Shift+A` | base | A biblioteca do jogo: pastas, importação, busca e pré-visualização. |
| Console | ``Ctrl+` `` | base | Mensagens da engine e dos scripts, com filtro por nível e fonte, e a barra de comando na área Código. |
| Luzes | `Ctrl+Shift+L` | direita | Todas as luzes da cena numa lista, com intensidade, cor e sombras editáveis sem selecionar cada uma. |
| Ambiente | — | direita | Céu, sol, atmosfera, nuvens, névoa e a luz ambiente. |
| Pós-processamento | — | direita | Exposição, bloom, tonemapping, vinheta, aberração, grão, profundidade de campo e oclusão. |
| Física | — | direita | Gravidade, passo fixo, subpassos, backend, camadas de colisão e os materiais físicos. |
| Terreno | — | direita | As ferramentas de esculpir e pintar, as camadas, a grama e a água. Abre com a ferramenta Terreno (`T`). |
| Personagem | — | direita | O personagem jogável, a câmera em terceira pessoa, o modelo, os clipes e os controles. |
| Animação | `Ctrl+Shift+T` | base | A linha do tempo, as faixas, as chaves e o esqueleto do clipe aberto. |
| Áudio | `Ctrl+Shift+U` | base | O mixer com os barramentos e o editor de clipes com a forma de onda. |
| Efeitos | `Ctrl+Shift+X` | base | O editor de partículas: emissores, módulos e a pré-visualização. |
| Interface | `Ctrl+Shift+F` | esquerda | A paleta de elementos do designer de telas. Só na área Interface. |
| Scripts | `Ctrl+Shift+Y` | esquerda | Os scripts do jogo, por pasta, com a linguagem e o estado de compilação de cada um. |
| Desempenho | `F3` | sobre o viewport | O HUD de orçamento do frame. |

## Zonas e arranjo

![A base da janela do editor com as abas Ativos e Console destacadas.](/docs/figures/ativos/abas.webp "Cada zona mostra os seus painéis como abas; arraste uma aba para levá-la a outra zona.")

![O painel Ativos: as categorias da biblioteca à esquerda e a área de arquivos à direita.](/docs/figures/ativos/painel.webp "O painel Ativos num jogo recém-criado: a biblioteca ainda vazia, com a lista de formatos aceitos.")

Há três zonas: **esquerda**, **direita** e **base**. Arraste a aba de um painel para outra zona, ou para a borda de uma zona para criar uma divisão. Arraste a borda entre zonas para redimensionar. O arranjo é guardado por área de trabalho e por jogo.

- `Ctrl+Shift+Espaço` **maximiza o viewport**: esconde todas as zonas; o mesmo atalho restaura.
- **Exibir ▸ Painéis ▸ Restaurar o arranjo padrão** volta à disposição original da área atual.
- Um painel fechado não perde o estado: a seleção de pasta dos Ativos, a rolagem do Console e o clipe aberto na Animação voltam como estavam.

## Console

O Console recebe quatro níveis (`debug`, `info`, `warn`, `error`) de qualquer fonte: a engine, cada script (identificado pelo nome do ativo), a física, o importador. Clicar numa mensagem de script abre o arquivo na linha. Os filtros no topo escondem níveis e fontes; o botão de limpar apaga a lista. Mensagens repetidas são agrupadas com um contador.

Da API, `helix.log.info("Fonte", "mensagem")` e as irmãs escrevem aqui; `helix.log.trace()` anexa a pilha mapeada ao arquivo e à linha do script.

### Barra de comando

![O rodapé do editor com a barra de comando e a barra de estado destacadas.](/docs/figures/editor/comandos-e-status.webp "A barra de comando, acima da barra de estado, com os quatro comandos próprios sugeridos ao lado do prompt.")

A **barra de comando** fica no rodapé da janela, acima da barra de estado (`Ctrl+K` leva o foco; `Ctrl+Shift+K` mostra e oculta). Ela executa uma linha na linguagem base do jogo, dentro da cena, e guarda o histórico entre sessões. Quatro comandos próprios são interpretados antes da linguagem:

| Comando | O que faz |
| --- | --- |
| `help` | Lista os comandos e a linguagem ativa. |
| `scripts` | Lista os scripts carregados e o estado de cada um. |
| `lang` | Mostra a linguagem base; `lang python` troca a interpretação da barra (não a do jogo). |
| `clear` | Limpa a saída. |

Sem uma linguagem base definida, a barra pede que você escolha uma antes de interpretar qualquer coisa.

## Desempenho (HUD de orçamento do frame)

`F3` desenha por cima do viewport, em texto pequeno e sem interferir na edição:

- **CPU por faixa**: scripts, física, animação, culling, submissão.
- **GPU por etapa**: sombras, geometria, céu, transparência, pós-processamento, interface.
- **Governador**: o nível de qualidade em vigor e por que ele subiu ou desceu (veja [Qualidade e desempenho](/helix/docs/pt-br/renderizacao/qualidade-e-desempenho)).
- **Pendências**: texturas, malhas e sons ainda carregando ou compilando.

> [!TIP]
> O HUD também funciona dentro da simulação e no jogo compilado em modo de desenvolvimento: é a primeira ferramenta para descobrir onde um frame lento gasta o tempo.
