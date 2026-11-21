import { addLocalizedAsset, removeLocalizedAsset, renameLocalizedAsset, setLocalizedAsset, setLocalizedAssetKind } from '@/engine/localization/edits/localized-asset-edits';
import { addLocale, removeLocale, setLocaleEnabled, setLocaleFallback, setSourceLocale, setStartupLocale } from '@/engine/localization/edits/locale-edits';
import { addString, removeString, renameString, setStringNote, setTranslation } from '@/engine/localization/edits/string-edits';
import { resolveFallbackChain } from '@/engine/localization/fallback/fallback-chain';
import { localeDisplayName, localeNativeName } from '@/engine/localization/locale/locale-names';
import { negotiateLocale } from '@/engine/localization/locale/locale-negotiation';
import { canonicalLocaleTag, isSupportedLocale, localeDirection, parentLocaleTags } from '@/engine/localization/locale/locale-tag';
import { entryGroup, normalizeEntryKey, uniqueEntryKey } from '@/engine/localization/settings/entry-key';
import { createLocalizationSettings, type LocalizationSettings } from '@/engine/localization/settings/localization-settings';
import { normalizeLocalizationSettings } from '@/engine/localization/settings/normalize-localization-settings';
import { resolveStartupLocale } from '@/engine/localization/runtime/startup-locale';
import { createCheckList } from '../support/check-list';
const checks = createCheckList('Configuração de localização: idiomas, tabelas e fallback');
function withLocales(...tags: string[]): LocalizationSettings {
    return tags.reduce(addLocale, createLocalizationSettings());
}
const defaults = createLocalizationSettings();
checks.check('cena nova começa em inglês, sem textos', defaults.sourceLocale === 'en' && defaults.locales.length === 1 && defaults.locales[0].enabled && defaults.startupLocale === null && defaults.strings.length === 0 && defaults.assets.length === 0);
checks.check('o código do idioma é levado à forma canônica', canonicalLocaleTag('pt_br') === 'pt-BR' && canonicalLocaleTag(' ZH-hant ') === 'zh-Hant' && canonicalLocaleTag('não é idioma') === null && canonicalLocaleTag(7) === null);
checks.check('idioma inventado não tem regras conhecidas', isSupportedLocale('pt-BR') && !isSupportedLocale('english'));
checks.check('os idiomas-pai saem do mais próximo ao mais geral', parentLocaleTags('zh-Hant-TW').join(' ') === 'zh-Hant zh' && parentLocaleTags('en').length === 0);
checks.check('o nome do idioma sai em português e na própria língua', localeDisplayName('pt-BR') === 'Português (Brasil)' && localeNativeName('es') === 'Español' && localeNativeName('ja') === '日本語');
checks.check('árabe e hebraico são escritos da direita para a esquerda', localeDirection('ar') === 'rtl' && localeDirection('he-IL') === 'rtl' && localeDirection('pt-BR') === 'ltr');
checks.check('a chave aceita pontos e barras, e recusa espaços', normalizeEntryKey(' menu.play ') === 'menu.play' && normalizeEntryKey('hud/health_bar-2') === 'hud/health_bar-2' && normalizeEntryKey('menu play') === null && normalizeEntryKey('') === null && normalizeEntryKey('.menu') === null);
checks.check('o grupo é o trecho antes do primeiro ponto', entryGroup('menu.play') === 'menu' && entryGroup('title') === '');
checks.check('chave repetida ganha um sufixo', uniqueEntryKey(new Set(['new.text', 'new.text-2']), 'new.text') === 'new.text-3' && uniqueEntryKey(new Set(), 'new.text') === 'new.text');
const three = withLocales('pt_BR', 'es', 'pt');
checks.check('adicionar idioma guarda o código canônico', three.locales.map((locale) => locale.tag).join(' ') === 'en pt-BR es pt');
checks.check('idioma repetido ou inválido não muda nada', addLocale(three, 'pt-br') === three && addLocale(three, '???') === three);
checks.check('o fallback automático sobe ao idioma-pai e termina na origem', resolveFallbackChain(three, 'pt-BR').join(' ') === 'pt-BR pt en');
const viaSpanish = setLocaleFallback(three, 'pt-BR', 'es');
checks.check('o fallback escolhido entra no lugar do idioma-pai', resolveFallbackChain(viaSpanish, 'pt-BR').join(' ') === 'pt-BR es en');
const looped = setLocaleFallback(viaSpanish, 'es', 'pt-BR');
checks.check('fallback em círculo não trava a cadeia', resolveFallbackChain(looped, 'es').join(' ') === 'es pt-BR en');
checks.check('idioma fora do projeto cai no idioma de origem', resolveFallbackChain(three, 'ja').join(' ') === 'en');
checks.check('fallback para si mesmo ou para idioma ausente é recusado', setLocaleFallback(three, 'es', 'es') === three && setLocaleFallback(three, 'es', 'ja') === three);
const available = ['en', 'pt-BR', 'zh-Hans', 'zh-Hant'];
checks.check('o idioma do aparelho casa com a variante mais próxima', negotiateLocale(available, ['pt-PT']) === 'pt-BR' && negotiateLocale(available, ['zh-TW']) === 'zh-Hant' && negotiateLocale(available, ['fr', 'en-US']) === 'en' && negotiateLocale(available, ['fr']) === null);
checks.check('sem idioma inicial o jogo segue o aparelho', resolveStartupLocale(three, ['es-MX', 'en']) === 'es' && resolveStartupLocale(three, ['ja']) === 'en');
const fixedStartup = setStartupLocale(three, 'pt-BR');
checks.check('o idioma inicial fixo vale sobre o aparelho', resolveStartupLocale(fixedStartup, ['es']) === 'pt-BR');
const disabled = setLocaleEnabled(fixedStartup, 'pt-BR', false);
checks.check('desativar o idioma inicial devolve a escolha ao aparelho', disabled.startupLocale === null && resolveStartupLocale(disabled, ['pt-BR']) === 'pt');
checks.check('idioma desativado não pode ser o inicial', setStartupLocale(disabled, 'pt-BR') === disabled);
checks.check('o idioma de origem não pode ser desativado nem removido', setLocaleEnabled(three, 'en', false) === three && removeLocale(three, 'en') === three);
const spanishSource = setSourceLocale(setLocaleEnabled(three, 'es', false), 'es');
checks.check('virar origem reativa o idioma', spanishSource.sourceLocale === 'es' && spanishSource.locales.find((locale) => locale.tag === 'es')?.enabled === true);
let table = addString(addString(three, 'menu.play'), 'menu.quit');
table = setTranslation(setTranslation(setTranslation(table, 'menu.play', 'en', 'Play'), 'menu.play', 'pt-BR', 'Jogar'), 'menu.play', 'es', 'Jugar');
checks.check('cada texto guarda uma tradução por idioma', JSON.stringify(table.strings[0].values) === '{"en":"Play","pt-BR":"Jogar","es":"Jugar"}');
checks.check('chave inválida ou repetida não entra na tabela', addString(table, 'menu play') === table && addString(table, 'menu.play') === table);
checks.check('tradução igual ou em idioma ausente não muda nada', setTranslation(table, 'menu.play', 'en', 'Play') === table && setTranslation(table, 'menu.play', 'ja', 'プレイ') === table && setTranslation(table, 'missing', 'en', 'x') === table);
checks.check('tradução vazia apaga o valor do idioma', !('es' in setTranslation(table, 'menu.play', 'es', '').strings[0].values));
checks.check('a nota do texto fica para o tradutor', setStringNote(table, 'menu.play', 'Botão principal').strings[0].note === 'Botão principal' && setStringNote(table, 'menu.play', '') === table);
const renamed = renameString(table, 'menu.play', 'menu.start');
checks.check('renomear mantém as traduções', renamed.strings[0].key === 'menu.start' && renamed.strings[0].values.es === 'Jugar');
checks.check('renomear para uma chave em uso é recusado', renameString(table, 'menu.play', 'menu.quit') === table && renameString(table, 'menu.play', 'no key') === table);
checks.check('excluir tira só o texto pedido', removeString(table, 'menu.quit').strings.length === 1 && removeString(table, 'missing') === table);
let localized = addLocalizedAsset(table, 'logo', 'texture');
localized = setLocalizedAsset(setLocalizedAsset(localized, 'logo', 'en', 'asset-en'), 'logo', 'pt-BR', 'asset-pt');
checks.check('cada ativo localizado guarda um ativo por idioma', localized.assets[0].kind === 'texture' && JSON.stringify(localized.assets[0].values) === '{"en":"asset-en","pt-BR":"asset-pt"}');
checks.check('limpar o ativo de um idioma devolve o fallback', !('pt-BR' in setLocalizedAsset(localized, 'logo', 'pt-BR', null).assets[0].values));
checks.check('trocar o tipo esvazia os ativos escolhidos', Object.keys(setLocalizedAssetKind(localized, 'logo', 'audio').assets[0].values).length === 0 && setLocalizedAssetKind(localized, 'logo', 'texture') === localized);
checks.check('renomear e excluir o ativo localizado', renameLocalizedAsset(localized, 'logo', 'ui/logo').assets[0].key === 'ui/logo' && removeLocalizedAsset(localized, 'logo').assets.length === 0);
const withoutPortuguese = removeLocale(setStartupLocale(setLocaleFallback(localized, 'es', 'pt-BR'), 'pt-BR'), 'pt-BR');
checks.check('remover um idioma leva junto traduções, ativos, fallback e idioma inicial', withoutPortuguese.locales.length === 3 && !('pt-BR' in withoutPortuguese.strings[0].values) && !('pt-BR' in withoutPortuguese.assets[0].values) && withoutPortuguese.locales.find((locale) => locale.tag === 'es')?.fallback === null && withoutPortuguese.startupLocale === null);
const damaged = {
    sourceLocale: 'fr',
    startupLocale: 'ja',
    locales: [{ tag: 'pt_br', fallback: 'pt-BR' }, { tag: 'PT-BR' }, { tag: 'es', fallback: 'de', enabled: false }, { tag: 'not a tag' }, 'en'],
    strings: [{ key: 'menu.play', note: 7, values: { 'pt-br': 'Jogar', de: 'Spielen', es: '' } }, { key: 'menu.play', values: { es: 'Jugar' } }, { key: 'bad key' }, null],
    assets: [{ key: 'logo', kind: 'script', values: { es: 'asset-es' } }],
};
const repaired = normalizeLocalizationSettings(damaged);
checks.check('documento danificado ganha o idioma de origem e perde duplicados', repaired.sourceLocale === 'fr' && repaired.locales.map((locale) => locale.tag).join(' ') === 'fr pt-BR es');
checks.check('fallback e idioma inicial inválidos voltam ao automático', repaired.locales.every((locale) => locale.fallback === null) && repaired.startupLocale === null);
checks.check('textos danificados perdem chaves e valores inválidos', repaired.strings.length === 1 && repaired.strings[0].note === '' && JSON.stringify(repaired.strings[0].values) === '{"pt-BR":"Jogar"}');
checks.check('tipo de ativo desconhecido vira textura', repaired.assets[0].kind === 'texture' && repaired.assets[0].values.es === 'asset-es');
checks.check('valor que não é documento vira o padrão', JSON.stringify(normalizeLocalizationSettings(undefined)) === JSON.stringify(defaults) && JSON.stringify(normalizeLocalizationSettings('texto')) === JSON.stringify(defaults));
checks.check('documento válido passa sem mudanças', JSON.stringify(normalizeLocalizationSettings(localized)) === JSON.stringify(localized));
checks.finish();
