"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function DemoToasts() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="outline"
        onClick={() => toast.success("Saved", { description: "Your changes were saved." })}
      >
        Success toast
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.error("Couldn't save", { description: "Please try again." })}
      >
        Error toast
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast.promise(new Promise((resolve) => setTimeout(resolve, 1200)), {
            loading: "Saving…",
            success: "All done",
            error: "Failed",
          })
        }
      >
        Loading toast
      </Button>
    </div>
  );
}

export function DemoSelect() {
  return (
    <Select defaultValue="pending">
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Choose a status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="pending">Pending</SelectItem>
        <SelectItem value="confirmed">Confirmed</SelectItem>
        <SelectItem value="completed">Completed</SelectItem>
        <SelectItem value="cancelled">Cancelled</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function DemoErrorState() {
  return <ErrorState onRetry={() => toast("Retrying…")} />;
}
