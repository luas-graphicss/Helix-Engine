# Helix Engine

[Read in English](README.md)

A Helix é uma engine 3D para a web com editor próprio, escrita em TypeScript em cima do Next.js. A ideia é ter algo parecido com um editor de jogos de desktop, só que abrindo numa aba do navegador. Tem um viewport com gizmos de transformação, a hierarquia da cena, um inspetor de propriedades, painel de assets, console e painéis de ambiente, física e desempenho.

Quase tudo dentro da pasta engine foi escrito do zero, sem biblioteca 3D pronta. O renderizador fala direto com o WebGL e tem shaders próprios, sombras, céu, nível de detalhe, culling e batching. Tem um módulo de física com corpos, detecção de colisão e solver, e um sistema de terreno dividido em chunks com geração procedural, materiais, vegetação e pincéis para esculpir e pintar o chão. O editor importa modelos em glTF, FBX, OBJ e STL, guarda o histórico para desfazer e refazer e tem um modo de teste para rodar a cena sem sair do editor.

Pelo menu de adicionar dá para colocar primitivas, terreno, luz direcional, luz ambiente, grupos vazios e câmeras.

## Como usar

Você precisa do Node.js e do pnpm. Clone o repositório, rode pnpm install e depois pnpm dev. O editor abre na página inicial, em localhost na porta 3000. Para gerar a versão de produção, rode pnpm build e depois pnpm start.

## Tempo de desenvolvimento

Até agora a Helix levou três dias de trabalho. Ela ainda está em desenvolvimento, então falta bastante coisa e muita coisa pode mudar de um commit para outro.

## Licença

GNU General Public License versão 3. O texto completo está no arquivo LICENSE.
