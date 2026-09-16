import React, { useState, FormEvent } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/api/client";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const result = await apiClient.forgotPassword(email.trim());
      setNotice(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить письмо");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center py-16 px-8">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Восстановление пароля</CardTitle>
            <CardDescription>Укажите email учётной записи. Если он есть в системе, придёт письмо со ссылкой.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                {notice ? (
                  <div className="text-sm text-emerald-800 bg-emerald-50 px-3 py-2 rounded-md">{notice}</div>
                ) : null}
                {error ? (
                  <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</div>
                ) : null}
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Отправка..." : "Отправить ссылку"}
                </Button>
              </div>
            </form>
          </CardContent>
          <CardFooter>
            <p className="text-sm text-muted-foreground text-center w-full">
              <Link to="/login" className="text-primary hover:underline">
                Вернуться ко входу
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
