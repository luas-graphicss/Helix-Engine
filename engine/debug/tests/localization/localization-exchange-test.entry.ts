import { coveragePercent, localeCoverage, projectCoverage } from '@/engine/localization/analysis/coverage';
import { findAssetIssues, findStringIssues, type TranslationIssue } from '@/engine/localization/analysis/translation-issues';
import { addLocalizedAsset, setLocalizedAsset } from '@/engine/localization/edits/localized-asset-edits';
import { setStringNote } from '@/engine/localization/edits/string-edits';
import { parseCsv, serializeCsv } from '@/engine/localization/exchange/csv-text';
import { exportStringsCsv, importStringsCsv } from '@/engine/localization/exchange/strings-csv';
import { createLocalizationSettings } from '@/engine/localization/settings/localization-settings';
import { createCheckList } from '../support/check-list';
import { buildStringTable } from './localization-test-table';
const checks = createCheckList('Localização: planilha CSV, pendências e cobertura');
function issueLine(issue: TranslationIssue): string {
    return `${issue.key}@${issue.locale} ${issue.kind}: ${issue.detail}`;
}
const awkward = [['key', 'en'], ['a,b', 'say "hi"'], ['multi', 'line\nbreak'], ['semi;colon', '']];
const awkwardCsv = serializeCsv(awkward);
checks.check('células com vírgula, aspas e quebra de linha ganham aspas', awkwardCsv === 'key,en\r\n"a,b","say ""hi"""\r\nmulti,"line\nbreak"\r\n"semi;colon",');
checks.check('o CSV gravado é lido de volta igual', JSON.stringify(parseCsv(awkwardCsv)) === JSON.stringify(awkward));
checks.check('planilha com ponto e vírgula e BOM é reconhecida', JSON.stringify(parseCsv('\uFEFFkey;en;pt-BR\r\nmenu.play;Play;Jogar\r\n')) === '[["key","en","pt-BR"],["menu.play","Play","Jogar"]]');
checks.check('planilha separada por tabulação é reconhecida', JSON.stringify(parseCsv('key\ten\nmenu.play\tPlay, now')) === '[["key","en"],["menu.play","Play, now"]]');
const table = setStringNote(buildStringTable(['pt-BR', 'es'], {
    'menu.play': { en: 'Play', 'pt-BR': 'Jogar', es: 'Jugar' },
    'menu.quit': { en: 'Quit' },
}), 'menu.play', 'Botão principal');
const exported = exportStringsCsv(table);
checks.check('a exportação traz chave, nota e uma coluna por idioma', exported === 'key,note,en,pt-BR,es\r\nmenu.play,Botão principal,Play,Jogar,Jugar\r\nmenu.quit,,Quit,,');
const restored = importStringsCsv(createLocalizationSettings(), exported);
checks.check('importar a planilha exportada recria idiomas e textos', restored.added === 2 && restored.newLocales.join(' ') === 'pt-BR es' && JSON.stringify(restored.settings.strings) === JSON.stringify(table.strings));
const sheet = 'key,note,pt-br,fr\r\nmenu.quit,,Sair,Quitter\r\nmenu.play,,,Jouer\r\nmenu.new,Novo jogo,Novo,\r\nbad key,,x,y\r\n,,,\r\n';
const merged = importStringsCsv(table, sheet);
const byKey = new Map(merged.settings.strings.map((entry) => [entry.key, entry]));
checks.check('a importação conta novos, atualizados e recusados', merged.added === 1 && merged.updated === 2 && merged.skipped === 1 && merged.newLocales.join(' ') === 'fr');
checks.check('coluna de idioma novo entra no projeto', merged.settings.locales.map((locale) => locale.tag).join(' ') === 'en pt-BR es fr');
checks.check('célula vazia mantém a tradução que já existia', byKey.get('menu.play')?.values['pt-BR'] === 'Jogar' && byKey.get('menu.play')?.values.fr === 'Jouer' && byKey.get('menu.play')?.note === 'Botão principal');
checks.check('linha nova entra com nota e traduções', byKey.get('menu.new')?.note === 'Novo jogo' && byKey.get('menu.new')?.values['pt-BR'] === 'Novo' && byKey.get('menu.quit')?.values.fr === 'Quitter');
const unchanged = importStringsCsv(merged.settings, sheet);
checks.check('importar a mesma planilha de novo não muda nada', unchanged.settings === merged.settings && unchanged.added === 0 && unchanged.updated === 0);
checks.throws('planilha vazia é recusada', () => importStringsCsv(table, ''), 'O CSV está vazio.');
checks.throws('a primeira coluna precisa ser key', () => importStringsCsv(table, 'chave,en\nmenu.play,Play'), 'precisa se chamar "key"');
checks.throws('planilha sem coluna de idioma é recusada', () => importStringsCsv(table, 'key,note\nmenu.play,x'), 'não tem coluna de idioma');
const flawed = buildStringTable(['pt-BR', 'ru', 'pt'], {
    'menu.play': { en: 'Play', 'pt-BR': 'Jogar', ru: 'Играть', pt: 'Jogar' },
    'hud.coins': { en: '{count, plural, one {# coin} other {# coins}}', 'pt-BR': '{total, plural, one {# moeda} other {# moedas}}', ru: '{count, plural, one {# монета} other {# монет}}' },
    'hud.score': { en: 'Score: {score}', 'pt-BR': 'Pontos: {score' },
    'hud.empty': {},
});
const stringIssues = findStringIssues(flawed).map(issueLine);
checks.check('texto completo e válido não gera pendência', !stringIssues.some((line) => line.startsWith('menu.play')));
checks.check('argumento trocado na tradução é apontado', stringIssues.includes('hud.coins@pt-BR arguments: falta {count}') && stringIssues.includes('hud.coins@pt-BR arguments: {total} não está no texto de origem'));
checks.check('plural sem as formas do idioma é apontado', stringIssues.includes('hud.coins@ru plural: {count} sem a forma few, many'), stringIssues.join(' | '));
checks.check('tradução ausente diz de onde vem o texto mostrado', stringIssues.includes('hud.coins@pt missing: usa pt-BR') === false && stringIssues.includes('hud.coins@pt missing: usa en') && stringIssues.includes('hud.score@ru missing: usa en'));
checks.check('texto sem valor em idioma nenhum é apontado', stringIssues.includes('hud.empty@en missing: nenhum idioma de fallback tem valor'));
checks.check('erro de sintaxe vem com a explicação', stringIssues.some((line) => line.startsWith('hud.score@pt-BR syntax: o argumento "score" precisa fechar')));
const withAssets = setLocalizedAsset(setLocalizedAsset(addLocalizedAsset(flawed, 'logo', 'texture'), 'logo', 'en', 'logo-en'), 'logo', 'ru', 'logo-deleted');
const assetIssues = findAssetIssues(withAssets, (assetId) => assetId === 'logo-en').map(issueLine);
checks.check('ativo removido da biblioteca é apontado e ativo herdado de outro idioma não', assetIssues.join(' | ') === 'logo@ru asset: o ativo não está mais na biblioteca', assetIssues.join(' | '));
const unassigned = findAssetIssues(addLocalizedAsset(flawed, 'banner', 'texture'), () => true).map(issueLine);
checks.check('ativo sem arquivo em nenhum idioma é apontado em todos', unassigned.length === 4 && unassigned[0] === 'banner@en missing: nenhum idioma da cadeia de fallback tem ativo', unassigned.join(' | '));
const english = localeCoverage(withAssets, 'en');
const russian = localeCoverage(withAssets, 'ru');
checks.check('a cobertura conta textos e ativos de cada idioma', english.translated === 4 && english.total === 5 && russian.translated === 3 && coveragePercent(english) === 80);
checks.check('a cobertura do projeto soma todos os idiomas e conta o ativo herdado', projectCoverage(withAssets).total === 20 && projectCoverage(withAssets).translated === 13 && coveragePercent(projectCoverage(withAssets)) === 65, `${projectCoverage(withAssets).translated}/${projectCoverage(withAssets).total}`);
checks.check('projeto sem textos está completo', coveragePercent(projectCoverage(createLocalizationSettings())) === 100);
checks.finish();
