import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";

/**
 * Shown on a section until it is built, so the app never displays fake data.
 * Each module replaces this with its real page in its build step.
 */
export function ModulePlaceholder({
  title,
  description,
  icon: Icon,
  step,
  features,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  step: number;
  features: string[];
}) {
  return (
    <div className="space-y-8">
      <PageHeader title={title} description={description} />
      <Card className="relative overflow-hidden p-0">
        <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div className="space-y-4">
            <div className="flex size-12 items-center justify-center rounded-xl border bg-card shadow-sm">
              <Icon className="size-6 text-primary" />
            </div>
            <Badge variant="brand">Arrives in build step {step}</Badge>
            <h2 className="text-xl font-semibold tracking-tight">{title} is on its way</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              This section is part of Ledgerly&apos;s plan and will be built in step {step}. Here&apos;s what
              it will let you do:
            </p>
          </div>
          <ul className="grid gap-3">
            {features.map((f) => (
              <li
                key={f}
                className="flex items-start gap-3 rounded-xl border bg-card/80 p-3.5 text-sm shadow-xs"
              >
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-soft">
                  <Check className="size-3 text-brand-soft-foreground" />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}
