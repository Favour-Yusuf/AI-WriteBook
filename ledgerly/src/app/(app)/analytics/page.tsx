import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";

import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <ModulePlaceholder
      title="Analytics"
      description="Understand your sales, best sellers and best customers over time."
      icon={BarChart3}
      step={10}
      features={[
        "Revenue and order trends by day, week or month",
        "Best-selling products and top customers",
        "Unpaid balances and payment trends",
        "Compare any period with the one before",
      ]}
    />
  );
}
