import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ProofCard({ title, detail, severity, tags }: any) {
  const color = severity === "high" ? "bg-red-100 text-red-600" : severity === "med" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700";
  return (
    <Card className="border border-border bg-white/70 p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Badge className={color}>{severity}</Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(tags || []).map((t: string, i: number) => (
          <span key={i} className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">#{t}</span>
        ))}
      </div>
    </Card>
  );
}
