import { Outlet, Link, useNavigate, useLocation } from "react-router";
import { Search, User, LogOut, FolderOpen, BookOpen, GraduationCap, Play, ScrollText, ClipboardList, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/app/components/LanguageSwitcher";

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const { pathname } = useLocation();
  const active = pathname === to || (to !== "/" && pathname.startsWith(`${to}/`));
  return (
    <Link
      to={to}
      className={cn(
        "font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0",
        active ? "text-primary" : "text-gray-700 hover:text-primary"
      )}
    >
      {children}
    </Link>
  );
}

export function Layout() {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { t } = useI18n();
  const { isAuthenticated, isAdmin, isExpert, isModerator, user, logout, isImpersonating, impersonatorEmail, stopImpersonation } = useAuth();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-page font-sans">
      {isImpersonating ? (
        <div className="bg-amber-500 text-amber-950 px-4 py-2 text-sm flex flex-wrap items-center justify-center gap-3">
          <span>
            {t("impersonationBanner", {
              email: user?.email || "",
              asAdmin: impersonatorEmail ? t("impersonationAsAdmin", { email: impersonatorEmail }) : "",
            })}
          </span>
          <Button
            size="sm"
            variant="secondary"
            className="h-7"
            onClick={() => {
              stopImpersonation();
              navigate("/admin/users");
            }}
          >
            {t("impersonationBack")}
          </Button>
        </div>
      ) : null}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1440px] mx-auto px-8">
          <div className="flex justify-between items-center h-20">
            <Link to="/" className="flex items-center gap-4 shrink-0">
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
                <div className="font-bold text-gray-900 text-lg leading-tight">
                  {t("brand.title")}
                </div>
                <div className="text-sm text-gray-500">{t("brand.subtitle")}</div>
              </div>
            </Link>

            <div className="flex items-center gap-4 min-w-0">
              <form onSubmit={handleSearch} className="relative hidden md:block">
                <Input
                  type="text"
                  placeholder={t("searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-[320px] max-w-[32vw] pl-10 pr-4 h-10 border-gray-300 focus-visible:ring-primary"
                />
                <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400 pointer-events-none" />
              </form>

              <LanguageSwitcher />

              {isAuthenticated ? (
                <div className="flex items-center gap-3 shrink-0">
                  <Button variant="outline" size="default" className="gap-2" asChild>
                    <Link to="/profile">
                      <User className="w-4 h-4" />
                      <span>{t("cabinet")}</span>
                    </Link>
                  </Button>
                  <Button variant="outline" size="default" className="gap-2" asChild>
                    <Link to="/my-projects">
                      <FolderOpen className="w-4 h-4" />
                      <span>{t("myProjects")}</span>
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
                    <span>{t("logout")}</span>
                  </Button>
                </div>
              ) : (
                <Button variant="default" size="default" className="gap-2" asChild>
                  <Link to="/login">
                    <User className="w-4 h-4" />
                    <span>{t("login")}</span>
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 bg-nav">
          <div className="max-w-[1440px] mx-auto px-8">
            <nav className="flex gap-6 h-14 items-center text-base overflow-x-auto whitespace-nowrap">
              <NavLink to="/">{t("nav.home")}</NavLink>
              <NavLink to="/search">{t("nav.search")}</NavLink>
              <NavLink to="/new">{t("nav.propose")}</NavLink>
              {isAuthenticated && isAdmin && (
                <>
                  <NavLink to="/strategic-session">
                    <Play className="w-3.5 h-3.5" />
                    {t("nav.session")}
                  </NavLink>
                  <NavLink to="/standards">
                    <BookOpen className="w-3.5 h-3.5" />
                    {t("nav.standards")}
                  </NavLink>
                  <NavLink to="/qualifications">
                    <GraduationCap className="w-3.5 h-3.5" />
                    {t("nav.qualifications")}
                  </NavLink>
                  <NavLink to="/assessment-tools">
                    <ClipboardList className="w-3.5 h-3.5" />
                    {t("nav.assessment")}
                  </NavLink>
                  <NavLink to="/fgos">
                    <ScrollText className="w-3.5 h-3.5" />
                    {t("nav.fgos")}
                  </NavLink>
                </>
              )}
              {(isModerator || isExpert) && (
                <NavLink to="/admin">{isModerator ? t("nav.moderation") : t("nav.expert")}</NavLink>
              )}
              {isAdmin && !isImpersonating && (
                <NavLink to="/admin/users">
                  <Users className="w-3.5 h-3.5" />
                  {t("nav.users")}
                </NavLink>
              )}
              <NavLink to="/integration">{t("nav.integration")}</NavLink>
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
              <h3 className="font-semibold text-white mb-4">{t("footer.aboutRegistry")}</h3>
              <ul className="space-y-2 text-base">
                <li>
                  <Link to="/about" className="text-footer-muted hover:text-white transition-colors">
                    {t("footer.aboutProject")}
                  </Link>
                </li>
                <li>
                  <a href="#" className="text-footer-muted hover:text-white transition-colors">
                    {t("footer.legal")}
                  </a>
                </li>
                <li>
                  <Link to="/methodology" className="text-footer-muted hover:text-white transition-colors">
                    {t("footer.methodology")}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">{t("footer.forDevs")}</h3>
              <ul className="space-y-2 text-base">
                <li>
                  <Link to="/integration" className="text-footer-muted hover:text-white transition-colors">
                    {t("footer.api")}
                  </Link>
                </li>
                <li>
                  <a href="#" className="text-footer-muted hover:text-white transition-colors">
                    {t("footer.support")}
                  </a>
                </li>
                <li>
                  <a href="#" className="text-footer-muted hover:text-white transition-colors">
                    {t("footer.examples")}
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">{t("footer.help")}</h3>
              <ul className="space-y-2 text-base">
                <li>
                  <Link to="/user-guide" className="text-footer-muted hover:text-white transition-colors">
                    {t("footer.guide")}
                  </Link>
                </li>
                <li>
                  <a href="#" className="text-footer-muted hover:text-white transition-colors">
                    {t("footer.faq")}
                  </a>
                </li>
                <li>
                  <a href="#" className="text-footer-muted hover:text-white transition-colors">
                    {t("footer.feedback")}
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">{t("footer.contacts")}</h3>
              <ul className="space-y-2 text-base text-footer-muted">
                <li>Email: info@nrk.edu.ru</li>
                <li>{t("footer.phone")} +7 (495) 123-45-67</li>
                <li>{t("footer.address")}</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 pt-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center text-sm">
            <div>{t("footer.copyright")}</div>
            <div className="flex gap-6">
              <a href="#" className="text-footer-muted hover:text-white transition-colors">
                {t("footer.privacy")}
              </a>
              <a href="#" className="text-footer-muted hover:text-white transition-colors">
                {t("footer.terms")}
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
