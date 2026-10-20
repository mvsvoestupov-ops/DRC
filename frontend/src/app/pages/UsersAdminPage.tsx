import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useNavigate } from "react-router";
import { LogIn, Plus, KeyRound, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/app/components/ui/badge";
import { Switch } from "@/app/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import { apiClient } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { formatUserName } from "@/lib/userDisplay";
import { cn } from "@/lib/utils";

type AdminUser = {
  id: number;
  email: string;
  role: string;
  is_active: boolean;
  email_confirmed?: boolean;
  last_name?: string;
  first_name?: string;
  middle_name?: string;
  organization?: string;
  created_at?: string | null;
};

type UserColId = "name" | "email" | "org" | "role" | "status" | "created" | "actions";

const USER_COLS: UserColId[] = ["name", "email", "org", "role", "status", "created", "actions"];

/** Доли по умолчанию суммируются в 100% — таблица помещается без горизонтального скролла. */
const DEFAULT_COL_WIDTHS: Record<UserColId, number> = {
  name: 14,
  email: 16,
  org: 14,
  role: 12,
  status: 12,
  created: 12,
  actions: 20,
};

const MIN_COL_PCT = 6;
const WIDTHS_STORAGE_KEY = "drc.users.table.colWidths.v1";

function formatDate(value?: string | null, locale = "ru-RU") {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale);
}

function loadSavedWidths(): Record<UserColId, number> | null {
  try {
    const raw = localStorage.getItem(WIDTHS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Record<UserColId, number>>;
    const next = { ...DEFAULT_COL_WIDTHS };
    let sum = 0;
    for (const id of USER_COLS) {
      const value = Number(parsed[id]);
      if (!Number.isFinite(value) || value < MIN_COL_PCT) return null;
      next[id] = value;
      sum += value;
    }
    if (Math.abs(sum - 100) > 0.5) return null;
    return next;
  } catch {
    return null;
  }
}

function ResizableHead({
  label,
  widthPct,
  align = "left",
  resizable = true,
  onResizeStart,
}: {
  label: string;
  widthPct: number;
  align?: "left" | "right";
  resizable?: boolean;
  onResizeStart?: (event: ReactMouseEvent<HTMLDivElement>) => void;
}) {
  return (
    <TableHead
      style={{ width: `${widthPct}%` }}
      className={cn(
        "relative select-none whitespace-normal break-words align-bottom",
        align === "right" && "text-right",
      )}
    >
      <span className="pr-2 block leading-snug">{label}</span>
      {resizable && onResizeStart ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Изменить ширину колонки"
          title="Потяните, чтобы изменить ширину"
          onMouseDown={onResizeStart}
          className="absolute top-0 right-0 z-10 h-full w-1.5 cursor-col-resize touch-none hover:bg-primary/30 active:bg-primary/50"
        />
      ) : null}
    </TableHead>
  );
}

