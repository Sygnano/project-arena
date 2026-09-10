import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <Card className="border-frame-subtle bg-panel hover:border-lol-gold-500 transition-colors">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs uppercase tracking-[0.18em] text-lol-gold-600 font-body font-normal">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold text-heading font-display">{value}</div>
        {hint ? <p className="mt-2 text-sm text-lol-text-muted">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
