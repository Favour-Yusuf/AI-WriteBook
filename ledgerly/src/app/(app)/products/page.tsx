import type { Metadata } from "next";
import { Package } from "lucide-react";

import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export const metadata: Metadata = { title: "Products" };

export default function ProductsPage() {
  return (
    <ModulePlaceholder
      title="Products"
      description="Everything you sell, with prices, costs and stock levels."
      icon={Package}
      step={6}
      features={[
        "Add, edit, view and delete products and services",
        "Track price, cost and profit margin per item",
        "Stock that goes down automatically when you record an order",
        "Low-stock alerts before you run out",
      ]}
    />
  );
}
