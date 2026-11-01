---
title: A tela inicial
description: Onde os jogos nascem, são abertos, renomeados, duplicados, importados, exportados em backup e recuperados da lixeira.
order: 4
---

A tela inicial é o que aparece em `/editor` quando nenhum jogo está aberto. Ela lista o que está guardado no navegador, oferece os templates para começar um jogo novo e cuida da importação, do backup e da lixeira.

![A tela inicial da Helix Engine: barra lateral à esquerda, templates no alto e os jogos recentes abaixo.](/docs/figures/tela-inicial/visao-geral.webp "A tela inicial, na seção Início, com os templates e um jogo recente.")

## As três seções

![A tela inicial com a barra lateral de seções destacada.](/docs/figures/tela-inicial/secoes.webp "As seções Início, Meus jogos e Lixeira ficam na barra lateral.")

A barra lateral da esquerda alterna entre três seções:

| Seção | O que mostra |
| --- | --- |
| **Início** | Os templates para criar um jogo novo e os jogos abertos recentemente. |
| **Meus jogos** | Todos os jogos guardados, com busca por nome, ordenação e a miniatura de cada um. |
| **Lixeira** | Os jogos excluídos, que podem ser restaurados ou apagados de vez. |

Abaixo das seções ficam os botões **Importar jogo ou backup…** e **Backup de todos os jogos**, e no rodapé o estado do armazenamento: quanto espaço está em uso e se o navegador aceitou guardá-lo de forma persistente.

![A tela inicial com a caixa Armazenamento local destacada no rodapé da barra lateral.](/docs/figures/tela-inicial/armazenamento.webp "O estado do armazenamento: o espaço em uso, a cota e o botão para pedir ao navegador a proteção persistente.")

## Criar um jogo a partir de um template

![A tela inicial com a seção Começar com um template destacada.](/docs/figures/tela-inicial/templates.webp "Os templates, cada um com a sua pré-visualização e o botão Criar jogo.")

Cada template é uma cena pronta para um tipo de começo:

| Template | O que traz | Quando usar |
| --- | --- | --- |
| **Vazio** | Só o céu, a iluminação (sol e luz ambiente) e a câmera principal. | Quando você já sabe o que vai montar, ou vai importar um nível pronto. |
| **Baseplate** | Uma plataforma, objetos de referência de tamanhos conhecidos e um manequim na escala do personagem. | Para prototipar mecânicas e aprender o editor: é o template dos tutoriais. |
| **Oclusão** | A mesma plataforma com um estudo da luz do céu: casa fechada ao lado de um abrigo aberto, arcada de lojas, viela, viaduto, lajes a alturas crescentes e pedregulhos. | Para ver como a sombra fecha onde o céu entra menos, e para testar iluminação e materiais em interiores e vãos. |
| **Terreno** | Um terreno gerado proceduralmente e pintado com camadas, com água no nível do mar. | Para jogos ao ar livre e para experimentar as ferramentas de terreno. |

Clique em **Criar jogo** no cartão e o jogo abre no editor com um nome provisório; renomeie quando quiser pelo menu **Helix ▸ Renomear** ou pela tela inicial. O botão **Novo jogo**, no canto superior direito, oferece os mesmos templates num menu. O template usado pelo atalho `Ctrl+Alt+N` (Helix ▸ Novo jogo) é escolhido em **Configuração ▸ Projeto ▸ Template de "Novo"**.

![A tela inicial com o menu do botão Novo jogo aberto, listando Baseplate, Terreno e Vazio.](/docs/figures/tela-inicial/novo-jogo.webp "O menu Novo jogo: o mesmo que clicar em Criar jogo no cartão do template.")

## O cartão de um jogo

![A tela inicial com a seção Recentes destacada, mostrando o cartão de um jogo.](/docs/figures/tela-inicial/recentes.webp "Os jogos abertos recentemente aparecem na seção Início; todos ficam em Meus jogos.")

Cada jogo aparece como um cartão com a miniatura (o último quadro do viewport na última gravação), o nome e a data da última alteração. O menu do cartão oferece:

- **Abrir**, **Renomear** e **Duplicar**;
- **Baixar cópia**: gera o arquivo `.helix` do jogo;
- **Histórico**: os salvamentos automáticos restauráveis daquele jogo, com data e tamanho;
- **Transferir**: envia o jogo para outro navegador ou máquina pelo arquivo, mantendo o identificador;
- **Excluir**: move o jogo para a lixeira.

> [!NOTE]
> A miniatura é atualizada a cada gravação enquanto **Configuração ▸ Projeto ▸ Atualizar a miniatura ao salvar** estiver ligada. Desligue-a para manter uma capa escolhida a dedo.

![A seção Meus jogos, com a busca por nome e o cartão de cada jogo guardado.](/docs/figures/tela-inicial/meus-jogos.webp "Meus jogos lista tudo o que está guardado no navegador, com busca e ordenação.")

## Importar

![A tela inicial com o botão Importar jogo ou backup destacado na barra lateral.](/docs/figures/tela-inicial/importar.webp "Importar jogo ou backup… fica na barra lateral; o botão Importar no alto faz o mesmo.")

**Importar jogo ou backup…** aceita:

- um arquivo `.helix` (um jogo), que entra em **Meus jogos** com um identificador novo se já existir um igual;
- um arquivo de backup gerado por **Backup de todos os jogos**, que restaura todos os jogos contidos nele, perguntando antes o que fazer com os que já existem.

Arrastar os arquivos para qualquer lugar da tela inicial tem o mesmo efeito.

## Backup de todos os jogos

![A tela inicial com o botão Backup de todos os jogos destacado na barra lateral.](/docs/figures/tela-inicial/backup.webp "Backup de todos os jogos gera um único arquivo com a biblioteca inteira.")

Gera um único arquivo com todos os jogos ativos (os da lixeira ficam de fora), os ativos de cada um e os salvamentos automáticos mais recentes. É a forma recomendada de mover a sua biblioteca para outro computador ou de se proteger antes de limpar os dados do navegador.

> [!IMPORTANT]
> Os jogos vivem no armazenamento do navegador, por perfil e por origem. Limpar os dados do site, trocar de perfil ou usar outro navegador deixa a tela inicial vazia. Faça backups.

## Lixeira

![A seção Lixeira da tela inicial, vazia.](/docs/figures/tela-inicial/lixeira.webp "A Lixeira guarda os jogos excluídos até você restaurá-los ou apagá-los de vez.")

Excluir um jogo o move para a lixeira em vez de apagá-lo. Dali ele pode ser **restaurado** para Meus jogos ou **apagado de vez**, individualmente ou com **Esvaziar lixeira**. Enquanto está na lixeira, o jogo continua ocupando espaço e não entra nos backups.

## Quando o armazenamento não está disponível

Se o navegador bloqueia o IndexedDB (modo de privacidade reforçada, cota esgotada ou um perfil corrompido), a tela inicial abre numa versão reduzida: ela avisa o motivo e ainda permite abrir um arquivo `.helix` direto no editor, sem guardar nada. Tudo o que você fizer nesse modo precisa ser baixado antes de fechar a aba.
