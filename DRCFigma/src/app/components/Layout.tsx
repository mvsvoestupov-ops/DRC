import { Outlet, Link } from "react-router";
import { Search, User, Menu } from "lucide-react";

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F5F7FA' }}>
      <header style={{
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E5E7EB',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
      }}>
        <div className="max-w-[1440px] mx-auto px-8">
          <div className="flex justify-between items-center h-20">
            <Link to="/" className="flex items-center gap-4">
              <div style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#1E40AF',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <path d="M16 4L4 10V16C4 23 10 27.5 16 28C22 27.5 28 23 28 16V10L16 4Z"
                    stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  <path d="M12 16L15 19L21 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <div className="font-bold text-gray-900" style={{ fontSize: '18px', lineHeight: '24px' }}>
                  Национальный реестр компетенций
                </div>
                <div className="text-xs text-gray-500">
                  РОСОБРНАДЗОР
                </div>
              </div>
            </Link>

            <div className="flex items-center gap-6">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Поиск по названию или ID компетенции..."
                  style={{
                    width: '400px',
                    paddingLeft: '40px',
                    paddingRight: '16px',
                    paddingTop: '10px',
                    paddingBottom: '10px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                  className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
              </div>

              <select
                style={{
                  padding: '8px 12px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
                className="focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>RU</option>
                <option>EN</option>
              </select>

              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  backgroundColor: '#1E40AF',
                  color: 'white',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
                className="hover:bg-blue-800 transition-colors"
              >
                <User className="w-4 h-4" />
                <span>Войти</span>
              </button>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #E5E7EB', backgroundColor: '#FAFBFC' }}>
          <div className="max-w-[1440px] mx-auto px-8">
            <nav className="flex gap-8 h-12 items-center text-sm">
              <Link to="/" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
                Главная
              </Link>
              <Link to="/search" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
                Поиск компетенций
              </Link>
              <Link to="/new" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
                Предложить компетенцию
              </Link>
              <Link to="/admin" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
                Панель эксперта
              </Link>
              <Link to="/integration" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
                Интеграция
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer style={{ backgroundColor: '#1F2937', color: '#9CA3AF' }}>
        <div className="max-w-[1440px] mx-auto px-8 py-12">
          <div className="grid grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-semibold text-white mb-4">О реестре</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">О проекте</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Нормативная база</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Методология</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Для разработчиков</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/integration" className="hover:text-white transition-colors">Документация API</Link></li>
                <li><a href="#" className="hover:text-white transition-colors">Техническая поддержка</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Примеры интеграции</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Помощь</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Руководство пользователя</a></li>
                <li><a href="#" className="hover:text-white transition-colors">FAQ</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Обратная связь</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Контакты</h3>
              <ul className="space-y-2 text-sm">
                <li>Email: info@nrk.edu.ru</li>
                <li>Тел: +7 (495) 123-45-67</li>
                <li>Москва, ул. Тверская, 1</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 pt-6 flex justify-between items-center text-sm">
            <div>© 2026 Национальный реестр компетенций. Министерство науки и высшего образования РФ</div>
            <div className="flex gap-6">
              <a href="#" className="hover:text-white transition-colors">Политика конфиденциальности</a>
              <a href="#" className="hover:text-white transition-colors">Условия использования</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
