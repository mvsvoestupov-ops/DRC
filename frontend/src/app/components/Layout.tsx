import { Outlet, Link, useNavigate, useLocation } from "react-router";
import { Search, User, LogOut, FolderOpen, BookOpen, GraduationCap, Play, ScrollText, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const { pathname } = useLocation();
  const active = pathname === to || (to !== "/" && pathname.startsWith(to));
  return (
    <Link
      to={to}
      className={cn(
        "font-medium transition-colors flex items-center gap-1",
        active ? "text-primary" : "text-gray-700 hover:text-primary"
      )}
    >
      {children}
    </Link>
  );
}

export function Layout() {
  const [language, setLanguage] = useState("RU");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, user, logout } = useAuth();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-page font-sans">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1440px] mx-auto px-8">
          <div className="flex justify-between items-center h-20">
            <Link to="/" className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
                  <path
                    d="M16 4L4 10V16C4 23 10 27.5 16 28C22 27.5 28 23 28 16V10L16 4Z"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  <path
                    d="M12 16L15 19L21 13"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <div className="font-bold text-gray-900 text-lg leading-6">
                  Национальный реестр компетенций
                </div>
                <div className="text-xs text-gray-500">РОСОБРНАДЗОР</div>
              </div>
            </Link>

            <div className="flex items-center gap-6">
              <form onSubmit={handleSearch} className="relative hidden md:block">
                <Input
                  type="text"
                  placeholder="Поиск по названию или ID компетенции..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-[400px] max-w-[40vw] pl-10 pr-4 h-10 border-gray-300 focus-visible:ring-primary"
                />
                <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400 pointer-events-none" />
              </form>

              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="form-control w-auto px-3 py-2"
                aria-label="Язык"
              >
                <option>RU</option>
                <option>EN</option>
              </select>

              {isAuthenticated ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 hidden lg:block">{user?.email}</span>
                  <Button variant="outline" size="default" className="gap-2" asChild>
                    <Link to="/my-projects">
                      <FolderOpen className="w-4 h-4" />
                      <span>Мои проекты</span>
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="default"
                    className="gap-2 text-gray-600"
                    onClick={() => {
                      logout();
                      navigate("/");
                    }}
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Выйти</span>
                  </Button>
                </div>
              ) : (
                <Button variant="default" size="default" className="gap-2" asChild>
                  <Link to="/login">
                    <User className="w-4 h-4" />
                    <span>Войти</span>
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 bg-nav">
          <div className="max-w-[1440px] mx-auto px-8">
            <nav className="flex gap-8 h-12 items-center text-sm overflow-x-auto">
              <NavLink to="/">Главная</NavLink>
              <NavLink to="/search">Поиск компетенций</NavLink>
              <NavLink to="/new">Предложить компетенцию</NavLink>
              {isAuthenticated && (
                <>
                  <NavLink to="/strategic-session">
                    <Play className="w-3.5 h-3.5" />
                    Стратегическая сессия
                  </NavLink>
                  {isAdmin && (
                    <>
                      <NavLink to="/standards">
                        <BookOpen className="w-3.5 h-3.5" />
                        Профстандарты
                      </NavLink>
                      <NavLink to="/qualifications">
                        <GraduationCap className="w-3.5 h-3.5" />
                        Квалификации
                      </NavLink>
                      <NavLink to="/assessment-tools">
                        <ClipboardList className="w-3.5 h-3.5" />
                        Оценочные средства
                      </NavLink>
                      <NavLink to="/fgos">
                        <ScrollText className="w-3.5 h-3.5" />
                        ФГОС
                      </NavLink>
                    </>
                  )}
                </>
              )}
              {isAdmin && <NavLink to="/admin">Панель эксперта</NavLink>}
              <NavLink to="/integration">Интеграция</NavLink>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-footer text-footer-muted">
        <div className="max-w-[1440px] mx-auto px-8 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-semibold text-white mb-4">О реестре</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="text-footer-muted hover:text-white transition-colors">
                    О проекте
                  </a>
                </li>
                <li>
                  <a href="#" className="text-footer-muted hover:text-white transition-colors">
                    Нормативная база
                  </a>
                </li>
                <li>
                  <a href="#" className="text-footer-muted hover:text-white transition-colors">
                    Методология
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Для разработчиков</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/integration" className="text-footer-muted hover:text-white transition-colors">
                    Документация API
                  </Link>
                </li>
                <li>
                  <a href="#" className="text-footer-muted hover:text-white transition-colors">
                    Техническая поддержка
                  </a>
                </li>
                <li>
                  <a href="#" className="text-footer-muted hover:text-white transition-colors">
                    Примеры интеграции
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Помощь</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="text-footer-muted hover:text-white transition-colors">
                    Руководство пользователя
                  </a>
                </li>
                <li>
                  <a href="#" className="text-footer-muted hover:text-white transition-colors">
                    FAQ
                  </a>
                </li>
                <li>
                  <a href="#" className="text-footer-muted hover:text-white transition-colors">
                    Обратная связь
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Контакты</h3>
              <ul className="space-y-2 text-sm text-footer-muted">
                <li>Email: info@nrk.edu.ru</li>
                <li>Тел: +7 (495) 123-45-67</li>
                <li>Москва, ул. Тверская, 1</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 pt-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center text-sm">
            <div>© 2026 Национальный реестр компетенций. Министерство науки и высшего образования РФ</div>
            <div className="flex gap-6">
              <a href="#" className="text-footer-muted hover:text-white transition-colors">
                Политика конфиденциальности
              </a>
              <a href="#" className="text-footer-muted hover:text-white transition-colors">
                Условия использования
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
