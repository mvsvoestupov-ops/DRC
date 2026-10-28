import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Bell } from "lucide-react";
import { apiClient } from "@/api/client";
import { useI18n } from "@/context/I18nContext";
import { cn } from "@/lib/utils";

type NotificationItem = {
  id: number;
  kind: string;
  title: string;
  body: string;
  competence_id: number | null;
  link: string | null;
  read_at: string | null;
  created_at: string | null;
  is_read: boolean;
};

export function NotificationBell() {
  const { t, intlLocale } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiClient.getNotifications();
      setItems(data.items || []);
      setUnread(data.unread_count || 0);
    } catch {
      /* тихо: колокольчик не должен ломать шапку */
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const onOpen = async () => {
    setOpen((prev) => !prev);
    if (!open) {
      setLoading(true);
      await load();
      setLoading(false);
    }
  };

  const onItemClick = async (item: NotificationItem) => {
    if (!item.is_read) {
      try {
        await apiClient.markNotificationRead(item.id);
        setItems((prev) =>
          prev.map((row) =>
            row.id === item.id
              ? { ...row, is_read: true, read_at: new Date().toISOString() }
              : row,
          ),
        );
        setUnread((n) => Math.max(0, n - 1));
      } catch {
        /* ignore */
      }
    }
    setOpen(false);
    if (item.link) navigate(item.link);
    else if (item.competence_id) navigate(`/competency/${item.competence_id}`);
  };

  const onMarkAll = async () => {
    try {
      await apiClient.markAllNotificationsRead();
      setItems((prev) =>
        prev.map((row) => ({ ...row, is_read: true, read_at: row.read_at || new Date().toISOString() })),
      );
      setUnread(0);
    } catch {
      /* ignore */
    }
  };

  const formatDate = (value: string | null) => {
    if (!value) return "";
    try {
      return new Date(value).toLocaleString(intlLocale, {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return value;
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => void onOpen()}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 hover:border-primary hover:text-primary"
        aria-label={t("notifications.title")}
        aria-expanded={open}
      >
        <Bell className="w-4.5 h-4.5" />
        {unread > 0 ? (
          <span className="absolute -top-1 -right-1 min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">{t("notifications.title")}</p>
            {unread > 0 ? (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => void onMarkAll()}
              >
                {t("notifications.markAll")}
              </button>
            ) : null}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-3 py-6 text-sm text-gray-500 text-center">{t("common.loading")}</p>
            ) : null}
            {!loading && items.length === 0 ? (
              <p className="px-3 py-6 text-sm text-gray-500 text-center">{t("notifications.empty")}</p>
            ) : null}
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void onItemClick(item)}
                className={cn(
                  "w-full text-left px-3 py-2.5 border-b border-gray-50 hover:bg-slate-50",
                  !item.is_read && "bg-blue-50/60",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900 leading-snug">{item.title}</p>
                  {!item.is_read ? (
                    <span className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                  ) : null}
                </div>
                <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{item.body}</p>
                <p className="text-[11px] text-gray-400 mt-1">{formatDate(item.created_at)}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
