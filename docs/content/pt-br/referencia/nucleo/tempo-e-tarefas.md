---
title: Tempo e tarefas
description: helix.time, com o relógio da simulação e o agendamento, e helix.task, com as tarefas concorrentes de cada linguagem.
order: 2
---

## helix.time

| Membro | Tipo | Descrição |
| --- | --- | --- |
| `now` | `number` | Segundos desde o início da simulação, escalados por `scale`. |
| `delta` | `number` | Tempo do frame atual, escalado. O mesmo `dt` que `onUpdate` recebe. |
| `fixedDelta` | `number` | O passo fixo da física (`PhysicsSettings.fixedTimestep`), padrão `1/60`. |
| `unscaledDelta` | `number` | Tempo do frame sem a escala. |
| `scale` | `number` | Escala de tempo; escrever altera a simulação (`PlaytestController.setTimeScale`). `0` congela a lógica; a interface e `realtime` continuam. |
| `frame` | `number` | Número do frame desde o início da simulação. |
| `realtime` | `number` | Relógio de parede em segundos, sem escala e sem pausa. Para medir desempenho. |

### Agendamento

| Assinatura | Descrição |
| --- | --- |
| `wait(seconds: number): void` | Suspende a tarefa atual por tanto tempo de simulação. Só dentro de uma tarefa (`helix.task.spawn`) ou de um gancho que a linguagem trate como corrotina. |
| `waitFrames(count: number): void` | Suspende por tantos frames. |
| `delay(seconds: number, fn: () => void): Cancel` | Chama `fn` uma vez depois do tempo. Devolve um cancelador. |
| `every(seconds: number, fn: () => void): Cancel` | Chama `fn` repetidamente nesse intervalo, até cancelar. |
| `nextFrame(fn: () => void): Cancel` | Chama `fn` no fim do frame atual, depois de `onRender`. |

`Cancel` é uma função sem argumentos; chamá-la desfaz o agendamento. Agendamentos pertencem ao script: são cancelados automaticamente em `onDestroy` e ao parar a simulação.

```luau
local parar = helix.time.every(0.5, function()
  helix.vfx.play("Faísca", helix.self.transform.position)
end)

helix.time.delay(5, parar)
```

```typescript
helix.time.delay(2, () => {
  porta.animation.play("Fechar")
})
```

## helix.task

Tarefas concorrentes, no idioma de cada linguagem: corrotinas em Luau e Lua, `async`/`await` em JavaScript, TypeScript, Python, C# e Dart, goroutines em Go, `Future` em Java e Kotlin, threads verdes em Ruby.

| Assinatura | Descrição |
| --- | --- |
| `spawn(fn: () => void): TaskHandle` | Inicia uma tarefa que roda até terminar, cedendo a cada `wait`. |
| `cancel(handle: TaskHandle): void` | Interrompe a tarefa no próximo ponto de suspensão. |
| `all(handles: TaskHandle[]): TaskHandle` | Uma tarefa que termina quando todas terminarem. |
| `current(): TaskHandle \| null` | A tarefa em execução, ou `null` fora de tarefas. |

### TaskHandle

| Membro | Tipo | Descrição |
| --- | --- | --- |
| `done` | `boolean` | Terminou ou foi cancelada. |
| `cancelled` | `boolean` | Foi cancelada antes de terminar. |
| `wait(): void` | — | Suspende a tarefa atual até esta terminar. |

```luau
local tarefa = helix.task.spawn(function()
  for i = 3, 1, -1 do
    hud:find("Contagem").text = tostring(i)
    helix.time.wait(1)
  end
  hud:find("Contagem").text = "Vai!"
  helix.events.emit("corrida.iniciada")
end)

function onDestroy()
  helix.task.cancel(tarefa)
end
```

```python
async def on_start():
    await helix.time.wait(1.0)
    helix.log.info("Intro", "fim da espera")
```

> [!NOTE]
> Tarefas rodam no tempo da simulação: com `helix.time.scale = 0`, um `wait(1)` nunca acorda. Para esperas que ignoram a escala (um menu de pausa, por exemplo), compare `helix.time.realtime` em `onUpdate`.
