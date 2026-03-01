import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function UrlIntelList({ intel }: any) {
  if (!intel?.items?.length) return null;
  return (
    <Card className="glass p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">URL Intel</h2>
        <Badge className="bg-slate-100 text-slate-700">Risk {intel.overallRisk}</Badge>
      </div>
      <div className="mt-4 space-y-3">
        {intel.items.map((item: any, idx: number) => (
          <div key={idx} className="rounded-2xl border border-border bg-white/70 p-3 text-sm">
            <p className="font-medium">{item.finalUrl}</p>
            <p className="text-xs text-muted-foreground">Redirects: {item.redirects} • HTTPS: {item.https ? "Yes" : "No"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {item.flags.map((f: string, i: number) => (
                <span key={i} className="rounded-full bg-muted px-2 py-1 text-xs">{f}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
