import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Paperclip, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";

type Attachment = {
  id: string;
  kind: string;
  name: string;
  mime: string;
  url: string;
  size: number;
};

const ACCEPT =
  ".jpg,.jpeg,.png,.gif,.webp,.txt,.md,.csv,.rtf,.doc,.docx,.odt,.pdf,image/jpeg,image/png,image/gif,image/webp,text/plain,application/pdf";

export function FooterFeedbackForm() {
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const [text, setText] = useState("");
  const [section, setSection] = useState("project");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  const onPickFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setError("");
    setBusy(true);
    try {
      const uploaded: Attachment[] = [];
      for (const file of Array.from(list)) {
        const item = await apiClient.uploadFeedbackMedia(file);
        uploaded.push(item);
      }
      setFiles((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("feedback.uploadError"));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) return;
    setError("");
    setOk(false);
    setBusy(true);
    try {
      await apiClient.sendFeedback({
        section,
        text,
        attachments: files,
      });
      setText("");
      setFiles([]);
      setSection("project");
      setOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("feedback.sendError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-white mb-1">{t("feedback.title")}</h3>
      <p className="text-sm text-footer-muted leading-relaxed">{t("feedback.lead")}</p>
      {!isAuthenticated ? (
        <p className="text-sm text-amber-200/90">
          {t("feedback.authOnly")}{" "}
          <Link to="/login" className="underline hover:text-white">
            {t("login")}
          </Link>
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-2">
          <select
            value={section}
            onChange={(e) => setSection(e.target.value)}
            className="w-full rounded-md border border-gray-600 bg-gray-800 text-white text-sm px-2 py-1.5"
          >
            <option value="project">{t("feedback.sectionProject")}</option>
            <option value="methodology">{t("feedback.sectionMethodology")}</option>
            <option value="wizard">{t("feedback.sectionWizard")}</option>
            <option value="bug">{t("feedback.sectionBug")}</option>
            <option value="other">{t("feedback.sectionOther")}</option>
          </select>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            required
            minLength={5}
            placeholder={t("feedback.placeholder")}
            className="w-full rounded-md border border-gray-600 bg-gray-800 text-white text-sm px-2 py-1.5 placeholder:text-gray-500"
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-xs text-footer-muted cursor-pointer hover:text-white">
              <Paperclip className="w-3.5 h-3.5" />
              {t("feedback.attach")}
              <input
                type="file"
                accept={ACCEPT}
                multiple
                className="sr-only"
                disabled={busy}
                onChange={(e) => {
                  void onPickFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            <span className="text-[11px] text-gray-500">{t("feedback.attachHint")}</span>
          </div>
          {files.length > 0 ? (
            <ul className="space-y-1">
              {files.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center justify-between gap-2 text-xs text-footer-muted bg-gray-800/80 rounded px-2 py-1"
                >
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    className="text-red-300 hover:text-red-200 shrink-0"
                    onClick={() => setFiles((prev) => prev.filter((item) => item.id !== file.id))}
                    aria-label={t("common.delete")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {error ? <p className="text-xs text-red-300">{error}</p> : null}
          {ok ? <p className="text-xs text-emerald-300">{t("feedback.sent")}</p> : null}
          <Button
            type="submit"
            size="sm"
            disabled={busy || text.trim().length < 5}
            className="gap-1.5 bg-primary hover:bg-primary/90"
          >
            <Send className="w-3.5 h-3.5" />
            {busy ? t("feedback.sending") : t("feedback.send")}
          </Button>
        </form>
      )}
    </div>
  );
}
