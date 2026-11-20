export const feedbackTopics = {
  general: "Góp ý chung",
  bug: "Báo lỗi",
  idea: "Đề xuất tính năng",
} as const;

export const maxFeedbackLength = 2_000;
export const maxFeedbackEmailLength = 254;

export type FeedbackTopic = keyof typeof feedbackTopics;
export type FeedbackDraft = { category: FeedbackTopic; message: string; email: string };

export function isFeedbackTopic(value: unknown): value is FeedbackTopic {
  return typeof value === "string" && Object.hasOwn(feedbackTopics, value);
}

export function validateFeedback({ message, email }: Pick<FeedbackDraft, "message" | "email">) {
  return {
    message: !message.trim() || message.length > maxFeedbackLength
      ? "Nhập nội dung góp ý từ 1 đến 2.000 ký tự." : "",
    email: email.length > maxFeedbackEmailLength || (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      ? "Nhập địa chỉ email hợp lệ hoặc để trống." : "",
  };
}
