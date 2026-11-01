import type { ComponentType, ReactNode, SVGProps } from 'react';
export type CodeIconProps = SVGProps<SVGSVGElement>;
export type CodeIcon = ComponentType<CodeIconProps>;
function icon(displayName: string, children: ReactNode, options: {
    filled?: boolean;
} = {}): CodeIcon {
    function Icon(props: CodeIconProps) {
        return (<svg viewBox="0 0 16 16" width="1em" height="1em" fill={options.filled ? 'currentColor' : 'none'} stroke={options.filled ? 'none' : 'currentColor'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
        {children}
      </svg>);
    }
    Icon.displayName = displayName;
    return Icon;
}
export const ServerIcon = icon('ServerIcon', <>
    <rect x="2.5" y="2.5" width="11" height="4.5" rx="1"/>
    <rect x="2.5" y="9" width="11" height="4.5" rx="1"/>
    <path d="M5 4.75h.01"/>
    <path d="M5 11.25h.01"/>
  </>);
export const ClientIcon = icon('ClientIcon', <>
    <rect x="2" y="2.5" width="12" height="8" rx="1"/>
    <path d="M8 10.5v3"/>
    <path d="M5.5 13.5h5"/>
  </>);
export const SharedIcon = icon('SharedIcon', <>
    <rect x="1.5" y="4" width="5" height="8" rx="1"/>
    <rect x="9.5" y="4" width="5" height="8" rx="1"/>
    <path d="M6.5 8h3"/>
  </>);
export const LockIcon = icon('LockIcon', <>
    <rect x="3.5" y="7" width="9" height="7" rx="1"/>
    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>
  </>);
export const LinkIcon = icon('LinkIcon', <>
    <path d="M8 14V8"/>
    <circle cx="8" cy="7" r="1.25"/>
    <path d="M5.2 4.2a4 4 0 0 0 0 5.6"/>
    <path d="M10.8 4.2a4 4 0 0 1 0 5.6"/>
    <path d="M3.2 2.2a6.8 6.8 0 0 0 0 9.6"/>
    <path d="M12.8 2.2a6.8 6.8 0 0 1 0 9.6"/>
  </>);
export const ScriptFileIcon = icon('ScriptFileIcon', <>
    <path d="M4 1.5h5.5L13 5v8.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z"/>
    <path d="M9.5 1.5V5H13"/>
    <path d="m6.75 8.25-1.5 1.75 1.5 1.75"/>
    <path d="m9.25 8.25 1.5 1.75-1.5 1.75"/>
  </>);
export const NewScriptIcon = icon('NewScriptIcon', <>
    <path d="M4 1.5h5.5L13 5v8.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z"/>
    <path d="M9.5 1.5V5H13"/>
    <path d="M8 7.5v4.5"/>
    <path d="M5.75 9.75h4.5"/>
  </>);
export const TemplateIcon = icon('TemplateIcon', <>
    <path d="M4 1.5h5.5L13 5v8.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z"/>
    <path d="M9.5 1.5V5H13"/>
    <path d="M5.5 8.25h5"/>
    <path d="M5.5 10.75h3.5"/>
  </>);
export const LibraryIcon = icon('LibraryIcon', <>
    <path d="M2.5 2.5h3v11h-3z"/>
    <path d="M6.5 2.5h3v11h-3z"/>
    <path d="m10.3 3.6 2.7-.8 2.6 10.1-2.7.8z"/>
  </>);
export const ActorIcon = icon('ActorIcon', <>
    <circle cx="8" cy="4.75" r="2.25"/>
    <path d="M3.5 14a4.5 4.5 0 0 1 9 0"/>
  </>);
export const ResourceIcon = icon('ResourceIcon', <>
    <path d="M8 2.5 14 5.5 8 8.5 2 5.5Z"/>
    <path d="m2 8.75 6 3 6-3"/>
    <path d="m2 11.75 6 3 6-3"/>
  </>);
export const ShaderIcon = icon('ShaderIcon', <>
    <path d="M8 1.75 9.9 6.1l4.35 1.9L9.9 9.9 8 14.25 6.1 9.9 1.75 8l4.35-1.9L8 1.75Z"/>
  </>);
export const LanguageIcon = icon('LanguageIcon', <>
    <path d="M5.75 2.5c-1.5 0-2.25.75-2.25 2.25v1.5c0 1-.5 1.5-1.5 1.75 1 .25 1.5.75 1.5 1.75v1.5c0 1.5.75 2.25 2.25 2.25"/>
    <path d="M10.25 2.5c1.5 0 2.25.75 2.25 2.25v1.5c0 1 .5 1.5 1.5 1.75-1 .25-1.5.75-1.5 1.75v1.5c0 1.5-.75 2.25-2.25 2.25"/>
  </>);
export const BetaIcon = icon('BetaIcon', <>
    <path d="M6 2h4"/>
    <path d="M6.5 2v4.5L2.75 12.6A1.25 1.25 0 0 0 3.8 14.5h8.4a1.25 1.25 0 0 0 1.05-1.9L9.5 6.5V2"/>
    <path d="M4.75 10.5h6.5"/>
  </>);
export const SaveIcon = icon('SaveIcon', <>
    <path d="M2.5 3.5a1 1 0 0 1 1-1h7.5l2.5 2.5v8a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1Z"/>
    <path d="M5 2.5v3h5v-3"/>
    <path d="M4.5 13.5v-3.5h7v3.5"/>
  </>);
export const SaveAllIcon = icon('SaveAllIcon', <>
    <path d="M5 2.5h6.25l2.25 2.25V11"/>
    <path d="M2.5 5.5a1 1 0 0 1 1-1h5.75L11.5 6.75v6.75a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1Z"/>
    <path d="M4.5 14.5v-3h5v3"/>
  </>);
export const RunIcon = icon('RunIcon', <path d="M4.75 2.75a.75.75 0 0 1 1.14-.64l8 5.25a.75.75 0 0 1 0 1.28l-8 5.25a.75.75 0 0 1-1.14-.64V2.75Z"/>, { filled: true });
export const StopIcon = icon('StopIcon', <rect x="3" y="3" width="10" height="10" rx="1.5"/>, { filled: true });
export const BuildIcon = icon('BuildIcon', <>
    <path d="M8 1.75 13.5 4.75v6.5L8 14.25l-5.5-3v-6.5L8 1.75Z"/>
    <path d="M2.5 4.75 8 7.75l5.5-3"/>
    <path d="M8 7.75v6.5"/>
  </>);
export const FindIcon = icon('FindIcon', <>
    <circle cx="7" cy="7" r="4.5"/>
    <path d="m10.5 10.5 3 3"/>
  </>);
export const ReplaceIcon = icon('ReplaceIcon', <>
    <rect x="2" y="8.5" width="5.5" height="5.5" rx="1"/>
    <rect x="8.5" y="2" width="5.5" height="5.5" rx="1"/>
    <path d="M4.75 8.5V6.75a2 2 0 0 1 2-2H9"/>
    <path d="m7.5 3.25 1.5 1.5-1.5 1.5"/>
  </>);
export const EntryFlagIcon = icon('EntryFlagIcon', <>
    <path d="M3.5 14.5v-12"/>
    <path d="M3.5 2.75h8.75l-2 3 2 3H3.5"/>
  </>);
export const ImportIcon = icon('ImportIcon', <>
    <path d="M8 1.75v8"/>
    <path d="m5 6.75 3 3 3-3"/>
    <path d="M2.5 10.5v2a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5v-2"/>
  </>);
export const ExportIcon = icon('ExportIcon', <>
    <path d="M8 9.75v-8"/>
    <path d="m5 4.75 3-3 3 3"/>
    <path d="M2.5 10.5v2a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5v-2"/>
  </>);
export const ViewOptionsIcon = icon('ViewOptionsIcon', <>
    <path d="M2.5 4.25h11"/>
    <path d="M2.5 8h11"/>
    <path d="M2.5 11.75h11"/>
    <circle cx="10.25" cy="4.25" r="1.5" fill="var(--surface)"/>
    <circle cx="5.75" cy="8" r="1.5" fill="var(--surface)"/>
    <circle cx="8.75" cy="11.75" r="1.5" fill="var(--surface)"/>
  </>);
export const PreferencesIcon = icon('PreferencesIcon', <>
    <circle cx="8" cy="8" r="2.5"/>
    <path d="M8 1.75v2M8 12.25v2M1.75 8h2M12.25 8h2M3.58 3.58l1.42 1.42M11 11l1.42 1.42M3.58 12.42 5 11M11 5l1.42-1.42"/>
  </>);
export const CloseIcon = icon('CloseIcon', <>
    <path d="m4 4 8 8"/>
    <path d="m12 4-8 8"/>
  </>);
export const PlusIcon = icon('PlusIcon', <>
    <path d="M8 3v10"/>
    <path d="M3 8h10"/>
  </>);
export const ChevronDownIcon = icon('ChevronDownIcon', <path d="m4 6 4 4 4-4"/>);
export const ChevronRightIcon = icon('ChevronRightIcon', <path d="m6 4 4 4-4 4"/>);
export const BackIcon = icon('BackIcon', <>
    <path d="M13 8H3"/>
    <path d="m7 4-4 4 4 4"/>
  </>);
export const CheckIcon = icon('CheckIcon', <path d="m3.5 8.5 3 3 6-7"/>);
export const PinIcon = icon('PinIcon', <>
    <path d="m9.75 1.75 4.5 4.5-1.25.5-1.25-.25L9 9.25l.25 2.5-1 1-2.5-2.5L2.5 13.5l-1-1 3.25-3.25L2.25 6.75l1-1 2.5.25 2.75-2.75-.25-1.25.5-1.25Z"/>
  </>);
export const WrapIcon = icon('WrapIcon', <>
    <path d="M2.5 4h11"/>
    <path d="M2.5 8h8.25a2 2 0 0 1 0 4H9.5"/>
    <path d="m11 10.5-1.5 1.5 1.5 1.5"/>
    <path d="M2.5 12h3.5"/>
  </>);
export const TerminalIcon = icon('TerminalIcon', <>
    <rect x="2" y="3" width="12" height="10" rx="1.5"/>
    <path d="m4.75 6.5 2 1.5-2 1.5"/>
    <path d="M8.25 9.75h3"/>
  </>);
export const AttachIcon = icon('AttachIcon', <>
    <rect x="2.5" y="2.5" width="4.5" height="3.5" rx=".75"/>
    <rect x="9" y="10" width="4.5" height="3.5" rx=".75"/>
    <path d="M4.75 6v4.5a1.25 1.25 0 0 0 1.25 1.25H9"/>
  </>);
export const WorkspaceIcon = icon('WorkspaceIcon', <>
    <rect x="2" y="2.5" width="12" height="11" rx="1.5"/>
    <path d="M2 6h12"/>
    <path d="M6 6v7.5"/>
  </>);
export const FloatingWindowIcon = icon('FloatingWindowIcon', <>
    <rect x="2" y="3" width="12" height="10" rx="1.5"/>
    <path d="M2 6.25h12"/>
    <path d="M4.25 4.6h.01" strokeWidth={2}/>
    <path d="M6.25 4.6h.01" strokeWidth={2}/>
  </>);
export const BrowserTabIcon = icon('BrowserTabIcon', <>
    <path d="M9.25 2.5h4.25v4.25"/>
    <path d="m13.5 2.5-6 6"/>
    <path d="M12 9.75v3a1 1 0 0 1-1 1H3.25a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3"/>
  </>);
export const ErrorIcon = icon('ErrorIcon', <>
    <circle cx="8" cy="8" r="6"/>
    <path d="M8 4.75V8.5"/>
    <path d="M8 11h.01" strokeWidth={2}/>
  </>);
export const WarningIcon = icon('WarningIcon', <>
    <path d="M7.13 2.75a1 1 0 0 1 1.74 0l5.5 9.75a1 1 0 0 1-.87 1.5H2.5a1 1 0 0 1-.87-1.5l5.5-9.75Z"/>
    <path d="M8 6.5v3"/>
    <path d="M8 11.75h.01" strokeWidth={2}/>
  </>);
export const SuccessIcon = icon('SuccessIcon', <>
    <circle cx="8" cy="8" r="6"/>
    <path d="m5.25 8.25 2 2 3.5-4"/>
  </>);
export const IdleIcon = icon('IdleIcon', <circle cx="8" cy="8" r="6" strokeDasharray="2.6 2.6"/>);
export const SpinnerIcon = icon('SpinnerIcon', <path d="M14 8a6 6 0 1 1-1.76-4.24"/>);
