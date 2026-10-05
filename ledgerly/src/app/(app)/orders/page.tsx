import type { Metadata } from "next";
import { ShoppingBag } from "lucide-react";

import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export const metadata: Metadata = { title: "Orders" };

export default function OrdersPage() {
  return (
    <ModulePlaceholder
      title="Orders"
      description="Record sales, track payment and move orders from pending to completed."
      icon={ShoppingBag}
      step={7}
      features={[
        "Create orders with several products and quantities",
        "Track status: pending, confirmed, completed or cancelled",
        "Record full or part payments and see what's still owed",
        "Filter by status, payment, customer and date",
      ]}
    />
  );
}
