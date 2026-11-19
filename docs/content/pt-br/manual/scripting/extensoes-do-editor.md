---
title: Extensões do editor
description: Scripts que rodam com o editor e acrescentam a ele janelas, itens de menu, seções do Inspetor, gizmos, ferramentas do viewport e fluxos de trabalho.
order: 6
---

Uma extensão é um script do jogo que roda dentro do editor. Ela sobe quando o projeto abre, continua ativa durante a simulação e recarrega cada vez que o script é salvo. Por `helix.editor` ela registra seis tipos de contribuição: janelas, itens de menu, seções do Inspetor, gizmos, ferramentas do viewport e fluxos de trabalho.

## Criar uma extensão

Abra **Extensões ▸ Nova extensão** na barra de menus e escolha um modelo. O editor cria o script, marca-o como extensão e abre o código. Há um modelo para cada tipo de contribuição, e todos funcionam sem alteração.

Para usar um script que já existe, escolha-o em **Usar um script da biblioteca**, no mesmo menu.

O painel **Extensões** lista as extensões do projeto, o estado de cada uma (ativa, carregando, com erro, desligada) e quantas contribuições ela registrou. O interruptor de cada linha desliga a extensão sem tirá-la do projeto, e a lista é salva com a cena.

> [!IMPORTANT]
> Extensões rodam código assim que o projeto abre. Num projeto que veio de outra pessoa elas ficam bloqueadas até você clicar em **Ativar extensões** no painel.

## Como um script de extensão é escrito

```typescript
import helix from "helix"

const editor = helix.editor

if (editor) {
	editor.menus.register("Ferramentas/Selecionar tudo", {
		shortcut: "Ctrl+Shift+T",
		run: () => editor.selectAll(),
	})
}
```

`helix.editor` só existe dentro do editor; no jogo ele é `undefined`, por isso o `if`. O registro pode ficar no corpo do script, como acima, ou em `onLoad`.

Quando o script recarrega, cada contribuição é trocada pela versão nova e as que ele deixou de registrar são removidas. Um erro num callback vai para o Console com o arquivo e a linha. Callbacks chamados a cada quadro ou a cada desenho (`onDraw`, `appliesTo`, `enabled`, `checked`) param de ser chamados depois do primeiro erro, até o script ser salvo de novo.

Toda função `register` devolve um objeto com `unregister()`. Os ids aceitam letras, números, ponto, hífen e sublinhado.

### Desfazer

Criar e apagar atores por `helix.scene` entra no histórico do editor, e `Ctrl+Z` desfaz. Escritas diretas, como `helix.transform.setPosition`, não entram. Para que entrem, passe a mudança por `editor.history.execute`:

```typescript
const position = helix.transform.position(actor)
const from = [position[0], position[1], position[2]]

editor.history.execute({
	label: "Apoiar no chão",
	execute: () => helix.transform.setPosition(actor, [from[0], 0, from[2]]),
	undo: () => helix.transform.setPosition(actor, from),
})
```

`execute` roda na hora e de novo a cada refazer. `helix.transform.position` devolve o vetor vivo do ator, então copie os valores antes de alterá-lo.

## Janelas

`editor.windows.register(id, opções)` cria um painel que encaixa, move e fecha como os painéis do editor. Ele aparece em **Exibir ▸ Janelas de extensões**.

```typescript
const row = { name: "Cubo", count: 5, spacing: 2 }

const janela = editor.windows.register("fileira", {
	title: "Fileira",
	icon: "layout-grid",
	area: "right",
	onGui(ui) {
		ui.heading("Fileira de atores")
		row.name = ui.text("Nome", row.name)
		row.count = ui.number("Quantidade", row.count, { min: 1, max: 50, step: 1 })
		row.spacing = ui.slider("Espaçamento", row.spacing, 0.5, 10)
		if (ui.button("Criar fileira", { variant: "primary", icon: "plus" })) {
			for (let index = 0; index < row.count; index++) {
				helix.scene.spawnPrimitive("box", { name: `${row.name} ${index + 1}`, position: [index * row.spacing, 0.5, 0] })
			}
		}
	},
})
janela.open()
```

`area` é `"left"`, `"right"` ou `"bottom"`. O objeto devolvido tem `open()`, `close()`, `repaint()` e `isOpen`.

### A interface em `onGui`

`onGui` desenha a interface inteira a cada vez que é chamado. Cada campo recebe o valor atual e devolve o valor depois da interação, e cada botão devolve `true` no desenho em que foi clicado. O estado fica nas variáveis do script. O editor chama `onGui` de novo quando o usuário mexe num campo e quando a cena, a seleção, o histórico ou os ativos mudam; `repaint()` pede um desenho fora desses momentos.

