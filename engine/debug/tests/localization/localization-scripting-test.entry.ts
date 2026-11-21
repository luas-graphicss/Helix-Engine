import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import { addLocalizedAsset, setLocalizedAsset } from '@/engine/localization/edits/localized-asset-edits';
import { setLocaleEnabled } from '@/engine/localization/edits/locale-edits';
import { LocalizationRuntime } from '@/engine/localization/runtime/localization-runtime';
import type { LocalizationSettings } from '@/engine/localization/settings/localization-settings';
import { API_MANIFEST } from '@/engine/scripting/api-manifest';
import { createLocalizationApi } from '@/engine/scripting/api/localization';
import { EventBus } from '@/engine/scripting/runtime/event-bus';
import type { RuntimeHost } from '@/engine/scripting/runtime/runtime-host';
import { HELIX_DECLARATIONS } from '@/engine/scripting/typings/helix-dts';
import { createCheckList } from '../support/check-list';
import { buildStringTable } from './localization-test-table';
const checks = createCheckList('Localização nos scripts');
function buildSettings(): LocalizationSettings {
    const table = buildStringTable(['pt-BR', 'es', 'ar', 'fr'], {
        'menu.play': { en: 'Play', 'pt-BR': 'Jogar', es: 'Jugar' },
        'hud.coins': { en: '{count, plural, one {# coin} other {# coins}}', 'pt-BR': '{count, plural, one {# moeda} other {# moedas}}' },
        'hud.greeting': { en: 'Hello, {name}!' },
    });
    const logo = setLocalizedAsset(setLocalizedAsset(addLocalizedAsset(table, 'logo', 'texture'), 'logo', 'en', 'logo-en'), 'logo', 'pt-BR', 'logo-pt');
    return setLocaleEnabled(logo, 'fr', false);
}
const settings = buildSettings();
const logged: string[] = [];
const runtime = new LocalizationRuntime({ settings: () => settings, preferredLocales: () => ['en-US'], warn: (message) => logged.push(message) });
const library = new Map([
    ['logo-en', { id: 'logo-en', name: 'Logo EN' }],
    ['logo-pt', { id: 'logo-pt', name: 'Logo PT' }],
]);
const disposers = new Set<() => void>();
const host = {
    bus: new EventBus({ invoke: (_owner, _phase, run) => run() }),
    localization: runtime,
    session: { library: { get: (id: string) => library.get(id) ?? null } },
    disposers,
    current: null,
    log: (_level: string, message: string) => logged.push(message),
} as unknown as RuntimeHost;
runtime.start();
const api = createLocalizationApi(host, (asset: LibraryAsset) => ({ id: asset.id, name: asset.name }));
const manifest = API_MANIFEST.find((namespace) => namespace.name === 'localization');
checks.check('a API entrega cada membro que o manifesto promete', manifest !== undefined && manifest.members.length === 16 && manifest.members.every((member) => member in api));
checks.check('as declarações de tipo expõem helix.localization', HELIX_DECLARATIONS.includes('readonly localization: LocalizationApi') && HELIX_DECLARATIONS.includes('export const localization: LocalizationApi') && HELIX_DECLARATIONS.includes('export interface LocalizationApi'));
checks.check('o jogo abre no idioma do aparelho', api.locale === 'en' && api.sourceLocale === 'en' && api.direction === 'ltr');
const listed = api.locales();
const brazilian = listed.find((locale) => locale.tag === 'pt-BR');
checks.check('locales lista só os idiomas ativos', listed.map((locale) => locale.tag).join(' ') === 'en pt-BR es ar');
checks.check('cada idioma traz o nome no idioma ativo e no próprio idioma', brazilian !== undefined && brazilian.name.includes('Brazil') && brazilian.nativeName.includes('Brasil') && !brazilian.isSource && listed[0].isSource, JSON.stringify(brazilian));
const heard: string[] = [];
const stopListening = api.onChanged((locale: string) => heard.push(locale));
checks.check('setLocale troca o idioma e avisa quem escuta', api.setLocale('pt_BR') && api.locale === 'pt-BR' && heard.join(' ') === 'pt-BR');
checks.check('t devolve o texto no idioma ativo', api.t('menu.play') === 'Jogar');
checks.check('t aplica o plural do idioma', api.t('hud.coins', { count: 1 }) === '1 moeda' && api.t('hud.coins', { count: 3 }) === '3 moedas');
checks.check('t usa o idioma de origem quando falta tradução', api.t('hud.greeting', { name: 'Ana' }) === 'Hello, Ana!');
checks.check('has e keys consultam a tabela', api.has('menu.play') && !api.has('menu.credits') && api.keys().join(' ') === 'menu.play hud.coins hud.greeting');
checks.check('format usa a sintaxe das traduções em um texto avulso', api.format('{lives, plural, one {# vida} other {# vidas}}', { lives: 2 }) === '2 vidas');
checks.check('plural devolve a categoria do número', api.plural(1) === 'one' && api.plural(5) === 'other');
const price = api.number(10, 'currency:BRL');
checks.check('number formata no idioma ativo', api.number(1234.5) === '1.234,5' && api.number(0.5, 'percent') === '50%' && price.includes('R$') && price.includes('10,00'), `${api.number(1234.5)} | ${price}`);
checks.check('date formata no idioma ativo', api.date(new Date(2026, 0, 5), 'short') === '05/01/2026', api.date(new Date(2026, 0, 5), 'short'));
checks.check('list junta os itens com a conjunção do idioma', api.list(['A', 'B', 'C']) === 'A, B e C' && api.list(['A', 'B', 'C'], 'or') === 'A, B ou C');
checks.check('asset devolve o ativo do idioma ativo', api.asset('logo')?.id === 'logo-pt' && api.asset('banner') === null);
api.setLocale('es');
checks.check('asset sem versão no idioma usa o de origem', api.asset('logo')?.name === 'Logo EN');
checks.check('idioma desativado é recusado com aviso', !api.setLocale('fr') && api.locale === 'es' && logged.some((message) => message.includes('"fr" não está entre os idiomas ativos do jogo (en, pt-BR, es, ar)')), logged.join(' | '));
checks.check('código de idioma inválido é recusado', !api.setLocale('não é idioma') && api.locale === 'es');
api.setLocale('ar');
checks.check('o sentido de leitura acompanha o idioma', api.direction === 'rtl' && api.locales().find((locale) => locale.tag === 'ar')?.direction === 'rtl');
stopListening();
api.setLocale('en');
checks.check('quem cancelou a escuta não é mais avisado', heard.join(' ') === 'pt-BR es ar');
const late: string[] = [];
api.onChanged((locale: string) => late.push(locale));
for (const dispose of disposers)
    dispose();
runtime.selectLocale('es');
checks.check('ao parar o jogo a API deixa de repassar trocas', late.length === 0);
checks.throws('a chave precisa ser um texto', () => api.t(42), 'helix.localization.t: a chave precisa ser uma string não vazia');
checks.throws('os argumentos precisam ser um objeto', () => api.t('menu.play', 'Ana'), 'os argumentos precisam ser um objeto');
checks.throws('format explica o erro de sintaxe', () => api.format('{lives, plural, one {# vida}}'), 'helix.localization.format: "lives" precisa da opção "other"');
checks.throws('estilo de número desconhecido lista os aceitos', () => api.number(1, 'fancy'), 'use integer, percent, compact ou currency:CÓDIGO');
checks.throws('plural precisa de um número', () => api.plural('muitos'), 'a quantidade precisa ser um número finito');
checks.throws('onChanged precisa de uma função', () => api.onChanged('refresh'), 'helix.localization.onChanged');
checks.finish();
