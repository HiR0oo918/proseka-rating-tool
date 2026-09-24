"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FEEDBACK_DIFFICULTIES,
  FEEDBACK_KINDS,
  FEEDBACK_LIMITS,
  type FeedbackKind,
} from "@/lib/feedback";

const KIND_OPTIONS = Object.entries(FEEDBACK_KINDS) as [
  FeedbackKind,
  string,
][];

export function FeedbackDialog() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [body, setBody] = useState("");
  const [contact, setContact] = useState("");
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function resetForm() {
    setKind("bug");
    setBody("");
    setContact("");
    setTitle("");
    setDifficulty("");
    setBusy(false);
    setError(null);
    setDone(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, body, contact, title, difficulty }),
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!res.ok) {
        setError(data?.error ?? "送信に失敗しました");
        return;
      }
      setDone(true);
    } catch {
      setError("送信に失敗しました。通信を確認してください");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        フィードバック
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>フィードバック</DialogTitle>
          <DialogDescription>
            不具合や定数の誤り、要望を送れます。リザルトは付きません。
          </DialogDescription>
        </DialogHeader>
        {done ? (
          <div className="space-y-3">
            <p className="text-sm">受け付けました。ありがとうございます。</p>
            <Button variant="outline" onClick={() => setOpen(false)}>
              閉じる
            </Button>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={(e) => void onSubmit(e)}>
            <div className="space-y-1">
              <Label htmlFor="feedback-kind">種類</Label>
              <select
                id="feedback-kind"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={kind}
                onChange={(e) => setKind(e.target.value as FeedbackKind)}
              >
                {KIND_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="feedback-body">内容</Label>
              <textarea
                id="feedback-body"
                required
                maxLength={FEEDBACK_LIMITS.body}
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="何が起きるか、どの曲か、期待した動き"
                className="min-h-28 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {body.length} / {FEEDBACK_LIMITS.body}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="feedback-title">曲名（任意）</Label>
                <Input
                  id="feedback-title"
                  value={title}
                  maxLength={FEEDBACK_LIMITS.title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例: 人生"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="feedback-diff">難易度（任意）</Label>
                <select
                  id="feedback-diff"
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                >
                  <option value="">指定しない</option>
                  {FEEDBACK_DIFFICULTIES.map((value) => (
                    <option key={value} value={value}>
                      {value.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="feedback-contact">連絡先（任意）</Label>
              <Input
                id="feedback-contact"
                value={contact}
                maxLength={FEEDBACK_LIMITS.contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Discord名やメールなど"
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                やめる
              </Button>
              <Button type="submit" disabled={busy || !body.trim()}>
                {busy ? "送信中…" : "送る"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
