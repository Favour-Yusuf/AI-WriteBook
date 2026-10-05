"use client";

import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useShell } from "@/components/layout/shell-context";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { cn } from "@/lib/utils";

/** Desktop sidebar: full width or a slim icon rail. */
export function AppSidebar() {
  const { collapsed, toggleCollapsed } = useShell();
  return (
    <aside
      className={cn(
        "sticky top-0 z-40 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out md:flex",
        collapsed ? "w-[72px]" : "w-[264px]",
      )}
    >
      <div className={cn("flex h-16 items-center px-4", collapsed && "justify-center px-0")}>
        <Link href="/dashboard" aria-label="Ledgerly home">
          <Logo showText={!collapsed} />
        </Link>
      </div>
      <SidebarNav collapsed={collapsed} />
      <div className="border-t border-sidebar-border p-3">
        <UserMenu collapsed={collapsed} />
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="absolute top-5 -right-4 z-10 size-7 rounded-full bg-card text-muted-foreground shadow-sm hover:text-foreground"
          >
            {collapsed ? <PanelLeftOpen className="size-3.5" /> : <PanelLeftClose className="size-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {collapsed ? "Expand" : "Collapse"} <kbd className="ml-1 opacity-70">Ctrl B</kbd>
        </TooltipContent>
      </Tooltip>
    </aside>
  );
}

/** Mobile sidebar: slides in from the left. */
export function MobileSidebar() {
  const { mobileOpen, setMobileOpen } = useShell();
  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent side="left" className="w-[284px] gap-0 bg-sidebar p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SheetDescription className="sr-only">Go to a section of Ledgerly</SheetDescription>
        <div className="flex h-16 items-center px-4">
          <Logo />
        </div>
        <SidebarNav onNavigate={() => setMobileOpen(false)} />
        <div className="border-t border-sidebar-border p-3">
          <UserMenu />
        </div>
      </SheetContent>
    </Sheet>
  );
}
