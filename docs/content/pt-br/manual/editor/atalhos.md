---
title: Atalhos de teclado
description: Todos os atalhos padrão do editor, por escopo e por grupo, e como remapeá-los.
order: 6
---

Toda ação da engine que responde a uma tecla está registrada com um nome e uma combinação padrão. O que você personaliza em **Helix ▸ Personalizar atalhos** (`Ctrl+Alt+K`) substitui o padrão; os menus e as dicas passam a mostrar a sua combinação.

## Escopos

Um atalho só vale no seu **escopo**, então ações de escopos diferentes podem dividir a mesma tecla sem conflito (`H` oculta um ator na cena e é a ferramenta Mão na Interface).

| Escopo | Vale quando |
| --- | --- |
| Editor | O foco está no viewport 3D ou nos painéis da área Cena. |
| Interface | A área de trabalho Interface está ativa. |
| Código | O editor de código está à frente, fora do campo de texto (que tem as suas próprias teclas). |
| Animação, Áudio, Efeitos | O respectivo painel está focado. |

> [!NOTE]
> Em macOS, `Ctrl` nas tabelas abaixo é `Cmd`. A engine mostra os símbolos certos para a sua plataforma nos menus.

## Helix

| Ação | Atalho |
| --- | --- |
| Novo jogo (guarda o atual e abre um template) | `Ctrl+Alt+N` |
| Fechar jogo (volta à tela inicial) | `Ctrl+Alt+W` |
| Baixar cópia do jogo | `Ctrl+Shift+S` |
| Compilar jogo para computador | `Ctrl+Shift+D` |
| Abrir salvamentos automáticos | `Ctrl+Alt+H` |
| Personalizar atalhos | `Ctrl+Alt+K` |
| Configuração da Helix Engine | `Ctrl+,` |

## Editar

| Ação | Atalho |
| --- | --- |
| Desfazer | `Ctrl+Z` |
| Refazer | `Ctrl+Shift+Z`, `Ctrl+Y` |
| Duplicar | `Ctrl+D` |
| Copiar / Colar | `Ctrl+C` / `Ctrl+V` |
| Agrupar / Desagrupar | `Ctrl+G` / `Ctrl+Shift+G` |
| Selecionar tudo | `Ctrl+A` |
| Nova pasta | `Alt+N` |
| Renomear | `F2` |
| Excluir (com a Animação aberta, apaga chaves) | `Delete`, `Backspace` |

## Seleção

| Ação | Atalho |
| --- | --- |
| Limpar seleção | `Esc` |
| Enquadrar a seleção | `F` |
| Ocultar / mostrar a seleção | `H` |
| Isolar a seleção (oculta o resto) | `Shift+H` |
| Mostrar todos os ocultos | `Alt+H` |
| Bloquear / desbloquear a seleção | `L` |
| Desbloquear todos | `Alt+L` |

## Ferramentas

| Ação | Atalho |
| --- | --- |
| Selecionar | `Q` |
| Mover | `W` |
| Rotacionar | `E` |
| Escalar | `R` |
| Terreno (esculpir e pintar) | `T` |

## Terreno (com a ferramenta Terreno ativa)

| Ação | Atalho |
| --- | --- |
| Elevar / Suavizar / Achatar | `1` / `2` / `3` |
| Ruído / Terraço / Erosão | `4` / `5` / `6` |
| Pintar / Grama | `7` / `8` |
| Copiar a altura sob o cursor para o Achatar | `C` |
| Diminuir o raio do pincel (Shift: divide ao meio) | `[`, `Shift+[` |
| Aumentar o raio do pincel (Shift: dobra) | `]`, `Shift+]` |

## Exibir

| Ação | Atalho |
| --- | --- |
| Alternar a grade | `G` |
| HUD de orçamento do frame | `F3` |
| Abrir o editor de materiais | `M` |
| Abrir / fechar o editor de código (em qualquer área) | `Ctrl+Alt+C` |

## CSG

| Ação | Atalho |
| --- | --- |
| Pincel de subtração em caixa (no ator selecionado) | `B` |
| Pincel de subtração em cilindro | `Shift+B` |
| Subtrair os demais selecionados do principal | `Ctrl+Alt+S` |
| Unir os demais selecionados ao principal | `Ctrl+Alt+U` |
| Interseção do principal com os demais | `Ctrl+Alt+I` |
| Consolidar o alvo CSG selecionado (fixa o resultado) | `Ctrl+Alt+B` |
| Ativar / desativar os pincéis selecionados | `Ctrl+Alt+E` |
| Subir / descer o pincel na ordem das operações | `Ctrl+Alt+↑` / `Ctrl+Alt+↓` |

## Simulação

| Ação | Atalho |
| --- | --- |
| Simular / pausar a física | `Ctrl+P` |
| Parar e restaurar a cena | `Ctrl+Shift+P` |

## Painéis

