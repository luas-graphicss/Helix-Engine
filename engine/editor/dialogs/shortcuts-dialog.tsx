'use client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SHORTCUT_GROUPS } from '@/engine/editor/shortcuts/shortcut-map';
type ShortcutsDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};
export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
    return (<Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-4 rounded-sm border-border-strong bg-surface p-5 text-foreground">
        <DialogHeader>
          <DialogTitle className="text-sm">Atalhos de teclado</DialogTitle>
          <DialogDescription className="text-2xs text-muted-foreground">
            Os atalhos valem com o foco no viewport ou nos painéis, fora de campos de texto.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {SHORTCUT_GROUPS.map((group) => (<section key={group.title} className="flex flex-col gap-1.5">
              <h3 className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">{group.title}</h3>
              <ul className="flex flex-col gap-1">
                {group.items.map((item) => (<li key={item.label} className="flex items-center justify-between gap-3 text-2xs">
                    <span className="text-foreground/90">{item.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {item.keys.map((key) => (<kbd key={key} className="rounded-sm border border-border-strong bg-surface-sunken px-1.5 py-px font-mono text-[10px] text-foreground">
                          {key}
                        </kbd>))}
                    </span>
                  </li>))}
              </ul>
            </section>))}
        </div>
      </DialogContent>
    </Dialog>);
}
