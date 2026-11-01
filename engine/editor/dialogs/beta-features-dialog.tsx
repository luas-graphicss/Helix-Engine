'use client';
import { FlaskConical } from 'lucide-react';
import { BETA_FEATURES, betaFeatures, useBetaFeaturesVersion, type BetaFeature } from '@/engine/settings/beta-features';
import { EMPTY_WELL_CLASS } from '@/engine/ui/surface-styles';
import { ToggleSwitch } from '@/engine/ui/toggle-field';
import { cn } from '@/lib/utils';
import { EditorDialogShell } from './editor-dialog-shell';
interface BetaFeaturesDialogProps {
    open: boolean;
    onOpenChange(open: boolean): void;
}
function BetaFeatureRow({ feature }: {
    feature: BetaFeature;
}) {
    const enabled = betaFeatures.isEnabled(feature.id);
    return (<li className="flex items-start justify-between gap-4 px-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs font-medium text-foreground">{feature.label}</span>
        <span className="text-2xs leading-relaxed text-muted-foreground text-pretty">{feature.description}</span>
      </div>
      <ToggleSwitch label={feature.label} on={enabled} onToggle={() => betaFeatures.setEnabled(feature.id, !enabled)} className="mt-0.5"/>
    </li>);
}
export function BetaFeaturesDialog({ open, onOpenChange }: BetaFeaturesDialogProps) {
    useBetaFeaturesVersion();
    const enabledCount = betaFeatures.enabledCount;
    return (<EditorDialogShell open={open} onOpenChange={onOpenChange} title="Funcionalidades beta" description="Recursos em experimentação. Ligue ou desligue a qualquer momento; a escolha vale para todos os seus jogos." action="helix.beta" size="md" footer={<span className="font-mono text-3xs text-muted-foreground">
          {BETA_FEATURES.length === 0 ? 'Nenhum recurso em beta no momento.' : `${enabledCount} de ${BETA_FEATURES.length} ${BETA_FEATURES.length === 1 ? 'ativo' : 'ativos'}`}
        </span>}>
      {BETA_FEATURES.length === 0 ? (<div className={cn('m-4 flex flex-col items-center gap-3 px-6 py-10 text-center', EMPTY_WELL_CLASS)}>
          <FlaskConical className="size-6 text-muted-foreground" aria-hidden/>
          <p className="max-w-64 text-xs leading-relaxed text-muted-foreground text-pretty">
            Novos recursos em experimentação aparecem aqui, com um interruptor para você testá-los.
          </p>
        </div>) : (<ul className="divide-y divide-border">
          {BETA_FEATURES.map((feature) => (<BetaFeatureRow key={feature.id} feature={feature}/>))}
        </ul>)}
    </EditorDialogShell>);
}
