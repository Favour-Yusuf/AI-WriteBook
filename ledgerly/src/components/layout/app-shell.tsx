"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar, MobileSidebar } from "@/components/layout/app-sidebar";
import { CommandMenu } from "@/components/layout/command-menu";
import { ShellProvider } from "@/components/layout/shell-context";
import { Topbar } from "@/components/layout/topbar";

export function AppShell({
  defaultCollapsed,
  children,
}: {
  defaultCollapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <ShellProvider defaultCollapsed={defaultCollapsed}>
      <TooltipProvider>
        <div className="flex min-h-dvh">
          <AppSidebar />
          <MobileSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            <main className="flex-1">
              <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</div>
            </main>
          </div>
        </div>
        <CommandMenu />
      </TooltipProvider>
    </ShellProvider>
  );
}
