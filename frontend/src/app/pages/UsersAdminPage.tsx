import { useCallback, useEffect, useState } from "react";
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

function formatDate(value?: string | null, locale = "ru-RU") {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale);
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
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            {t("users.add")}
          </Button>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("users.colName")}</TableHead>
                <TableHead>{t("users.colEmail")}</TableHead>
                <TableHead>{t("users.colOrg")}</TableHead>
                <TableHead>{t("users.colRole")}</TableHead>
                <TableHead>{t("users.colStatus")}</TableHead>
                <TableHead>{t("users.colCreated")}</TableHead>
                <TableHead className="text-right">{t("users.colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((row) => {
                const isSelf = currentUser?.email === row.email;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {formatUserName(row) || "—"}
                      {isSelf ? (
                        <span className="ml-2 text-xs text-muted-foreground">{t("users.you")}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>{row.email}</TableCell>
                    <TableCell>{row.organization || "—"}</TableCell>
                    <TableCell>
                      <select
                        className="form-control w-auto px-2 py-1 text-sm"
                        value={row.role}
                        disabled={isSelf}
                        onChange={(event) => handleRoleChange(row, event.target.value)}
                        aria-label={t("users.roleAria", { email: row.email })}
                      >
                        <option value="user">{t("role.user")}</option>
                        <option value="expert">{t("role.expert")}</option>
                        <option value="moderator">{t("role.moderator")}</option>
                        <option value="admin">{t("role.admin")}</option>
                      </select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={row.is_active}
                          disabled={isSelf}
                          onCheckedChange={(checked) => handleActiveChange(row, checked)}
                          aria-label={t("users.activeAria", { email: row.email })}
                        />
                        <Badge variant={row.is_active ? "secondary" : "outline"}>
                          {row.email_confirmed === false
                            ? t("users.pending")
                            : row.is_active
                              ? t("users.active")
                              : t("users.disabled")}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(row.created_at, intlLocale)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1"
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
                          {t("users.mail")}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => {
                            setPasswordUser(row);
                            setNewPassword("");
                          }}
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          {t("users.password")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="gap-1"
                          disabled={isSelf || !row.is_active || isImpersonating}
                          onClick={() => handleImpersonate(row)}
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          {t("users.loginAs")}
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
