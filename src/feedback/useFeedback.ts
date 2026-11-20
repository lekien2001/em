import { useRef, useState } from "react";
import { validateFeedback, type FeedbackDraft } from "./validation";

const emptyDraft: FeedbackDraft = { category: "general", message: "", email: "" };
type Delivery = "idle" | "sending" | "failed" | "sent";

export function useFeedback() {
  const [draft, setDraft] = useState(emptyDraft);
  const [delivery, setDelivery] = useState<Delivery>("idle");
  const [submitted, setSubmitted] = useState(false);
  const [standalone] = useState(() => location.protocol === "file:" ||
    !!document.querySelector('meta[name="em-edition"][content="standalone"]'));
  const inFlight = useRef(false);
  const attempt = useRef<{ id: string; content: string } | null>(null);
  const errors = validateFeedback(draft);

  function update<Field extends keyof FeedbackDraft>(field: Field, value: FeedbackDraft[Field]) {
    if (inFlight.current) return;
    setDraft(current => ({ ...current, [field]: value }));
    setDelivery("idle");
  }

  async function submit(website: string) {
    if (standalone || inFlight.current) return;
    setSubmitted(true);
    if (errors.message || errors.email) return;
    inFlight.current = true;
    setDelivery("sending");
    try {
      const payload = { ...draft, message: draft.message.trim(), email: draft.email.trim() || null };
      const content = JSON.stringify(payload);
      if (attempt.current?.content !== content) attempt.current = { id: crypto.randomUUID(), content };
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, id: attempt.current.id, website }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok || (await response.json()).ok !== true) throw new Error("Feedback was not confirmed");
      attempt.current = null;
      setDraft(emptyDraft);
      setSubmitted(false);
      setDelivery("sent");
    } catch {
      setDelivery("failed");
    } finally {
      inFlight.current = false;
    }
  }

  return { draft, delivery, update, submit, submitted, errors, standalone };
}
