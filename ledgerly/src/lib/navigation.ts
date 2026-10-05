import {
  BarChart3,
  Bell,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingBag,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

export type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        description: "Your business at a glance",
      },
      { title: "Analytics", href: "/analytics", icon: BarChart3, description: "Sales, profit and trends" },
    ],
  },
  {
    label: "Manage",
    items: [
      { title: "Orders", href: "/orders", icon: ShoppingBag, description: "Record and track orders" },
      { title: "Customers", href: "/customers", icon: Users, description: "Everyone you sell to" },
      { title: "Products", href: "/products", icon: Package, description: "What you sell and your stock" },
      {
        title: "Follow-ups",
        href: "/follow-ups",
        icon: Bell,
        description: "Reminders to call, chase or check in",
      },
    ],
  },
  {
    label: "Intelligence",
    items: [
      {
        title: "AI Assistant",
        href: "/assistant",
        icon: Sparkles,
        description: "Ask anything about your business",
      },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = {
  title: "Settings",
  href: "/settings",
  icon: Settings,
  description: "Business profile, account and preferences",
};

export const ALL_NAV_ITEMS: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM];

export function findNavItem(pathname: string): NavItem | undefined {
  return ALL_NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(item.href + "/"));
}
