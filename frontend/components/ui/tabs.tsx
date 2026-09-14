import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

// 11.css styles [role=tablist]/[role=tab]/[role=tabpanel] natively (plan G1);
// these wrappers add the class names so the styles apply even outside a
// .win11-scoped root, plus the variants/overflow/badge layer from the plan
// (Phase 4.1).

export type TabsVariant = "default" | "pills" | "underline" | "segment";

const TabsVariantContext = React.createContext<TabsVariant>("default");

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
    /** default=Fluent underline; pills=rounded chips; segment=connected control */
    variant?: TabsVariant;
  }
>(({ className, variant = "default", children, ...props }, ref) => (
  <TabsVariantContext.Provider value={variant}>
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "win11-tablist flex w-full gap-1 whitespace-nowrap overflow-x-auto [scrollbar-width:thin]",
        // pills / segment restyle the container (Fluent look comes from the
        // per-trigger classes below).
        variant === "pills" &&
          "gap-1 rounded-lg bg-[var(--w11-control-hover,rgba(0,0,0,0.045))] p-1 w-fit",
        variant === "segment" &&
          "gap-0 rounded-lg border border-[var(--w11-border,rgba(0,0,0,0.12))] bg-[var(--w11-control-hover,rgba(0,0,0,0.045))] p-1 w-fit",
        variant === "underline" && "border-b border-[var(--w11-border-subtle,rgba(0,0,0,0.08))]",
        className
      )}
      {...props}
    >
      {children}
    </TabsPrimitive.List>
  </TabsVariantContext.Provider>
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
    /** Count badge — e.g. pending items on a "Pending (3)" tab. */
    badge?: number | string;
  }
>(({ className, children, badge, ...props }, ref) => {
  const variant = React.useContext(TabsVariantContext);
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "win11-tab inline-flex items-center gap-1.5 whitespace-nowrap outline-none disabled:pointer-events-none disabled:opacity-50",
        variant === "pills" &&
          "rounded-md px-3 py-1.5 text-[13px] data-[state=active]:bg-[var(--w11-accent)] data-[state=active]:text-white",
        variant === "segment" &&
          "rounded-md px-3 py-1.5 text-[13px] data-[state=active]:bg-[var(--w11-surface-raised,#fff)] data-[state=active]:shadow-sm",
        className
      )}
      {...props}
    >
      {children}
      {badge !== undefined && badge !== null && (
        <span
          className="inline-flex min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-4"
          style={{
            background: "var(--w11-accent)",
            color: "#fff",
          }}
        >
          {badge}
        </span>
      )}
    </TabsPrimitive.Trigger>
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("win11-tabpanel mt-2 outline-none", className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
