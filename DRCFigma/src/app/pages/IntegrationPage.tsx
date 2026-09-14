import { Link } from "react-router";
import { ArrowRight, Database, Users, FileText, Globe, Share2, Lock } from "lucide-react";

export function IntegrationPage() {
  const integrations = [
    {
      id: "cop",
      icon: "👤",
      title: "Цифровой образовательный профиль (ЦОП)",
      description: "Реестр компетенций интегрирован с ЦОП для отслеживания прогресса студентов в освоении компетенций",
      features: [
        "Автоматическая фиксация освоенных компетенций",
        "Визуализация прогресса студента",
        "Формирование портфолио компетенций",
        "Сопоставление с требованиями работодателей"
      ],
      color: "purple"
    },
    {
      id: "poa",
      icon: "📊",
      title: "Персональные образовательные активы (ПОА)",
      description: "Компетенции из реестра используются для формирования и управления персональными образовательными активами",
      features: [
        "Токенизация компетенций",
        "Верификация достижений",
        "Межвузовский обмен данными",
        "Прозрачность и защита от подделок"
      ],
      color: "blue"
    },
    {
      id: "target",
      icon: "🎓",
      title: "Целевое обучение (смарт-контракты)",
      description: "Смарт-контракты на основе компетенций для целевого обучения между вузами, студентами и работодателями",
      features: [
        "Автоматизация договоров целевого обучения",
        "Верификация выполнения условий",
        "Прозрачность обязательств сторон",
        "Интеграция с финансовыми системами"
      ],
      color: "green"
    },
    {
      id: "opop",
      icon: "📚",
      title: "ОПОП и образовательные программы",
      description: "Вузы используют реестр для формирования компетентностных моделей образовательных программ",
      features: [
        "Автоматический импорт компетенций в ОПОП",
        "Проверка соответствия ФГОС",
        "Актуализация программ при обновлении реестра",
        "Формирование матриц компетенций"
      ],
      color: "yellow"
    },
    {
      id: "profstandard",
      icon: "🏢",
      title: "Профессиональные стандарты",
      description: "Двусторонняя интеграция с реестром профстандартов для связи компетенций с трудовыми функциями",
      features: [
        "Автоматическая синхронизация с реестром профстандартов",
        "Сопоставление компетенций и трудовых функций",
        "Уведомления об обновлениях профстандартов",
        "API для СПК и работодателей"
      ],
      color: "red"
    },
    {
      id: "international",
      icon: "🌍",
      title: "Международная гармонизация",
      description: "Интеграция с международными системами классификации компетенций (ESCO, ISCED)",
      features: [
        "Автоматическое сопоставление с ESCO",
        "Поддержка ISCED кодов",
        "Экспорт данных для международных партнеров",
        "Мультиязычность интерфейса"
      ],
      color: "indigo"
    }
  ];

  const colorClasses = {
    purple: "bg-purple-100 border-purple-300",
    blue: "bg-blue-100 border-blue-300",
    green: "bg-green-100 border-green-300",
    yellow: "bg-yellow-100 border-yellow-300",
    red: "bg-red-100 border-red-300",
    indigo: "bg-indigo-100 border-indigo-300"
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-blue-100 hover:text-white mb-6"
          >
            ← Вернуться на главную
          </Link>
          <h1 className="text-4xl font-bold mb-4">Интеграция и экосистема</h1>
          <p className="text-xl text-blue-100 max-w-3xl">
            Национальный реестр компетенций является ядром образовательной экосистемы,
            обеспечивая связь между образовательными организациями, работодателями и студентами
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
              Архитектура системы
            </h2>
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <div className="w-32 h-32 bg-blue-600 rounded-lg flex items-center justify-center text-white mb-2">
                  <Database className="w-16 h-16" />
                </div>
                <p className="font-semibold text-gray-900">Реестр компетенций</p>
                <p className="text-sm text-gray-600">Центральное хранилище</p>
              </div>

              <ArrowRight className="w-8 h-8 text-gray-400" />

              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="w-24 h-24 bg-purple-500 rounded-lg flex items-center justify-center text-white mb-2">
                    <Users className="w-12 h-12" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900">Студенты</p>
                </div>
                <div className="text-center">
                  <div className="w-24 h-24 bg-green-500 rounded-lg flex items-center justify-center text-white mb-2">
                    <FileText className="w-12 h-12" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900">Вузы</p>
                </div>
                <div className="text-center">
                  <div className="w-24 h-24 bg-yellow-500 rounded-lg flex items-center justify-center text-white mb-2">
                    <Share2 className="w-12 h-12" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900">Работодатели</p>
                </div>
                <div className="text-center">
                  <div className="w-24 h-24 bg-indigo-500 rounded-lg flex items-center justify-center text-white mb-2">
                    <Globe className="w-12 h-12" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900">Партнеры</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-12">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className={`bg-white rounded-lg shadow-sm border-2 ${colorClasses[integration.color]} p-6`}
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="text-4xl">{integration.icon}</div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {integration.title}
                  </h3>
                  <p className="text-sm text-gray-600">{integration.description}</p>
                </div>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Ключевые возможности:
                </h4>
                <ul className="space-y-1">
                  {integration.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-blue-600 flex-shrink-0">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Share2 className="w-8 h-8 text-blue-600" />
              <h3 className="text-xl font-semibold text-gray-900">API для разработчиков</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Открытый REST API для интеграции с внешними системами
            </p>
            <ul className="space-y-2 text-sm text-gray-700 mb-4">
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span>Поиск и получение компетенций</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span>Подписка на обновления</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span>Экспорт в различных форматах (JSON, XML)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span>OAuth 2.0 аутентификация</span>
              </li>
            </ul>
            <a
              href="#"
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Документация API
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Lock className="w-8 h-8 text-green-600" />
              <h3 className="text-xl font-semibold text-gray-900">Безопасность и приватность</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Защита данных и соблюдение требований законодательства
            </p>
            <ul className="space-y-2 text-sm text-gray-700 mb-4">
              <li className="flex items-start gap-2">
                <span className="text-green-600">•</span>
                <span>Соответствие требованиям ФЗ-152</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600">•</span>
                <span>Шифрование данных при передаче и хранении</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600">•</span>
                <span>Аудит доступа и изменений</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600">•</span>
                <span>Ролевая модель доступа (RBAC)</span>
              </li>
            </ul>
            <a
              href="#"
              className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 text-sm font-medium"
            >
              Политика безопасности
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div className="mt-12 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg p-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold mb-2">Присоединяйтесь к экосистеме</h3>
              <p className="text-blue-100">
                Интегрируйте ваши системы с Национальным реестром компетенций
              </p>
            </div>
            <button className="px-6 py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 font-semibold">
              Связаться с нами
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
