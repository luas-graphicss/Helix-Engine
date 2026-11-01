import { commentLine, type ScriptLanguageId } from './script-languages';
export type NetTemplateId = 'netServer' | 'netClient';
function luaNet(template: NetTemplateId, tab: string, typed: boolean): string {
    const num = typed ? ': number' : '';
    if (template === 'netServer') {
        return [
            '-- Roda só no servidor: o jogador nunca recebe este arquivo.',
            'local net = helix.net',
            '',
            'local function onStart()',
            `${tab}net.state.set("placar", {})`,
            '',
            `${tab}net.onPlayerJoined(function(player)`,
            `${tab}${tab}local placar = net.state.get("placar")`,
            `${tab}${tab}placar[tostring(player.id)] = 0`,
            `${tab}${tab}net.state.set("placar", placar)`,
            `${tab}${tab}net.broadcast("anuncio", player.name .. " entrou")`,
            `${tab}end)`,
            '',
            `${tab}-- O cliente pede; o servidor confere e decide. perSecond limita pedidos por jogador.`,
            `${tab}net.rpc("pontuar", function(player, pontos${num})`,
            `${tab}${tab}if type(pontos) ~= "number" or pontos < 1 or pontos > 10 then`,
            `${tab}${tab}${tab}error("pontuação inválida")`,
            `${tab}${tab}end`,
            `${tab}${tab}local placar = net.state.get("placar")`,
            `${tab}${tab}local total = (placar[tostring(player.id)] or 0) + pontos`,
            `${tab}${tab}placar[tostring(player.id)] = total`,
            `${tab}${tab}net.state.set("placar", placar)`,
            `${tab}${tab}return total`,
            `${tab}end, { perSecond = 5 })`,
            'end',
            '',
            'return { onStart = onStart }',
            '',
        ].join('\n');
    }
    return [
        '-- Roda na máquina do jogador: só pede ao servidor e mostra o que ele replica.',
        'local net = helix.net',
        '',
        'local function onStart()',
        `${tab}net.state.onChanged("placar", function(placar)`,
        `${tab}${tab}local meu = net.localPlayer and placar[tostring(net.localPlayer.id)] or 0`,
        `${tab}${tab}print("placar: " .. tostring(meu))`,
        `${tab}end)`,
        '',
        `${tab}net.on("anuncio", function(texto)`,
        `${tab}${tab}print(texto)`,
        `${tab}end)`,
        '',
        `${tab}helix.input.onKeyDown(function(event)`,
        `${tab}${tab}if event.code == "Space" then`,
        `${tab}${tab}${tab}-- A chamada espera a resposta do servidor (a corrotina suspende até ela chegar).`,
        `${tab}${tab}${tab}local total = net.call("pontuar", 1)`,
        `${tab}${tab}${tab}print("o servidor confirmou: " .. tostring(total))`,
        `${tab}${tab}end`,
        `${tab}end)`,
        'end',
        '',
        'return { onStart = onStart }',
        '',
    ].join('\n');
}
function jsNet(template: NetTemplateId, tab: string, typed: boolean): string {
    const playerType = typed ? ': helix.NetPlayer' : '';
    const numType = typed ? ': number' : '';
    const recordType = typed ? ': Record<string, number>' : '';
    if (template === 'netServer') {
        return [
            'import helix from "helix"',
            '',
            '// Roda só no servidor: o jogador nunca recebe este arquivo.',
            'const { net } = helix',
            '',
            'export function onStart() {',
            `${tab}net.state.set("placar", {})`,
            '',
            `${tab}net.onPlayerJoined((player${playerType}) => {`,
            `${tab}${tab}const placar${recordType} = net.state.get("placar", {})`,
            `${tab}${tab}placar[player.id] = 0`,
            `${tab}${tab}net.state.set("placar", placar)`,
            `${tab}${tab}net.broadcast("anuncio", \`\${player.name} entrou\`)`,
            `${tab}})`,
            '',
            `${tab}// O cliente pede; o servidor confere e decide. perSecond limita pedidos por jogador.`,
            `${tab}net.rpc("pontuar", (player${playerType}, pontos${numType}) => {`,
            `${tab}${tab}if (typeof pontos !== "number" || pontos < 1 || pontos > 10) throw new Error("pontuação inválida")`,
            `${tab}${tab}const placar${recordType} = net.state.get("placar", {})`,
            `${tab}${tab}const total = (placar[player.id] ?? 0) + pontos`,
            `${tab}${tab}placar[player.id] = total`,
            `${tab}${tab}net.state.set("placar", placar)`,
            `${tab}${tab}return total`,
            `${tab}}, { perSecond: 5 })`,
            '}',
            '',
        ].join('\n');
    }
    return [
        'import helix from "helix"',
        '',
        '// Roda na máquina do jogador: só pede ao servidor e mostra o que ele replica.',
        'const { net } = helix',
        '',
        'export function onStart() {',
        `${tab}net.state.onChanged("placar", (placar${recordType}) => {`,
        `${tab}${tab}const meu = net.localPlayer ? (placar[net.localPlayer.id] ?? 0) : 0`,
        `${tab}${tab}console.log(\`placar: \${meu}\`)`,
        `${tab}})`,
        '',
        `${tab}net.on("anuncio", (texto${typed ? ': string' : ''}) => console.log(texto))`,
        '',
        `${tab}helix.input.onKeyDown(async (event) => {`,
        `${tab}${tab}if (event.code !== "Space") return`,
        `${tab}${tab}const total = await net.call("pontuar", 1)`,
        `${tab}${tab}console.log(\`o servidor confirmou: \${total}\`)`,
        `${tab}})`,
        '}',
        '',
    ].join('\n');
}
function pythonNet(template: NetTemplateId, tab: string): string {
    if (template === 'netServer') {
        return [
            '# Roda só no servidor: o jogador nunca recebe este arquivo.',
            'net = helix.net',
            '',
            '',
            'def on_start():',
            `${tab}net.state.set("placar", {})`,
            `${tab}net.onPlayerJoined(on_player_joined)`,
            `${tab}# O cliente pede; o servidor confere e decide. perSecond limita pedidos por jogador.`,
            `${tab}net.rpc("pontuar", pontuar, {"perSecond": 5})`,
            '',
            '',
            'def on_player_joined(player):',
            `${tab}placar = net.state.get("placar", {})`,
            `${tab}placar[str(player.id)] = 0`,
            `${tab}net.state.set("placar", placar)`,
            `${tab}net.broadcast("anuncio", f"{player.name} entrou")`,
            '',
            '',
            'def pontuar(player, pontos):',
            `${tab}if not isinstance(pontos, (int, float)) or pontos < 1 or pontos > 10:`,
            `${tab}${tab}raise ValueError("pontuação inválida")`,
            `${tab}placar = net.state.get("placar", {})`,
            `${tab}total = placar.get(str(player.id), 0) + pontos`,
            `${tab}placar[str(player.id)] = total`,
            `${tab}net.state.set("placar", placar)`,
            `${tab}return total`,
            '',
        ].join('\n');
    }
    return [
        '# Roda na máquina do jogador: só pede ao servidor e mostra o que ele replica.',
        'net = helix.net',
        '',
        '',
        'def on_start():',
        `${tab}net.state.onChanged("placar", on_placar)`,
        `${tab}net.on("anuncio", print)`,
        `${tab}helix.input.onKeyDown(on_key_down)`,
        '',
        '',
        'def on_placar(placar):',
        `${tab}meu = placar.get(str(net.localPlayer.id), 0) if net.localPlayer else 0`,
        `${tab}print(f"placar: {meu}")`,
        '',
        '',
        'async def on_key_down(event):',
        `${tab}if event.code == "Space":`,
        `${tab}${tab}total = await net.call("pontuar", 1)`,
        `${tab}${tab}print(f"o servidor confirmou: {total}")`,
        '',
    ].join('\n');
}
function phpNet(template: NetTemplateId, tab: string): string {
    if (template === 'netServer') {
        return [
            '// Roda só no servidor: o jogador nunca recebe este arquivo.',
            '$net = $helix->net;',
            '',
            'return [',
            `${tab}'onStart' => function () use ($net): void {`,
            `${tab}${tab}$net->state->set('placar', []);`,
            '',
            `${tab}${tab}$net->onPlayerJoined(function ($player) use ($net): void {`,
            `${tab}${tab}${tab}$placar = $net->state->get('placar', []);`,
            `${tab}${tab}${tab}$placar[(string) $player->id] = 0;`,
            `${tab}${tab}${tab}$net->state->set('placar', $placar);`,
            `${tab}${tab}${tab}$net->broadcast('anuncio', "{$player->name} entrou");`,
            `${tab}${tab}});`,
            '',
            `${tab}${tab}// O cliente pede; o servidor confere e decide. perSecond limita pedidos por jogador.`,
            `${tab}${tab}$net->rpc('pontuar', function ($player, $pontos) use ($net): int {`,
            `${tab}${tab}${tab}if (!is_numeric($pontos) || $pontos < 1 || $pontos > 10) {`,
            `${tab}${tab}${tab}${tab}throw new \\InvalidArgumentException('pontuação inválida');`,
            `${tab}${tab}${tab}}`,
            `${tab}${tab}${tab}$placar = $net->state->get('placar', []);`,
            `${tab}${tab}${tab}$total = ($placar[(string) $player->id] ?? 0) + (int) $pontos;`,
            `${tab}${tab}${tab}$placar[(string) $player->id] = $total;`,
            `${tab}${tab}${tab}$net->state->set('placar', $placar);`,
            `${tab}${tab}${tab}return $total;`,
            `${tab}${tab}}, ['perSecond' => 5]);`,
            `${tab}},`,
            '];',
            '',
        ].join('\n');
    }
    return [
        '// Roda na máquina do jogador: só pede ao servidor e mostra o que ele replica.',
        '$net = $helix->net;',
        '',
        'return [',
        `${tab}'onStart' => function () use ($helix, $net): void {`,
        `${tab}${tab}$net->state->onChanged('placar', function ($placar) use ($net): void {`,
        `${tab}${tab}${tab}$meu = $net->localPlayer ? ($placar[(string) $net->localPlayer->id] ?? 0) : 0;`,
        `${tab}${tab}${tab}echo "placar: {$meu}\\n";`,
        `${tab}${tab}});`,
        '',
        `${tab}${tab}$net->on('anuncio', fn ($texto) => print("{$texto}\\n"));`,
        '',
        `${tab}${tab}// Um callback gerador pode esperar o servidor com yield.`,
        `${tab}${tab}$helix->input->onKeyDown(function ($event) use ($net) {`,
        `${tab}${tab}${tab}if ($event->code === 'Space') {`,
        `${tab}${tab}${tab}${tab}$total = yield $net->call('pontuar', 1);`,
        `${tab}${tab}${tab}${tab}echo "o servidor confirmou: {$total}\\n";`,
        `${tab}${tab}${tab}}`,
        `${tab}${tab}});`,
        `${tab}},`,
        '];',
        '',
    ].join('\n');
}
function gdscriptNet(template: NetTemplateId, tab: string): string {
    if (template === 'netServer') {
        return [
            'extends Node',
            '',
            '# Roda só no servidor: o jogador nunca recebe este arquivo.',
            'var net = helix.net',
            '',
            '',
            'func _ready() -> void:',
            `${tab}net.state.set("placar", {})`,
            `${tab}net.onPlayerJoined(_on_player_joined)`,
            `${tab}# O cliente pede; o servidor confere e decide. perSecond limita pedidos por jogador.`,
            `${tab}net.rpc("pontuar", _pontuar, { "perSecond": 5 })`,
            '',
            '',
            'func _on_player_joined(player) -> void:',
            `${tab}var placar: Dictionary = net.state.get("placar", {})`,
            `${tab}placar[str(player.id)] = 0`,
            `${tab}net.state.set("placar", placar)`,
            `${tab}net.broadcast("anuncio", player.name + " entrou")`,
            '',
            '',
            'func _pontuar(player, pontos) -> int:',
            `${tab}if typeof(pontos) != TYPE_INT and typeof(pontos) != TYPE_FLOAT or pontos < 1 or pontos > 10:`,
            `${tab}${tab}push_error("pontuação inválida")`,
            `${tab}${tab}return 0`,
            `${tab}var placar: Dictionary = net.state.get("placar", {})`,
            `${tab}var total: int = placar.get(str(player.id), 0) + int(pontos)`,
            `${tab}placar[str(player.id)] = total`,
            `${tab}net.state.set("placar", placar)`,
            `${tab}return total`,
            '',
        ].join('\n');
    }
    return [
        'extends Node',
        '',
        '# Roda na máquina do jogador: só pede ao servidor e mostra o que ele replica.',
        'var net = helix.net',
        '',
        '',
        'func _ready() -> void:',
        `${tab}net.state.onChanged("placar", _on_placar)`,
        `${tab}net.on("anuncio", func(texto): print(texto))`,
        `${tab}helix.input.onKeyDown(_on_key_down)`,
        '',
        '',
        'func _on_placar(placar: Dictionary) -> void:',
        `${tab}var meu = placar.get(str(net.localPlayer.id), 0) if net.localPlayer else 0`,
        `${tab}print("placar: ", meu)`,
        '',
        '',
        'func _on_key_down(event) -> void:',
        `${tab}if event.code == "Space":`,
        `${tab}${tab}var total = await net.call("pontuar", 1)`,
        `${tab}${tab}print("o servidor confirmou: ", total)`,
        '',
    ].join('\n');
}
function rubyNet(template: NetTemplateId, tab: string): string {
    if (template === 'netServer') {
        return [
            '# Roda só no servidor: o jogador nunca recebe este arquivo.',
            'def on_start',
            `${tab}net = helix.net`,
            `${tab}net.state.set("placar", {})`,
            '',
            `${tab}net.onPlayerJoined do |player|`,
            `${tab}${tab}placar = net.state.get("placar", {})`,
            `${tab}${tab}placar[player.id.to_s] = 0`,
            `${tab}${tab}net.state.set("placar", placar)`,
            `${tab}${tab}net.broadcast("anuncio", "#{player.name} entrou")`,
            `${tab}end`,
            '',
            `${tab}# O cliente pede; o servidor confere e decide. perSecond limita pedidos por jogador.`,
            `${tab}net.rpc("pontuar", { perSecond: 5 }) do |player, pontos|`,
            `${tab}${tab}raise ArgumentError, "pontuação inválida" unless pontos.is_a?(Numeric) && pontos.between?(1, 10)`,
            `${tab}${tab}placar = net.state.get("placar", {})`,
            `${tab}${tab}total = placar.fetch(player.id.to_s, 0) + pontos`,
            `${tab}${tab}placar[player.id.to_s] = total`,
            `${tab}${tab}net.state.set("placar", placar)`,
            `${tab}${tab}total`,
            `${tab}end`,
            'end',
            '',
        ].join('\n');
    }
    return [
        '# Roda na máquina do jogador: só pede ao servidor e mostra o que ele replica.',
        'def on_start',
        `${tab}net = helix.net`,
        `${tab}net.state.onChanged("placar") do |placar|`,
        `${tab}${tab}meu = net.localPlayer ? placar.fetch(net.localPlayer.id.to_s, 0) : 0`,
        `${tab}${tab}puts "placar: #{meu}"`,
        `${tab}end`,
        '',
        `${tab}net.on("anuncio") { |texto| puts texto }`,
        '',
        `${tab}helix.input.onKeyDown do |event|`,
        `${tab}${tab}next unless event.code == "Space"`,
        `${tab}${tab}# A chamada espera a resposta do servidor (a fibra suspende até ela chegar).`,
        `${tab}${tab}total = net.call("pontuar", 1)`,
        `${tab}${tab}puts "o servidor confirmou: #{total}"`,
        `${tab}end`,
        'end',
        '',
    ].join('\n');
}
function csharpNet(template: NetTemplateId, name: string, tab: string): string {
    if (template === 'netServer') {
        return [
            'using Helix;',
            '',
            '// Roda só no servidor: o jogador nunca recebe este arquivo.',
            `public class ${name} : ActorScript`,
            '{',
            `${tab}public override void OnStart()`,
            `${tab}{`,
            `${tab}${tab}var net = Helix.Net;`,
            `${tab}${tab}net.State.Set("placar", new Dictionary<string, int>());`,
            '',
            `${tab}${tab}net.OnPlayerJoined((dynamic player) =>`,
            `${tab}${tab}{`,
            `${tab}${tab}${tab}var placar = net.State.Get("placar");`,
            `${tab}${tab}${tab}placar[player.Id.ToString()] = 0;`,
            `${tab}${tab}${tab}net.State.Set("placar", placar);`,
            `${tab}${tab}${tab}net.Broadcast("anuncio", $"{player.Name} entrou");`,
            `${tab}${tab}});`,
            '',
            `${tab}${tab}// O cliente pede; o servidor confere e decide. PerSecond limita pedidos por jogador.`,
            `${tab}${tab}net.Rpc("pontuar", (dynamic player, dynamic pontos) =>`,
            `${tab}${tab}{`,
            `${tab}${tab}${tab}if (pontos < 1 || pontos > 10) throw new ArgumentException("pontuação inválida");`,
            `${tab}${tab}${tab}var placar = net.State.Get("placar");`,
            `${tab}${tab}${tab}var total = (placar[player.Id.ToString()] ?? 0) + pontos;`,
            `${tab}${tab}${tab}placar[player.Id.ToString()] = total;`,
            `${tab}${tab}${tab}net.State.Set("placar", placar);`,
            `${tab}${tab}${tab}return total;`,
            `${tab}${tab}}, new { PerSecond = 5 });`,
            `${tab}}`,
            '}',
            '',
        ].join('\n');
    }
    return [
        'using Helix;',
        '',
        '// Roda na máquina do jogador: só pede ao servidor e mostra o que ele replica.',
        `public class ${name} : ActorScript`,
        '{',
        `${tab}public override void OnStart()`,
        `${tab}{`,
        `${tab}${tab}var net = Helix.Net;`,
        `${tab}${tab}net.State.OnChanged("placar", (dynamic placar) =>`,
        `${tab}${tab}{`,
        `${tab}${tab}${tab}var meu = net.LocalPlayer != null ? (placar[net.LocalPlayer.Id.ToString()] ?? 0) : 0;`,
        `${tab}${tab}${tab}Console.WriteLine($"placar: {meu}");`,
        `${tab}${tab}});`,
        '',
        `${tab}${tab}net.On("anuncio", (dynamic texto) => Console.WriteLine(texto));`,
        '',
        `${tab}${tab}Helix.Input.OnKeyDown(async (dynamic evt) =>`,
        `${tab}${tab}{`,
        `${tab}${tab}${tab}if (evt.Code != "Space") return;`,
        `${tab}${tab}${tab}var total = await net.Call("pontuar", 1);`,
        `${tab}${tab}${tab}Console.WriteLine($"o servidor confirmou: {total}");`,
        `${tab}${tab}});`,
        `${tab}}`,
        '}',
        '',
    ].join('\n');
}
function commentedNet(language: ScriptLanguageId, template: NetTemplateId): string {
    const lines = template === 'netServer'
        ? [
            'Roda só no servidor: o jogador nunca recebe este arquivo.',
            '',
            'Roteiro de um servidor autoritativo com a API helix.net:',
            '  1. helix.net.state.set("placar", {}) no onStart: o estado que os clientes espelham.',
            '  2. helix.net.onPlayerJoined(player => ...) para registrar quem entrou e avisar com helix.net.broadcast.',
            '  3. helix.net.rpc("pontuar", (player, pontos) => ..., { perSecond: 5 }): o cliente pede, o servidor valida e decide.',
            '  4. helix.net.replicate(ator, ["transform.position"]) para os clientes receberem a pose a cada tick.',
            '',
            'Nada do que o cliente envia é confiável: confira tipos e limites antes de mudar o estado.',
        ]
        : [
            'Roda na máquina do jogador: só pede ao servidor e mostra o que ele replica.',
            '',
            'Roteiro de um cliente ligado ao servidor autoritativo:',
            '  1. helix.net.state.onChanged("placar", placar => ...) desenha o que o servidor publicou.',
            '  2. helix.net.on("anuncio", texto => ...) ouve eventos enviados por send/broadcast.',
            '  3. helix.net.call("pontuar", 1) pede ao servidor e espera a resposta (uma promessa).',
            '  4. helix.net.onReplicated((id, campos) => ...) recebe a pose dos atores replicados.',
            '',
            'O cliente nunca muda helix.net.state: quem decide é o servidor.',
        ];
    return `${lines.map((line) => (line ? commentLine(language, line) : commentLine(language, ''))).join('\n')}\n`;
}
export function netTemplateBody(language: ScriptLanguageId, template: NetTemplateId, name: string, tab: string): string {
    switch (language) {
        case 'luau':
            return luaNet(template, tab, true);
        case 'lua':
            return luaNet(template, tab, false);
        case 'javascript':
            return jsNet(template, tab, false);
        case 'typescript':
            return jsNet(template, tab, true);
        case 'python':
            return pythonNet(template, tab);
        case 'php':
            return phpNet(template, tab);
        case 'gdscript':
            return gdscriptNet(template, tab);
        case 'ruby':
            return rubyNet(template, tab);
        case 'csharp':
            return csharpNet(template, name, tab);
        default:
            return commentedNet(language, template);
    }
}
