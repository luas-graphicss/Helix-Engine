'use client';
import { useRef } from 'react';
import { cn } from '@/lib/utils';
import type { LevelMeter } from '@/engine/audio/analysis/level-meter';
import { formatDb } from '@/engine/audio/core/decibels';
import { METER_FLOOR_DB, useLevelMeterFrames } from '@/engine/editor/audio/ui/use-audio-editor';
const SCALE_DB = [0, -6, -12, -24, -48];
const HOT_DB = -6;
const CLIP_DB = -1;
const ARIA_INTERVAL_MS = 250;
type LevelMeterBarsProps = {
    meter: LevelMeter | null;
    active: boolean;
    label: string;
    orientation?: 'vertical' | 'horizontal';
    scale?: boolean;
    className?: string;
};
function fraction(db: number): number {
    return Math.min(1, Math.max(0, (db - METER_FLOOR_DB) / -METER_FLOOR_DB));
}
function peakText(peakDb: number): string {
    return peakDb <= METER_FLOOR_DB ? 'silêncio' : formatDb(peakDb);
}
export function LevelMeterBars({ meter, active, label, orientation = 'vertical', scale = false, className }: LevelMeterBarsProps) {
    const vertical = orientation === 'vertical';
    const channelCount = meter?.channels ?? 2;
    const rootRef = useRef<HTMLDivElement>(null);
    const barRefs = useRef<Array<HTMLDivElement | null>>([]);
    const markerRefs = useRef<Array<HTMLDivElement | null>>([]);
    const ariaRef = useRef({ peak: Number.NaN, at: 0 });
    useLevelMeterFrames(meter, active, (channels, now) => {
        let peak = METER_FLOOR_DB;
        for (let index = 0; index < channels.length; index++) {
            const { levelDb, peakDb } = channels[index];
            if (peakDb > peak)
                peak = peakDb;
            const bar = barRefs.current[index];
            if (bar) {
                const size = `${fraction(levelDb) * 100}%`;
                if (vertical)
                    bar.style.height = size;
                else
                    bar.style.width = size;
                bar.dataset.tone = levelDb >= CLIP_DB ? 'clip' : levelDb >= HOT_DB ? 'hot' : 'normal';
            }
            const marker = markerRefs.current[index];
            if (marker) {
                marker.style.visibility = peakDb > METER_FLOOR_DB ? 'visible' : 'hidden';
                const offset = `calc(${fraction(peakDb) * 100}% - 1px)`;
                if (vertical)
                    marker.style.bottom = offset;
                else
                    marker.style.left = offset;
            }
        }
        const rounded = Math.round(peak);
        const aria = ariaRef.current;
        const root = rootRef.current;
        if (root && rounded !== aria.peak && now - aria.at >= ARIA_INTERVAL_MS) {
            aria.peak = rounded;
            aria.at = now;
            root.setAttribute('aria-valuenow', String(rounded));
            root.setAttribute('aria-valuetext', peakText(peak));
            root.title = `${label}: pico ${peak <= METER_FLOOR_DB ? '−∞' : formatDb(peak)}`;
        }
    });
    return (<div ref={rootRef} role="meter" aria-label={label} aria-valuemin={METER_FLOOR_DB} aria-valuemax={0} aria-valuenow={METER_FLOOR_DB} aria-valuetext="silêncio" title={`${label}: pico −∞`} className={cn('flex gap-px', vertical ? 'h-full flex-row' : 'w-full flex-col', className)}>
      {Array.from({ length: channelCount }, (_, index) => (<div key={index} className={cn('relative overflow-hidden rounded-[1px] bg-surface-sunken ring-1 ring-inset ring-border-strong', vertical ? 'h-full w-1.5' : 'h-1.5 w-full')}>
          <div ref={(element) => {
                barRefs.current[index] = element;
            }} data-tone="normal" className={cn('absolute bg-primary data-[tone=clip]:bg-destructive data-[tone=hot]:bg-warning', vertical ? 'inset-x-0 bottom-0 h-0' : 'inset-y-0 left-0 w-0')}/>
          <div ref={(element) => {
                markerRefs.current[index] = element;
            }} className={cn('invisible absolute bg-foreground', vertical ? 'inset-x-0 h-px' : 'inset-y-0 w-px')}/>
        </div>))}
      {scale && vertical && (<div aria-hidden className="relative ml-0.5 h-full w-5 font-mono text-[8px] leading-none text-muted-foreground/70">
          {SCALE_DB.map((db) => (<span key={db} className="absolute left-0 -translate-y-1/2" style={{ top: `${(1 - fraction(db)) * 100}%` }}>
              {db}
            </span>))}
        </div>)}
    </div>);
}
