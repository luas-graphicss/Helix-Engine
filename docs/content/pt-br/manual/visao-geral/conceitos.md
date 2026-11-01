---
title: Conceitos fundamentais
description: Jogo, cena, ator, componente, ativo, documento e simulação: as palavras que aparecem em todo o manual e o que cada uma significa.
order: 3
---

Este artigo define o vocabulário que o resto do manual usa sem explicar de novo. Vale ler uma vez, inteiro; depois, use-o como glossário.

## Jogo

Um **jogo** (ou projeto) é tudo o que você cria em uma sessão da engine: a cena, os ativos importados, os scripts, as telas de interface, os efeitos, as animações e as configurações. Cada jogo tem um identificador, um nome, uma miniatura e vive numa entrada própria do armazenamento do navegador. Baixado, vira um arquivo `.helix`.

A engine abre um jogo por vez, em `/editor/<id>`. A tela inicial, em `/editor`, lista todos.

## Cena

A **cena** é o mundo 3D do jogo: a árvore de atores com as suas transformações e componentes, mais o céu, a atmosfera, o pós-processamento e as configurações de física e do jogador. Hoje cada jogo tem uma cena; os scripts podem carregar e descarregar partes dela em tempo de execução pela API (`helix.scene`).

## Ator e componentes

Um **ator** (`Entity` na API) é qualquer coisa que existe na cena: uma caixa, uma luz, a câmera, um grupo vazio que só organiza outros, um pedaço de terreno, uma fonte de som. Todo ator tem:

- um **nome** e um identificador estável;
- um **tipo** (`kind`): `mesh`, `light`, `camera`, `group`, `terrain`, `character`, entre outros;
- uma **transformação** (`transform`): posição, rotação e escala, relativas ao pai;
- um **pai** e zero ou mais **filhos**, formando a hierarquia;
- **componentes** opcionais que acrescentam comportamento: material, corpo rígido, fonte de áudio, efeito visual, player de animação, scripts.

O mesmo ator é visto pelo editor, pelo arquivo `.helix` e pelos scripts. Não há cópia ou objeto intermediário: quando um script muda `entity.transform.position`, o inspetor mostra o novo valor no mesmo frame.

```luau
local lampada = helix.scene.find("Lampada")
lampada.light.intensity = 40
lampada:addComponent("sound", { clip = "Zumbido", loop = true })
```

## Hierarquia e transformações

![Uma caixa grande com caixas menores apoiadas sobre ela, renderizadas sobre a grade do editor.](/docs/figures/conceitos/hierarquia.webp "Filhos acompanham o pai: mover ou girar a caixa grande leva junto as menores.")

A posição de um ator é relativa ao pai. Mover o pai move os filhos; escalar o pai escala os filhos. Em todo lugar da API e do inspetor existem as duas leituras: **local** (relativa ao pai) e **mundial** (absoluta). O painel Hierarquia mostra a árvore; grupos (`group`) são atores sem geometria que servem só para organizar.

![O mesmo cubo três vezes: deslocado, girado e aumentado.](/docs/figures/conceitos/transformacoes.webp "As três partes de uma transformação: posição, rotação e escala.")

## Ativos e biblioteca

Um **ativo** é um arquivo que acompanha o jogo: um modelo 3D importado, uma textura, um clipe de áudio, um vídeo, uma fonte, um script, uma tela de interface, um efeito, uma animação ou um prefab. Os ativos moram na **biblioteca** (painel Ativos), organizada em pastas, e são referenciados pelos atores pelo identificador, não pelo caminho: renomear ou mover um ativo nunca quebra quem o usa.

## Documentos

Alguns ativos têm editores próprios dentro da engine e são chamados de **documentos**:

| Documento | Editor | Formato |
| --- | --- | --- |
| Tela de interface | Área de trabalho Interface | GUI declarativa (árvore de elementos) |
| Efeito visual | Painel Efeitos | Emissores e módulos |
| Animação | Painel Animação | Clipes com faixas e chaves |
| Clipe de áudio | Painel Áudio | Recorte e processamento sobre o arquivo original |
| Script | Área de trabalho Código | Texto na linguagem do jogo |
| Prefab | Hierarquia (arrastar um ator para a biblioteca) | Subárvore de atores com componentes |

Um documento aberto no seu editor é salvo na biblioteca com `Ctrl+S`; o estado da cena, por sua vez, é gravado automaticamente.

## Prefabs

Um **prefab** é uma subárvore de atores guardada na biblioteca para ser instanciada quantas vezes for preciso. Alterar o prefab atualiza todas as instâncias que não sobrescreveram aquele campo; cada instância pode sobrescrever o que quiser. É a forma de montar um inimigo, uma moeda ou uma porta uma vez e espalhar pelo nível.

![Três postes de luz idênticos, montados de três partes cada, enfileirados sobre a grade.](/docs/figures/conceitos/prefabs.webp "Um poste montado uma vez e instanciado três vezes: mudar o prefab muda os três.")

## Materiais, luzes e céu

![Duas fileiras de esferas: acima, superfícies foscas e brilhantes não metálicas; abaixo, as mesmas em metal.](/docs/figures/conceitos/materiais.webp "A rugosidade cresce da esquerda para a direita; a fileira de baixo é metálica.")

Um **material** descreve como uma superfície reage à luz: cor base, metálico, rugosidade, emissão, normal e as texturas de cada canal. **Luzes** são atores do tipo `light` com um componente de luz (direcional, pontual ou spot). O **céu** não é um ator: é uma configuração da cena, com sol, atmosfera, nuvens e névoa, que também alimenta a iluminação ambiente.

![Três pedestais no escuro, cada um iluminado de um jeito.](/docs/figures/conceitos/luzes.webp "Os três tipos de luz: pontual (quente, à esquerda), spot (fria, ao centro) e direcional (o sol baixo, à direita).")

## Simulação e modo play

O editor tem dois estados:

- **Edição**: a cena está parada. Você move atores, ajusta valores e escreve scripts. O que você muda é gravado.
- **Simulação** (`Ctrl+P`): a física integra, os scripts rodam e o personagem do jogador responde ao teclado. Nada do que acontece aqui é gravado. **Parar e restaurar** (`Ctrl+Shift+P`) devolve a cena exatamente ao estado de antes.

Na API, `helix.isPlaying` diz em qual dos dois a engine está; `helix.isEditor` diz se o script está rodando dentro do editor (em qualquer dos estados) ou no jogo compilado.

## Áreas de trabalho

A janela do editor alterna entre três **áreas de trabalho**, que compartilham a barra de menus e os painéis laterais:

| Área | Para quê | Atalho |
| --- | --- | --- |
| Cena | O mundo 3D: viewport, hierarquia, inspetor, terreno, luzes, física. | padrão |
| Interface | O designer de telas 2D e as superfícies 3D. | menu Interface |
| Código | O editor de scripts, com abas, busca e a barra de comando. | `Ctrl+Alt+C` |

## Linguagem base

Cada jogo escolhe uma **linguagem base** para os seus scripts: Luau, Lua, Python, GDScript, JavaScript, TypeScript, C#, Haxe, Ruby e outras. Scripts novos nascem nela, a barra de comando a interpreta e `require` resolve módulos nela. Misturar linguagens num mesmo jogo é uma funcionalidade beta da engine, ligada em **Helix ▸ Funcionalidades beta**.

> [!TIP]
> A API é idêntica em todas as linguagens: `helix.scene.spawn` em Luau é `helix.scene.spawn` em Python e `Helix.Scene.Spawn` em C#. Trocar de linguagem não exige aprender a engine de novo.
