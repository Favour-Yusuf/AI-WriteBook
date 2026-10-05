"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NAV_GROUPS, SETTINGS_ITEM, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

function NavLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-[14px] font-medium transition-colors duration-150",
        "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        active && "bg-sidebar-accent text-sidebar-accent-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      {active && (
        <span className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r-full bg-sidebar-primary" />
      )}
      <Icon
        className={cn(
          "size-[18px] shrink-0 transition-colors",
          active ? "text-sidebar-primary" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground",
        )}
      />
      {!collapsed && <span className="truncate">{item.title}</span>}
    </Link>
  );

  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.title}</TooltipContent>
    </Tooltip>
  );
}

export function SidebarNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2" aria-label="Main">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-1">
            {collapsed ? (
              <div className="mx-auto mb-2 h-px w-6 bg-sidebar-border" />
            ) : (
              <p className="px-2.5 pb-1 text-[11px] font-semibold tracking-[0.08em] text-sidebar-foreground/45 uppercase">
                {group.label}
              </p>
            )}
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </nav>

      <div className="space-y-2 px-3 pb-3">
        {!collapsed && (
          <Link
            href="/assistant"
            onClick={onNavigate}
            className="group block overflow-hidden rounded-xl border border-sidebar-border bg-gradient-to-br from-brand-soft to-transparent p-3.5 transition-shadow hover:shadow-md"
          >
            <div className="flex items-center gap-2 text-[13px] font-semibold text-sidebar-accent-foreground">
              <Sparkles className="size-4 text-sidebar-primary" />
              Ask Ledgerly AI
            </div>
            <p className="mt-1 text-xs leading-relaxed text-sidebar-foreground/70">
              Get answers about sales, customers and stock in seconds.
            </p>
          </Link>
        )}
        <NavLink item={SETTINGS_ITEM} collapsed={collapsed} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
