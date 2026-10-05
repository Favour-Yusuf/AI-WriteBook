"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Bell, Package, ShoppingBag, UserPlus } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useShell } from "@/components/layout/shell-context";
import { THEME_OPTIONS } from "@/components/layout/theme-toggle";
import { ALL_NAV_ITEMS } from "@/lib/navigation";

export const CREATE_ACTIONS = [
  { label: "New order", href: "/orders?new=1", icon: ShoppingBag },
  { label: "New customer", href: "/customers?new=1", icon: UserPlus },
  { label: "New product", href: "/products?new=1", icon: Package },
  { label: "New follow-up", href: "/follow-ups?new=1", icon: Bell },
];

export function CommandMenu() {
  const { commandOpen, setCommandOpen } = useShell();
  const router = useRouter();
  const { setTheme } = useTheme();

  const run = (fn: () => void) => {
    setCommandOpen(false);
    fn();
  };

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Search pages and actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Go to">
          {ALL_NAV_ITEMS.map((item) => (
            <CommandItem
              key={item.href}
              value={`${item.title} ${item.description}`}
              onSelect={() => run(() => router.push(item.href))}
            >
              <item.icon />
              <span>{item.title}</span>
              <span className="truncate text-xs text-muted-foreground">{item.description}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Create">
          {CREATE_ACTIONS.map((a) => (
            <CommandItem key={a.href} onSelect={() => run(() => router.push(a.href))}>
              <a.icon />
              {a.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Theme">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <CommandItem key={value} value={`theme ${label}`} onSelect={() => run(() => setTheme(value))}>
              <Icon />
              {label} theme
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      <div className="flex items-center justify-end gap-3 border-t px-4 py-2 text-xs text-muted-foreground">
        <span>
          <CommandShortcut className="ml-0">↵</CommandShortcut> to select
        </span>
        <span>
          <CommandShortcut className="ml-0">esc</CommandShortcut> to close
        </span>
      </div>
    </CommandDialog>
  );
}
