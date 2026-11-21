import { collectArguments } from '@/engine/localization/message/message-arguments';
import { MessageCache } from '@/engine/localization/message/message-cache';
import { formatMessage } from '@/engine/localization/message/message-formatter';
import { MessageSyntaxError, hasMessageSyntax, parseMessage } from '@/engine/localization/message/message-parser';
import { pluralCategories, pluralCategory } from '@/engine/localization/message/plural-category';
import { formatValue } from '@/engine/localization/message/value-formatters';
import { createCheckList } from '../support/check-list';
const checks = createCheckList('Mensagens localizadas: argumentos, plural e formatação');
function render(pattern: string, args: Record<string, unknown> = {}, locale = 'en'): string {
    return formatMessage(parseMessage(pattern), args, locale);
}
function syntaxErrorAt(pattern: string): number | null {
    try {
        parseMessage(pattern);
    }
    catch (cause) {
        if (cause instanceof MessageSyntaxError)
            return cause.position;
        throw cause;
    }
    return null;
}
checks.check('texto sem marcação passa inteiro', render('Play') === 'Play' && !hasMessageSyntax('Play'));
checks.check('argumento é trocado pelo valor', render('Hello, {name}!', { name: 'Ana' }) === 'Hello, Ana!');
checks.check('argumento ausente aparece entre chaves', render('Hello, {name}!') === 'Hello, {name}!');
checks.check('número solto segue o idioma', render('{score} pts', { score: 1234567.5 }, 'pt-BR') === '1.234.567,5 pts' && render('{score} pts', { score: 1234567.5 }) === '1,234,567.5 pts');
const items = '{count, plural, =0 {No items} one {# item} other {# items}}';
checks.check('plural em inglês escolhe one e other', render(items, { count: 1 }) === '1 item' && render(items, { count: 2 }) === '2 items');
checks.check('a forma exata =N vence a categoria', render(items, { count: 0 }) === 'No items');
checks.check('plural sem o argumento mostra o nome dele', render(items) === '{count}');
const russianItems = '{count, plural, one {# предмет} few {# предмета} many {# предметов} other {# предмета}}';
const russian = [1, 3, 5, 21].map((count) => render(russianItems, { count }, 'ru')).join(' | ');
checks.check('plural em russo usa one, few e many', russian === '1 предмет | 3 предмета | 5 предметов | 21 предмет', russian);
checks.check('em português zero cai na forma one', render('{count, plural, one {# item} other {# itens}}', { count: 0 }, 'pt-BR') === '0 item');
const guests = '{guests, plural, offset:1 =0 {nobody} =1 {{host}} one {{host} and # other} other {{host} and # others}}';
checks.check('offset desconta do número mostrado', render(guests, { guests: 3, host: 'Ana' }) === 'Ana and 2 others' && render(guests, { guests: 2, host: 'Ana' }) === 'Ana and 1 other' && render(guests, { guests: 1, host: 'Ana' }) === 'Ana');
const place = '{place, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}';
const places = [1, 2, 3, 4, 22].map((value) => render(place, { place: value })).join(' ');
checks.check('selectordinal escolhe a forma ordinal', places === '1st 2nd 3rd 4th 22nd', places);
const winner = '{gender, select, female {She} male {He} other {They}} won';
checks.check('select escolhe pela chave e cai em other', render(winner, { gender: 'female' }) === 'She won' && render(winner, { gender: 'robot' }) === 'They won');
const nested = '{count, plural, one {{gender, select, female {She has # key} other {They have # key}}} other {{gender, select, female {She has # keys} other {They have # keys}}}}';
checks.check('select dentro de plural mantém o número em #', render(nested, { count: 1, gender: 'female' }) === 'She has 1 key' && render(nested, { count: 4, gender: 'x' }) === 'They have 4 keys');
checks.check('estilos de número: percent, integer e compact', render('{ratio, number, percent}', { ratio: 0.25 }) === '25%' && render('{value, number, integer}', { value: 3.7 }) === '4' && render('{value, number, compact}', { value: 1500 }) === '1.5K');
const price = render('{price, number, currency:brl}', { price: 12.5 }, 'pt-BR');
checks.check('currency formata a moeda no idioma', price.includes('R$') && price.includes('12,50'), price);
const launch = new Date(2026, 0, 15, 12, 0);
checks.check('date segue o estilo e o idioma', render('{when, date, long}', { when: launch }) === 'January 15, 2026' && render('{when, date, long}', { when: launch }, 'pt-BR') === '15 de janeiro de 2026');
checks.check('time formata a hora', /^12:00\sPM$/.test(render('{when, time, short}', { when: launch })), render('{when, time, short}', { when: launch }));
checks.check('date aceita milissegundos e data solta', render('{when, date, short}', { when: launch.getTime() }) === '1/15/26' && render('{when}', { when: launch }) === 'Jan 15, 2026');
const names = ['Ana', 'Bia', 'Caio'];
checks.check('list junta os itens no idioma', render('{names, list}', { names }) === 'Ana, Bia, and Caio' && render('{names, list}', { names }, 'pt-BR') === 'Ana, Bia e Caio' && render('{names, list, or}', { names }) === 'Ana, Bia, or Caio');
checks.check('apóstrofo comum e dobrado viram um só', render("It's {name}''s turn", { name: 'Ana' }) === "It's Ana's turn");
checks.check('chaves entre apóstrofos são texto', render("Use '{name}' as is", { name: 'Ana' }) === 'Use {name} as is');
checks.check('# fora de plural é texto', render('Level #{level}', { level: 3 }) === 'Level #3');
checks.check("'#' entre apóstrofos é texto dentro de plural", render("{count, plural, other {'#'# done}}", { count: 2 }) === '#2 done');
checks.throws('argumento sem fechar é erro de sintaxe', () => parseMessage('Hello, {name'), 'precisa fechar com "}"');
checks.throws('plural sem other é recusado', () => parseMessage('{count, plural, one {# item}}'), 'precisa da opção "other"');
checks.throws('forma de plural desconhecida é recusada', () => parseMessage('{count, plural, some {x} other {y}}'), '"some" não é uma forma de plural');
checks.throws('opção repetida é recusada', () => parseMessage('{kind, select, a {1} a {2} other {3}}'), 'aparece duas vezes');
checks.throws('formato desconhecido lista os aceitos', () => parseMessage('{value, money}'), 'formato "money" desconhecido');
checks.throws('chave sobrando é recusada', () => parseMessage('Done}'), '"}" sem um "{"');
checks.check('o erro informa a posição no texto', syntaxErrorAt('Hello {name, money} there') === 18 && syntaxErrorAt('Play') === null);
checks.throws('estilo de número desconhecido é explicado', () => render('{value, number, huge}', { value: 1 }), 'estilo de número "huge" desconhecido');
checks.throws('moeda inválida é explicada', () => render('{value, number, currency:real}', { value: 1 }), 'moeda "real" inválida');
checks.throws('estilo de data desconhecido é explicado', () => render('{when, date, tiny}', { when: launch }), 'estilo de data "tiny" desconhecido');
const described = collectArguments(parseMessage('{count, plural, one {{name} has # item} other {{name} has # items}} on {when, date} as {role, select, admin {A} other {B}}'));
checks.check('os argumentos saem com nome, tipo e opções', described.map((argument) => `${argument.name}:${argument.kind}`).join(' ') === 'count:plural name:text when:date role:select' && described[3].choices.join(',') === 'admin,other');
checks.check('o mesmo argumento fica com o tipo mais específico', collectArguments(parseMessage('{total} of {total, number, integer}'))[0].kind === 'number');
checks.check('as categorias de plural vêm do idioma', pluralCategories('ru').includes('few') && pluralCategories('ru').includes('many') && pluralCategory('en', 1) === 'one' && pluralCategory('en', 2, true) === 'two');
const cache = new MessageCache();
checks.check('o cache reaproveita a mensagem compilada', cache.compile(items) === cache.compile(items) && cache.render(items, { count: 5 }, 'en') === '5 items' && cache.render('Play', {}, 'en') === 'Play');
checks.check('formatValue formata fora de uma mensagem', formatValue('number', 'de', 1234.5) === '1.234,5' && formatValue('list', 'en', ['a', 'b'], 'or') === 'a or b');
checks.finish();
