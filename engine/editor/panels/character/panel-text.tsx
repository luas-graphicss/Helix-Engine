export function SubHeading({ children }: {
    children: string;
}) {
    return <span className="px-2 pt-2 pb-0.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">{children}</span>;
}
export function Hint({ children }: {
    children: string;
}) {
    return <p className="px-2 py-1 text-[10px] leading-relaxed text-pretty text-muted-foreground">{children}</p>;
}
