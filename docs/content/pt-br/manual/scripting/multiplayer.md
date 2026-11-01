---
title: Multiplayer
description: O modelo cliente-servidor da engine, os contextos de script, a replicação de atores, chamadas remotas e como testar os dois lados dentro do editor.
order: 5
---

A engine tem um modelo de rede **cliente-servidor com autoridade no servidor**: o servidor é dono do estado do jogo, os clientes mandam intenções e recebem o estado replicado. A API já está definida e os contextos de script já existem, para que os jogos nasçam com a estrutura certa.

> [!WARNING]
> Nesta versão (0.2.0), o **transporte** entre máquinas ainda não está disponível: o multiplayer roda com servidor e cliente na mesma aba, dentro da simulação, para desenvolver e testar a lógica. A ABI descrita aqui é a definitiva; quando o transporte chegar, os scripts não mudam.

## Ligar

**Configuração do jogo ▸ Rede ▸ Multiplayer** liga o modelo. A partir daí:

- a simulação sobe um **servidor** e um **cliente** locais;
- scripts com contexto `server` rodam só no servidor, `client` só no cliente, `shared` nos dois;
- a barra de ferramentas ganha o seletor de **lado**, que alterna o Inspetor e o Console entre servidor e cliente;
- o personagem do jogador passa a ser um ator replicado, com a entrada lida no cliente e aplicada no servidor.

## Contextos

| Contexto | Responsabilidade típica |
| --- | --- |
| `server` | Regras do jogo, pontuação, inimigos, física que decide algo, spawn de atores. É a verdade. |
| `client` | Câmera, interface, efeitos, sons, previsão local do movimento do próprio jogador. |
| `shared` | Utilidades, constantes, matemática, módulos. Nada que decida estado. |

Um script `shared` pode perguntar onde está com `helix.net.isServer` e `helix.net.isClient`, mas se um script precisa de muitos `if isServer`, ele provavelmente deveria ser dois scripts.

## Replicação

Um ator criado no servidor **não existe** no cliente até ser replicado. `helix.net.replicate(ator, campos)` marca o ator para replicação e diz quais campos viajam:

```luau
                   
local inimigo = helix.scene.spawn("mesh", { name = "Inimigo", primitive = "capsule" })
helix.net.replicate(inimigo, { "transform.position", "transform.rotation", "props.vida" })
```

A engine envia o ator inteiro na primeira vez (tipo, componentes, hierarquia) e depois só os campos listados, quando mudam, com interpolação no cliente para `transform`. Atores que o **cliente** cria são locais àquele cliente (efeitos, marcadores de interface) e nunca sobem ao servidor.

Propriedades expostas replicam-se quando listadas como `props.nome`. Para estado que não cabe em propriedades, use eventos.

## Chamadas remotas

| Função | Direção | Uso |
| --- | --- | --- |
| `helix.net.rpc(nome, fn)` | registra um handler no lado atual | O servidor registra o que os clientes podem pedir; o cliente registra o que o servidor pode avisar. |
| `helix.net.call(nome, ...)` | cliente → servidor, ou servidor → todos os clientes | Dispara o handler do outro lado com os argumentos. |
| `helix.net.callPlayer(jogador, nome, ...)` | servidor → um cliente | Idem, para um jogador só. |

```luau
                   
helix.net.rpc("atirar", function(jogador, direcao)
  if not podeAtirar(jogador) then return end
  criarProjetil(jogador.entity.transform.position, direcao)
  helix.net.call("efeitoTiro", jogador.entity.id)
end)
```

```luau
                   
helix.net.rpc("efeitoTiro", function(idAtirador)
  helix.vfx.play("Tiro", helix.scene.get(idAtirador).transform.position)
end)

function onUpdate()
  if helix.input.action("atirar").pressed then
    helix.net.call("atirar", helix.camera.main.forward)
  end
end
```

Os argumentos atravessam pela mesma ABI dos módulos entre linguagens: números, textos, booleanos, `Vec3`, `Quat`, atores e ativos por id, listas e mapas. O servidor **nunca** confia no cliente: valide tudo no handler.

## Jogadores

`helix.net.players()` lista os jogadores conectados; cada um tem `id`, `name`, `entity` (o ator do personagem, no servidor) e `latency`. `helix.net.onPlayerJoined(fn)` e `onPlayerLeft(fn)` avisam das entradas e saídas, no servidor. Na simulação local há sempre um jogador, o seu.

## Testar no editor

1. Ligue o multiplayer e inicie a simulação (`Ctrl+P`).
2. Use o seletor de lado para ver o estado do servidor e o do cliente; selecione o mesmo ator nos dois e compare os valores no Inspetor.
3. **Configuração do jogo ▸ Rede ▸ Simular latência** acrescenta atraso e perda artificiais ao transporte local, para ver a interpolação e a previsão trabalhando.
4. O Console mostra, com a fonte `net`, cada ator replicado e cada chamada remota quando **Registrar tráfego** está ligado.

> [!TIP]
> Comece com tudo em `server` e a interface em `client`. Só mova lógica para o cliente quando a latência a tornar necessária (previsão do próprio movimento, por exemplo), e mantenha o servidor como quem corrige.
