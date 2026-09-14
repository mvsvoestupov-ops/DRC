import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, FileText, PlusCircle, LogOut, Menu, X, Shield, BookOpen, UserPlus, GraduationCap, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';

const AppLayout = ({ children }) => {
  const { user, logout, isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Определяем пункты меню в зависимости от роли
  const getMenuItems = () => {
    if (!isAuthenticated) return [];

    let items = [
      { label: 'Мои проекты', icon: FileText, path: '/my-projects', adminOnly: false },
      { label: 'Стратегическая сессия', icon: Play, path: '/strategic-session', adminOnly: false },
    ];

    if (isAdmin) {
      items = [
        { label: 'Главная', icon: Home, path: '/', adminOnly: true },
        ...items,
        { label: 'Профстандарты', icon: BookOpen, path: '/standards', adminOnly: true },
        { label: 'Квалификации', icon: GraduationCap, path: '/qualifications', adminOnly: true },
        { label: 'Предложить компетенцию', icon: PlusCircle, path: '/create-competence', adminOnly: true },
        { label: 'Регистрации', icon: Shield, path: '/admin/registrations', adminOnly: true },
      ];
    }

    items.push({ label: 'Регистрация', icon: UserPlus, path: '/register', adminOnly: false });
    return items;
  };

  const menuItems = getMenuItems();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-2">
                <Shield className="w-6 h-6 text-primary" />
                <span className="text-lg font-medium text-foreground">
                  Национальный реестр компетенций
                </span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            {isAuthenticated && (
              <nav className="hidden md:flex items-center space-x-1">
                {menuItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="flex items-center px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                  >
                    <item.icon className="w-4 h-4 mr-2" />
                    {item.label}
                  </Link>
                ))}
              </nav>
            )}

            {/* User Info & Logout */}
            {isAuthenticated && (
              <div className="flex items-center space-x-4">
                <span className="hidden md:block text-sm text-muted-foreground">
                  {user?.email || ''}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Выйти
                </Button>

                {/* Mobile menu button */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-2 rounded-md text-muted-foreground hover:bg-accent"
                >
                  {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && isAuthenticated && (
          <div className="md:hidden border-t border-border">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {menuItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex items-center px-3 py-2 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-center text-sm text-muted-foreground">
            © 2026 Национальный реестр компетенций
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;
