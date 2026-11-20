import { isFeedbackTopic, validateFeedback } from "../src/feedback/validation";

export type FeedbackDatabase = {
  prepare(sql: string): {
    bind(...values: (string | null)[]): { run(): Promise<{ success: boolean }> };
  };
};

const maxBodyBytes = 12 * 1024;
const uuidV4 = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

function response(status: number, code?: string) {
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (status === 405) headers.set("Allow", "POST");
  return Response.json(code ? { error: code } : { ok: true }, { status, headers });
}

async function readBody(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let body = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return body + decoder.decode();
      bytes += value.byteLength;
      if (bytes > maxBodyBytes) {
        await reader.cancel();
        return null;
      }
      body += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

export async function handleFeedback(request: Request, database?: FeedbackDatabase) {
  if (request.method !== "POST") return response(405, "method");
  if (request.headers.get("Origin") !== new URL(request.url).origin) return response(403, "origin");
  if (request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return response(415, "content_type");
  }
  if (Number(request.headers.get("Content-Length")) > maxBodyBytes) return response(413, "too_large");
  if (!request.body) return response(400, "invalid");

  let input: unknown;
  try {
    const body = await readBody(request.body);
    if (body === null) return response(413, "too_large");
    input = JSON.parse(body);
  } catch {
    return response(400, "invalid");
  }
  if (!input || typeof input !== "object") return response(400, "invalid");
  const { id, category, message, email, website } = input as Record<string, unknown>;
  if (typeof website === "string" && website.trim()) return response(200);
  if (typeof id !== "string" || !uuidV4.test(id) || !isFeedbackTopic(category) ||
      typeof message !== "string" || (email != null && typeof email !== "string")) {
    return response(400, "invalid");
  }
  const errors = validateFeedback({ message, email: email ?? "" });
  if (errors.message || errors.email) return response(400, "invalid");
  if (!database) return response(503, "unavailable");

  try {
    const result = await database.prepare(
      "INSERT INTO feedback (id, category, message, email) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
    ).bind(id.toLowerCase(), category, message.trim(), email?.trim() || null).run();
    return result.success ? response(200) : response(503, "unavailable");
  } catch {
    return response(503, "unavailable");
  }
}
