import type { Metadata } from "next";
import { Users } from "lucide-react";

import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export const metadata: Metadata = { title: "Customers" };

export default function CustomersPage() {
  return (
    <ModulePlaceholder
      title="Customers"
      description="Everyone you sell to, with their contact details, history and what they owe."
      icon={Users}
      step={5}
      features={[
        "Add, edit, view and delete customers",
        "See each customer's orders, total spent and balance owed",
        "Search by name, phone or email and filter by status or tag",
        "Keep notes, like delivery preferences or birthdays",
      ]}
    />
  );
}
