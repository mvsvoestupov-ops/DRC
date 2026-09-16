import React, { useState, FormEvent } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/api/client";

export function RegisterPage() {
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [organization, setOrganization] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== passwordConfirm) {
      setError("Пароли не совпадают");
      return;
    }
    setLoading(true);
    setError("");
    setDone("");
    try {
      const result = await apiClient.signup({
        email: email.trim(),
        password,
        last_name: lastName.trim(),
        first_name: firstName.trim(),
        middle_name: middleName.trim(),
        organization: organization.trim(),
      });
      setDone(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось зарегистрироваться");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center py-16 px-8">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Регистрация</CardTitle>
            <CardDescription>
              После регистрации на email придёт ссылка подтверждения. Войти можно после перехода по ней.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {done ? (
              <p className="text-sm text-emerald-800 bg-emerald-50 px-3 py-2 rounded-md">{done}</p>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="last-name">Фамилия</Label>
                    <Input id="last-name" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="first-name">Имя</Label>
                    <Input id="first-name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="middle-name">Отчество</Label>
                    <Input id="middle-name" value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="organization">Организация</Label>
                    <Input
                      id="organization"
                      required
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="password">Пароль</Label>
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
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Отправка..." : "Зарегистрироваться"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
          <CardFooter>
            <p className="text-sm text-muted-foreground text-center w-full">
              Уже есть аккаунт?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Войти
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
