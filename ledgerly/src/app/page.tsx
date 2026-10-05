import { redirect } from "next/navigation";

// Signed-in users land on the dashboard. (Sign-in arrives in build step 2.)
export default function Home() {
  redirect("/dashboard");
}