| Chamada | Devolve | Observação |
| --- | --- | --- |
| `ui.label(texto, { muted })` | nada | Texto simples. |
| `ui.heading(texto)` | nada | Título de bloco. |
| `ui.help(texto, nível)` | nada | Aviso; nível `"info"`, `"warn"` ou `"error"`. |
| `ui.separator()`, `ui.space(altura)` | nada | Divisória e espaço vertical. |
| `ui.progress(valor, rótulo)` | nada | Barra de 0 a 1. |
| `ui.button(rótulo, { icon, variant })` | `boolean` | `variant` é `"primary"`, `"secondary"` ou `"danger"`. |
| `ui.toggle(rótulo, valor)` | `boolean` | Interruptor. |
| `ui.number(rótulo, valor, { min, max, step })` | `number` | Campo numérico. |
| `ui.slider(rótulo, valor, min, max, { step })` | `number` | Controle deslizante. |
| `ui.text(rótulo, valor, { placeholder, multiline })` | `string` | Campo de texto. |
| `ui.select(rótulo, valor, opções)` | `string` | Opções como textos ou `{ value, label }`. |
| `ui.color(rótulo, cor)` | `Vec3` | Cor linear. |
| `ui.vector(rótulo, vetor)` | `Vec3` | Três campos. |
| `ui.actor(rótulo, ator)` | ator ou `null` | Referência a um ator da cena. |
| `ui.asset(rótulo, ativo, tipo)` | ativo ou `null` | Seletor da biblioteca, filtrado pelo tipo. |
| `ui.row(desenho)` | nada | Coloca os campos lado a lado. |
| `ui.section(título, desenho)` | nada | Bloco recolhível. |

Todo campo aceita `disabled` nas opções. O editor reconhece um campo pelo rótulo: dois campos com o mesmo rótulo no mesmo bloco precisam de `key` diferente nas opções. `ui.changed` diz se algum valor mudou no desenho atual.

## Itens de menu

`editor.menus.register(caminho, opções)` acrescenta um comando. No menu principal, o primeiro nome do caminho escolhe o menu e os seguintes viram submenus, até cinco níveis. Se o primeiro nome for um menu do editor (Arquivo, Editar, Interface, Código, Simular, Exibir, Extensões, Ajuda), o item entra no fim dele. Qualquer outro nome cria um menu novo entre Extensões e Ajuda.

```typescript
editor.menus.register("Ferramentas/Alinhar/Apoiar no chão", {
	icon: "magnet",
	shortcut: "Ctrl+Shift+G",
	enabled: (target) => target.actors.length > 0,
	run: (target) => {
		const moves = target.actors.map((actor) => {
			const position = helix.transform.position(actor)
			return { actor, x: position[0], y: position[1], z: position[2] }
		})
		editor.history.execute({
			label: "Apoiar no chão",
			execute: () => moves.forEach((move) => helix.transform.setPosition(move.actor, [move.x, 0, move.z])),
			undo: () => moves.forEach((move) => helix.transform.setPosition(move.actor, [move.x, move.y, move.z])),
		})
	},
})
```

Com `location`, o item vai para um menu de contexto: `"actor"` para o menu dos atores, na Hierarquia e no viewport, e `"asset"` para o menu dos ativos. Nesses dois o caminho não tem nome de menu.

| Opção | O que faz |
| --- | --- |
| `run(target)` | O comando. Obrigatório. |
| `location` | `"main"` (padrão), `"actor"` ou `"asset"`. |
| `enabled(target)` | Devolve `false` para desligar o item. |
| `checked(target)` | Torna o item marcável; devolve se está marcado. |
| `shortcut` | Atalho no formato `"Ctrl+Shift+G"`. |
| `icon`, `order`, `separator` | Ícone, posição entre os itens de extensão e uma divisória antes do item. |

`target` traz `actors`, `actor` (o primeiro) e `asset`. No menu principal e nos atalhos, `actors` é a seleção; no menu de contexto, é o ator clicado ou a seleção de que ele faz parte.

O atalho só dispara quando nenhum atalho do editor usa a mesma combinação e quando o foco não está num campo de texto.

## Seções do Inspetor

`editor.inspectors.register(id, opções)` acrescenta uma seção recolhível ao Inspetor, depois das seções do editor. `onGui` recebe a mesma `ui` das janelas e os atores a que a seção se aplica.

```typescript
editor.inspectors.register("altura-rapida", {
	title: "Altura rápida",
	kinds: ["mesh", "group"],
	multiple: true,
	onGui(ui, actors) {
		const current = helix.transform.position(actors[0])[1]
		const height = ui.number("Altura", current, { step: 0.25 })
		if (height === current) return
		const moves = actors.map((actor) => {
			const position = helix.transform.position(actor)
			return { actor, x: position[0], y: position[1], z: position[2] }
		})
		editor.history.execute({
			label: "Mudar altura",
			execute: () => moves.forEach((move) => helix.transform.setPosition(move.actor, [move.x, height, move.z])),
			undo: () => moves.forEach((move) => helix.transform.setPosition(move.actor, [move.x, move.y, move.z])),
		})
	},
})
```

