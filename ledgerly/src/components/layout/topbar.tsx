"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CREATE_ACTIONS } from "@/components/layout/command-menu";
import { useShell } from "@/components/layout/shell-context";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LogoMark } from "@/components/brand/logo";
import { findNavItem } from "@/lib/navigation";

export function Topbar() {
  const pathname = usePathname();
  const { setMobileOpen, setCommandOpen } = useShell();
  const current = findNavItem(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="-ml-1.5 md:hidden"
        aria-label="Open menu"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="size-5" />
      </Button>
      <Link href="/dashboard" className="md:hidden" aria-label="Ledgerly home">
        <LogoMark className="size-7" />
      </Link>

      <div className="hidden min-w-0 items-center gap-2 text-sm md:flex">
        <span className="text-muted-foreground">Ledgerly</span>
        {current && (
          <>
            <span className="text-muted-foreground/50">/</span>
            <span className="truncate font-medium text-foreground">{current.title}</span>
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="hidden h-9 w-64 items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground shadow-xs transition-colors hover:bg-accent sm:flex lg:w-80"
        >
          <Search className="size-4" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium">
            Ctrl K
          </kbd>
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground sm:hidden"
          aria-label="Search"
          onClick={() => setCommandOpen(true)}
        >
          <Search className="size-[18px]" />
        </Button>
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="h-9 gap-1.5 px-3">
              <Plus className="size-4" />
              <span className="hidden sm:inline">New</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {CREATE_ACTIONS.map((a) => (
              <DropdownMenuItem key={a.href} asChild>
                <Link href={a.href}>
                  <a.icon />
                  {a.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
