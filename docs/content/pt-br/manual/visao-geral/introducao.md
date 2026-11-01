---
title: O que é a Helix Engine
description: Uma engine de jogos 3D completa que roda no navegador, sem instalar nada, e compila o jogo pronto para computador.
order: 1
---

A Helix Engine é uma engine de jogos 3D que roda inteira no navegador. Você abre uma aba, escolhe um template e já está dentro de um editor completo: viewport com gizmos, hierarquia de atores, materiais, luzes, física, terreno, personagem jogável, designer de interface, mixer de áudio, editor de partículas, animação e um editor de código com mais de vinte linguagens. Quando o jogo está pronto, a engine o compila num executável para Windows, macOS e Linux.

Nada é instalado. Os jogos ficam no armazenamento do próprio navegador e podem ser baixados como um arquivo `.helix` a qualquer momento.

![A janela do editor da Helix Engine com o template Baseplate aberto.](/docs/figures/editor/visao-geral.webp "O editor no navegador: Hierarquia, viewport, Inspetor e Ativos, com o template Baseplate.")

## Para quem é

A engine foi desenhada para três perfis que costumam usar ferramentas diferentes:

| Perfil | O que encontra |
| --- | --- |
| Quem está começando | Templates prontos, primitivas, um personagem que já anda e pula e tutoriais que montam um jogo do zero em capítulos curtos. |
| Quem já programa | Uma API única, `helix`, igual em todas as linguagens, com controle total sobre cada sistema: ajustar, enganchar ou substituir. |
| Quem faz arte e nível | Esculpir terreno, pintar camadas, operações booleanas (CSG), editor de materiais, luzes, céu e pós-processamento, tudo no viewport. |

## Os sistemas

Cada sistema tem um capítulo próprio neste manual. Em resumo:

- **Cena e atores.** Tudo no mundo é um ator (`Entity`) com componentes. A hierarquia, as transformações, as primitivas, os prefabs e o CSG vivem aqui.
- **Renderização.** WebGL2 com materiais PBR, luzes direcionais, pontuais e spot, céu e atmosfera, sombras, pós-processamento e shaders personalizados em GLSL ou WGSL.
- **Física.** Corpos rígidos, materiais físicos, juntas, campos de força, consultas espaciais e eventos de contato, com a simulação rodando numa thread separada quando o navegador permite.
- **Terreno.** Mapa de alturas esculpido com pincéis, camadas pintadas, grama semeada e água.
- **Personagem e animação.** Um controlador de personagem em terceira pessoa, clipes, esqueletos, retarget e IK.
- **Interface (GUI).** Um designer de telas com elementos, layout, aparência e teste em aparelhos emulados; as telas podem ir para o HUD ou para superfícies no mundo 3D.
- **Áudio.** Mixer com barramentos, fontes 3D, zonas com reverberação e um editor de clipes.
- **Efeitos visuais.** Um editor de partículas com emissores, módulos e templates.
- **Scripting.** Uma linguagem base por jogo, escolhida entre Luau, Lua, Python, GDScript, JavaScript, TypeScript, C# e muitas outras, todas falando a mesma API.

## A API em uma olhada

Todo script conversa com a engine pelo namespace `helix`. O mesmo código, com a sintaxe de cada linguagem, faz a mesma coisa em todas elas:

```luau
local caixa = helix.scene.spawn("mesh", { name = "Caixa", primitive = "box" })
caixa.transform.position = { x = 0, y = 2, z = 0 }

function onUpdate(dt)
  caixa.transform:rotate({ x = 0, y = 45 * dt, z = 0 })
end
```

```python
caixa = helix.scene.spawn("mesh", name="Caixa", primitive="box")
caixa.transform.position = (0, 2, 0)

def on_update(dt):
    caixa.transform.rotate((0, 45 * dt, 0))
```

> [!TIP]
> A [Referência da API](/helix/docs/pt-br/referencia) lista cada membro de `helix` com assinatura, estado de implementação e exemplos. O manual explica os sistemas; a referência, os nomes.

## Os cinco princípios

A engine segue cinco regras que valem para o editor e para a API, e que explicam muitas das decisões descritas neste manual:

1. **Paridade total.** Cada propriedade do inspetor, cada botão e cada ferramenta tem um equivalente na API.
2. **Mesmo modelo de dados.** Scripts veem o mesmo `Entity` e os mesmos componentes que o editor e o arquivo `.helix`. Não há um "objeto de script" paralelo.
3. **Três níveis em todo sistema.** Ajustar os valores que existem; enganchar antes ou depois do que a engine faz; desligar e substituir, com acesso bruto ao WebGL2, ao `AudioContext` ou ao canvas.
4. **Determinismo onde importa.** Física e efeitos com semente (`seed`), passo fixo em `onFixedUpdate` e ordem de execução de scripts estável e visível.
5. **Falhar alto, nunca em silêncio.** Erros de script vão ao Console com arquivo e linha; a engine continua rodando.

## Onde ir agora

- Nunca usou a engine? Comece pelo tutorial [Seu primeiro jogo em dez minutos](/helix/docs/pt-br/tutorial/primeiros-passos/primeiro-jogo).
- Quer saber se o seu navegador serve? Veja os [Requisitos](/helix/docs/pt-br/visao-geral/requisitos).
- Já está no editor? Pressione `F1` a qualquer momento para abrir esta documentação ao lado dele, ou `Shift+F1` para os tutoriais.
