import { handleFeedback, type FeedbackDatabase } from "../../server/feedback";

export function onRequest({ request, env }: {
  request: Request;
  env: { FEEDBACK_DB?: FeedbackDatabase };
}) {
  return handleFeedback(request, env.FEEDBACK_DB);
}
