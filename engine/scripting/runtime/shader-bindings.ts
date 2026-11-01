import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import type { Material } from '@/engine/core/scene/material';
import type { LogLevel } from '@/engine/editor/session/editor-log';
import { SHADER_MODEL_LABEL, STANDARD_SHADER_INPUTS, STANDARD_SHADER_UNIFORM_NAMES, type ShaderModel } from '@/engine/renderer/shaders/custom/custom-shader.glsl';
import { decodeShaderBundle, isBindableSamplerType, isSamplerType, type CompiledShaderBundle, type ShaderUniformDeclaration } from '@/engine/renderer/shaders/custom/shader-bundle';
import { setMaterialShader } from '@/engine/renderer/shaders/custom/material-shader-registry';
import { ambiguousUniformNames, createShaderBinding, findUniformDeclaration, type ShaderBinding, type ShaderUniformValue } from '@/engine/renderer/shaders/custom/shader-values';
import type { CompiledScript } from '../compiler/compile-types';
import { isTexture } from './engine-objects';
import { HelixArgumentError, HelixError } from './script-errors';
import { describeType, requireString } from './values';
export interface ShaderUniforms {
    set(name: string, value: ShaderUniformValue | null): void;
    set(values: Record<string, ShaderUniformValue | null>): void;
    get(name: string): ShaderUniformValue | undefined;
    has(name: string): boolean;
    list(): Array<{
        name: string;
        type: string;
        arraySize: number;
        active: boolean;
    }>;
}
export type ShaderMaterial = Material & {
    readonly uniforms: ShaderUniforms;
};
export interface ShaderBindingServices {
    resolveAsset(value: unknown, member: string): LibraryAsset;
    compiledOf(assetId: string): CompiledScript | null;
    log(level: LogLevel, message: string): void;
}
function isNumberList(value: unknown): value is ArrayLike<number> {
    if (ArrayBuffer.isView(value))
        return !(value instanceof DataView);
    return Array.isArray(value) && value.every((entry) => typeof entry === 'number' || typeof entry === 'boolean' || isNumberList(entry));
}
function componentsToList(value: unknown): number[] | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return null;
    const fields = value as Record<string, unknown>;
    for (const axes of [['x', 'y', 'z', 'w'], ['r', 'g', 'b', 'a']]) {
        const present = axes.filter((axis) => fields[axis] !== undefined);
        if (present.length < 2 || present.some((axis) => typeof fields[axis] !== 'number'))
            continue;
        if (present.join('') !== axes.slice(0, present.length).join(''))
            continue;
        return present.map((axis) => fields[axis] as number);
    }
    return null;
}
function scriptNames(bundle: CompiledShaderBundle): Array<{
    declaration: ShaderUniformDeclaration;
    name: string;
}> {
    const ambiguous = ambiguousUniformNames(bundle);
    return bundle.uniforms.map((declaration) => ({
        declaration,
        name: ambiguous.has(declaration.name) && declaration.owner ? `${declaration.owner}.${declaration.name}` : declaration.name,
    }));
}
function isStandardInputName(name: string): boolean {
    if (STANDARD_SHADER_UNIFORM_NAMES.has(name))
        return true;
    return STANDARD_SHADER_INPUTS.some((spec) => spec.wgslName === name || `helix.${spec.wgslName}` === name);
}
export class ShaderBindings {
    private readonly byAsset = new Map<string, Set<ShaderBinding>>();
    private readonly apis = new WeakMap<ShaderBinding, ShaderUniforms>();
    private readonly warnedInactive = new WeakMap<ShaderBinding, Set<string>>();
    constructor(private readonly services: ShaderBindingServices) { }
    bind(assetValue: unknown, model: ShaderModel, initial: unknown, member: string): ShaderBinding {
        const asset = this.services.resolveAsset(assetValue, member);
        const bundle = this.bundleOf(asset, model, member);
        const binding = createShaderBinding(bundle);
        let set = this.byAsset.get(asset.id);
        if (!set) {
            set = new Set();
            this.byAsset.set(asset.id, set);
        }
        set.add(binding);
        if (initial !== undefined && initial !== null) {
            if (typeof initial !== 'object')
                throw new HelixArgumentError(member, `os uniformes iniciais devem ser um objeto { nome: valor }, não ${describeType(initial)}.`);
            this.uniforms(binding).set(initial as Record<string, ShaderUniformValue | null>);
        }
        return binding;
    }
    release(binding: ShaderBinding): void {
        for (const [assetId, set] of this.byAsset) {
            if (!set.delete(binding))
                continue;
            if (set.size === 0)
                this.byAsset.delete(assetId);
            return;
        }
    }
    uniforms(binding: ShaderBinding): ShaderUniforms {
        let api = this.apis.get(binding);
        if (!api) {
            api = this.createUniformsApi(binding);
            this.apis.set(binding, api);
        }
        return api;
    }
    materialFor(binding: ShaderBinding, material: Material): ShaderMaterial {
        setMaterialShader(material, binding);
        Object.defineProperty(material, 'uniforms', { value: this.uniforms(binding), enumerable: false, configurable: true });
        return material as ShaderMaterial;
    }
    reload(compiled: CompiledScript): number {
        const set = this.byAsset.get(compiled.assetId);
        if (!set || set.size === 0)
            return 0;
        const bundle = decodeShaderBundle(compiled.code);
        if (!bundle) {
            this.services.log('warn', `${compiled.name} recompilou, mas não produziu um shader; os materiais e efeitos continuam com a versão anterior.`);
            return 0;
        }
        let swapped = 0;
        for (const binding of set) {
            if (binding.bundle.model !== bundle.model) {
                this.services.log('warn', `${compiled.name} mudou do modelo ${SHADER_MODEL_LABEL[binding.bundle.model]} para ${SHADER_MODEL_LABEL[bundle.model]}; a ligação existente continua com a versão anterior.`);
                continue;
            }
            binding.bundle = bundle;
            binding.values.retainDeclared(bundle);
            this.warnedInactive.delete(binding);
            swapped++;
        }
        return swapped;
    }
    clear(): void {
        this.byAsset.clear();
    }
    private bundleOf(asset: LibraryAsset, model: ShaderModel, member: string): CompiledShaderBundle {
        if (asset.kind !== 'script')
            throw new HelixArgumentError(member, `${asset.name} é um ativo de tipo ${asset.kind}, não um shader (script GLSL ou WGSL).`);
        const compiled = this.services.compiledOf(asset.id);
        if (!compiled)
            throw new HelixError(`${member}: ${asset.name} não foi compilado nesta execução (foi criado depois de o jogo começar?). Salve-o de novo ou pare e inicie o jogo.`);
        if (compiled.kind !== 'shader')
            throw new HelixArgumentError(member, `${asset.name} é um script ${compiled.kind === 'module' || compiled.kind === 'foreign' ? 'de código' : compiled.kind.toUpperCase()}, não um shader GLSL ou WGSL.`);
        if (compiled.errorCount > 0)
            throw new HelixError(`${member}: ${asset.name} tem ${compiled.errorCount} ${compiled.errorCount === 1 ? 'erro' : 'erros'} de compilação; corrija-os antes de ligá-lo.`);
        const bundle = decodeShaderBundle(compiled.code);
        if (!bundle)
            throw new HelixError(`${member}: ${asset.name} não produziu um shader utilizável.`);
        if (bundle.model !== model) {
            const hint = model === 'post' ? 'helix.material.fromShader' : 'helix.post.custom.add';
            throw new HelixArgumentError(member, `${asset.name} é um shader de ${SHADER_MODEL_LABEL[bundle.model]}; aqui entra um de ${SHADER_MODEL_LABEL[model]} (para este, use ${hint}).`);
        }
        return bundle;
    }
    private createUniformsApi(binding: ShaderBinding): ShaderUniforms {
        const member = binding.bundle.model === 'post' ? 'effect.uniforms.set' : 'material.uniforms.set';
        const resolve = (name: string): ShaderUniformDeclaration => {
            const { bundle } = binding;
            const declaration = findUniformDeclaration(bundle, name);
            if (declaration)
                return declaration;
            if (isStandardInputName(name))
                throw new HelixArgumentError(member, `"${name}" é uma entrada padrão que a engine preenche a cada frame; o shader só a lê.`);
            const names = scriptNames(bundle).map((entry) => entry.name);
            if (ambiguousUniformNames(bundle).has(name))
                throw new HelixArgumentError(member, `"${name}" existe em mais de um bloco de ${bundle.name}; qualifique com a variável: ${names.filter((entry) => entry.endsWith(`.${name}`)).join(' ou ')}.`);
            throw new HelixArgumentError(member, `${bundle.name} não declara o uniforme "${name}".${names.length > 0 ? ` Declarados: ${names.join(', ')}.` : ' Ele não declara uniformes próprios.'}`);
        };
        const check = (declaration: ShaderUniformDeclaration, value: unknown, name: string): ShaderUniformValue | null => {
            if (isSamplerType(declaration.type)) {
                if (!isBindableSamplerType(declaration.type))
                    throw new HelixArgumentError(member, `"${name}" é ${declaration.type}; a engine só vincula texturas 2D (sampler2D) por uniforms.`);
                if (value === null)
                    return null;
                if (isTexture(value))
                    return value;
                throw new HelixArgumentError(member, `"${name}" é um sampler2D: esperava uma Texture (helix.texture.create(), helix.texture.fromAsset()…) ou null, não ${describeType(value)}.`);
            }
            if (value === null)
                return null;
            if (typeof value === 'number' || typeof value === 'boolean' || isNumberList(value))
                return value as ShaderUniformValue;
            const components = componentsToList(value);
            if (components)
                return components as ShaderUniformValue;
            throw new HelixArgumentError(member, `"${name}" é ${declaration.arraySize > 1 ? `${declaration.type}[${declaration.arraySize}]` : declaration.type}: esperava número, booleano, lista de números ou {x, y, z}, não ${describeType(value)}.`);
        };
        const setOne = (nameValue: unknown, value: unknown) => {
            const name = requireString(nameValue, member, 'o nome do uniforme');
            const declaration = resolve(name);
            const checked = check(declaration, value, name);
            if (!declaration.active) {
                let warned = this.warnedInactive.get(binding);
                if (!warned) {
                    warned = new Set();
                    this.warnedInactive.set(binding, warned);
                }
                if (!warned.has(declaration.glslName)) {
                    warned.add(declaration.glslName);
                    this.services.log('warn', `${binding.bundle.name}: o uniforme "${name}" é declarado mas nunca lido, então o compilador o descartou; o valor não tem efeito.`);
                }
            }
            if (checked === null)
                binding.values.delete(declaration.glslName);
            else
                binding.values.set(declaration.glslName, checked);
        };
        return {
            set: (nameOrValues: unknown, value?: unknown) => {
                if (typeof nameOrValues === 'object' && nameOrValues !== null) {
                    for (const [name, entry] of Object.entries(nameOrValues as Record<string, unknown>))
                        setOne(name, entry);
                    return;
                }
                setOne(nameOrValues, value);
            },
            get: (name: string) => binding.values.get(resolve(requireString(name, member, 'o nome do uniforme')).glslName),
            has: (name: string) => binding.values.has(resolve(requireString(name, member, 'o nome do uniforme')).glslName),
            list: () => scriptNames(binding.bundle).map(({ declaration, name }) => ({ name, type: declaration.type, arraySize: declaration.arraySize, active: declaration.active })),
        };
    }
}
