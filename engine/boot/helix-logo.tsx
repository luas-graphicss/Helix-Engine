import { cn } from '@/lib/utils';
type HelixLogoProps = {
    size?: number;
    className?: string;
};
const HEX_POINTS = '1.8,16 8.9,3.7 23.1,3.7 30.2,16 23.1,28.3 8.9,28.3';
const BAR_POINTS = '7.3,16.22 24.7,11.29 24.7,15.78 7.3,20.71';
export function HelixLogo({ size = 20, className }: HelixLogoProps) {
    return (<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={cn('shrink-0', className)}>
      <polygon points={HEX_POINTS} fill="var(--brand)" stroke="var(--brand)" strokeWidth="2" strokeLinejoin="round"/>
      <g fill="var(--brand-foreground)">
        <rect x="6.9" y="8.4" width="4.8" height="15.2"/>
        <rect x="20.3" y="8.4" width="4.8" height="15.2"/>
        <polygon points={BAR_POINTS}/>
      </g>
    </svg>);
}
