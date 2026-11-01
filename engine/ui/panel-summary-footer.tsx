export function PanelSummaryFooter({ parts }: {
    parts: ReadonlyArray<string | false | null | undefined>;
}) {
    const text = parts.filter((part): part is string => typeof part === 'string' && part.length > 0).join(' · ');
    return (<div className="flex h-statusbar shrink-0 items-center border-t border-border bg-surface-sunken px-2 font-mono text-3xs text-muted-foreground shadow-well">
      <span className="min-w-0 truncate" title={text}>
        {text}
      </span>
    </div>);
}
