import JSZip from 'jszip';
import { SCENE_DOCUMENT_VERSION } from '../scene-document/scene-document';
import { isPrefabJson, PREFAB_DOCUMENT_VERSION, PREFAB_MIME_TYPE, prefabFileName, type PrefabDocument } from './prefab-document';
const JSON_ENTRY = 'prefab.json';
const BINARY_ENTRY = 'prefab.bin';
const IMAGE_DIR = 'images';
export async function prefabDocumentToFile(document: PrefabDocument): Promise<File> {
    const zip = new JSZip();
    zip.file(JSON_ENTRY, JSON.stringify(document.json), { compression: 'DEFLATE' });
    zip.file(BINARY_ENTRY, document.binary, { compression: 'DEFLATE' });
    document.images.forEach((image, index) => zip.file(`${IMAGE_DIR}/${index}.png`, image, { compression: 'STORE' }));
    const blob = await zip.generateAsync({ type: 'blob', mimeType: PREFAB_MIME_TYPE, compression: 'DEFLATE', compressionOptions: { level: 6 } });
    return new File([blob], prefabFileName(document.json.name), { type: PREFAB_MIME_TYPE });
}
export async function readPrefabDocument(file: Blob & {
    name?: string;
}): Promise<PrefabDocument> {
    const label = file.name ?? 'O arquivo';
    let zip: JSZip;
    try {
        zip = await JSZip.loadAsync(file);
    }
    catch {
        throw new Error(`${label} não é um pacote de prefab válido.`);
    }
    const jsonEntry = zip.file(JSON_ENTRY);
    const binaryEntry = zip.file(BINARY_ENTRY);
    if (!jsonEntry || !binaryEntry)
        throw new Error(`${label} não contém um prefab da Helix Engine.`);
    let json: unknown;
    try {
        json = JSON.parse(await jsonEntry.async('string'));
    }
    catch {
        throw new Error(`O conteúdo de ${label} não é um JSON válido.`);
    }
    if (!isPrefabJson(json))
        throw new Error(`${label} está num formato de prefab irreconhecível.`);
    if (json.version > PREFAB_DOCUMENT_VERSION)
        throw new Error(`${label} foi salvo por uma versão mais nova da engine (formato ${json.version}; esta versão lê até ${PREFAB_DOCUMENT_VERSION}).`);
    if (json.sceneVersion > SCENE_DOCUMENT_VERSION)
        throw new Error(`Os atores de ${label} foram salvos por uma versão mais nova da engine (formato de cena ${json.sceneVersion}).`);
    const binary = await binaryEntry.async('arraybuffer');
    const images: Blob[] = [];
    for (let index = 0;; index++) {
        const entry = zip.file(`${IMAGE_DIR}/${index}.png`);
        if (!entry)
            break;
        images.push(new Blob([await entry.async('arraybuffer')], { type: 'image/png' }));
    }
    return { json, binary, images };
}
