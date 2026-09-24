import { APP_NAME } from "@/lib/rating";
import {
  clientKey,
  discordBody,
  isDiscordWebhookUrl,
  parseFeedbackInput,
  rateLimitOk,
} from "@/lib/feedback";

function webhookUrl(): string {
  return (process.env.DISCORD_WEBHOOK_URL ?? "").trim();
}

export async function POST(request: Request) {
  if (!rateLimitOk(clientKey(request))) {
    return Response.json(
      { error: "少し時間をおいてから送ってください" },
      { status: 429 },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "内容を確認してください" }, { status: 400 });
  }

  const parsed = parseFeedbackInput(raw);
  if (typeof parsed === "string") {
    return Response.json({ error: parsed }, { status: 400 });
  }

  const url = webhookUrl();
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      return Response.json(
        { error: "今は受け付けていません" },
        { status: 503 },
      );
    }
    console.info("[feedback]", parsed);
    return Response.json({ ok: true });
  }

  if (!isDiscordWebhookUrl(url)) {
    console.error("[feedback] DISCORD_WEBHOOK_URL の形式が違います");
    return Response.json(
      { error: "今は受け付けていません" },
      { status: 503 },
    );
  }

  const upstream = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(discordBody(parsed, APP_NAME)),
  });

  if (upstream.status === 429) {
    return Response.json(
      { error: "少し時間をおいてから送ってください" },
      { status: 429 },
    );
  }
  if (!upstream.ok) {
    console.error("[feedback] discord", upstream.status);
    return Response.json(
      { error: "送信に失敗しました。時間をおいてやり直してください" },
      { status: 502 },
    );
  }

  return Response.json({ ok: true });
}