`kinds` restringe a seção a tipos de ator (`"mesh"`, `"light"`, `"camera"`, `"group"` e os demais de `helix.scene.kinds()`), e `appliesTo(actor)` decide ator por ator. Sem `multiple`, a seção some quando há mais de um ator selecionado; com `multiple`, ela recebe os atores selecionados que passam no filtro. `order` ordena as seções entre si e `open: false` faz a seção começar recolhida.

## Gizmos

`editor.gizmos.register(id, opções)` desenha linhas no viewport. `onDraw` é chamado para cada ator visível que passa no filtro, e `onDrawScene` uma vez por quadro.

```typescript
editor.gizmos.register("frente-do-ator", {
	kinds: ["mesh", "light", "camera"],
	when: "selected",
	onDraw(draw, actor) {
		draw.color("#ffd166")
		draw.local(actor, () => {
			draw.arrow([0, 0, 0], [0, 0, -2])
			draw.circle([0, 0, 0], 1)
		})
	},
})
```

`when` é `"always"` (padrão) ou `"selected"`. `kinds` e `appliesTo` filtram como nas seções do Inspetor. O terceiro argumento de `onDraw` diz se o ator está selecionado.

| Chamada | Desenha |
| --- | --- |
| `draw.color(cor, opacidade)` | Nada; define a cor das formas seguintes. |
| `draw.line(a, b)` | Um segmento. |
| `draw.polyline(pontos, fechada)` | Segmentos em sequência. |
| `draw.ray(origem, direção, comprimento)` | Um segmento a partir de um ponto. |
| `draw.arrow(de, até)` | Um segmento com ponta. |
| `draw.cross(centro, tamanho)` | Três segmentos nos eixos. |
| `draw.box(centro, tamanho)` | As arestas de uma caixa; `tamanho` é um número ou um vetor. |
| `draw.sphere(centro, raio)` | Três círculos. |
| `draw.circle(centro, raio, normal)` | Um círculo; sem `normal`, fica na horizontal. |
| `draw.local(ator, desenho)` | Nada; dentro de `desenho`, as coordenadas são locais ao ator. |

As coordenadas são do mundo, exceto dentro de `draw.local`. A cor volta ao padrão a cada chamada de `onDraw`.

Os gizmos são recalculados só nos quadros que o viewport desenha. O limite é de 20 mil segmentos por quadro, somados todos os gizmos; o que passar disso não é desenhado. Enquanto os scripts do jogo rodam na simulação, os gizmos de extensão não aparecem. O menu de visualização do viewport tem a opção **Gizmos das extensões** para escondê-los.

## Ferramentas do viewport

`editor.tools.register(id, opções)` põe um botão no trilho de ferramentas, abaixo das ferramentas do editor. Há dois tipos. Com `run`, o botão executa uma ação e pronto. Com qualquer um de `onActivate`, `onDeactivate`, `onPointerDown`, `onPointerMove`, `onPointerUp`, `onDraw` ou `onGui`, o botão liga uma ferramenta que fica ativa até o usuário escolher outra ou apertar `Esc`.

```typescript
const stamp = { size: 1, hovering: false, cursor: [0, 0, 0] }

editor.tools.register("carimbo", {
	title: "Carimbo de caixas",
	icon: "box",
	shortcut: "Shift+B",
	cursor: "crosshair",
	onPointerMove(event) {
		stamp.hovering = event.point !== null
		if (event.point) stamp.cursor = [event.point[0], event.point[1], event.point[2]]
	},
	onPointerDown(event) {
		if (!event.point) return
		helix.scene.spawnPrimitive("box", {
			scale: stamp.size,
			position: [event.point[0], event.point[1] + stamp.size / 2, event.point[2]],
		})
	},
	onDraw(draw) {
		if (!stamp.hovering) return
		const [x, y, z] = stamp.cursor
		draw.circle([x, y, z], stamp.size / 2)
		draw.box([x, y + stamp.size / 2, z], stamp.size)
	},
	onGui(ui) {
		stamp.size = ui.slider("Tamanho", stamp.size, 0.25, 5, { step: 0.25 })
	},
})
```

Enquanto uma ferramenta com `onPointer*` está ativa, o botão esquerdo do mouse vai para ela. A câmera continua no botão direito (orbitar), no botão do meio (deslocar) e na roda (aproximar). `onDraw` recebe a mesma `draw` dos gizmos, e `onGui` desenha o painel de opções que aparece sobre o viewport.

O evento de ponteiro traz:

