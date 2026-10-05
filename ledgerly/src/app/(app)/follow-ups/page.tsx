import type { Metadata } from "next";
import { Bell } from "lucide-react";

import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export const metadata: Metadata = { title: "Follow-ups" };

export default function FollowUpsPage() {
  return (
    <ModulePlaceholder
      title="Follow-ups"
      description="Reminders to call, chase a payment or check in with a customer."
      icon={Bell}
      step={8}
      features={[
        "Create reminders with a due date and priority",
        "Link a reminder to a customer or an order",
        "See what's overdue, due today and coming up",
        "Mark reminders done or snooze them",
      ]}
    />
  );
}
