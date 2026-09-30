import React, { useState, FormEvent, useEffect } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { t } = useI18n();
  const from = (location.state as { from?: string })?.from || '/my-projects';
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(params.get('confirmed') === '1' ? t('loginPage.confirmed') : '');

  useEffect(() => {
    if (params.get('confirmed') === '1') {
      setNotice(t('loginPage.confirmed'));
    }
  }, [params]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email || !password) {
      setError(t('loginPage.needEmailPassword'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email.trim(), password.trim());
      navigate(from);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loginPage.invalid'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center py-16 px-8">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>{t('loginPage.title')}</CardTitle>
            <CardDescription>
              {t('loginPage.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@aonk.ru"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">{t('loginPage.password')}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md"
                      aria-label={showPassword ? t('loginPage.hidePassword') : t('loginPage.showPassword')}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {notice && !error && (
                  <div className="text-sm text-emerald-800 bg-emerald-50 px-3 py-2 rounded-md">
                    {notice}
                  </div>
                )}
                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                    {error}
                  </div>
                )}
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? t('loginPage.submitting') : t('loginPage.submit')}
                </Button>
                <p className="text-sm text-center">
                  <Link to="/forgot-password" className="text-primary hover:underline">
                    {t('loginPage.forgot')}
                  </Link>
                </p>
              </div>
            </form>
          </CardContent>
          <CardFooter>
            <p className="text-sm text-muted-foreground text-center w-full">
              {t('loginPage.noAccount')}{' '}
              <Link to="/register" className="text-primary hover:underline">
                {t('loginPage.register')}
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}