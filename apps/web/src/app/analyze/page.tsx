"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { analyze } from "@/lib/api";

export default function AnalyzePage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [urls, setUrls] = useState("");
  const [inputType, setInputType] = useState<"sms" | "email" | "message">("message");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!text.trim()) {
      toast.error("Please paste a message");
      return;
    }
    setLoading(true);
    try {
      const urlList = urls
        .split(/\n|,/) // newline or comma
        .map((u) => u.trim())
        .filter(Boolean);
      const res = await analyze({ text, inputType, urls: urlList });
      router.push(`/result/${res.scanId}`);
    } catch (err: any) {
      if (err?.status === 401) {
        toast.error("Please sign in to run a scan");
        router.push("/account");
      } else {
        toast.error(err?.message || "Scan failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <Card className="glass p-6 shadow-soft">
          <h1 className="text-2xl font-semibold">Run a Trust Scan</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Paste a message, email, or link. We never fetch full page contents.
          </p>

          <div className="mt-6">
            <Tabs value={inputType} onValueChange={(v) => setInputType(v as any)}>
              <TabsList>
                <TabsTrigger value="message">Message</TabsTrigger>
                <TabsTrigger value="sms">SMS</TabsTrigger>
                <TabsTrigger value="email">Email</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="mt-6">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste suspicious content here..."
              rows={8}
            />
          </div>

          <div className="mt-4">
            <Input
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder="Optional URLs (comma or newline separated)"
            />
          </div>

          <div className="mt-6 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Free plan: 10 scans/day</p>
            <Button onClick={onSubmit} disabled={loading}>
              {loading ? "Analyzing..." : "Analyze"}
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