export function UsersAdminPage() {
  const { user: currentUser, impersonate, isImpersonating } = useAuth();
  const { t, intlLocale } = useI18n();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState<AdminUser | null>(null);
  const [formEmail, setFormEmail] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formFirstName, setFormFirstName] = useState("");
  const [formMiddleName, setFormMiddleName] = useState("");
  const [formOrganization, setFormOrganization] = useState("");
  const [formRole, setFormRole] = useState("user");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [colWidths, setColWidths] = useState<Record<UserColId, number>>(
    () => loadSavedWidths() || { ...DEFAULT_COL_WIDTHS },
  );
  const dragRef = useRef<{
    left: UserColId;
    right: UserColId;
    startX: number;
    startLeft: number;
    startRight: number;
    tableWidth: number;
  } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(WIDTHS_STORAGE_KEY, JSON.stringify(colWidths));
    } catch {
      /* ignore quota */
    }
  }, [colWidths]);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.tableWidth <= 0) return;
      const deltaPct = ((event.clientX - drag.startX) / drag.tableWidth) * 100;
      let nextLeft = drag.startLeft + deltaPct;
      let nextRight = drag.startRight - deltaPct;
      if (nextLeft < MIN_COL_PCT) {
        nextRight -= MIN_COL_PCT - nextLeft;
        nextLeft = MIN_COL_PCT;
      }
      if (nextRight < MIN_COL_PCT) {
        nextLeft -= MIN_COL_PCT - nextRight;
        nextRight = MIN_COL_PCT;
      }
      if (nextLeft < MIN_COL_PCT || nextRight < MIN_COL_PCT) return;
      setColWidths((prev) => ({
        ...prev,
        [drag.left]: nextLeft,
        [drag.right]: nextRight,
      }));
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const startResize = (left: UserColId, event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const leftIndex = USER_COLS.indexOf(left);
    if (leftIndex < 0 || leftIndex >= USER_COLS.length - 1) return;
    const right = USER_COLS[leftIndex + 1];
    const table = (event.currentTarget.closest("table") as HTMLTableElement | null) || null;
    const tableWidth = table?.getBoundingClientRect().width || 1;
    dragRef.current = {
      left,
      right,
      startX: event.clientX,
      startLeft: colWidths[left],
      startRight: colWidths[right],
      tableWidth,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const resetWidths = () => {
    setColWidths({ ...DEFAULT_COL_WIDTHS });
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiClient.listUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("users.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const created = await apiClient.createUser({
        email: formEmail.trim(),
        last_name: formLastName.trim(),
        first_name: formFirstName.trim(),
        middle_name: formMiddleName.trim(),
        organization: formOrganization.trim(),
        role: formRole,
        is_active: true,
      });
      setCreateOpen(false);
      setFormEmail("");
      setFormLastName("");
      setFormFirstName("");
      setFormMiddleName("");
      setFormOrganization("");
      setFormRole("user");
      setNotice(t("users.created", { email: created.email }));
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("users.createError"));
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (target: AdminUser, role: string) => {
    setError("");
    try {
      const updated = await apiClient.updateUser(target.id, { role });
      setUsers((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("users.roleError"));
    }
  };

  const handleActiveChange = async (target: AdminUser, is_active: boolean) => {
    setError("");
    try {
      const updated = await apiClient.updateUser(target.id, { is_active });
      setUsers((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("users.statusError"));
    }
  };

  const handlePasswordSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!passwordUser) return;
    setSaving(true);
    setError("");
    try {
      await apiClient.updateUser(passwordUser.id, { password: newPassword });
      setPasswordUser(null);
      setNewPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("users.passwordError"));
    } finally {
      setSaving(false);
    }
  };

  const handleImpersonate = async (target: AdminUser) => {
    setError("");
    try {
      await impersonate(target.id);
      navigate("/my-projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("users.impersonateError"));
    }
  };

  return (
    <PageShell>
      <PageHeader
        title={t("users.title")}
        description={t("users.lead")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={resetWidths}>
              {t("users.resetColumns")}
            </Button>
            <Button className="gap-2" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4" />
              {t("users.add")}
            </Button>
          </div>
        }
      />

      {notice ? (
        <div className="mb-4 text-sm text-emerald-800 bg-emerald-50 px-3 py-2 rounded-md">{notice}</div>
      ) : null}
      {error ? (
        <div className="mb-4 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</div>
      ) : null}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <Table className="table-fixed w-full" containerClassName="overflow-x-hidden">
            <colgroup>
              {USER_COLS.map((id) => (
                <col key={id} style={{ width: `${colWidths[id]}%` }} />
              ))}
            </colgroup>
            <TableHeader>
              <TableRow>
                <ResizableHead
                  label={t("users.colName")}
                  widthPct={colWidths.name}
                  onResizeStart={(event) => startResize("name", event)}
                />
                <ResizableHead
                  label={t("users.colEmail")}
                  widthPct={colWidths.email}
                  onResizeStart={(event) => startResize("email", event)}
                />
                <ResizableHead
                  label={t("users.colOrg")}
                  widthPct={colWidths.org}
                  onResizeStart={(event) => startResize("org", event)}
                />
                <ResizableHead
                  label={t("users.colRole")}
                  widthPct={colWidths.role}
                  onResizeStart={(event) => startResize("role", event)}
                />
                <ResizableHead
                  label={t("users.colStatus")}
                  widthPct={colWidths.status}
                  onResizeStart={(event) => startResize("status", event)}
                />
                <ResizableHead
                  label={t("users.colCreated")}
                  widthPct={colWidths.created}
                  onResizeStart={(event) => startResize("created", event)}
                />
                <ResizableHead
                  label={t("users.colActions")}
                  widthPct={colWidths.actions}
                  align="right"
                  resizable={false}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((row) => {
                const isSelf = currentUser?.email === row.email;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium whitespace-normal break-words max-w-0">
                      <span className="line-clamp-2" title={formatUserName(row) || undefined}>
                        {formatUserName(row) || "—"}
                        {isSelf ? (
                          <span className="ml-2 text-xs text-muted-foreground">{t("users.you")}</span>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-normal break-all max-w-0">
                      <span className="line-clamp-2" title={row.email}>
                        {row.email}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-normal break-words max-w-0">
                      <span className="line-clamp-2" title={row.organization || undefined}>
                        {row.organization || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-normal max-w-0">
                      <select
                        className="form-control w-full max-w-full px-1.5 py-1 text-xs sm:text-sm"
                        value={row.role}
                        disabled={isSelf}
                        onChange={(event) => handleRoleChange(row, event.target.value)}
                        aria-label={t("users.roleAria", { email: row.email })}
                      >
                        <option value="user">{t("role.user")}</option>
                        <option value="expert">{t("role.expert")}</option>
                        <option value="moderator">{t("role.moderator")}</option>
                        <option value="intl_methodologist">{t("role.intl_methodologist")}</option>
                        <option value="admin">{t("role.admin")}</option>
                      </select>
                    </TableCell>
                    <TableCell className="whitespace-normal max-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Switch
                          checked={row.is_active}
                          disabled={isSelf}
                          onCheckedChange={(checked) => handleActiveChange(row, checked)}
                          aria-label={t("users.activeAria", { email: row.email })}
                        />
                        <Badge variant={row.is_active ? "secondary" : "outline"} className="text-[10px] sm:text-xs">
                          {row.email_confirmed === false
                            ? t("users.pending")
                            : row.is_active
                              ? t("users.active")
                              : t("users.disabled")}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-normal break-words max-w-0 text-xs sm:text-sm">
                      {formatDate(row.created_at, intlLocale)}
                    </TableCell>
                    <TableCell className="text-right whitespace-normal max-w-0">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1 h-8 px-2"
                          title={t("users.mail")}
                          disabled={row.email_confirmed !== false}
                          onClick={async () => {
                            setError("");
                            try {
                              await apiClient.resendInvite(row.id);
                              setNotice(t("users.resent", { email: row.email }));
                            } catch (err) {
                              setError(err instanceof Error ? err.message : t("users.mailError"));
                            }
                          }}
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span className="hidden xl:inline">{t("users.mail")}</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1 h-8 px-2"
                          title={t("users.password")}
                          onClick={() => {
                            setPasswordUser(row);
                            setNewPassword("");
                          }}
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span className="hidden xl:inline">{t("users.password")}</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="gap-1 h-8 px-2"
                          title={t("users.loginAs")}
                          disabled={isSelf || !row.is_active || isImpersonating}
                          onClick={() => handleImpersonate(row)}
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          <span className="hidden xl:inline">{t("users.loginAs")}</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>{t("users.createTitle")}</DialogTitle>
              <DialogDescription>
                {t("users.createDesc")}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-last-name">{t("common.lastName")}</Label>
                <Input
                  id="new-last-name"
                  required
                  value={formLastName}
                  onChange={(event) => setFormLastName(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-first-name">{t("common.firstName")}</Label>
                <Input
                  id="new-first-name"
                  required
                  value={formFirstName}
                  onChange={(event) => setFormFirstName(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-middle-name">{t("common.middleName")}</Label>
                <Input
                  id="new-middle-name"
                  value={formMiddleName}
                  onChange={(event) => setFormMiddleName(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-organization">{t("common.organization")}</Label>
                <Input
                  id="new-organization"
                  required
                  value={formOrganization}
                  onChange={(event) => setFormOrganization(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-email">{t("common.email")}</Label>
                <Input
                  id="new-email"
                  type="email"
                  required
                  value={formEmail}
                  onChange={(event) => setFormEmail(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-role">{t("users.colRole")}</Label>
                <select
                  id="new-role"
                  className="form-control px-3 py-2"
                  value={formRole}
                  onChange={(event) => setFormRole(event.target.value)}
                >
                  <option value="user">{t("role.user")}</option>
                  <option value="expert">{t("role.expert")}</option>
                  <option value="moderator">{t("role.moderator")}</option>
                  <option value="intl_methodologist">{t("role.intl_methodologist")}</option>
                  <option value="admin">{t("role.admin")}</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t("common.saving") : t("users.createSubmit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(passwordUser)} onOpenChange={(open) => !open && setPasswordUser(null)}>
        <DialogContent>
          <form onSubmit={handlePasswordSave}>
            <DialogHeader>
              <DialogTitle>{t("users.passwordTitle")}</DialogTitle>
              <DialogDescription>{passwordUser?.email}</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="reset-password">{t("users.newPassword")}</Label>
              <Input
                id="reset-password"
                type="password"
                minLength={6}
                required
                className="mt-2"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPasswordUser(null)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t("common.saving") : t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
