import { useEffect, useRef, useState } from "react";
import { Eye, Paperclip } from "lucide-react";
import { apiClient } from "@/api/client";
import { ASSESSMENT_MEDIA_ACCEPT } from "@/app/components/AssessmentFosPreview";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/context/I18nContext";
import {
  ASSESSMENT_MEDIA_KIND_LABELS,
  assessmentMediaUrl,
  formatAttachmentSize,
  type AssessmentAttachment,
} from "@/lib/assessmentConstructor";

type Props = {
  attachments: AssessmentAttachment[];
  onChange: (next: AssessmentAttachment[]) => void;
  /** Без верхней разделительной линии (если блок уже отделён) */
  bare?: boolean;
};

export function AssessmentTaskAttachments({ attachments, onChange, bare = false }: Props) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<AssessmentAttachment | null>(null);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError("");
    try {
      const uploaded: AssessmentAttachment[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await apiClient.uploadAssessmentMedia(file));
      }
      onChange([...attachments, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("assessmentV2.attachmentsUploadError"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={bare ? "space-y-2" : "space-y-2 border-t border-gray-100 pt-4"}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-500">{t("assessmentV2.attachments")}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="gap-1.5"
        >
          <Paperclip className="w-3.5 h-3.5" />
          {busy ? t("assessmentV2.attachmentsUploading") : t("assessmentV2.attachmentsUpload")}
        </Button>
      </div>
      <p className="text-xs text-gray-500">{t("assessmentV2.attachmentsHint")}</p>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple
        accept={ASSESSMENT_MEDIA_ACCEPT}
        onChange={(e) => {
          void addFiles(e.target.files);
        }}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {attachments.length > 0 ? (
        <ul className="space-y-1">
          {attachments.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 text-sm rounded-md border border-gray-200 px-2 py-1.5 bg-slate-50"
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left truncate hover:text-primary"
                onClick={() => setPreview(item)}
                title={t("assessmentV2.attachmentsView")}
              >
                {item.name}
                <span className="ml-2 text-xs text-gray-500">
                  {ASSESSMENT_MEDIA_KIND_LABELS[item.kind] || item.kind}
                  {item.size ? ` · ${formatAttachmentSize(item.size)}` : ""}
                </span>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  onClick={() => setPreview(item)}
                >
                  <Eye className="w-3.5 h-3.5" />
                  {t("assessmentV2.attachmentsView")}
                </button>
                <button
                  type="button"
                  className="text-red-600 text-xs hover:underline"
                  onClick={() => onChange(attachments.filter((row) => row.id !== item.id))}
                >
                  {t("common.delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-400">{t("assessmentV2.attachmentsEmpty")}</p>
      )}

      <AttachmentPreviewDialog
        item={preview}
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      />
    </div>
  );
}

function AttachmentPreviewDialog({
  item,
  open,
  onOpenChange,
}: {
  item: AssessmentAttachment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const [textBody, setTextBody] = useState<string | null>(null);
  const [textError, setTextError] = useState("");
  const [textLoading, setTextLoading] = useState(false);

  useEffect(() => {
    if (!open || !item || item.kind !== "text") {
      setTextBody(null);
      setTextError("");
      setTextLoading(false);
      return;
    }
    let cancelled = false;
    setTextLoading(true);
    setTextError("");
    setTextBody(null);
    const src = assessmentMediaUrl(item.url);
    fetch(src)
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        // Для бинарных офисных форматов показываем ссылку, не сырой текст
        const name = (item.name || "").toLowerCase();
        if (/\.(docx?|odt|rtf)$/i.test(name) || /word|opendocument|rtf/i.test(item.mime || "")) {
          if (!cancelled) {
            setTextBody(null);
            setTextError("");
          }
          return;
        }
        const text = await blob.text();
        if (!cancelled) setTextBody(text);
      })
      .catch(() => {
        if (!cancelled) setTextError(t("assessmentV2.attachmentsPreviewError"));
      })
      .finally(() => {
        if (!cancelled) setTextLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, item, t]);

  if (!item) return null;
  const src = assessmentMediaUrl(item.url);
  const size = formatAttachmentSize(item.size);
  const isOfficeText =
    item.kind === "text" &&
    (/\.(docx?|odt|rtf)$/i.test(item.name || "") || /word|opendocument|rtf/i.test(item.mime || ""));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{item.name}</DialogTitle>
          <DialogDescription>
            {ASSESSMENT_MEDIA_KIND_LABELS[item.kind] || item.kind}
            {size ? ` · ${size}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200 bg-slate-50 p-3">
          {item.kind === "image" ? (
            <img
              src={src}
              alt={item.name || t("assessmentV2.attachments")}
              className="max-h-[70vh] mx-auto rounded-md border border-gray-200 bg-white object-contain"
            />
          ) : null}
          {item.kind === "pdf" ? (
            <iframe
              title={item.name}
              src={src}
              className="w-full h-[70vh] rounded-md border border-gray-200 bg-white"
            />
          ) : null}
          {item.kind === "video" ? (
            <video src={src} controls className="w-full max-h-[70vh] rounded-md bg-black" />
          ) : null}
          {item.kind === "audio" ? <audio src={src} controls className="w-full" /> : null}
          {item.kind === "text" ? (
            textLoading ? (
              <p className="text-sm text-gray-500">{t("common.loading")}</p>
            ) : textError ? (
              <p className="text-sm text-red-600">{textError}</p>
            ) : textBody != null ? (
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">
                {textBody}
              </pre>
            ) : (
              <div className="space-y-2 text-sm text-gray-700">
                <p>
                  {isOfficeText
                    ? t("assessmentV2.attachmentsOfficeHint")
                    : t("assessmentV2.attachmentsOpenExternal")}
                </p>
                <a
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary font-medium hover:underline"
                >
                  {t("assessmentV2.attachmentsOpenTab")}
                </a>
              </div>
            )
          ) : null}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:border-primary hover:text-primary"
          >
            {t("assessmentV2.attachmentsOpenTab")}
          </a>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
