import { Scene } from '@/engine/core/scene/scene';
import { addLocalizedAsset, setLocalizedAsset } from '@/engine/localization/edits/localized-asset-edits';
import { setLocaleEnabled, setLocaleFallback, setStartupLocale } from '@/engine/localization/edits/locale-edits';
import { setStringNote } from '@/engine/localization/edits/string-edits';
import { createLocalizationSettings } from '@/engine/localization/settings/localization-settings';
import { MaterialLibrary } from '@/engine/materials/material-library';
import { deserializeScene } from '@/engine/project/scene-document/deserialize-scene';
import { serializeScene } from '@/engine/project/scene-document/serialize-scene';
import { createCheckList } from '../support/check-list';
import { buildStringTable } from './localization-test-table';
const checks = createCheckList('Localização no documento da cena');
function loadOptions() {
    return { materials: new MaterialLibrary(() => undefined, null) };
}
const texts = buildStringTable(['pt-BR', 'es', 'fr'], {
    'menu.play': { en: 'Play', 'pt-BR': 'Jogar', es: 'Jugar' },
    'hud.coins': { en: '{count, plural, one {# coin} other {# coins}}' },
});
const configured = setStartupLocale(setLocaleEnabled(setLocaleFallback(setStringNote(texts, 'menu.play', 'Botão principal'), 'pt-BR', 'es'), 'fr', false), 'es');
const source = new Scene('Menu');
Object.assign(source.localization, setLocalizedAsset(addLocalizedAsset(configured, 'logo', 'texture'), 'logo', 'pt-BR', 'asset-logo-pt'));
const document = await serializeScene(source, { libraryDocumentForTerrainMaterial: () => null });
const { scene } = await deserializeScene(document, loadOptions());
checks.check('idiomas, textos e ativos localizados sobrevivem à gravação da cena', JSON.stringify(scene.localization) === JSON.stringify(source.localization));
checks.check('a cena recarregada mantém fallback, idioma inicial e idioma desativado', scene.localization.locales[1].fallback === 'es' && scene.localization.startupLocale === 'es' && !scene.localization.locales[3].enabled);
document.json.environment.localization = { sourceLocale: 'pt_br', startupLocale: 'ja', locales: 'nenhum', strings: [{ key: 'menu.play', values: { 'pt-br': 'Jogar', en: 'Play' } }, { key: 'bad key' }] };
const repaired = await deserializeScene(document, loadOptions());
checks.check('localização danificada no arquivo é reparada ao abrir', JSON.stringify(repaired.scene.localization) === '{"sourceLocale":"pt-BR","startupLocale":null,"locales":[{"tag":"pt-BR","fallback":null,"enabled":true}],"strings":[{"key":"menu.play","note":"","values":{"pt-BR":"Jogar"}}],"assets":[]}', JSON.stringify(repaired.scene.localization));
delete document.json.environment.localization;
const legacy = await deserializeScene(document, loadOptions());
checks.check('cena antiga sem localização recebe o padrão', JSON.stringify(legacy.scene.localization) === JSON.stringify(createLocalizationSettings()));
checks.finish();
