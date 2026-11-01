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
function pythonBody(template: ScriptTemplateId, name: string, tab: string): string {
    switch (template) {
        case 'actor':
            return [`class ${name}:`, `${tab}def on_start(self):`, `${tab}${tab}print(f"{self.actor.name} acordou")`, '', `${tab}def on_update(self, dt: float):`, `${tab}${tab}pass                      `, '', `${tab}def on_destroy(self):`, `${tab}${tab}pass`, ''].join('\n');
        case 'module':
            return ['def hello(who: str) -> str:', `${tab}return f"Olá, {who}"`, ''].join('\n');
        case 'game':
            return [
                'def on_start():',
                `${tab}print(f"Jogo iniciado com {helix.scene.count()} atores")`,
                `${tab}helix.input.onKeyDown(on_key_down)`,
                '',
                '',
                'def on_key_down(event):',
                `${tab}if event.code == "KeyR":`,
                `${tab}${tab}helix.play.restart()`,
                '',
            ].join('\n');
        default:
            return '';
    }
}
function rubyBody(template: ScriptTemplateId, name: string, tab: string): string {
    switch (template) {
        case 'actor':
            return [`class ${name}`, `${tab}def on_start`, `${tab}${tab}puts "#{actor.name} acordou"`, `${tab}end`, '', `${tab}def on_update(dt)`, `${tab}${tab}# roda a cada quadro`, `${tab}end`, '', `${tab}def on_destroy`, `${tab}end`, 'end', ''].join('\n');
        case 'module':
            return [`module ${name}`, `${tab}def self.hello(who)`, `${tab}${tab}"Olá, #{who}"`, `${tab}end`, 'end', ''].join('\n');
        case 'game':
            return [
                'def on_start',
                `${tab}puts "Jogo iniciado com #{helix.scene.count} atores"`,
                `${tab}helix.input.onKeyDown(method(:on_key_down))`,
                'end',
                '',
                'def on_key_down(event)',
                `${tab}helix.play.restart if event.code == "KeyR"`,
                'end',
                '',
            ].join('\n');
        default:
            return '';
    }
}
function cBody(template: ScriptTemplateId, name: string, tab: string): string {
    switch (template) {
        case 'module':
            return [
                '#include <stdio.h>',
                '#include <stdlib.h>',
                '#include "helix.h"',
                '',
                `                                                                                                 `,
                'HX_EXPORT double soma(double a, double b) {',
                `${tab}return a + b;`,
                '}',
                '',
                'HX_EXPORT hx_ref saudacao(hx_ref quem) {',
                `${tab}char* nome = hx_string_dup(quem);`,
                `${tab}char texto[128];`,
                `${tab}snprintf(texto, sizeof texto, "Olá, %s", nome);`,
                `${tab}free(nome);`,
                `${tab}return hx_string(texto);`,
                '}',
                '',
            ].join('\n');
        case 'game':
            return [
                '#include <stdio.h>',
                '#include "helix.h"',
                '',
                '                                                                    ',
                'HX_HOOK void onStart(void) {',
                `${tab}hx_print("${name}: a partida começou");`,
                `${tab}hx_ref jogador = hx_invoke1(hx_get(hx_root(), "scene"), "find", hx_string("Player"));`,
                `${tab}if (hx_is_none(jogador)) hx_warn("não há um ator chamado Player na cena");`,
                '}',
                '',
                'HX_HOOK void onUpdate(double dt) {',
                `${tab}(void)dt;`,
                '}',
                '',
            ].join('\n');
        default:
            return [
                '#include <stdio.h>',
                '#include <stdlib.h>',
                '#include "helix.h"',
                '',
                '                                                                                              ',
                'static double velocidade = 1.0;',
                '',
                'HX_HOOK void onStart(void) {',
                `${tab}char* nome = hx_get_string(hx_self(), "name");`,
                `${tab}printf("%s acordou\\n", nome);`,
                `${tab}free(nome);`,
                '}',
                '',
                'HX_HOOK void onUpdate(double dt) {',
                `${tab}hx_ref posicao = hx_path("self.transform.position");`,
                `${tab}hx_set_number(posicao, "x", hx_get_number(posicao, "x") + velocidade * dt);`,
                '}',
                '',
                'HX_HOOK void onDestroy(void) {',
                `${tab}hx_print("tchau");`,
                '}',
                '',
            ].join('\n');
    }
}
function cppBody(template: ScriptTemplateId, name: string, tab: string): string {
    switch (template) {
        case 'module':
            return [
                '#include <string>',
                '#include "helix.hpp"',
                '',
                `                                                                                              `,
                'HX_EXPORT double soma(double a, double b) {',
                `${tab}return a + b;`,
                '}',
                '',
                'HX_EXPORT hx_ref saudacao(hx_ref quem) {',
                `${tab}helix::Value nome = helix::Value::adopt(hx_retain(quem));`,
                `${tab}                                                                                             `,
                `${tab}return helix::Value("Olá, " + nome.str()).ref();`,
                '}',
                '',
            ].join('\n');
        case 'game':
            return [
                '#include "helix.hpp"',
                '',
                'using namespace helix;',
                '',
                '                                                                 ',
                'HX_HOOK void onStart() {',
                `${tab}print("${name}: a partida começou");`,
                `${tab}Value jogador = root()["scene"].call("find", "Player");`,
                `${tab}if (jogador.isNone()) warn("não há um ator chamado Player na cena");`,
                '}',
                '',
                'HX_HOOK void onUpdate(double dt) {',
                `${tab}(void)dt;`,
                '}',
                '',
            ].join('\n');
        default:
            return [
                '#include <string>',
                '#include "helix.hpp"',
                '',
                'using namespace helix;',
                '',
                `struct ${name} {`,
                `${tab}double velocidade = 1.0;`,
                `${tab}int quadros = 0;`,
                '};',
                '',
                '                                                                                   ',
                `static ${name} estado;`,
                '',
                'HX_HOOK void onStart() {',
                `${tab}print(self()["name"].str() + " acordou");`,
                '}',
                '',
                'HX_HOOK void onUpdate(double dt) {',
                `${tab}estado.quadros++;`,
                `${tab}Value posicao = self().path("transform.position");`,
                `${tab}posicao.set("x", posicao["x"].number() + estado.velocidade * dt);`,
                '}',
                '',
                'HX_HOOK void onDestroy() {',
                `${tab}print("tchau depois de " + std::to_string(estado.quadros) + " quadros");`,
                '}',
                '',
            ].join('\n');
    }
}
function rustBody(template: ScriptTemplateId, name: string, tab: string): string {
    switch (template) {
        case 'module':
            return [
                'use helix::prelude::*;',
                '',
                '                                                                               ' + name + '").',
                'helix::exports! {',
                `${tab}pub fn hello(who: String) -> String {`,
                `${tab}${tab}format!("Olá, {who}")`,
                `${tab}}`,
                '}',
                '',
            ].join('\n');
        case 'game':
            return [
                'use helix::prelude::*;',
                '',
                '                                                                 ',
                'helix::hooks! {',
                `${tab}fn on_start() {`,
                `${tab}${tab}let scene = root().get("scene");`,
                `${tab}${tab}helix::print!("${name}: a partida começou com {} atores", scene.invoke("count", ()).number());`,
                `${tab}${tab}let input = root().get("input");`,
                `${tab}${tab}input.invoke("onKeyDown", Value::function(|args| {`,
                `${tab}${tab}${tab}if args[0].get("code").to_string() == "KeyR" {`,
                `${tab}${tab}${tab}${tab}root().get("play").invoke("restart", ());`,
                `${tab}${tab}${tab}}`,
                `${tab}${tab}}));`,
                `${tab}}`,
                '',
                `${tab}fn on_update(dt: f64) {`,
                `${tab}${tab}let _ = dt;`,
                `${tab}}`,
                '}',
                '',
            ].join('\n');
        default:
            return [
                'use helix::prelude::*;',
                'use std::cell::Cell;',
                '',
                '                                                                                   ',
                'thread_local! {',
                `${tab}static QUADROS: Cell<u32> = const { Cell::new(0) };`,
                '}',
                '',
                'const VELOCIDADE: f64 = 1.0;',
                '',
                'helix::hooks! {',
                `${tab}fn on_start() {`,
                `${tab}${tab}helix::print!("{} acordou", actor().get("name"));`,
                `${tab}}`,
                '',
                `${tab}fn on_update(dt: f64) {`,
                `${tab}${tab}QUADROS.with(|quadros| quadros.set(quadros.get() + 1));`,
                `${tab}${tab}let posicao = actor().path("transform.position");`,
                `${tab}${tab}posicao.set("x", posicao.get("x").number() + VELOCIDADE * dt);`,
                `${tab}}`,
                '',
                `${tab}fn on_destroy() {`,
                `${tab}${tab}helix::print!("tchau depois de {} quadros", QUADROS.with(|quadros| quadros.get()));`,
                `${tab}}`,
                '}',
                '',
            ].join('\n');
    }
}
