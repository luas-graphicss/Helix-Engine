import { netTemplateBody, type NetTemplateId } from './net-templates';
import { createScriptDocument, type ScriptDocument, type ScriptRunContext } from './script-document';
import { commentLine, indentUnit, scriptLanguage, type ScriptLanguageFamily, type ScriptLanguageId } from './script-languages';
export type ScriptTemplateId = 'blank' | 'actor' | 'module' | 'game' | 'ui' | 'shader' | NetTemplateId;
export interface ScriptTemplate {
    readonly id: ScriptTemplateId;
    readonly label: string;
    readonly description: string;
    readonly families: readonly ScriptLanguageFamily[];
    readonly runContext: ScriptRunContext;
    readonly defaultName: string;
}
export const SCRIPT_TEMPLATES: readonly ScriptTemplate[] = [
    { id: 'blank', label: 'Em branco', description: 'Só um cabeçalho com o nome do script; o resto é seu.', families: [], runContext: 'shared', defaultName: 'Script' },
    { id: 'actor', label: 'Script de ator', description: 'Ciclo de vida de um ator: ao iniciar, a cada quadro e ao destruir. Anexe-o a um ator da cena.', families: ['scripting', 'systems'], runContext: 'shared', defaultName: 'Ator' },
    { id: 'module', label: 'Módulo', description: 'Funções e dados reutilizáveis, importados por outros scripts.', families: ['scripting', 'systems'], runContext: 'shared', defaultName: 'Modulo' },
    { id: 'game', label: 'Script do jogo', description: 'O ponto de entrada: começa a partida, liga as regras e os sistemas. Marcado como script de entrada.', families: ['scripting', 'systems'], runContext: 'server', defaultName: 'Jogo' },
    { id: 'netServer', label: 'Regras no servidor', description: 'Só no servidor: recebe pedidos dos jogadores com helix.net.rpc, valida e publica o placar em helix.net.state. O jogador nunca recebe este código.', families: ['scripting', 'systems'], runContext: 'server', defaultName: 'Regras' },
    { id: 'netClient', label: 'Cliente do servidor', description: 'Só no jogador: pede ao servidor com helix.net.call e desenha o que ele replica. Par do modelo "Regras no servidor".', families: ['scripting', 'systems'], runContext: 'client', defaultName: 'Cliente' },
    { id: 'ui', label: 'Tela em código', description: 'Uma tela ou HUD escrita à mão, para quem prefere marcação ao designer visual.', families: ['web'], runContext: 'client', defaultName: 'Tela' },
    { id: 'shader', label: 'Shader', description: 'Um programa de fragmento com as entradas que a engine fornece.', families: ['shader'], runContext: 'client', defaultName: 'Shader' },
];
export function findScriptTemplate(id: string): ScriptTemplate {
    return SCRIPT_TEMPLATES.find((template) => template.id === id) ?? SCRIPT_TEMPLATES[0];
}
export function scriptTemplatesFor(language: ScriptLanguageId): ScriptTemplate[] {
    const { family } = scriptLanguage(language);
    return SCRIPT_TEMPLATES.filter((template) => template.families.length === 0 || template.families.includes(family));
}
function header(language: ScriptLanguageId, name: string, template: ScriptTemplate): string {
    const lines = [commentLine(language, `${name} · ${template.label}`), commentLine(language, 'Helix Engine')].filter(Boolean);
    const open = language === 'php' ? '<?php\n' : '';
    return lines.length > 0 ? `${open}${lines.join('\n')}\n\n` : open;
}
function phpBody(template: ScriptTemplateId, name: string, tab: string): string {
    switch (template) {
        case 'actor':
            return [
                '// Cada ator com este script recebe uma instância própria; as propriedades são o estado daquele ator.',
                `final class ${name} extends \\Helix\\Script`,
                '{',
                `${tab}public float $velocidade = 1.0;`,
                `${tab}public int $quadros = 0;`,
                '',
                `${tab}public function onStart(): void`,
                `${tab}{`,
                `${tab}${tab}echo "{$this->self->name} acordou\\n";`,
                `${tab}}`,
                '',
                `${tab}public function onUpdate(float $dt): void`,
                `${tab}{`,
                `${tab}${tab}$this->quadros++; // roda a cada quadro`,
                `${tab}}`,
                '',
                `${tab}public function onDestroy(): void`,
                `${tab}{`,
                `${tab}${tab}echo "tchau depois de {$this->quadros} quadros\\n";`,
                `${tab}}`,
                '}',
                '',
            ].join('\n');
        case 'module':
            return ['// As funções do arquivo são as exportações: helix_require(\'Util\')[\'hello\'](\'mundo\') de qualquer linguagem.', 'function hello(string $who): string', '{', `${tab}return "Olá, $who";`, '}', ''].join('\n');
        case 'game':
            return [
                '// $helix é o objeto da engine neste arquivo; hooks de espera podem ser geradores (yield $helix->task->wait(1)).',
                'return [',
                `${tab}'onStart' => function () use ($helix): void {`,
                `${tab}${tab}echo "Jogo iniciado com {$helix->scene->count()} atores\\n";`,
                `${tab}${tab}$helix->input->onKeyDown(function ($event) use ($helix): void {`,
                `${tab}${tab}${tab}if ($event->code === 'KeyR') {`,
                `${tab}${tab}${tab}${tab}$helix->play->restart();`,
                `${tab}${tab}${tab}}`,
                `${tab}${tab}});`,
                `${tab}},`,
                '];',
                '',
            ].join('\n');
        default:
            return '';
    }
}
function luaBody(template: ScriptTemplateId, name: string, tab: string, typed: boolean): string {
    const delta = typed ? 'dt: number' : 'dt';
    const who = typed ? 'who: string' : 'who';
    const ret = typed ? ': string' : '';
    switch (template) {
        case 'actor':
            return [
                'local actor = helix.self',
                '',
                'local function onStart()',
                `${tab}print(actor.name .. " acordou")`,
                'end',
                '',
                `local function onUpdate(${delta})`,
                `${tab}-- roda a cada quadro`,
                'end',
                '',
                'local function onDestroy()',
                'end',
                '',
                'return { onStart = onStart, onUpdate = onUpdate, onDestroy = onDestroy }',
                '',
            ].join('\n');
        case 'module':
            return [`local ${name} = {}`, '', `function ${name}.hello(${who})${ret}`, `${tab}return "Olá, " .. who`, 'end', '', `return ${name}`, ''].join('\n');
        case 'game':
            return [
                'local function onStart()',
                `${tab}print("Jogo iniciado com " .. helix.scene.count() .. " atores")`,
                `${tab}helix.input.onKeyDown(function(event)`,
                `${tab}${tab}if event.code == "KeyR" then helix.play.restart() end`,
                `${tab}end)`,
                'end',
                '',
                'return { onStart = onStart }',
                '',
            ].join('\n');
        default:
            return '';
    }
}
function jsBody(template: ScriptTemplateId, name: string, tab: string, typed: boolean): string {
    const delta = typed ? 'deltaSeconds: number' : 'deltaSeconds';
    const who = typed ? 'who: string' : 'who';
    const ret = typed ? ': string' : '';
    switch (template) {
        case 'actor':
            return [
                `export default class ${name} {`,
                `${tab}onStart() {`,
                `${tab}${tab}console.log(\`\${this.actor.name} acordou\`)`,
                `${tab}}`,
                '',
                `${tab}onUpdate(${delta}) {`,
                `${tab}${tab}                     `,
                `${tab}}`,
                '',
                `${tab}onDestroy() {}`,
                '}',
                '',
            ].join('\n');
        case 'module':
            return [`export function hello(${who})${ret} {`, `${tab}return \`Olá, \${who}\``, '}', ''].join('\n');
        case 'game':
            return [
                'import helix from "helix"',
                '',
                'export function onStart() {',
                `${tab}console.log(\`Jogo iniciado com \${helix.scene.count()} atores\`)`,
                `${tab}helix.input.onKeyDown((event) => {`,
                `${tab}${tab}if (event.code === "KeyR") helix.play.restart()`,
                `${tab}})`,
                '}',
                '',
            ].join('\n');
        default:
            return '';
    }
}
function gdscriptBody(template: ScriptTemplateId, name: string, tab: string): string {
    switch (template) {
        case 'actor':
            return [
                'extends Node3D',
                '',
                '                                                                                                     ',
                'var velocidade: float = 1.0',
                'var quadros: int = 0',
                '',
                '',
                'func _ready() -> void:',
                `${tab}print(name, " acordou")`,
                '',
                '',
                'func _process(delta: float) -> void:',
                `${tab}quadros += 1                     `,
                '',
                '',
                'func _exit_tree() -> void:',
                `${tab}print("tchau depois de ", quadros, " quadros")`,
                '',
            ].join('\n');
        case 'module':
            return [
                `class_name ${name}`,
                'extends RefCounted',
                '',
                `                                                                                                                         `,
                'static func hello(who: String) -> String:',
                `${tab}return "Olá, " + who`,
                '',
            ].join('\n');
        case 'game':
            return [
                'extends Node',
                '',
                '                                                                                            ',
                'func _ready() -> void:',
                `${tab}print("Jogo iniciado com ", helix.scene.count(), " atores")`,
                `${tab}helix.input.onKeyDown(_on_key_down)`,
                '',
                '',
                'func _on_key_down(event) -> void:',
                `${tab}if event.code == "KeyR":`,
                `${tab}${tab}helix.play.restart()`,
                '',
            ].join('\n');
        default:
            return '';
    }
}
function csharpBody(template: ScriptTemplateId, name: string, tab: string): string {
    switch (template) {
        case 'actor':
            return [
                'using Helix;',
                '',
                '// Cada ator com este script recebe uma instância própria; os campos e propriedades são o estado daquele ator.',
                `public class ${name} : ActorScript`,
                '{',
                `${tab}public float Velocidade { get; set; } = 1f;`,
                `${tab}private int quadros;`,
                '',
                `${tab}public override void OnStart()`,
                `${tab}{`,
                `${tab}${tab}Console.WriteLine($"{Self.Name} acordou");`,
                `${tab}}`,
                '',
                `${tab}public override void OnUpdate(float deltaSeconds)`,
                `${tab}{`,
                `${tab}${tab}quadros++; // roda a cada quadro`,
                `${tab}}`,
                '',
                `${tab}public override void OnDestroy()`,
                `${tab}{`,
                `${tab}${tab}Console.WriteLine($"tchau depois de {quadros} quadros");`,
                `${tab}}`,
                '}',
                '',
            ].join('\n');
        case 'module':
            return [
                `// Outros scripts C# usam a classe pelo nome (${name}.Hello("mundo")); as demais linguagens, por require("${name}").`,
                `public static class ${name}`,
                '{',
                `${tab}public static string Hello(string who) => $"Olá, {who}";`,
                '}',
                '',
            ].join('\n');
        case 'game':
            return [
                'using Helix;',
                '',
                '// Script de entrada: começa a partida e liga as regras do jogo. `Helix` é a API da engine.',
                `public class ${name} : ActorScript`,
                '{',
                `${tab}public override void OnStart()`,
                `${tab}{`,
                `${tab}${tab}Console.WriteLine($"Jogo iniciado com {Helix.Scene.Count()} atores");`,
                `${tab}${tab}Helix.Input.OnKeyDown(OnKeyDown);`,
                `${tab}}`,
                '',
                `${tab}private void OnKeyDown(dynamic evt)`,
                `${tab}{`,
                `${tab}${tab}if (evt.Code == "KeyR") Helix.Play.Restart();`,
                `${tab}}`,
                '}',
                '',
            ].join('\n');
        default:
            return '';
    }
}
