import type { Metadata } from "next";
import { Sparkles } from "lucide-react";

import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export const metadata: Metadata = { title: "AI Assistant" };

export default function AssistantPage() {
  return (
    <ModulePlaceholder
      title="AI Assistant"
      description="Ask anything about your business and get answers from your own data."
      icon={Sparkles}
      step={9}
      features={[
        "Ask “How much did I sell this month?” or “Who owes me money?”",
        "Answers use your real customers, products, orders and follow-ups",
        "Draft messages: payment reminders, promotions, replies to customers",
        "Get advice on pricing, marketing and growing the business",
      ]}
    />
  );
}
