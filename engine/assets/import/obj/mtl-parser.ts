export interface MtlTextureMap {
    path: string;
    bumpMultiplier: number;
    clamp: boolean;
}
export interface MtlMaterial {
    name: string;
    diffuse: [
        number,
        number,
        number
    ] | null;
    specular: [
        number,
        number,
        number
    ] | null;
    emissive: [
        number,
        number,
        number
    ] | null;
    shininess: number | null;
    dissolve: number;
    illumination: number | null;
    roughness: number | null;
    metallic: number | null;
    maps: {
        diffuse?: MtlTextureMap;
        specular?: MtlTextureMap;
        emissive?: MtlTextureMap;
        bump?: MtlTextureMap;
        normal?: MtlTextureMap;
        dissolve?: MtlTextureMap;
        roughness?: MtlTextureMap;
        metallic?: MtlTextureMap;
        occlusion?: MtlTextureMap;
    };
}
const MAP_OPTION_ARITY: Record<string, number> = {
    '-blendu': 1,
    '-blendv': 1,
    '-boost': 1,
    '-bm': 1,
    '-cc': 1,
    '-clamp': 1,
    '-imfchan': 1,
    '-texres': 1,
    '-type': 1,
    '-mm': 2,
    '-o': 3,
    '-s': 3,
    '-t': 3,
};
const VECTOR_OPTIONS = new Set(['-o', '-s', '-t']);
function isNumeric(token: string): boolean {
    return token.length > 0 && !Number.isNaN(Number(token));
}
function parseMap(tokens: string[]): MtlTextureMap | null {
    const map: MtlTextureMap = { path: '', bumpMultiplier: 1, clamp: false };
    let index = 0;
    while (index < tokens.length) {
        const token = tokens[index];
        const arity = MAP_OPTION_ARITY[token.toLowerCase()];
        if (arity === undefined)
            break;
        const args: string[] = [];
        if (VECTOR_OPTIONS.has(token.toLowerCase())) {
            while (args.length < 3 && index + 1 + args.length < tokens.length && isNumeric(tokens[index + 1 + args.length]))
                args.push(tokens[index + 1 + args.length]);
        }
        else {
            for (let i = 0; i < arity && index + 1 + i < tokens.length; i++)
                args.push(tokens[index + 1 + i]);
        }
        if (token.toLowerCase() === '-bm')
            map.bumpMultiplier = Number(args[0]) || 1;
        if (token.toLowerCase() === '-clamp')
            map.clamp = args[0]?.toLowerCase() === 'on';
        index += 1 + args.length;
    }
    map.path = tokens.slice(index).join(' ').trim();
    return map.path ? map : null;
}
function parseColor(tokens: string[]): [
    number,
    number,
    number
] | null {
    if (tokens[0] === 'spectral' || tokens[0] === 'xyz')
        return null;
    const r = Number(tokens[0]);
    if (Number.isNaN(r))
        return null;
    const g = tokens.length > 1 ? Number(tokens[1]) : r;
    const b = tokens.length > 2 ? Number(tokens[2]) : r;
    return [r, Number.isNaN(g) ? r : g, Number.isNaN(b) ? r : b];
}
function createMtlMaterial(name: string): MtlMaterial {
    return { name, diffuse: null, specular: null, emissive: null, shininess: null, dissolve: 1, illumination: null, roughness: null, metallic: null, maps: {} };
}
export function parseMtl(text: string): Map<string, MtlMaterial> {
    const materials = new Map<string, MtlMaterial>();
    let current: MtlMaterial | null = null;
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#'))
            continue;
        const tokens = line.split(/\s+/);
        const keyword = tokens[0];
        const args = tokens.slice(1);
        if (keyword === 'newmtl') {
            current = createMtlMaterial(args.join(' ') || `Material_${materials.size + 1}`);
            materials.set(current.name, current);
            continue;
        }
        if (!current)
            continue;
        switch (keyword) {
            case 'Kd':
                current.diffuse = parseColor(args);
                break;
            case 'Ks':
                current.specular = parseColor(args);
                break;
            case 'Ke':
                current.emissive = parseColor(args);
                break;
            case 'Ns':
                current.shininess = Number(args[0]);
                break;
            case 'd':
                current.dissolve = args[0] === '-halo' ? Number(args[1]) : Number(args[0]);
                break;
            case 'Tr':
                current.dissolve = 1 - Number(args[0]);
                break;
            case 'illum':
                current.illumination = Number(args[0]);
                break;
            case 'Pr':
                current.roughness = Number(args[0]);
                break;
            case 'Pm':
                current.metallic = Number(args[0]);
                break;
            default:
                break;
        }
        switch (keyword.toLowerCase()) {
            case 'map_kd':
                current.maps.diffuse = parseMap(args) ?? current.maps.diffuse;
                break;
            case 'map_ks':
                current.maps.specular = parseMap(args) ?? current.maps.specular;
                break;
            case 'map_ke':
                current.maps.emissive = parseMap(args) ?? current.maps.emissive;
                break;
            case 'map_bump':
            case 'bump':
                current.maps.bump = parseMap(args) ?? current.maps.bump;
                break;
            case 'norm':
            case 'map_norm':
                current.maps.normal = parseMap(args) ?? current.maps.normal;
                break;
            case 'map_d':
                current.maps.dissolve = parseMap(args) ?? current.maps.dissolve;
                break;
            case 'map_pr':
                current.maps.roughness = parseMap(args) ?? current.maps.roughness;
                break;
            case 'map_pm':
                current.maps.metallic = parseMap(args) ?? current.maps.metallic;
                break;
            case 'map_ao':
                current.maps.occlusion = parseMap(args) ?? current.maps.occlusion;
                break;
            default:
                break;
        }
    }
    return materials;
}
