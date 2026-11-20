import { useId } from "react";
import type { useFeedback } from "../feedback/useFeedback";
import { feedbackTopics, isFeedbackTopic, maxFeedbackEmailLength, maxFeedbackLength } from "../feedback/validation";

export function FeedbackPanel({ feedback }: { feedback: ReturnType<typeof useFeedback> }) {
  const { draft, delivery, update, submit, submitted, errors, standalone } = feedback;
  const id = useId();
  const sending = delivery === "sending";
  const messageError = submitted && errors.message;
  const emailError = submitted && errors.email;

  return <form className="feedback-form" noValidate onSubmit={event => {
    event.preventDefault();
    const form = event.currentTarget;
    const invalidField = errors.message ? "message" : errors.email ? "email" : null;
    if (invalidField) form.querySelector<HTMLElement>(`[name="${invalidField}"]`)?.focus();
    void submit(String(new FormData(form).get("website") ?? ""));
  }}>
    <fieldset className="feedback-fields" disabled={sending}>
      <label htmlFor={`${id}-topic`}>Chủ đề</label>
      <select id={`${id}-topic`} value={draft.category} data-initial-focus="true" onChange={event => {
        const value = event.target.value;
        if (isFeedbackTopic(value)) update("category", value);
      }}>
        {Object.entries(feedbackTopics).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <div className="feedback-label">
        <label htmlFor={`${id}-message`}>Nội dung góp ý</label>
        <span id={`${id}-length`}>{draft.message.length.toLocaleString("vi-VN")} / 2.000</span>
      </div>
      <textarea id={`${id}-message`} name="message" rows={4} required maxLength={maxFeedbackLength}
        value={draft.message} onChange={event => update("message", event.target.value)}
        aria-invalid={!!messageError} aria-describedby={`${id}-length${messageError ? ` ${id}-message-error` : ""}`} />
      {messageError && <p className="form-error" id={`${id}-message-error`} role="alert">{messageError}</p>}
      <label htmlFor={`${id}-email`}>Email <span>(không bắt buộc)</span></label>
      <input id={`${id}-email`} name="email" type="email" autoComplete="email" maxLength={maxFeedbackEmailLength}
        value={draft.email} onChange={event => update("email", event.target.value)}
        aria-invalid={!!emailError} aria-describedby={`${id}-email-note${emailError ? ` ${id}-email-error` : ""}`} />
      {emailError && <p className="form-error" id={`${id}-email-error`} role="alert">{emailError}</p>}
      <p id={`${id}-email-note`} className="feedback-note">Email chỉ dùng để phản hồi góp ý của bạn.</p>
      <div hidden>
        <label htmlFor={`${id}-website`}>Trang web</label>
        <input id={`${id}-website`} name="website" type="text" autoComplete="off" tabIndex={-1} />
      </div>
    </fieldset>
    {standalone && <p id={`${id}-offline`} className="feedback-note">Đây là bản HTML dùng thử. Hãy mở website Êm đã triển khai để gửi góp ý.</p>}
    <div className="feedback-status" role="status">
      {sending && "Đang gửi góp ý…"}
      {delivery === "sent" && "Cảm ơn bạn. Êm đã nhận được góp ý!"}
    </div>
    {delivery === "failed" && <p className="form-error" role="alert">Chưa thể xác nhận đã gửi góp ý. Bản nháp vẫn còn, bạn có thể thử lại.</p>}
    <button className="modal-primary" type="submit" disabled={sending || standalone || delivery === "sent"}
      aria-describedby={standalone ? `${id}-offline` : undefined}>
      {delivery === "failed" ? "Thử lại" : "Gửi góp ý"}
    </button>
  </form>;
}
