import { addLocalizedAsset, setLocalizedAsset } from '@/engine/localization/edits/localized-asset-edits';
import { setLocaleEnabled, setLocaleFallback, setStartupLocale } from '@/engine/localization/edits/locale-edits';
import { setTranslation } from '@/engine/localization/edits/string-edits';
import { LocalizationRuntime } from '@/engine/localization/runtime/localization-runtime';
import type { LocalizationSettings } from '@/engine/localization/settings/localization-settings';
import { createCheckList } from '../support/check-list';
import { buildStringTable } from './localization-test-table';
const checks = createCheckList('Localização em jogo: idioma ativo, tradução e fallback');
function buildSettings(): LocalizationSettings {
    const table = buildStringTable(['pt-BR', 'pt', 'es', 'fr'], {
        'menu.play': { en: 'Play', 'pt-BR': 'Jogar', es: 'Jugar' },
        'menu.quit': { en: 'Quit', pt: 'Sair' },
        'hud.coins': { en: '{count, plural, one {# coin} other {# coins}}', 'pt-BR': '{count, plural, one {# moeda} other {# moedas}}' },
        'hud.score': { en: 'Score: {score}', 'pt-BR': 'Pontos: {score' },
        'hud.empty': {},
    });
    const logo = setLocalizedAsset(setLocalizedAsset(addLocalizedAsset(table, 'logo', 'texture'), 'logo', 'en', 'logo-en'), 'logo', 'pt-BR', 'logo-pt');
    return setLocaleEnabled(logo, 'fr', false);
}
let settings = buildSettings();
let deviceLocales = ['pt-PT', 'en'];
const warnings: string[] = [];
const runtime = new LocalizationRuntime({ settings: () => settings, preferredLocales: () => deviceLocales, warn: (message) => warnings.push(message) });
checks.check('antes do jogo o idioma já segue o aparelho', runtime.locale === 'pt');
runtime.start();
checks.check('ao iniciar o jogo vale o idioma mais próximo do aparelho', runtime.locale === 'pt');
checks.check('o texto sai no idioma ativo', runtime.translate('menu.quit') === 'Sair');
checks.check('sem tradução no idioma o texto vem da origem', runtime.translate('menu.play') === 'Play');
const heard: string[] = [];
const stopListening = runtime.onChanged((locale) => heard.push(locale));
checks.check('trocar o idioma avisa quem escuta', runtime.selectLocale('pt-BR') && runtime.locale === 'pt-BR' && heard.join(' ') === 'pt-BR');
checks.check('escolher o idioma que já está ativo não avisa de novo', runtime.selectLocale('pt-BR') && heard.length === 1);
checks.check('a variante regional herda do idioma-pai antes da origem', runtime.translate('menu.play') === 'Jogar' && runtime.translate('menu.quit') === 'Sair');
checks.check('o plural segue o número', runtime.translate('hud.coins', { count: 1 }) === '1 moeda' && runtime.translate('hud.coins', { count: 3 }) === '3 moedas');
checks.check('tradução com erro de sintaxe cede lugar ao fallback', runtime.translate('hud.score', { score: 10 }) === 'Score: 10');
runtime.translate('hud.score', { score: 11 });
const syntaxWarnings = warnings.filter((message) => message.includes('"hud.score" em pt-BR está inválido'));
checks.check('o erro de sintaxe vai ao console uma vez só', syntaxWarnings.length === 1 && syntaxWarnings[0].includes('precisa fechar com "}"'), warnings.join(' | '));
checks.check('chave desconhecida volta como está e avisa', runtime.translate('menu.credits') === 'menu.credits' && warnings.some((message) => message.includes('"menu.credits" não existe')));
checks.check('texto sem nenhuma tradução mostra a chave e avisa', runtime.translate('hud.empty') === 'hud.empty' && warnings.some((message) => message.includes('"hud.empty" não tem tradução em pt-BR')));
checks.check('has diz se há texto para mostrar', runtime.has('menu.quit') && !runtime.has('hud.empty') && !runtime.has('menu.credits'));
checks.check('keys lista as chaves da tabela', runtime.keys().join(' ') === 'menu.play menu.quit hud.coins hud.score hud.empty');
checks.check('o ativo sai no idioma ativo', runtime.assetId('logo') === 'logo-pt' && runtime.assetId('banner') === null);
runtime.selectLocale('es');
checks.check('ativo sem versão no idioma usa o da origem', runtime.assetId('logo') === 'logo-en');
checks.check('texto de fallback usa as regras do idioma em que foi escrito', runtime.translate('hud.coins', { count: 3 }) === '3 coins');
checks.check('idioma desativado ou fora do projeto é recusado', !runtime.selectLocale('fr') && !runtime.selectLocale('ja') && runtime.locale === 'es');
settings = setLocaleFallback(settings, 'es', 'pt-BR');
checks.check('mudar o fallback na tabela vale na hora', runtime.translate('hud.coins', { count: 3 }) === '3 moedas' && runtime.assetId('logo') === 'logo-pt');
settings = setTranslation(settings, 'menu.play', 'es', 'Jugar ya');
checks.check('editar uma tradução vale na hora', runtime.translate('menu.play') === 'Jugar ya');
heard.length = 0;
runtime.refresh();
checks.check('refresh repete o idioma ativo para quem escuta', heard.join(' ') === 'es');
stopListening();
runtime.selectLocale('pt');
checks.check('quem cancelou a escuta não é mais avisado', heard.length === 1 && runtime.locale === 'pt');
runtime.selectLocale('es');
settings = setLocaleEnabled(settings, 'es', false);
checks.check('desativar o idioma ativo devolve o do aparelho', runtime.locale === 'pt');
const warnedBefore = warnings.length;
runtime.stop();
runtime.start();
runtime.translate('menu.credits');
checks.check('um jogo novo volta a avisar o que falta', warnings.length === warnedBefore + 1);
settings = setStartupLocale(settings, 'pt-BR');
deviceLocales = ['en'];
runtime.start();
checks.check('o idioma inicial fixo vale sobre o aparelho', runtime.locale === 'pt-BR');
checks.finish();
