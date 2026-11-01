'use client';
import { ChevronDown, RotateCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { GUI_DEVICE_CATEGORIES, searchGuiDevices } from '@/engine/gui/devices/device-catalog';
import type { GuiEmulatedScreen } from '@/engine/gui/devices/device-geometry';
import { formatDpr, GUI_DEVICE_CATEGORY_LABELS, GUI_DEVICE_ORIENTATION_LABELS, type GuiDeviceCategory, type GuiDeviceOrientation } from '@/engine/gui/devices/device-model';
import { MENU_CONTENT_CLASS } from '@/engine/editor/menus/menu-styles';
import { useShortcutHint } from '@/engine/editor/shortcuts/shortcut-bindings';
import { IconButton } from '@/engine/ui/icon-button';
import { SearchField } from '@/engine/ui/search-field';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { ToggleSwitch } from '@/engine/ui/toggle-field';
import { cn } from '@/lib/utils';
import { useGuiDesigner } from '../use-gui-designer';
import { GuiCustomDeviceForm } from './gui-custom-device-form';
import { formatDiagonal, formatLogicalScreen, formatPhysicalPixels, formatPhysicalSize, formatSafeArea, formatSize, formatViewport, screenTitle, screenTraits } from './gui-device-format';
import { GUI_DEVICE_CATEGORY_ICONS, GUI_REFERENCE_SCREEN_ICON } from './gui-device-icons';
import { GuiDeviceList, GuiDeviceOption } from './gui-device-list';
type CategoryFilter = GuiDeviceCategory | 'all';
const CATEGORY_FILTERS: ReadonlyArray<{
    value: CategoryFilter;
    label: string;
}> = [{ value: 'all', label: 'Todos' }, ...GUI_DEVICE_CATEGORIES.map((category) => ({ value: category, label: GUI_DEVICE_CATEGORY_LABELS[category] }))];
const ORIENTATIONS: ReadonlyArray<{
    value: GuiDeviceOrientation;
    label: string;
}> = (['portrait', 'landscape'] as const).map((orientation) => ({ value: orientation, label: GUI_DEVICE_ORIENTATION_LABELS[orientation] }));
function GuiScreenSummary({ screen }: {
    screen: GuiEmulatedScreen;
}) {
    const diagonal = screen.spec ? formatDiagonal(screen.spec) : null;
    const physicalSize = formatPhysicalSize(screen);
    return (<dl className="flex flex-col gap-0.5 px-1 font-mono text-3xs text-muted-foreground">
      <div className="flex items-baseline justify-between gap-2">
        <dt className="sr-only">Aparelho</dt>
        <dd className="min-w-0 truncate font-sans text-2xs font-medium text-foreground">{screenTitle(screen)}</dd>
        <dd className="shrink-0 font-sans">{screenTraits(screen)}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <dt className="sr-only">Tela</dt>
        <dd className="min-w-0 truncate tabular-nums">
          {formatLogicalScreen(screen)} → {formatPhysicalPixels(screen)}
        </dd>
        {diagonal && <dd className="shrink-0 tabular-nums">{diagonal}</dd>}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <dt className="shrink-0 font-sans">Área segura</dt>
        <dd className="min-w-0 truncate tabular-nums">
          {formatSafeArea(screen.safeArea) ?? 'nenhuma'}
          {physicalSize && ` · ${physicalSize}`}
        </dd>
      </div>
    </dl>);
}
function CategoryChip({ label, active, onPick }: {
    label: string;
    active: boolean;
    onPick: () => void;
}) {
    return (<button type="button" role="radio" aria-checked={active} onClick={onPick} className={cn('h-5 shrink-0 rounded-xs px-1.5 text-3xs whitespace-nowrap transition-colors duration-100', FOCUS_RING_CLASS, active ? 'bg-primary/15 text-primary ring-1 ring-primary/35 ring-inset' : 'text-muted-foreground hover:bg-highlight hover:text-foreground')}>
      {label}
    </button>);
}
export function GuiDevicePicker() {
    const designer = useGuiDesigner();
    const hint = useShortcutHint();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<CategoryFilter>('all');
    const [customOpen, setCustomOpen] = useState(false);
    const { screen, document, options, customDevice } = designer;
    const spec = screen.spec;
    const devices = useMemo(() => searchGuiDevices(query, category === 'all' ? null : category), [query, category]);
    const showFixedOptions = query.trim() === '' && category === 'all';
    const TriggerIcon = spec ? GUI_DEVICE_CATEGORY_ICONS[spec.category] : GUI_REFERENCE_SCREEN_ICON;
    const close = () => setOpen(false);
    return (<div className="flex shrink-0 items-center gap-0.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<button type="button" title="Aparelho emulado: a tela em que a interface é testada" className={cn('flex h-7 max-w-80 shrink-0 items-center gap-1.5 rounded-sm px-2 font-mono text-2xs whitespace-nowrap text-foreground transition-colors hover:bg-highlight data-[popup-open]:bg-highlight', FOCUS_RING_CLASS)}/>}>
          <TriggerIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden/>
          <span className="hidden min-w-0 truncate @2xl/workspace:block">{screenTitle(screen)}</span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {formatViewport(screen)} {formatDpr(screen.dpr)}
          </span>
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" aria-hidden/>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={4} className={cn(MENU_CONTENT_CLASS, 'w-[22rem] gap-0 p-0')}>
          <PopoverTitle className="sr-only">Aparelho emulado</PopoverTitle>
          <div className="flex flex-col gap-1.5 border-b border-border p-1.5">
            <SearchField placeholder="Buscar aparelho, marca, plataforma ou resolução" value={query} onChange={setQuery}/>
            <div role="radiogroup" aria-label="Categoria" className="flex gap-0.5 overflow-x-auto [scrollbar-width:none]">
              {CATEGORY_FILTERS.map((filter) => (<CategoryChip key={filter.value} label={filter.label} active={filter.value === category} onPick={() => setCategory(filter.value)}/>))}
            </div>
          </div>
          <div role="listbox" aria-label="Aparelhos" className="max-h-72 overflow-y-auto p-1">
            {showFixedOptions && (<>
                <GuiDeviceOption icon={GUI_REFERENCE_SCREEN_ICON} label="Resolução de referência" detail={document ? formatSize(document.referenceSize.x, document.referenceSize.y) : ''} active={designer.followsReference} onPick={() => {
                designer.resetDevice();
                close();
            }}/>
                <GuiDeviceOption icon={GUI_DEVICE_CATEGORY_ICONS.custom} label="Personalizado…" detail={`${customDevice.width} × ${customDevice.height} ${formatDpr(customDevice.dpr)}`} active={spec?.category === 'custom'} onPick={() => setCustomOpen((value) => !value)}/>
                {customOpen && (<GuiCustomDeviceForm key={`${customDevice.width}x${customDevice.height}@${customDevice.dpr}`} value={customDevice} onApply={(custom) => {
                    designer.emulateCustomDevice(custom);
                    close();
                }}/>)}
              </>)}
            <GuiDeviceList devices={devices} activeId={spec?.id ?? null} onPick={(device) => {
            designer.emulateDevice(device);
            close();
        }}/>
          </div>
          <footer className="flex flex-col gap-2 border-t border-border p-1.5">
            <GuiScreenSummary screen={screen}/>
            <div className="flex items-center gap-3">
              <div className="w-40 shrink-0">
                <SegmentedControl label="Orientação" options={ORIENTATIONS} value={screen.orientation} onChange={(orientation) => designer.setDeviceOrientation(orientation)}/>
              </div>
              <div className="flex min-w-0 flex-1 items-center justify-end gap-3 text-2xs text-muted-foreground">
                <span className="flex items-center gap-1.5" title={hint('Corpo, cantos arredondados, recorte e indicadores do aparelho', 'gui.toggleDeviceFrame')}>
                  <ToggleSwitch label="Moldura do aparelho" on={options.deviceFrame} onToggle={() => designer.toggleOption('deviceFrame')}/>
                  Moldura
                </span>
                <span className="flex items-center gap-1.5" title="Rasterizar a tela na grade de pixels do aparelho (viewport × densidade)">
                  <ToggleSwitch label="Pixels do aparelho" on={options.devicePixels} onToggle={() => designer.toggleOption('devicePixels')}/>
                  Pixels
                </span>
              </div>
            </div>
          </footer>
        </PopoverContent>
      </Popover>
      <IconButton label={hint('Girar o aparelho', 'gui.rotateDevice')} size="sm" onClick={() => designer.rotateDevice()}>
        <RotateCw />
      </IconButton>
    </div>);
}