| Ação | Atalho |
| --- | --- |
| Hierarquia (Camadas, na Interface) | `Ctrl+Shift+E` |
| Ativos | `Ctrl+Shift+A` |
| Animação | `Ctrl+Shift+T` |
| Áudio | `Ctrl+Shift+U` |
| Efeitos | `Ctrl+Shift+X` |
| Luzes | `Ctrl+Shift+L` |
| Paleta Interface | `Ctrl+Shift+F` |
| Scripts | `Ctrl+Shift+Y` |
| Console | ``Ctrl+` `` |
| Maximizar o viewport / restaurar os painéis | `Ctrl+Shift+Espaço` |

## Ajuda

| Ação | Atalho |
| --- | --- |
| Abrir a documentação (numa aba nova) | `F1` |
| Abrir os tutoriais | `Shift+F1` |

## Interface: ferramentas

| Ação | Atalho |
| --- | --- |
| Selecionar | `V` |
| Mão (arrastar a vista) | `H` |
| Quadro | `F` |
| Texto | `T` |
| Imagem | `I` |
| Ícone | `O` |
| Botão | `B` |
| Alternador / Controle deslizante / Progresso | `Shift+K` / `Shift+S` / `Shift+P` |
| Campo de texto / Área rolável / Divisor | `Shift+I` / `Shift+C` / `Shift+D` |
| Vídeo / Visão | `Shift+V` / `Shift+W` |

## Interface: edição

| Ação | Atalho |
| --- | --- |
| Salvar a tela na biblioteca | `Ctrl+S` |
| Duplicar / Copiar / Recortar / Colar | `Ctrl+D` / `Ctrl+C` / `Ctrl+X` / `Ctrl+V` |
| Selecionar tudo | `Ctrl+A` |
| Agrupar em quadro / Desagrupar | `Ctrl+G` / `Ctrl+Shift+G` |
| Avançar na ordem / Trazer para a frente | `Ctrl+]` / `Ctrl+Shift+]` |
| Recuar na ordem / Enviar para trás | `Ctrl+[` / `Ctrl+Shift+[` |
| Alinhar à esquerda / ao centro / à direita | `Alt+A` / `Alt+H` / `Alt+D` |
| Alinhar ao topo / ao meio / à base | `Alt+W` / `Alt+V` / `Alt+S` |
| Distribuir na horizontal / na vertical | `Alt+Shift+H` / `Alt+Shift+V` |
| Mover 1 px (Shift: 10 px) | setas, `Shift` + setas |
| Editar o texto ou entrar nos filhos | `Enter` |
| Selecionar o pai | `Shift+Enter` |
| Renomear o elemento | `F2` |
| Ocultar / mostrar a seleção | `Shift+H` |
| Bloquear / desbloquear a seleção | `Shift+L` |
| Excluir a seleção | `Delete`, `Backspace` |
| Sair do texto, voltar à seleção, limpar ou sair do teste | `Esc` |

## Interface: vista, teste e aparelho

| Ação | Atalho |
| --- | --- |
| Alternar entre Design e Testar | `Ctrl+Enter` |
| Aproximar / Afastar / Zoom 100 % | `Ctrl+=` / `Ctrl+-` / `Ctrl+0` |
| Enquadrar a tela / a seleção | `Shift+1` / `Shift+2` |
| Grade / Encaixar na grade | `Ctrl+'` / `Ctrl+Shift+'` |
| Réguas | `Shift+R` |
| Contorno de todos os elementos | `Shift+O` |
| Área segura do aparelho | `Shift+A` |
| Girar o aparelho (retrato / paisagem) | `Alt+R` |
| Moldura do aparelho | `Alt+M` |

## Código

| Ação | Atalho |
| --- | --- |
| Novo script (na linguagem base) | `Alt+N` |
| Salvar o script | `Ctrl+S` |
| Salvar todos os scripts | `Ctrl+Alt+S` |
| Fechar a aba | `Alt+W` |
| Executar o script (salva antes) | `Ctrl+Enter`, `F5` |
| Compilar o projeto | `Ctrl+Shift+B` |
| Buscar / Buscar e substituir | `Ctrl+F` / `Ctrl+H` |
| Aba seguinte / anterior | `Ctrl+PageDown` / `Ctrl+PageUp` |
| Ir à barra de comando | `Ctrl+K` |
| Mostrar / ocultar a barra de comando | `Ctrl+Shift+K` |
| Fechar a busca ou voltar à cena | `Esc` |

## Animação

| Ação | Atalho |
| --- | --- |
| Reproduzir / pausar | `Espaço` |
| Quadro anterior / seguinte (Shift: 10 quadros) | `←` / `→` |
| Início / fim do clipe | `Home` / `End` |
| Chave anterior / seguinte | `,` / `.` |
| Inserir chave nos ossos selecionados / em todos | `K` / `Shift+K` |
| Copiar / colar chaves | `Ctrl+C` / `Ctrl+V` |
| Selecionar todas as chaves | `Ctrl+A` |
| Excluir as chaves selecionadas | `Delete`, `Backspace` |
| Salvar na biblioteca | `Ctrl+S` |

## Áudio

| Ação | Atalho |
| --- | --- |
| Reproduzir / pausar | `Espaço` |
| Recuar / avançar 0,1 s (Shift: 1 s) | `←` / `→` |
| Início / fim do recorte | `Home` / `End` |
| Início / fim do recorte no cursor | `[` / `]` |
| Ouvir o original (A/B) | `B` |
| Aproximar / afastar a forma de onda | `=` / `-` |
| Ver o arquivo inteiro | `0` |

## Efeitos

| Ação | Atalho |
| --- | --- |
| Tocar / congelar o efeito | `Espaço` |
| Recuar / avançar um quadro (Shift: 10) | `←` / `→` |
| Início / fim do ciclo | `Home` / `End` |
| Duplicar o emissor ou módulo | `Ctrl+D` |
| Subir / descer na pilha | `Alt+↑` / `Alt+↓` |
| Remover o emissor ou módulo | `Delete`, `Backspace` |
| Salvar o efeito na biblioteca | `Ctrl+S` |
| Voltar do módulo ao emissor, do emissor ao efeito | `Esc` |

## Personalizar

Em **Helix ▸ Personalizar atalhos**, clique na combinação de uma ação e pressione a nova. A engine avisa quando a combinação já está em uso **no mesmo escopo** e oferece trocar. Uma ação pode ter mais de uma combinação; **Redefinir** devolve o padrão de uma ação ou de todas. As personalizações são uma preferência da engine, guardadas no navegador, e entram no backup da configuração (**Configuração ▸ Exportar**).
