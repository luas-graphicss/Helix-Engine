import { IMPORT_FORMAT_SUMMARY } from '@/engine/assets/import/import-registry';
import { MATERIAL_TEXTURE_SLOTS, type MaterialTextureSlot } from '@/engine/core/scene/material';
import type { Entity } from '@/engine/core/scene/entity';
import { requireActor } from '@/engine/editor/assistant/tools/entity-access';
import { summarizeEntity } from '@/engine/editor/assistant/tools/entity-summary';
import { ToolFailure } from '@/engine/editor/assistant/tools/tool-failure';
import { choice, flag, integer, parameters, text, textList } from '@/engine/editor/assistant/tools/tool-parameters';
import { addFilesToLibrary } from '@/engine/editor/operations/asset-library-operations';
import { DEFAULT_IMPORT_OPTIONS, instantiateImportedScene, parseImportFiles, type ImportOptions, type ImportPlacement } from '@/engine/editor/operations/import-operations';
import { setMaterialTexture } from '@/engine/editor/operations/material-operations';
import { colorSpaceForSlot, importTextureFile } from '@/engine/editor/operations/texture-operations';
import type { FileTransfer } from './file-transfer';
import type { McpTool } from './mcp-tool';
const MAX_FILES_PER_CALL = 16;
const PLACEMENTS: readonly ImportPlacement[] = ['target', 'origin', 'keep'];
const TEXTURE_SLOTS: readonly MaterialTextureSlot[] = MATERIAL_TEXTURE_SLOTS.map((entry) => entry.slot);
const DEFAULT_TEXTURE_SLOT: MaterialTextureSlot = 'baseColorMap';
const UPLOAD_HINT = 'Upload each file first with PUT <MCP URL>/files/<name>, or call fetch_file with a public https URL, and pass the returned file ids.';
const CONSOLE_HINT = 'Call read_console for the reason.';
async function downloadAll(files: FileTransfer, fileIds: readonly string[]): Promise<File[]> {
    if (fileIds.length > MAX_FILES_PER_CALL)
        throw new ToolFailure(`"files" accepts at most ${MAX_FILES_PER_CALL} file ids.`);
    return Promise.all(fileIds.map((fileId) => files.download(fileId)));
}
const importModel: McpTool = {
    name: 'import_model',
    title: 'Importar modelo 3D',
    access: 'scene',
    description: `Places uploaded 3D models in the scene. Accepts ${IMPORT_FORMAT_SUMMARY}. ${UPLOAD_HINT} A .glb needs a single id; other formats also need their companion files.`,
    parameters: parameters({
        files: textList('File ids of the models and of their companion files such as textures, .bin and .mtl.'),
        name: text('Name for the root entity when a single model is imported. Defaults to the file name.'),
        placement: choice('Where the model goes: "target" at the camera focus, "origin" at the world origin, "keep" preserves the coordinates of the file. Default target.', PLACEMENTS),
        saveToLibrary: flag('Also keeps the model in the asset library. Default true.'),
    }, ['files']),
    async run({ session, files }, input) {
        const sources = await downloadAll(files, input.texts('files'));
        const models = await parseImportFiles(session, sources);
        if (models.length === 0)
            throw new ToolFailure(`No model could be read. Accepted formats: ${IMPORT_FORMAT_SUMMARY}. ${CONSOLE_HINT}`);
        const options: ImportOptions = {
            ...DEFAULT_IMPORT_OPTIONS,
            rootName: models.length === 1 ? (input.optionalText('name') ?? null) : null,
            placement: input.optionalChoice('placement', PLACEMENTS) ?? DEFAULT_IMPORT_OPTIONS.placement,
            frameAfterImport: false,
        };
        const roots: Entity[] = [];
        for (const model of models)
            roots.push(await instantiateImportedScene(session, model.scene, options));
        if (input.optionalFlag('saveToLibrary') ?? DEFAULT_IMPORT_OPTIONS.saveToLibrary)
            await addFilesToLibrary(session, sources, { parsedScenes: new Map(models.map((model) => [model.file, model.scene])) });
        return { output: { imported: roots.map(summarizeEntity) } };
    },
};
const importAsset: McpTool = {
    name: 'import_asset',
    title: 'Importar para a biblioteca',
    access: 'scene',
    description: `Adds uploaded files to the asset library of the game: images and textures, audio, fonts, video and 3D models. Library assets are then available to the interface, the materials and the scripts. ${UPLOAD_HINT}`,
    parameters: parameters({ files: textList('File ids to add to the asset library.') }, ['files']),
    async run({ session, files }, input) {
        const assets = await addFilesToLibrary(session, await downloadAll(files, input.texts('files')));
        if (assets.length === 0)
            throw new ToolFailure(`No file was added: each one is already in the library or has an unsupported format. ${CONSOLE_HINT}`);
        return { output: { added: assets.map(({ id, name, kind }) => ({ id, name, kind })) } };
    },
};
const applyTexture: McpTool = {
    name: 'apply_texture',
    title: 'Aplicar textura',
    access: 'scene',
    description: `Applies an uploaded image as a texture on the material of an entity. ${UPLOAD_HINT}`,
    parameters: parameters({
        id: integer('Entity id.'),
        file: text('File id of the image.'),
        slot: choice(`Material slot that receives the texture. Default ${DEFAULT_TEXTURE_SLOT}.`, TEXTURE_SLOTS),
    }, ['id', 'file']),
    async run({ session, files }, input) {
        const entity = requireActor(session, input.integer('id'));
        if (!entity.material)
            throw new ToolFailure(`"${entity.name}" has no material. Textures apply to meshes such as primitives and the meshes of imported models.`);
        const slot = input.optionalChoice('slot', TEXTURE_SLOTS) ?? DEFAULT_TEXTURE_SLOT;
        const texture = await importTextureFile(session, await files.download(input.text('file')), colorSpaceForSlot(slot));
        if (!texture)
            throw new ToolFailure(`The image could not be decoded. ${CONSOLE_HINT}`);
        setMaterialTexture(session, entity, slot, texture);
        return { output: { id: entity.id, slot, texture: texture.name, width: texture.width, height: texture.height } };
    },
};
export const IMPORT_TOOLS: readonly McpTool[] = [importModel, importAsset, applyTexture];
