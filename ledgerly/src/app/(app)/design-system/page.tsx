import type { Metadata } from "next";
import { Inbox, Info, Package, ShoppingBag, TriangleAlert, Users } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard, StatCardSkeleton } from "@/components/shared/stat-card";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { DemoErrorState, DemoSelect, DemoToasts } from "./demos";

export const metadata: Metadata = { title: "Design system" };

const SWATCHES = [
  ["Primary", "bg-primary"],
  ["Brand soft", "bg-brand-soft"],
  ["Success", "bg-success"],
  ["Warning", "bg-warning"],
  ["Destructive", "bg-destructive"],
  ["Info", "bg-info"],
  ["Muted", "bg-muted"],
  ["Card", "bg-card"],
];

const SAMPLE_ROWS = [
  { item: "Example product A", status: "Paid", variant: "success" as const, amount: "12,500.00" },
  { item: "Example product B", status: "Part paid", variant: "warning" as const, amount: "8,000.00" },
  { item: "Example product C", status: "Unpaid", variant: "destructive" as const, amount: "3,250.00" },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  return (
    <div className="space-y-12">
      <PageHeader
        title="Design system"
        description="The building blocks every Ledgerly screen is made from. Sample content only."
      />

      <Section
        title="Colours"
        description="Defined once as tokens in globals.css, with a dark-mode version of each."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SWATCHES.map(([name, cls]) => (
            <div key={name} className="overflow-hidden rounded-xl border bg-card">
              <div className={`h-16 ${cls}`} />
              <div className="px-3 py-2 text-sm font-medium">{name}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Delete</Button>
          <Button variant="link">Link</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="brand">Brand</Badge>
          <Badge variant="success">Paid</Badge>
          <Badge variant="warning">Part paid</Badge>
          <Badge variant="destructive">Overdue</Badge>
          <Badge variant="info">New</Badge>
          <Badge variant="secondary">Draft</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      </Section>

      <Section title="Forms">
        <Card>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="ds-name">Name</Label>
              <Input id="ds-name" placeholder="Type here" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ds-email">Email (invalid example)</Label>
              <Input id="ds-email" defaultValue="not-an-email" aria-invalid />
              <p className="text-xs text-destructive">Enter a valid email address.</p>
            </div>
            <div className="grid gap-2">
              <Label>Select</Label>
              <DemoSelect />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ds-disabled">Disabled</Label>
              <Input id="ds-disabled" disabled placeholder="Can't edit" />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="ds-notes">Notes</Label>
              <Textarea id="ds-notes" placeholder="Longer text" />
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section title="Cards & stats">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Stat with rise"
            value="1,234"
            icon={ShoppingBag}
            trend={12.4}
            hint="vs last period"
          />
          <StatCard label="Stat with fall" value="567" icon={Users} trend={-3.1} hint="vs last period" />
          <StatCard label="Plain stat" value="89" icon={Package} hint="Helper text" />
          <StatCardSkeleton />
        </div>
      </Section>

      <Section title="Table">
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_ROWS.map((r) => (
                <TableRow key={r.item}>
                  <TableCell className="font-medium">{r.item}</TableCell>
                  <TableCell>
                    <Badge variant={r.variant}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular">{r.amount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="one">
          <TabsList>
            <TabsTrigger value="one">Overview</TabsTrigger>
            <TabsTrigger value="two">Details</TabsTrigger>
            <TabsTrigger value="three">History</TabsTrigger>
          </TabsList>
          <TabsContent value="one" className="text-sm text-muted-foreground">
            Overview content.
          </TabsContent>
          <TabsContent value="two" className="text-sm text-muted-foreground">
            Details content.
          </TabsContent>
          <TabsContent value="three" className="text-sm text-muted-foreground">
            History content.
          </TabsContent>
        </Tabs>
      </Section>

      <Section title="Alerts">
        <div className="grid gap-3 md:grid-cols-2">
          <Alert>
            <Info />
            <AlertTitle>Information</AlertTitle>
            <AlertDescription>A neutral message for the user.</AlertDescription>
          </Alert>
          <Alert variant="warning">
            <TriangleAlert />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>Something needs attention soon.</AlertDescription>
          </Alert>
        </div>
      </Section>

      <Section title="Feedback" description="Toasts confirm actions; they appear in the top-right corner.">
        <DemoToasts />
      </Section>

      <Section title="States" description="Every data screen has empty, loading and error states.">
        <div className="grid gap-4 lg:grid-cols-2">
          <EmptyState
            icon={Inbox}
            title="Nothing here yet"
            description="Explain what will appear here and how to add the first item."
            action={<Button size="sm">Add the first one</Button>}
          />
          <DemoErrorState />
        </div>
        <TableSkeleton rows={3} columns={4} />
      </Section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Typography</CardTitle>
          <CardDescription>Geist, with tight headings and comfortable body text.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-3xl font-semibold tracking-tight">Heading one</p>
          <p className="text-xl font-semibold tracking-tight">Heading two</p>
          <p className="text-base">Body text for paragraphs and descriptions.</p>
          <p className="text-sm text-muted-foreground">Secondary text for hints and metadata.</p>
          <p className="text-2xl font-semibold tabular">1,234,567.89</p>
        </CardContent>
      </Card>
    </div>
  );
}
