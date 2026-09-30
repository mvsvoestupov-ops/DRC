import React, { useState, FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/api/client";
import { useI18n } from "@/context/I18nContext";

export function ResetPasswordPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(token ? "" : t("reset.noToken"));
  const [done, setDone] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== passwordConfirm) {
      setError(t("reset.mismatch"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await apiClient.resetPassword(token, password);
      setDone(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("reset.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center py-16 px-8">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>{t("reset.title")}</CardTitle>
            <CardDescription>{t("reset.desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {done ? (
              <p className="text-sm text-emerald-800 bg-emerald-50 px-3 py-2 rounded-md">{done}</p>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="password">{t("reset.newPassword")}</Label>
                    <Input
                      id="password"
                      type="password"
                      minLength={6}
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="password-confirm">{t("reset.passwordConfirm")}</Label>
                    <Input
                      id="password-confirm"
                      type="password"
                      minLength={6}
                      required
                      autoComplete="new-password"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                    />
                  </div>
                  {error ? (
                    <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</div>
                  ) : null}
                  <Button type="submit" disabled={loading || !token} className="w-full">
                    {loading ? t("reset.saving") : t("reset.submit")}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
          <CardFooter>
            <p className="text-sm text-muted-foreground text-center w-full">
              <Link to="/login" className="text-primary hover:underline">
                {t("reset.login")}
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
