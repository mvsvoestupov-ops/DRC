import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/api/client";

export function ConfirmEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [status, setStatus] = useState<"loading" | "ok" | "error">(token ? "loading" : "error");
  const [message, setMessage] = useState(token ? "Подтверждаем адрес..." : "В ссылке нет токена подтверждения");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    apiClient
      .confirmEmail(token)
      .then((data) => {
        if (cancelled) return;
        setStatus("ok");
        setMessage(data.message || "Email подтверждён. Можно войти в систему.");
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Не удалось подтвердить email");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex justify-center items-center py-16 px-8">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Подтверждение email</CardTitle>
            <CardDescription>Активация учётки в Цифровом реестре компетенций</CardDescription>
          </CardHeader>
          <CardContent>
            {status === "loading" ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : (
              <p className={status === "ok" ? "text-sm" : "text-sm text-destructive"}>{message}</p>
            )}
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link to="/login">Перейти ко входу</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
