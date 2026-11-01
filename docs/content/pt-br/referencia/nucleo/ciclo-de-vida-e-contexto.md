---
title: Ciclo de vida e contexto
description: As funções que a engine chama num script, o ator e o script atuais, e os sinalizadores que dizem onde o código está rodando.
order: 1
---

Esta referência descreve o contrato da API `helix`, igual em todas as linguagens. As assinaturas usam uma notação neutra: `nome(arg: Tipo, opcional?: Tipo = padrão): Retorno`. `Vec3` é `{x, y, z}`, `Quat` é `{x, y, z, w}`; ângulos em graus, distâncias em metros, tempo em segundos, cores em `Vec3` linear de 0 a 1. O estado de execução de cada linguagem está em [Linguagens](/helix/docs/pt-br/scripting/linguagens).

## Ganchos do ciclo de vida

Funções que o script define e a engine chama. Todas opcionais. A ordem dentro de um frame está em [Ciclo de vida de um script](/helix/docs/pt-br/scripting/ciclo-de-vida#um-frame).

| Assinatura | Quando |
| --- | --- |
| `onLoad(): void` | Compilado e ligado ao ator, antes da cena começar. |
| `onStart(): void` | Primeiro frame em que o ator está ativo. |
| `onUpdate(dt: number): void` | Todo frame, antes do render. `dt` já escalado por `helix.time.scale`. |
| `onFixedUpdate(h: number): void` | A cada passo de física (`PhysicsSettings.fixedTimestep`); 0..N vezes por frame. |
| `onLateUpdate(dt: number): void` | Depois de física, animação e câmera; antes do render. |
| `onRender(frame: FrameInfo): void` | Depois do frame desenhado. `frame` traz `index`, `cpuMs`, `gpuMs`, `width`, `height`. |
| `onEnable(): void` / `onDisable(): void` | `ScriptSettings.enabled` ou `Entity.visible` mudaram. |
| `onStop(): void` | O jogo parou (voltou ao editor). |
| `onDestroy(): void` | O ator foi removido. |
| `onBeforeHotReload(): any` | O arquivo vai ser trocado com o jogo rodando; devolva o estado a preservar. |
| `onHotReload(previousState: any): void` | O código novo recebe o estado devolvido pela versão anterior. |

```luau
function onStart()
  helix.log.info("Caixa", "pronta em " .. tostring(helix.self.transform.position.y))
end

function onFixedUpdate(h)
  helix.self.rigidBody:addForce({ x = 0, y = 9.81 * helix.self.rigidBody.mass, z = 0 })
end
```

## Contexto de execução

| Membro | Tipo | Descrição |
| --- | --- | --- |
| `helix.context` | `'shared' \| 'client' \| 'server'` | O contexto deste script, definido no Inspetor (`ScriptDocument.runContext`). |
| `helix.isEditor` | `boolean` | Rodando dentro do editor (em edição ou em simulação). `false` no jogo compilado. |
| `helix.isPlaying` | `boolean` | A simulação está ligada (`PlaytestController.state === 'playing'`). |
| `helix.engine.name` | `string` | `"Helix Engine"`. |
| `helix.engine.version` | `string` | A versão, por exemplo `"0.2.0"`. |
| `helix.self` | `Entity \| null` | O ator que carrega este script. `null` no script de entrada e na barra de comando. |
| `helix.script` | `ScriptHandle` | Este script: veja abaixo. |

### ScriptHandle

| Membro | Tipo | Descrição |
| --- | --- | --- |
| `assetId` | `string` | O identificador do ativo na biblioteca. |
| `name` | `string` | O nome do ativo. |
| `language` | `string` | O id da linguagem (`'luau'`, `'python'`, …). |
| `enabled` | `boolean` | Se os ganchos estão sendo chamados. |
| `enable(): void` / `disable(): void` | — | Liga e desliga; disparam `onEnable` / `onDisable`. |

```python
if helix.is_editor and not helix.is_playing:
    helix.log.debug("Ferramenta", "rodando em edição")

if helix.context == "server":
    iniciar_partida()
```

## Ordem de execução

| Membro | Tipo | Descrição |
| --- | --- | --- |
| `helix.props.executionOrder` | `number` | Padrão `0`: ordem da hierarquia. Negativo roda antes dos demais, positivo depois. Declarado como propriedade para aparecer no Inspetor e no painel Scripts. |

## Veja também

- [Tempo e tarefas](/helix/docs/pt-br/referencia/nucleo/tempo-e-tarefas) para `helix.time` e `helix.task`.
- [Console, depuração e eventos](/helix/docs/pt-br/referencia/nucleo/console-depuracao-e-eventos) para `helix.log`, `helix.debug` e `helix.events`.
- [Jogo e dados](/helix/docs/pt-br/referencia/jogo) para `helix.play` e `helix.net`.
