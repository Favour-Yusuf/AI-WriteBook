import type { Metadata } from "next";
import { Settings } from "lucide-react";

import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <ModulePlaceholder
      title="Settings"
      description="Your business profile, account and preferences."
      icon={Settings}
      step={10}
      features={[
        "Edit your business name, currency, contact details and logo",
        "Update your name, email and password",
        "Choose light, dark or system theme",
        "Manage how Ledgerly's AI assistant works for you",
      ]}
    />
  );
}
