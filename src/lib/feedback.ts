export const FEEDBACK_KINDS = {
  bug: "不具合",
  constant: "定数や譜面の誤り",
  request: "要望",
  other: "その他",
} as const;

export type FeedbackKind = keyof typeof FEEDBACK_KINDS;

export const FEEDBACK_DIFFICULTIES = [
  "hard",
  "expert",
  "master",
  "append",
] as const;

export type FeedbackDifficulty = (typeof FEEDBACK_DIFFICULTIES)[number];

export const FEEDBACK_LIMITS = {
  body: 2000,
  contact: 80,
  title: 80,
  difficulty: 16,
} as const;

export const FEEDBACK_RATE = {
  windowMs: 10 * 60 * 1000,
  max: 5,
} as const;

const DISCORD_WEBHOOK_RE =
  /^https:\/\/(?:discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/;

export type FeedbackInput = {
  kind: string;
  body: string;
  contact: string;
  title: string;
  difficulty: string;
};

export type FeedbackPayload = {
  kind: FeedbackKind;
  body: string;
  contact: string;
  title: string;
  difficulty: FeedbackDifficulty | "";
};

export function isFeedbackKind(value: string): value is FeedbackKind {
  return value in FEEDBACK_KINDS;
}

export function parseFeedbackInput(raw: unknown): FeedbackPayload | string {
  if (!raw || typeof raw !== "object") return "内容を確認してください";
  const data = raw as Partial<FeedbackInput>;
  const kind = typeof data.kind === "string" ? data.kind.trim() : "";
  if (!isFeedbackKind(kind)) return "種類を選んでください";
  const body = typeof data.body === "string" ? data.body.trim() : "";
  if (!body) return "内容を書いてください";
  if (body.length > FEEDBACK_LIMITS.body) {
    return `内容は ${String(FEEDBACK_LIMITS.body)} 字までです`;
  }
  const contact =
    typeof data.contact === "string" ? data.contact.trim() : "";
  if (contact.length > FEEDBACK_LIMITS.contact) {
    return `連絡先は ${String(FEEDBACK_LIMITS.contact)} 字までです`;
  }
  const title = typeof data.title === "string" ? data.title.trim() : "";
  if (title.length > FEEDBACK_LIMITS.title) {
    return `曲名は ${String(FEEDBACK_LIMITS.title)} 字までです`;
  }
  const difficulty =
    typeof data.difficulty === "string" ? data.difficulty.trim() : "";
  if (
    difficulty &&
    !FEEDBACK_DIFFICULTIES.includes(difficulty as FeedbackDifficulty)
  ) {
    return "難易度を選び直してください";
  }
  return {
    kind,
    body,
    contact,
    title,
    difficulty: difficulty as FeedbackDifficulty | "",
  };
}

export function isDiscordWebhookUrl(url: string): boolean {
  return DISCORD_WEBHOOK_RE.test(url);
}

const hits = new Map<string, number[]>();

export function rateLimitOk(key: string, now = Date.now()): boolean {
  const cutoff = now - FEEDBACK_RATE.windowMs;
  const next = (hits.get(key) ?? []).filter((t) => t > cutoff);
  if (next.length >= FEEDBACK_RATE.max) {
    hits.set(key, next);
    return false;
  }
  next.push(now);
  hits.set(key, next);
  return true;
}

export function clientKey(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return "unknown";
}

export function discordBody(payload: FeedbackPayload, appName: string) {
  const fields: { name: string; value: string; inline: boolean }[] = [];
  if (payload.title) {
    fields.push({ name: "曲名", value: payload.title, inline: true });
  }
  if (payload.difficulty) {
    fields.push({
      name: "難易度",
      value: payload.difficulty.toUpperCase(),
      inline: true,
    });
  }
  if (payload.contact) {
    fields.push({ name: "連絡先", value: payload.contact, inline: false });
  }
  return {
    username: appName,
    embeds: [
      {
        title: FEEDBACK_KINDS[payload.kind],
        description: payload.body.slice(0, 4000),
        color: 0x8b6bb5,
        fields,
        timestamp: new Date().toISOString(),
        footer: { text: `${appName} フィードバック` },
      },
    ],
  };
}
