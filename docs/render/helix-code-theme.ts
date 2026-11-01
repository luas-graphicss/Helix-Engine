import type { ThemeRegistrationRaw } from 'shiki/core';
const KEYWORD = '#f98e8f';
const DEFINITION = '#e6c77c';
const TYPE = '#7cd2ae';
const STRING = '#99c77f';
const NUMBER = '#fea668';
const COMMENT = '#71757a';
const PROPERTY = '#98cceb';
const OPERATOR = '#a3acb8';
const META = '#b89dd9';
const FOREGROUND = '#d6d8da';
const INVALID = '#e64343';
export const HELIX_CODE_THEME_NAME = 'helix-forge';
export const helixCodeTheme: ThemeRegistrationRaw = {
    name: HELIX_CODE_THEME_NAME,
    type: 'dark',
    colors: {
        'editor.foreground': FOREGROUND,
        'editor.background': '#0e0f11',
    },
    settings: [
        { scope: ['comment', 'punctuation.definition.comment', 'string.comment'], settings: { foreground: COMMENT, fontStyle: 'italic' } },
        {
            scope: ['keyword', 'storage', 'storage.type', 'storage.modifier', 'keyword.control', 'keyword.other', 'variable.language', 'keyword.operator.new', 'keyword.operator.expression', 'keyword.operator.logical.python'],
            settings: { foreground: KEYWORD },
        },
        { scope: ['entity.name.function', 'support.function', 'meta.function-call entity.name.function', 'entity.name.function.member', 'meta.method.declaration entity.name.function'], settings: { foreground: DEFINITION } },
        {
            scope: ['entity.name.type', 'entity.name.class', 'entity.name.namespace', 'entity.name.struct', 'entity.name.enum', 'entity.name.interface', 'support.type', 'support.class', 'entity.other.inherited-class', 'storage.type.class', 'entity.name.type.class'],
            settings: { foreground: TYPE },
        },
        { scope: ['string', 'string.quoted', 'string.template', 'punctuation.definition.string', 'string.regexp'], settings: { foreground: STRING } },
        { scope: ['constant.numeric', 'constant.language', 'constant.character', 'constant.other', 'keyword.other.unit', 'constant.language.boolean', 'constant.language.null'], settings: { foreground: NUMBER } },
        {
            scope: ['variable.other.property', 'variable.other.member', 'variable.other.object.property', 'support.variable.property', 'support.type.property-name', 'entity.other.attribute-name', 'entity.name.tag', 'meta.object-literal.key', 'variable.other.constant.property'],
            settings: { foreground: PROPERTY },
        },
        { scope: ['keyword.operator', 'punctuation.separator', 'punctuation.terminator', 'punctuation.accessor', 'meta.brace'], settings: { foreground: OPERATOR } },
        {
            scope: ['meta.preprocessor', 'keyword.control.directive', 'keyword.other.directive', 'entity.name.function.decorator', 'meta.decorator', 'punctuation.decorator', 'entity.name.function.preprocessor', 'meta.annotation', 'storage.type.annotation', 'keyword.other.special-method', 'variable.parameter'],
            settings: { foreground: META },
        },
        { scope: ['variable', 'variable.other', 'variable.other.readwrite', 'meta.definition.variable'], settings: { foreground: FOREGROUND } },
        { scope: ['invalid', 'invalid.illegal'], settings: { foreground: INVALID } },
        { scope: ['markup.heading', 'markup.bold'], settings: { foreground: DEFINITION, fontStyle: 'bold' } },
        { scope: ['markup.italic'], settings: { fontStyle: 'italic' } },
        { scope: ['markup.inline.raw', 'markup.raw'], settings: { foreground: STRING } },
    ],
};
