import React, { useState, FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/api/client";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(token ? "" : "В ссылке нет токена сброса пароля");
  const [done, setDone] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== passwordConfirm) {
      setError("Пароли не совпадают");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await apiClient.resetPassword(token, password);
      setDone(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сменить пароль");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center py-16 px-8">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Новый пароль</CardTitle>
            <CardDescription>Задайте пароль для входа в Цифровой реестр компетенций</CardDescription>
          </CardHeader>
          <CardContent>
            {done ? (
              <p className="text-sm text-emerald-800 bg-emerald-50 px-3 py-2 rounded-md">{done}</p>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="password">Новый пароль</Label>
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
                    <Label htmlFor="password-confirm">Повтор пароля</Label>
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
                    {loading ? "Сохранение..." : "Сохранить пароль"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
          <CardFooter>
            <p className="text-sm text-muted-foreground text-center w-full">
              <Link to="/login" className="text-primary hover:underline">
                Перейти ко входу
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
