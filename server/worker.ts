import { handleFeedback, type FeedbackDatabase } from "./feedback";

type Env = {
  DB?: FeedbackDatabase;
  ASSETS: { fetch(request: Request): Promise<Response> };
};

export default {
  fetch(request: Request, env: Env) {
    if (new URL(request.url).pathname === "/api/feedback") return handleFeedback(request, env.DB);
    return env.ASSETS.fetch(request);
  },
};
