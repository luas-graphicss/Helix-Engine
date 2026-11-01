import type { ShaderModel } from '@/engine/renderer/shaders/custom/custom-shader.glsl';
import type { ScriptLanguageId } from '@/engine/scripting/script-languages';
export function shaderBindingSnippet(language: ScriptLanguageId | null, model: ShaderModel, name: string): string {
    const post = model === 'post';
    switch (language) {
        case 'luau':
        case 'lua':
            return post
                ? `local efeito = helix.post.custom.add({ fragment = "${name}" })\nefeito.uniforms.set("tint", { 0.1, 0.0, 0.2 })`
                : `local material = helix.material.fromShader("${name}")\nhelix.material.assign(helix.self, material)`;
        case 'python':
            return post ? `efeito = helix.post.custom.add({"fragment": "${name}"})\nefeito.uniforms.set("tint", [0.1, 0.0, 0.2])` : `material = helix.material.fromShader("${name}")\nhelix.material.assign(helix.self, material)`;
        case 'ruby':
            return post ? `efeito = helix.post.custom.add({ fragment: "${name}" })\nefeito.uniforms.set("tint", [0.1, 0.0, 0.2])` : `material = helix.material.fromShader("${name}")\nhelix.material.assign(helix.self, material)`;
        case 'php':
            return post
                ? `$efeito = $helix->post->custom->add(['fragment' => '${name}']);\n$efeito->uniforms->set('tint', [0.1, 0.0, 0.2]);`
                : `$material = $helix->material->fromShader('${name}');\n$helix->material->assign($helix->self, $material);`;
        case 'gdscript':
            return post ? `var efeito = helix.post.custom.add({"fragment": "${name}"})\nefeito.uniforms.set("tint", [0.1, 0.0, 0.2])` : `var material = helix.material.fromShader("${name}")\nhelix.material.assign(helix.self, material)`;
        case 'javascript':
        case 'typescript':
        case 'haxe':
        case 'dart':
        case 'kotlin':
        case 'java':
        case 'swift':
        case 'csharp':
            return post ? `const efeito = helix.post.custom.add({ fragment: '${name}' })\nefeito.uniforms.set('tint', [0.1, 0.0, 0.2])` : `const material = helix.material.fromShader('${name}')\nhelix.material.assign(helix.self, material)`;
        default:
            return post ? `helix.post.custom.add({ fragment: "${name}" })  // efeito.uniforms.set("tint", …)` : `helix.material.fromShader("${name}")  // helix.material.assign(helix.self, material)`;
    }
}
