import { GUI_THEME, createGuiDocument, createGuiNode, emptyStateStyle, insets, shadow, solidFill, stroke, transparentAppearance, udim2, uniformRadii, type GuiAppearance, type GuiAutoLayout, type GuiControl, type GuiDocument, type GuiElementKind, type GuiIcon, type GuiImage, type GuiNode, type GuiPoint, type GuiRect, type GuiStates, type GuiTextStyle, type UDim2, } from '../document/gui-document';
export interface GuiTemplate {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly build: () => GuiDocument;
}
interface Place {
    readonly position?: UDim2;
    readonly anchor?: GuiPoint;
    readonly size?: GuiPoint | UDim2;
}
interface Patch {
    readonly rect?: Partial<GuiRect>;
    readonly text?: Partial<GuiTextStyle>;
    readonly appearance?: Partial<GuiAppearance>;
    readonly layout?: Partial<GuiAutoLayout>;
    readonly control?: GuiControl;
    readonly icon?: Partial<GuiIcon>;
    readonly image?: Partial<GuiImage>;
    readonly states?: GuiStates;
    readonly children?: readonly GuiNode[];
    readonly interactable?: boolean;
    readonly clipsContent?: boolean;
    readonly visible?: boolean;
}
function isUDim2(size: GuiPoint | UDim2 | undefined): size is UDim2 {
    return size !== undefined && 'x' in size && typeof size.x === 'object';
}
function element(kind: GuiElementKind, name: string, place: Place = {}, patch: Patch = {}): GuiNode {
    const base = createGuiNode(kind, { name, position: place.position, size: isUDim2(place.size) ? undefined : place.size });
    const rect: GuiRect = { ...base.rect, anchor: place.anchor ?? base.rect.anchor, size: isUDim2(place.size) ? place.size : base.rect.size, ...patch.rect };
    return {
        ...base,
        rect,
        appearance: { ...base.appearance, ...patch.appearance },
        layout: { ...base.layout, ...patch.layout },
        text: patch.text ? { ...(base.text ?? createGuiNode('text').text!), ...patch.text } : base.text,
        icon: patch.icon ? { ...(base.icon ?? createGuiNode('icon').icon!), ...patch.icon } : base.icon,
        image: patch.image ? { ...(base.image ?? createGuiNode('image').image!), ...patch.image } : base.image,
        control: patch.control ?? base.control,
        states: patch.states ?? base.states,
        children: patch.children ?? base.children,
        interactable: patch.interactable ?? base.interactable,
        clipsContent: patch.clipsContent ?? base.clipsContent,
        visible: patch.visible ?? base.visible,
    };
}
const GHOST: GuiAppearance = { fill: solidFill('#ffffff', 0.08), stroke: stroke('#ffffff', 0.12), radii: uniformRadii(10), shadow: null, opacity: 1 };
const ghostStates = (): GuiStates => ({
    hover: { ...emptyStateStyle(), fillColor: '#ffffff', fillAlpha: 0.14 },
    pressed: { ...emptyStateStyle(), fillColor: '#ffffff', fillAlpha: 0.2, scale: 0.98 },
    disabled: { ...emptyStateStyle(), opacity: 0.4 },
    transitionMs: 120,
});
const PANEL: GuiAppearance = { fill: solidFill('#151a27', 0.96), stroke: stroke('#ffffff', 0.08), radii: uniformRadii(16), shadow: shadow(48, 24, 0.5), opacity: 1 };
function overlay(): GuiNode {
    return element('frame', 'Escurecimento', { size: udim2(1, 0, 1, 0) }, { appearance: { fill: solidFill('#05070d', 0.6), stroke: null, radii: uniformRadii(0) } });
}
function heading(content: string, size = 36): GuiNode {
    return element('text', content, {}, { text: { content, size, weight: 800, family: 'builtin:display', uppercase: true, letterSpacing: 4, align: 'center' } });
}
function primaryButton(label: string, size: UDim2 | GuiPoint = { x: 280, y: 56 }): GuiNode {
    return element('button', label, { size }, { text: { content: label } });
}
function ghostButton(label: string, size: UDim2 | GuiPoint = { x: 280, y: 56 }, textColor: string = GUI_THEME.text): GuiNode {
    return element('button', label, { size }, { appearance: GHOST, text: { content: label, color: textColor, weight: 500 }, states: ghostStates() });
}
function settingsRow(label: string, control: GuiNode): GuiNode {
    return element('frame', label, { size: udim2(1, 0, 0, 40) }, {
        appearance: transparentAppearance(),
        children: [
            element('text', 'Rótulo', { position: udim2(0, 0, 0.5, 0), anchor: { x: 0, y: 0.5 } }, { text: { content: label, size: 17, weight: 500 } }),
            { ...control, rect: { ...control.rect, position: udim2(1, 0, 0.5, 0), anchor: { x: 1, y: 0.5 } } },
        ],
    });
}
function slot(index: number, icon?: string, count?: string): GuiNode {
    const children: GuiNode[] = [];
    if (icon)
        children.push(element('icon', 'Item', { position: udim2(0.5, 0, 0.5, 0), anchor: { x: 0.5, y: 0.5 }, size: { x: 40, y: 40 } }, { icon: { name: icon, strokeWidth: 1.75 } }));
    if (count)
        children.push(element('text', 'Quantidade', { position: udim2(1, -6, 1, -4), anchor: { x: 1, y: 1 } }, { text: { content: count, size: 13, weight: 700, align: 'right' } }));
    return element('frame', `Espaço ${index}`, {}, { appearance: { fill: solidFill('#ffffff', 0.06), stroke: stroke('#ffffff', 0.1), radii: uniformRadii(10) }, children });
}
function buildHud(): GuiDocument {
    const document = createGuiDocument('HUD de jogo');
    const health = element('frame', 'Vida', { position: udim2(0, 40, 0, 40), size: { x: 360, y: 64 } }, {
        appearance: transparentAppearance(),
        children: [
            element('text', 'Rótulo', {}, { text: { content: 'Vida', size: 14, weight: 700, uppercase: true, letterSpacing: 2, color: GUI_THEME.textMuted } }),
            element('text', 'Valor', { position: udim2(1, 0, 0, 0), anchor: { x: 1, y: 0 } }, { text: { content: '80 / 100', size: 14, weight: 600, align: 'right' } }),
            element('progress', 'Barra de vida', { position: udim2(0, 0, 0, 26), size: udim2(1, 0, 0, 18) }, { control: { kind: 'progress', value: 0.8, direction: 'horizontal', reverse: false, fillColor: GUI_THEME.success, fillAlpha: 1, fillGradient: null, showLabel: false, segments: 0 } }),
            element('progress', 'Barra de vigor', { position: udim2(0, 0, 0, 52), size: udim2(0.72, 0, 0, 8) }, { appearance: { radii: uniformRadii(4) }, control: { kind: 'progress', value: 0.55, direction: 'horizontal', reverse: false, fillColor: '#ffb84d', fillAlpha: 1, fillGradient: null, showLabel: false, segments: 0 } }),
        ],
    });
    const objective = element('frame', 'Objetivo', { position: udim2(0.5, 0, 0, 36), anchor: { x: 0.5, y: 0 } }, {
        rect: { autoSize: 'xy' },
        appearance: { fill: solidFill(GUI_THEME.surface, 0.7), radii: uniformRadii(999) },
        layout: { kind: 'list', direction: 'horizontal', gap: 10, padding: insets(10, 20), crossAlign: 'center' },
        children: [element('icon', 'Marcador', { size: { x: 18, y: 18 } }, { icon: { name: 'Flag', color: GUI_THEME.accent } }), element('text', 'Texto', {}, { text: { content: 'Encontre a saída da caverna', size: 17, weight: 500 } })],
    });
    const crosshair = element('icon', 'Mira', { position: udim2(0.5, 0, 0.5, 0), anchor: { x: 0.5, y: 0.5 }, size: { x: 28, y: 28 } }, { icon: { name: 'Crosshair', alpha: 0.9, strokeWidth: 1.5 } });
    const minimap = element('frame', 'Minimapa', { position: udim2(1, -40, 0, 40), anchor: { x: 1, y: 0 }, size: { x: 200, y: 200 } }, {
        rect: { aspectRatio: 1 },
        appearance: { fill: solidFill(GUI_THEME.surface, 0.6), stroke: stroke('#ffffff', 0.18, 2), radii: uniformRadii(100) },
        clipsContent: true,
        children: [element('icon', 'Jogador', { position: udim2(0.5, 0, 0.5, 0), anchor: { x: 0.5, y: 0.5 }, size: { x: 22, y: 22 } }, { icon: { name: 'Navigation', color: GUI_THEME.accent } })],
    });
    const ammo = element('frame', 'Munição', { position: udim2(1, -40, 1, -40), anchor: { x: 1, y: 1 } }, {
        rect: { autoSize: 'xy' },
        appearance: transparentAppearance(),
        layout: { kind: 'list', direction: 'vertical', gap: 2, crossAlign: 'end' },
        children: [
            element('text', 'Rótulo', {}, { text: { content: 'Munição', size: 14, weight: 700, uppercase: true, letterSpacing: 2, color: GUI_THEME.textMuted, align: 'right' } }),
            element('text', 'Valor', {}, { text: { content: '24 / 96', size: 44, weight: 800, family: 'builtin:display', align: 'right' } }),
        ],
    });
    const hotbar = element('frame', 'Atalhos', { position: udim2(0.5, 0, 1, -32), anchor: { x: 0.5, y: 1 } }, {
        rect: { autoSize: 'xy' },
        appearance: { fill: solidFill(GUI_THEME.surface, 0.72), radii: uniformRadii(14) },
        layout: { kind: 'list', direction: 'horizontal', gap: 8, padding: insets(8) },
        children: Array.from({ length: 8 }, (_, index) => {
            const base = slot(index + 1, index === 0 ? 'Sword' : index === 1 ? 'Shield' : index === 2 ? 'FlaskConical' : undefined, index === 2 ? '3' : undefined);
            return {
                ...base,
                rect: { ...base.rect, size: udim2(0, 56, 0, 56) },
                appearance: index === 0 ? { ...base.appearance, stroke: stroke(GUI_THEME.accent, 1, 2) } : base.appearance,
                children: [...base.children, element('text', 'Tecla', { position: udim2(0, 5, 0, 3) }, { text: { content: String(index + 1), size: 11, weight: 700, color: GUI_THEME.textMuted } })],
            };
        }),
    });
    return { ...document, root: { ...document.root, children: [health, objective, crosshair, minimap, ammo, hotbar] } };
}
function buildMainMenu(): GuiDocument {
    const document = createGuiDocument('Menu principal');
    const background = element('frame', 'Fundo', { size: udim2(1, 0, 1, 0) }, {
        appearance: {
            fill: {
                color: '#0b0f1a',
                alpha: 1,
                gradient: {
                    kind: 'linear',
                    angle: 20,
                    stops: [
                        { offset: 0, color: '#0b0f1a', alpha: 1 },
                        { offset: 1, color: '#1f2a44', alpha: 1 },
                    ],
                },
            },
            stroke: null,
            radii: uniformRadii(0),
        },
    });
    const title = element('frame', 'Título', { position: udim2(0, 160, 0.42, 0), anchor: { x: 0, y: 1 } }, {
        rect: { autoSize: 'xy' },
        appearance: transparentAppearance(),
        layout: { kind: 'list', direction: 'vertical', gap: 8 },
        children: [
            element('text', 'Nome do jogo', {}, { text: { content: 'Nome do jogo', size: 84, weight: 800, family: 'builtin:display', uppercase: true, letterSpacing: 6, shadow: shadow(24, 8, 0.5) } }),
            element('text', 'Subtítulo', {}, { text: { content: 'Uma aventura feita na Helix', size: 22, weight: 400, color: GUI_THEME.textMuted } }),
        ],
    });
    const menu = element('frame', 'Menu', { position: udim2(0, 160, 0.5, 0) }, {
        rect: { autoSize: 'xy' },
        appearance: transparentAppearance(),
        layout: { kind: 'list', direction: 'vertical', gap: 12 },
        children: [primaryButton('Jogar'), ghostButton('Continuar'), ghostButton('Opções'), ghostButton('Créditos'), ghostButton('Sair', { x: 280, y: 56 }, GUI_THEME.danger)],
    });
    const social = element('frame', 'Links', { position: udim2(0, 160, 1, -40), anchor: { x: 0, y: 1 } }, {
        rect: { autoSize: 'xy' },
        appearance: transparentAppearance(),
        layout: { kind: 'list', direction: 'horizontal', gap: 20 },
        children: ['Globe', 'MessageCircle', 'Users'].map((name) => element('icon', name, { size: { x: 24, y: 24 } }, { icon: { name, color: GUI_THEME.textMuted } })),
    });
    const version = element('text', 'Versão', { position: udim2(1, -40, 1, -36), anchor: { x: 1, y: 1 } }, { text: { content: 'v0.1.0', size: 14, family: 'builtin:mono', color: GUI_THEME.textMuted, align: 'right' } });
    return { ...document, root: { ...document.root, children: [background, title, menu, social, version] } };
}
function buildPause(): GuiDocument {
    const document = createGuiDocument('Menu de pausa');
    const panel = element('frame', 'Painel', { position: udim2(0.5, 0, 0.5, 0), anchor: { x: 0.5, y: 0.5 }, size: { x: 440, y: 420 } }, {
        rect: { autoSize: 'y' },
        appearance: PANEL,
        layout: { kind: 'list', direction: 'vertical', gap: 12, padding: insets(32), crossAlign: 'stretch' },
        children: [
            heading('Pausado'),
            element('divider', 'Divisor', { size: udim2(1, 0, 0, 1) }),
            primaryButton('Continuar', udim2(1, 0, 0, 52)),
            ghostButton('Reiniciar fase', udim2(1, 0, 0, 52)),
            ghostButton('Opções', udim2(1, 0, 0, 52)),
            ghostButton('Sair para o menu', udim2(1, 0, 0, 52), GUI_THEME.danger),
        ],
    });
    const hint = element('text', 'Dica', { position: udim2(0.5, 0, 1, -40), anchor: { x: 0.5, y: 1 } }, { text: { content: 'Pressione Esc para continuar', size: 15, color: GUI_THEME.textMuted, align: 'center' } });
    return { ...document, root: { ...document.root, children: [overlay(), panel, hint] } };
}
function buildSettings(): GuiDocument {
    const document = createGuiDocument('Configurações');
    const slider = (value: number) => element('slider', 'Controle', { size: { x: 280, y: 28 } }, { control: { kind: 'slider', min: 0, max: 100, value, step: 1, direction: 'horizontal', trackColor: '#ffffff', trackAlpha: 0.14, fillColor: GUI_THEME.accent, knobColor: '#ffffff', knobSize: 18, trackThickness: 6 } });
    const toggle = (value: boolean) => element('toggle', 'Alternador', {}, { control: { kind: 'toggle', value, style: 'switch', onColor: GUI_THEME.accent, knobColor: '#ffffff' } });
    const section = (label: string) => element('text', label, {}, { text: { content: label, size: 13, weight: 700, uppercase: true, letterSpacing: 2, color: GUI_THEME.textMuted } });
    const panel = element('frame', 'Painel', { position: udim2(0.5, 0, 0.5, 0), anchor: { x: 0.5, y: 0.5 }, size: { x: 680, y: 560 } }, {
        rect: { autoSize: 'y' },
        appearance: PANEL,
        layout: { kind: 'list', direction: 'vertical', gap: 14, padding: insets(32, 36), crossAlign: 'stretch' },
        children: [
            heading('Configurações', 30),
            element('divider', 'Divisor', { size: udim2(1, 0, 0, 1) }),
            section('Som'),
            settingsRow('Volume geral', slider(80)),
            settingsRow('Música', slider(60)),
            settingsRow('Efeitos', slider(90)),
            section('Vídeo'),
            settingsRow('Tela cheia', toggle(true)),
            settingsRow('Sincronização vertical', toggle(false)),
            settingsRow('Legendas', toggle(true)),
            element('frame', 'Ações', { size: udim2(1, 0, 0, 52) }, { appearance: transparentAppearance(), layout: { kind: 'list', direction: 'horizontal', gap: 12, mainAlign: 'end' }, children: [ghostButton('Cancelar', { x: 160, y: 48 }), primaryButton('Aplicar', { x: 160, y: 48 })] }),
        ],
    });
    return { ...document, root: { ...document.root, children: [overlay(), panel] } };
}
function buildInventory(): GuiDocument {
    const document = createGuiDocument('Inventário');
    const items: Array<[
        string | undefined,
        string | undefined
    ]> = [['Sword', undefined], ['Shield', undefined], ['FlaskConical', '3'], ['Key', '2'], ['Apple', '5'], ['Scroll', undefined], ['Gem', '12']];
    const grid = element('scroll', 'Itens', { position: udim2(0, 32, 0, 96), size: { x: 560, y: 470 } }, {
        appearance: { fill: solidFill('#ffffff', 0.03), stroke: null, radii: uniformRadii(12) },
        layout: { kind: 'grid', direction: 'horizontal', gap: 10, padding: insets(10), cellSize: udim2(0, 88, 0, 88), columns: 5 },
        control: { kind: 'scroll', canvasSize: udim2(1, 0, 0, 620), direction: 'vertical', scrollbarThickness: 6, scrollbarColor: '#ffffff', scrollbarAlpha: 0.35 },
        children: Array.from({ length: 30 }, (_, index) => {
            const item = items[index];
            const base = slot(index + 1, item?.[0], item?.[1]);
            return index === 0 ? { ...base, appearance: { ...base.appearance, stroke: stroke(GUI_THEME.accent, 1, 2) } } : base;
        }),
    });
    const details = element('frame', 'Detalhes', { position: udim2(1, -32, 0, 96), anchor: { x: 1, y: 0 }, size: { x: 320, y: 470 } }, {
        appearance: { fill: solidFill('#ffffff', 0.04), stroke: stroke('#ffffff', 0.08), radii: uniformRadii(12) },
        layout: { kind: 'list', direction: 'vertical', gap: 12, padding: insets(20), crossAlign: 'stretch' },
        children: [
            element('image', 'Imagem do item', { size: { x: 120, y: 120 } }, { rect: { ignoreLayout: false } }),
            element('text', 'Nome do item', {}, { text: { content: 'Espada de ferro', size: 22, weight: 700 } }),
            element('text', 'Descrição', { size: udim2(1, 0, 0, 72) }, { rect: { autoSize: 'y' }, text: { content: 'Uma lâmina confiável forjada pelos ferreiros de Helix. Leve o bastante para golpes rápidos.', size: 15, color: GUI_THEME.textMuted, lineHeight: 1.45, verticalAlign: 'top' } }),
            element('divider', 'Divisor', { size: udim2(1, 0, 0, 1) }),
            element('text', 'Atributos', {}, { text: { content: 'Dano 12  ·  Peso 3,5', size: 15, family: 'builtin:mono' } }),
            primaryButton('Equipar', udim2(1, 0, 0, 48)),
        ],
    });
    const weight = element('frame', 'Peso', { position: udim2(0, 32, 1, -28), anchor: { x: 0, y: 1 }, size: { x: 560, y: 24 } }, {
        appearance: transparentAppearance(),
        children: [
            element('text', 'Rótulo', { position: udim2(0, 0, 0.5, 0), anchor: { x: 0, y: 0.5 } }, { text: { content: 'Peso  23 / 60', size: 13, color: GUI_THEME.textMuted } }),
            element('progress', 'Barra', { position: udim2(1, 0, 0.5, 0), anchor: { x: 1, y: 0.5 }, size: { x: 380, y: 8 } }, { appearance: { radii: uniformRadii(4) }, control: { kind: 'progress', value: 0.38, direction: 'horizontal', reverse: false, fillColor: '#ffb84d', fillAlpha: 1, fillGradient: null, showLabel: false, segments: 0 } }),
        ],
    });
    const closeButton = element('button', 'Fechar', { position: udim2(1, -24, 0, 24), anchor: { x: 1, y: 0 }, size: { x: 40, y: 40 } }, { appearance: { ...GHOST, radii: uniformRadii(20) }, text: { content: '' }, control: { kind: 'button', disabled: false, iconName: 'X', iconPosition: 'only', iconSize: 18, iconGap: 0 }, states: ghostStates() });
    const panel = element('frame', 'Painel', { position: udim2(0.5, 0, 0.5, 0), anchor: { x: 0.5, y: 0.5 }, size: { x: 960, y: 620 } }, { appearance: PANEL, children: [element('text', 'Título', { position: udim2(0, 32, 0, 30) }, { text: { content: 'Inventário', size: 30, weight: 800, family: 'builtin:display', uppercase: true, letterSpacing: 4 } }), closeButton, grid, details, weight] });
    return { ...document, root: { ...document.root, children: [overlay(), panel] } };
}
function buildDialog(): GuiDocument {
    const document = createGuiDocument('Caixa de diálogo');
    const box = element('frame', 'Caixa', { position: udim2(0.5, 0, 1, -48), anchor: { x: 0.5, y: 1 }, size: udim2(0.7, 0, 0, 220) }, {
        rect: { minSize: { x: 720, y: 220 } },
        appearance: { fill: solidFill('#10141f', 0.94), stroke: stroke('#ffffff', 0.1), radii: uniformRadii(18), shadow: shadow(40, 16, 0.45) },
        children: [
            element('image', 'Retrato', { position: udim2(0, 28, 0.5, 0), anchor: { x: 0, y: 0.5 }, size: { x: 164, y: 164 } }, { appearance: { fill: solidFill('#ffffff', 0.05), stroke: stroke('#ffffff', 0.1), radii: uniformRadii(14) } }),
            element('text', 'Nome', { position: udim2(0, 220, 0, 30) }, { text: { content: 'Guardiã da ponte', size: 18, weight: 800, uppercase: true, letterSpacing: 3, color: GUI_THEME.accent } }),
            element('text', 'Fala', { position: udim2(0, 220, 0, 64), size: udim2(1, -260, 0, 110) }, { text: { content: 'Bem-vindo a Helix, viajante. Esta caixa acompanha a largura da tela e quebra o texto sozinha, então pode escrever à vontade.', size: 22, weight: 400, lineHeight: 1.4, verticalAlign: 'top' } }),
            element('icon', 'Continuar', { position: udim2(1, -28, 1, -22), anchor: { x: 1, y: 1 }, size: { x: 22, y: 22 } }, { icon: { name: 'ChevronDown', color: GUI_THEME.textMuted } }),
        ],
    });
    const choices = element('frame', 'Respostas', { position: udim2(0.85, 0, 1, -284), anchor: { x: 1, y: 1 } }, {
        rect: { autoSize: 'xy' },
        appearance: transparentAppearance(),
        layout: { kind: 'list', direction: 'vertical', gap: 8, crossAlign: 'stretch' },
        children: [ghostButton('Quem é você?', { x: 320, y: 44 }), ghostButton('Preciso atravessar.', { x: 320, y: 44 }), ghostButton('Até logo.', { x: 320, y: 44 }, GUI_THEME.textMuted)].map((button) => ({ ...button, text: button.text ? { ...button.text, align: 'left' as const, size: 17 } : null })),
    });
    return { ...document, root: { ...document.root, children: [box, choices] } };
}
function buildTouchControls(): GuiDocument {
    const document = createGuiDocument('Controles de toque', { x: 1280, y: 720 });
    const round = (name: string, icon: string, size: number, position: UDim2): GuiNode => element('button', name, { position, anchor: { x: 1, y: 1 }, size: { x: size, y: size } }, {
        rect: { aspectRatio: 1 },
        appearance: { fill: solidFill('#ffffff', 0.1), stroke: stroke('#ffffff', 0.25, 2), radii: uniformRadii(size / 2), shadow: null },
        text: { content: '' },
        control: { kind: 'button', disabled: false, iconName: icon, iconPosition: 'only', iconSize: Math.round(size * 0.42), iconGap: 0 },
        states: { ...ghostStates(), pressed: { ...emptyStateStyle(), fillColor: '#ffffff', fillAlpha: 0.3, scale: 0.94 } },
    });
    const stick = element('frame', 'Direcional', { position: udim2(0, 56, 1, -56), anchor: { x: 0, y: 1 }, size: { x: 168, y: 168 } }, {
        rect: { aspectRatio: 1 },
        interactable: true,
        appearance: { fill: solidFill('#ffffff', 0.07), stroke: stroke('#ffffff', 0.2, 2), radii: uniformRadii(84), shadow: null },
        children: [element('frame', 'Alavanca', { position: udim2(0.5, 0, 0.5, 0), anchor: { x: 0.5, y: 0.5 }, size: { x: 68, y: 68 } }, { appearance: { fill: solidFill('#ffffff', 0.32), stroke: null, radii: uniformRadii(34), shadow: shadow(10, 2, 0.3) } })],
    });
    const pause = element('button', 'Pausa', { position: udim2(1, -24, 0, 24), anchor: { x: 1, y: 0 }, size: { x: 44, y: 44 } }, { appearance: { ...GHOST, radii: uniformRadii(22) }, text: { content: '' }, control: { kind: 'button', disabled: false, iconName: 'Pause', iconPosition: 'only', iconSize: 18, iconGap: 0 }, states: ghostStates() });
    const health = element('progress', 'Vida', { position: udim2(0, 24, 0, 28), size: { x: 220, y: 12 } }, { appearance: { radii: uniformRadii(6) }, control: { kind: 'progress', value: 0.8, direction: 'horizontal', reverse: false, fillColor: GUI_THEME.success, fillAlpha: 1, fillGradient: null, showLabel: false, segments: 0 } });
    return {
        ...document,
        root: { ...document.root, children: [health, pause, stick, round('Pular', 'ArrowUp', 96, udim2(1, -56, 1, -140)), round('Atacar', 'Sword', 76, udim2(1, -170, 1, -56)), round('Interagir', 'Hand', 64, udim2(1, -176, 1, -196))] },
    };
}
export const GUI_TEMPLATES: readonly GuiTemplate[] = [
    { id: 'blank', label: 'Em branco', description: 'Só a tela, para montar do zero.', build: () => createGuiDocument('Nova tela') },
    { id: 'hud', label: 'HUD de jogo', description: 'Vida e vigor, objetivo, mira, minimapa, munição e barra de atalhos ancorados nas bordas.', build: buildHud },
    { id: 'main-menu', label: 'Menu principal', description: 'Fundo em gradiente, título em destaque e a coluna de botões Jogar, Continuar, Opções.', build: buildMainMenu },
    { id: 'pause', label: 'Menu de pausa', description: 'Jogo escurecido com um painel central e botões empilhados por layout automático.', build: buildPause },
    { id: 'settings', label: 'Configurações', description: 'Linhas de volume com controles deslizantes e opções de vídeo com interruptores.', build: buildSettings },
    { id: 'inventory', label: 'Inventário', description: 'Grade rolável de espaços, coluna de detalhes do item e barra de peso.', build: buildInventory },
    { id: 'dialog', label: 'Caixa de diálogo', description: 'Retrato, nome e fala com quebra automática, mais as respostas do jogador.', build: buildDialog },
    { id: 'touch', label: 'Controles de toque', description: 'Direcional virtual e botões redondos de ação para celular, em 1280×720.', build: buildTouchControls },
];
export function findGuiTemplate(id: string): GuiTemplate {
    return GUI_TEMPLATES.find((template) => template.id === id) ?? GUI_TEMPLATES[0];
}
