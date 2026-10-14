import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { MessageSquare, Send } from "lucide-react";
import { apiClient } from "@/api/client";
import type { CompetenceStepChatMessage } from "@/api/types";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/context/I18nContext";
import { presenceShortName } from "@/lib/collaborationPresence";
import { cn } from "@/lib/utils";

const POLL_MS = 4000;
const MAX_LEN = 2000;

function parseCounts(raw?: Record<string, number>) {
  const next: Record<number, number> = {};
  if (!raw) return next;
  for (const [key, value] of Object.entries(raw)) {
    const step = Number(key);
    const count = Number(value);
    if (Number.isFinite(step) && count > 0) next[step] = count;
  }
  return next;
}

export function StepChatPanel({
  competenceId,
  step,
  stepName,
  onCounts,
}: {
  competenceId: number | null;
  step: number;
  stepName: string;
  onCounts?: (counts: Record<number, number>) => void;
}) {
  const { t, intlLocale } = useI18n();
  const [messages, setMessages] = useState<CompetenceStepChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef(true);

  const load = useCallback(async () => {
    if (!competenceId) {
      setMessages([]);
      onCounts?.({});
      return;
    }
    try {
      const [thread, summary] = await Promise.all([
        apiClient.getCompetenceStepChat(competenceId, step),
        apiClient.getCompetenceChatSummary(competenceId),
      ]);
      setMessages(Array.isArray(thread?.messages) ? thread.messages : []);
      onCounts?.(parseCounts(summary?.counts));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("chat.loadError"));
    }
  }, [competenceId, onCounts, step, t]);

  useEffect(() => {
    void load();
    if (!competenceId) return;
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [competenceId, load]);

  useEffect(() => {
    const node = listRef.current;
    if (!node || !bottomRef.current) return;
    node.scrollTop = node.scrollHeight;
  }, [messages]);

  const send = async () => {
    const text = draft.trim();
    if (!competenceId || !text || sending) return;
    setSending(true);
    setError("");
    try {
      const saved = await apiClient.sendCompetenceStepChat(competenceId, step, text);
      setDraft("");
      bottomRef.current = true;
      if (saved?.id) {
        setMessages((prev) => [...prev.filter((row) => row.id !== saved.id), saved]);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("chat.sendError"));
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  return (
    <div className="surface-padded flex min-h-[18rem] flex-col">
      <div className="mb-3 flex items-start gap-2">
        <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 leading-tight">{t("chat.title", { n: step })}</h3>
          <p className="text-xs text-gray-500 truncate">{stepName}</p>
        </div>
      </div>

      {!competenceId ? (
        <p className="text-sm text-gray-500">{t("chat.needSave")}</p>
      ) : (
        <>
          <div
            ref={listRef}
            className="min-h-[10rem] max-h-[18rem] flex-1 space-y-2 overflow-y-auto pr-1"
            onScroll={(event) => {
              const node = event.currentTarget;
              bottomRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 40;
            }}
          >
            {messages.length === 0 ? (
              <p className="text-sm text-gray-500">{t("chat.empty")}</p>
            ) : (
              messages.map((row) => {
                const name = presenceShortName(row.user?.name || row.user?.email || t("chat.member"));
                const color = row.user?.color || "#2563EB";
                const time = row.created_at
                  ? new Date(row.created_at).toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit" })
                  : "";
                return (
                  <div
                    key={row.id}
                    className={cn("flex flex-col gap-0.5", row.self ? "items-end" : "items-start")}
                  >
                    <div className="flex max-w-full items-center gap-1.5 text-[11px] text-gray-500">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="truncate font-medium text-gray-700">
                        {row.self ? t("chat.you") : name}
                      </span>
                      {time ? <span>{time}</span> : null}
                    </div>
                    <div
                      className={cn(
                        "max-w-full whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm leading-snug",
                        row.self ? "rounded-br-md bg-primary text-white" : "rounded-bl-md bg-gray-100 text-gray-900",
                      )}
                    >
                      {row.text}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

          <div className="mt-3 flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value.slice(0, MAX_LEN))}
              onKeyDown={onKeyDown}
              rows={2}
              className="form-control min-h-[2.75rem] flex-1 resize-none text-sm"
              placeholder={t("chat.placeholder")}
              disabled={sending}
            />
            <Button
              type="button"
              size="sm"
              className="shrink-0"
              disabled={sending || !draft.trim()}
              onClick={() => void send()}
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">{t("chat.send")}</span>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function StepChatBadge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span className="absolute -right-1 -top-1 min-w-[1.1rem] rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}