| Campo | Conteúdo |
| --- | --- |
| `x`, `y` | Posição no viewport, em pixels. |
| `button`, `ctrl`, `shift`, `alt` | Botão e modificadores. |
| `dragging` | `true` do clique até soltar; `false` com o cursor livre. |
| `actor` | O ator sob o cursor, ou `null`. |
| `point` | O ponto da superfície sob o cursor. Sem superfície, o ponto no plano horizontal à altura do alvo da câmera. |
| `ground` | O ponto no plano `y = 0`, ou `null` se o raio não o cruza. |
| `ray` | `{ origin, direction }` do raio do cursor. |

`actor`, `point`, `ground` e `ray` são calculados na primeira leitura; um handler que não os lê não paga pelo cálculo.

Recarregar o script mantém a ferramenta ativa, já na versão nova.

## Fluxos de trabalho

Um fluxo é uma automação com nome, feita de passos. `editor.workflows.register(id, opções)` o registra; ele roda pelo botão na seção **Fluxos de trabalho** do painel Extensões, por `run()` no script ou sozinho, quando acontece o evento escolhido em `trigger`.

```typescript
editor.workflows.register("revisar-cena", {
	title: "Revisar cena",
	description: "Confere os nomes das malhas e relata o resultado no console.",
	trigger: "projectSaved",
	steps: [
		{
			title: "Contar atores",
			run(step) {
				step.data.total = helix.scene.count()
			},
		},
		{
			title: "Conferir nomes",
			async run(step) {
				const meshes = helix.scene.byKind("mesh")
				let unnamed = 0
				for (let index = 0; index < meshes.length; index++) {
					if (step.cancelled) return
					if (meshes[index].name.trim() === "") unnamed++
					step.progress((index + 1) / meshes.length, meshes[index].name)
					if (index % 50 === 49) await helix.time.waitFrames(1)
				}
				helix.log.info("Revisão", `${step.data.total} atores, ${unnamed} malha(s) sem nome.`)
			},
		},
	],
})
```

Os passos rodam em ordem e podem ser `async`. `step.progress(fração, mensagem)` atualiza a barra de status, que mostra o passo atual, a porcentagem e o botão de cancelar. `step.data` é um objeto compartilhado entre os passos de uma mesma execução. No lugar de `steps`, `run(step)` registra um fluxo de um passo só.

Cancelar não interrompe um passo no meio: os passos seguintes não rodam, e o passo em curso vê `step.cancelled` como `true` e decide quando parar. Um passo longo precisa devolver o controle ao editor de tempos em tempos, como o `await helix.time.waitFrames(1)` acima, senão a interface congela até ele terminar.

Um passo que lança um erro interrompe o fluxo, e o erro vai para o Console. `run()` devolve uma `Promise` com `"done"`, `"failed"` ou `"cancelled"`.

Roda um fluxo por vez. Os demais esperam numa fila de até 16, e pedir de novo um fluxo que já está na fila não o duplica. Um fluxo com `trigger` não é disparado de novo enquanto está rodando ou na fila, então as mudanças que ele mesmo faz não o reiniciam.

## Eventos do editor

`editor.events.on(nome, handler)` chama o handler quando algo muda no editor e devolve a função que cancela a inscrição.

| Evento | Quando | O handler recebe |
| --- | --- | --- |
| `selectionChanged` | A seleção mudou. | Os atores selecionados. |
| `sceneChanged` | A cena mudou. | Nada. |
| `assetsChanged` | A biblioteca de ativos mudou. | Nada. |
| `historyChanged` | Um comando foi executado, desfeito ou refeito. | Nada. |
| `toolChanged` | A ferramenta do viewport mudou. | O id da ferramenta. |
| `playModeChanged` | A simulação começou, pausou ou parou. | `"playing"`, `"paused"` ou `"stopped"`. |
| `projectSaved` | O projeto foi salvo. | O instante do salvamento, em milissegundos. |

Os eventos são entregues juntos, logo depois da mudança, uma vez por nome: dez alterações seguidas na cena chamam `sceneChanged` uma vez. O que um handler altera durante a entrega não dispara o mesmo lote de novo.

## Ícones

Os campos `icon` aceitam estes nomes: `app-window`, `blocks`, `box`, `boxes`, `brush`, `bug`, `camera`, `check`, `compass`, `copy`, `crosshair`, `eye`, `flag`, `folder`, `gauge`, `grid`, `hammer`, `layers`, `layout-grid`, `lightbulb`, `list`, `magnet`, `map`, `map-pin`, `mountain`, `move`, `palette`, `pencil`, `play`, `plus`, `puzzle`, `refresh`, `route`, `ruler`, `save`, `scissors`, `search`, `settings`, `shapes`, `shuffle`, `sliders`, `sparkles`, `square`, `star`, `sun`, `target`, `terminal`, `timer`, `trash`, `wind`, `workflow`, `wrench` e `zap`. Um nome fora da lista vira o ícone de peça de quebra-cabeça.
