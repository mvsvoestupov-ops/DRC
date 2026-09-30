import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/api/client";
import { useI18n } from "@/context/I18nContext";

export function ConfirmEmailPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [status, setStatus] = useState<"loading" | "ok" | "error">(token ? "loading" : "error");
  const [message, setMessage] = useState(token ? t("confirm.checking") : t("confirm.noToken"));

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    apiClient
      .confirmEmail(token)
      .then((data) => {
        if (cancelled) return;
        setStatus("ok");
        setMessage(data.message || t("confirm.okFallback"));
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus("error");
        setMessage(err instanceof Error ? err.message : t("confirm.error"));
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
            <CardTitle>{t("confirm.title")}</CardTitle>
            <CardDescription>{t("confirm.desc")}</CardDescription>
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
              <Link to="/login">{t("confirm.login")}</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
