---
title: Hierarquia e Inspetor
description: A árvore de atores da cena, como organizá-la em grupos e pastas, e o painel que mostra e edita cada propriedade do ator selecionado.
order: 3
---

A **Hierarquia** (`Ctrl+Shift+E`) lista todos os atores da cena como uma árvore; o **Inspetor** mostra as propriedades do ator principal da seleção. Os dois são o par que você mais usa na área de trabalho Cena.

## A árvore

![O painel Hierarquia com a árvore de atores do template Baseplate destacada.](/docs/figures/hierarquia/arvore.webp "A árvore: cada linha mostra o ícone e o nome do ator e, à direita, o tipo (Pasta, Malha, Luz, Câmera).")

Cada linha é um ator: o ícone do tipo, o nome, e à direita os botões de visibilidade e bloqueio que aparecem ao passar o mouse. Filhos ficam recuados sob o pai; a seta recolhe e expande a subárvore. Os atores aparecem na ordem em que estão na cena, que é também a **ordem de execução padrão dos scripts**.

### Organizar

- **Arrastar** um ator sobre outro o torna filho dele; arrastar entre duas linhas o reposiciona na ordem. Ao mudar de pai, a transformação mundial é preservada: o ator não pula de lugar no viewport.
- `Ctrl+G` **agrupa** a seleção num ator `group` novo, posicionado no centro da seleção. `Ctrl+Shift+G` desfaz o grupo e devolve os filhos ao pai original.
- `Alt+N` cria uma **pasta**: um grupo vazio, sem transformação própria visível, que só organiza. Pastas não aparecem no jogo nem na API como atores com geometria, mas são atores: podem ser ocultadas e bloqueadas com tudo o que contêm.
- `F2` **renomeia**; o nome não precisa ser único, mas `helix.scene.find` devolve o primeiro que encontrar, então nomes únicos ajudam no código.

### Buscar e filtrar

![O topo do painel Hierarquia com a barra de botões e o campo Filtrar atores destacados.](/docs/figures/hierarquia/barra-do-painel.webp "A barra da Hierarquia: adicionar ator, nova pasta, o filtro e os botões de expandir e recolher tudo.")

O campo de busca no topo filtra a árvore pelo nome e aceita prefixos:

| Prefixo | Exemplo | Mostra |
| --- | --- | --- |
| (nenhum) | `porta` | Atores cujo nome contém "porta" e os seus ancestrais. |
| `tipo:` | `tipo:light` | Só os atores daquele tipo. |
| `tag:` | `tag:inimigo` | Só os atores com aquela tag. |
| `script:` | `script:Patrulha` | Só os atores com aquele script. |

### Visibilidade e bloqueio

| Ação | Tecla | Efeito |
| --- | --- | --- |
| Ocultar / mostrar a seleção | `H` | O ator e os filhos saem do viewport e das consultas; no jogo, `Entity.visible` começa assim. |
| Isolar a seleção | `Shift+H` | Oculta todo o resto. |
| Mostrar todos os ocultos | `Alt+H` | Desfaz as ocultações. |
| Bloquear / desbloquear | `L` | Bloqueado não é selecionável no viewport, só aqui. |
| Desbloquear todos | `Alt+L` | — |

## Menu de contexto

O clique direito num ator da hierarquia (ou no viewport) abre o mesmo menu: adicionar filho (primitiva, luz, câmera, grupo, terreno, efeito, fonte de som), adicionar componente, criar prefab a partir do ator, as operações CSG, exportar a malha, e as ações específicas do tipo selecionado. O menu **Adicionar** na barra da hierarquia cria atores na raiz ou dentro da seleção.

## O Inspetor

![A janela do editor com o painel Inspetor destacado à direita.](/docs/figures/editor/inspetor.webp "O Inspetor ocupa a zona direita. Sem seleção, ele pede que você clique num ator no viewport ou na hierarquia.")

O inspetor mostra o ator principal da seleção em seções recolhíveis, uma por componente:

1. **Cabeçalho**: nome, tipo, ativo/inativo, tags e o identificador (copiável).
2. **Transformação**: posição, rotação (em graus) e escala, locais. O botão ao lado alterna para a leitura mundial. Os ícones de cadeado prendem a escala uniforme.
3. **Componentes**: material, malha e LOD, luz, câmera, corpo rígido e colisores, fonte de som, player de animação, efeito visual, personagem, terreno, superfícies de interface. Cada um tem o botão de menu com **Redefinir**, **Copiar valores**, **Colar valores** e **Remover**.
4. **Scripts**: cada script anexado com o interruptor de ativado, a linguagem, o contexto de execução (compartilhado, cliente ou servidor) e as **propriedades expostas** declaradas por ele.
5. **Adicionar componente**: o botão no fim da lista.

### Editar vários atores

Com mais de um ator selecionado, o inspetor mostra os campos que eles têm em comum. Um valor igual em todos aparece normalmente; valores diferentes aparecem como um traço, e digitar um valor novo o aplica a todos. Arrastar um campo numérico com vários atores selecionados aplica o **mesmo delta** a cada um, preservando as diferenças.

### Campos numéricos

- Arraste horizontalmente para alterar; `Alt` torna o passo fino, `Shift` o torna grosso.
- Digite expressões: `2*3`, `10/4`, `=x+1`. Unidades conhecidas são convertidas: `90deg`, `1.5m`, `30cm`.
- `Tab` passa ao campo seguinte e confirma. `Esc` cancela a edição e devolve o valor anterior.

### Campos de referência

Campos que apontam para um ator (o alvo de uma junta, a câmera de uma tela) aceitam arrastar o ator da hierarquia ou o botão de mira, que seleciona no viewport. Campos que apontam para um ativo (uma textura, um clipe) aceitam arrastar do painel Ativos ou abrem o seletor da biblioteca.

> [!NOTE]
> Tudo o que o inspetor mostra existe na API com o mesmo nome. Passe o mouse sobre o rótulo de um campo e a dica mostra o caminho (`light.intensity`, `rigidBody.mass`) para usar no código.
