"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getHistory } from "@/lib/api";

export default function HistoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getHistory();
        setItems(res.items || []);
      } catch (err: any) {
        if (err?.status === 402) setBlocked(true);
      }
    };
    load();
  }, []);

  if (blocked) {
    return (
      <main className="min-h-screen px-6 py-12">
        <div className="mx-auto max-w-3xl">
          <Card className="glass p-6 shadow-soft">
            <h1 className="text-xl font-semibold">History is Pro-only</h1>
            <p className="mt-2 text-sm text-muted-foreground">Upgrade to access your scan history.</p>
            <Link href="/paywall">
              <Button className="mt-4">Go Pro</Button>
            </Link>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="text-2xl font-semibold">Scan History</h1>
        {items.map((scan) => (
          <Card key={scan._id} className="glass p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{new Date(scan.createdAt).toLocaleString()}</p>
                <p className="mt-1 text-sm font-medium">Trust Score: {scan.trustScore}</p>
              </div>
              <Link href={`/result/${scan._id}`} className="text-sm text-primary">
                View
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
