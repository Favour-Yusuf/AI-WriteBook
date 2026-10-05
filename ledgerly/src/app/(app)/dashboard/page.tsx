import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Building2,
  CircleDollarSign,
  Package,
  ShoppingBag,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";

export const metadata: Metadata = { title: "Dashboard" };

const SETUP_STEPS = [
  {
    title: "Create your business profile",
    description: "Name, currency and contact details.",
    icon: Building2,
    href: "/settings",
  },
  {
    title: "Add your first customer",
    description: "Who you sell to, with their contact details.",
    icon: Users,
    href: "/customers",
  },
  {
    title: "Add your products",
    description: "What you sell, with prices and stock.",
    icon: Package,
    href: "/products",
  },
  {
    title: "Record an order",
    description: "Track what was bought and what's been paid.",
    icon: ShoppingBag,
    href: "/orders",
  },
  {
    title: "Set a follow-up",
    description: "A reminder to chase a payment or check in.",
    icon: Bell,
    href: "/follow-ups",
  },
  {
    title: "Ask the AI assistant",
    description: "Get answers about your business in seconds.",
    icon: Sparkles,
    href: "/assistant",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Welcome to Ledgerly"
        description="Your customers, products, orders and follow-ups, all in one place. Here's how to get set up."
        actions={
          <Button asChild variant="outline">
            <Link href="/assistant">
              <Sparkles className="text-primary" />
              Ask Ledgerly AI
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue this month"
          value="—"
          icon={CircleDollarSign}
          hint="Appears once you record orders"
        />
        <StatCard
          label="Orders this month"
          value="—"
          icon={ShoppingBag}
          hint="Appears once you record orders"
        />
        <StatCard label="Owed to you" value="—" icon={Wallet} hint="Unpaid and part-paid orders" />
        <StatCard label="Follow-ups due" value="—" icon={Bell} hint="Reminders due today or overdue" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Get started</CardTitle>
          <CardDescription>Six quick steps to run your business from Ledgerly.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3 md:grid-cols-2">
            {SETUP_STEPS.map((step, i) => (
              <li key={step.title} className="min-w-0">
                <Link
                  href={step.href}
                  className="group flex items-center gap-4 rounded-xl border bg-card p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                >
                  <div className="relative flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft">
                    <step.icon className="size-[18px] text-brand-soft-foreground" />
                    <span className="absolute -top-1.5 -left-1.5 flex size-5 items-center justify-center rounded-full border bg-card text-[10px] font-semibold text-muted-foreground">
                      {i + 1}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{step.description}</p>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="brand">Build step 1</Badge>
        Foundation and design system are ready. Live numbers appear here as each module is built.
      </div>
    </div>
  );
}
