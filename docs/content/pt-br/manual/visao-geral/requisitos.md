---
title: Requisitos
description: O que o navegador precisa oferecer para a engine rodar, e o que muda quando ele oferece mais.
order: 2
---

A engine roda em qualquer navegador moderno de computador. Ela não exige instalação, extensão nem conta: o que ela precisa está nas APIs da web que os navegadores atuais já trazem.

## O mínimo

| Recurso | Para quê | Sem ele |
| --- | --- | --- |
| **WebGL2** | Toda a renderização: viewport do editor, materiais, sombras, pós-processamento e os efeitos. | A engine não abre. A tela inicial avisa e indica como ativar a aceleração por hardware. |
| **IndexedDB** | Guardar os jogos, os ativos importados e os salvamentos automáticos no navegador. | A tela inicial abre em modo somente leitura: dá para abrir um `.helix` baixado, mas não para guardar. |
| **Web Workers** | Rodar a física fora da thread principal e compilar scripts sem travar o editor. | A física roda na thread principal (`local`). Tudo funciona, com menos folga de desempenho. |
| **Web Audio** | Mixer, fontes 3D, zonas e o editor de clipes. | O áudio fica mudo; o resto do editor segue normal. |

Chrome, Edge, Firefox e Safari em versões recentes atendem a todos os itens. Em notebooks com duas placas de vídeo, confirme que o navegador está usando a placa dedicada: o viewport inteiro depende dela.

## O que melhora com isolamento de origem

Quando a página é servida com os cabeçalhos `Cross-Origin-Opener-Policy` e `Cross-Origin-Embedder-Policy` (o padrão do servidor da engine), o navegador a marca como **isolada** e libera o `SharedArrayBuffer`. A física passa a compartilhar memória com o seu worker em vez de copiar as poses a cada frame.

| Situação | Backend de física | O que muda |
| --- | --- | --- |
| Página isolada, Workers disponíveis | `worker-shared` | Integração no worker, poses lidas direto da memória compartilhada. |
| Página não isolada (um iframe, por exemplo) | `worker-copy` | Integração no worker, poses copiadas por frame. Mesmo resultado, bit a bit; custa dezenas de microssegundos. |
| Sem Workers ou preferência `local` | `local` | Tudo na thread principal. |

A preferência fica em **Helix ▸ Configuração ▸ Simulação ▸ Backend de física** (`auto`, `local` ou `worker`). Em `auto`, a engine escolhe o melhor que o ambiente permite.

> [!NOTE]
> Dentro de um iframe que não é isolado, a memória compartilhada não existe mesmo que o servidor envie os cabeçalhos certos: só a página de topo decide o isolamento. É por isso que a pré-visualização embutida usa `worker-copy`.

## Armazenamento persistente

Os jogos ficam no armazenamento do navegador. Por padrão, o navegador pode apagar esses dados quando o disco está cheio. Na primeira gravação, a engine pede ao navegador que marque o armazenamento como **persistente** (`navigator.storage.persist()`); a barra lateral da tela inicial mostra se o pedido foi aceito e quanto espaço está em uso.

> [!WARNING]
> Janelas anônimas e perfis temporários descartam o IndexedDB ao fechar. Baixe uma cópia do jogo (`Ctrl+Shift+S`) antes de encerrar uma sessão nesse modo.

## Telas e entrada

- O editor foi desenhado para telas a partir de 1280 px de largura. Em janelas menores os painéis se recolhem para a barra lateral, mas o fluxo de trabalho pede um monitor.
- Mouse com três botões e roda: o botão do meio movimenta a câmera; sem ele, use `Shift` com o botão esquerdo.
- Teclado físico: a maior parte das ferramentas e das operações tem [atalho](/helix/docs/pt-br/editor/atalhos), e todos podem ser remapeados.
- Gamepads são lidos durante a simulação pela API de entrada (`helix.input`); o editor em si não os usa.

## O jogo compilado

O executável gerado por **Helix ▸ Compilar jogo para computador** embute um runtime próprio e não depende do navegador instalado na máquina de quem joga. Os requisitos passam a ser os do sistema operacional de destino: Windows 10 ou mais novo, macOS 12 ou mais novo e distribuições Linux com glibc 2.31 ou mais nova, todos com uma GPU que suporte OpenGL ES 3.0 ou equivalente.
