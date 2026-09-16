import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import { apiClient } from "@/api/client";
import { useAuth } from "@/context/AuthContext";

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [middleName, setMiddleName] = useState(user?.middle_name || "");
  const [organization, setOrganization] = useState(user?.organization || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setLastName(user?.last_name || "");
    setFirstName(user?.first_name || "");
    setMiddleName(user?.middle_name || "");
    setOrganization(user?.organization || "");
  }, [user]);

  const handleProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingProfile(true);
    setError("");
    setNotice("");
    try {
      await apiClient.updateMe({
        last_name: lastName.trim(),
        first_name: firstName.trim(),
        middle_name: middleName.trim(),
        organization: organization.trim(),
      });
      await refreshUser();
      setNotice("Данные профиля сохранены");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить профиль");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword !== newPasswordConfirm) {
      setError("Новые пароли не совпадают");
      return;
    }
    setSavingPassword(true);
    setError("");
    setNotice("");
    try {
      await apiClient.updateMe({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
      setNotice("Пароль изменён");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сменить пароль");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <PageShell>
      <PageHeader title="Личный кабинет" description="Профиль, организация и смена пароля" />
      {notice ? (
        <div className="mb-4 text-sm text-emerald-800 bg-emerald-50 px-3 py-2 rounded-md">{notice}</div>
      ) : null}
      {error ? (
        <div className="mb-4 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Профиль</CardTitle>
            <CardDescription>Email меняется только администратором</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfile} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="profile-email">Email</Label>
                <Input id="profile-email" value={user?.email || ""} disabled />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="profile-last-name">Фамилия</Label>
                <Input
                  id="profile-last-name"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="profile-first-name">Имя</Label>
                <Input
                  id="profile-first-name"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="profile-middle-name">Отчество</Label>
                <Input
                  id="profile-middle-name"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="profile-org">Организация</Label>
                <Input
                  id="profile-org"
                  required
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? "Сохранение..." : "Сохранить профиль"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Смена пароля</CardTitle>
            <CardDescription>Укажите текущий пароль и новый не короче 6 символов</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePassword} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="current-password">Текущий пароль</Label>
                <Input
                  id="current-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-password">Новый пароль</Label>
                <Input
                  id="new-password"
                  type="password"
                  minLength={6}
                  required
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-password-confirm">Повтор нового пароля</Label>
                <Input
                  id="new-password-confirm"
                  type="password"
                  minLength={6}
                  required
                  autoComplete="new-password"
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={savingPassword}>
                {savingPassword ? "Сохранение..." : "Сменить пароль"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
