import { Card } from "@/components/ui/card";

export function CommunitySignals({ community }: any) {
  if (!community) return null;
  return (
    <Card className="glass p-6 shadow-soft">
      <h2 className="text-lg font-semibold">Community Signals</h2>
      <p className="mt-2 text-sm text-muted-foreground">Cluster: {community.cluster}</p>
      <div className="mt-4 space-y-2">
        {(community.topMatches || []).map((m: any, i: number) => (
          <div key={i} className="rounded-xl border border-border bg-white/70 p-3 text-sm">
            <p className="font-medium">
              {m.type} - {m.label}
            </p>
            <p className="text-xs text-muted-foreground">Similarity: {(m.score * 100).toFixed(1)}%</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
