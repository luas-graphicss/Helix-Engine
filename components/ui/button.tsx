import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const RAISED = "bg-linear-to-b from-bevel to-transparent shadow-raised";
const buttonVariants = cva("group/button inline-flex shrink-0 items-center justify-center rounded-sm border text-xs font-medium whitespace-nowrap transition-[color,background-color,border-color,filter] duration-100 outline-none select-none focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-primary active:not-aria-[haspopup]:brightness-90 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", {
    variants: {
        variant: {
            default: cn(RAISED, "border-primary/70 bg-primary text-primary-foreground hover:brightness-110 aria-expanded:brightness-110"),
            outline: cn(RAISED, "border-border bg-surface-raised text-foreground hover:brightness-115 aria-expanded:brightness-115"),
            secondary: cn(RAISED, "border-border bg-surface-raised text-muted-foreground hover:text-foreground hover:brightness-115 aria-expanded:text-foreground"),
            ghost: "border-transparent text-muted-foreground hover:bg-highlight hover:text-foreground aria-expanded:bg-highlight aria-expanded:text-foreground",
            destructive: cn(RAISED, "border-destructive/50 bg-destructive/15 text-destructive hover:bg-destructive/25"),
            link: "border-transparent text-primary underline-offset-4 hover:underline",
        },
        size: {
            default: "h-8 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
            xs: "h-6 gap-1 px-2 text-2xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
            sm: "h-7 gap-1.5 px-2.5 text-2xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
            lg: "h-9 gap-2 px-4",
            icon: "size-8",
            "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
            "icon-sm": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
            "icon-lg": "size-9",
        },
    },
    defaultVariants: {
        variant: "default",
        size: "default",
    },
});
function Button({ className, variant = "default", size = "default", ...props }: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
    return (<ButtonPrimitive data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props}/>);
}
export { Button, buttonVariants };
