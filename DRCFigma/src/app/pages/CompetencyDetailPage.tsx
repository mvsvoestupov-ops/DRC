import { useState } from "react";
import { useParams, Link } from "react-router";
import { ArrowLeft, Edit, Download, Share2, ExternalLink } from "lucide-react";
import { competencies } from "../data/competencies";

export function CompetencyDetailPage() {
  const { id } = useParams();
  const competency = competencies.find((c) => c.id === id);
  const [activeTab, setActiveTab] = useState("overview");

  if (!competency) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Компетенция не найдена</h2>
          <Link to="/search" className="text-blue-600 hover:text-blue-700">
            Вернуться к поиску
          </Link>
        </div>
      </div>
    );
  }

  const statusColors = {
    active: "bg-green-100 text-green-800",
    draft: "bg-gray-100 text-gray-800",
    review: "bg-yellow-100 text-yellow-800",
    archived: "bg-red-100 text-red-800"
  };

  const statusLabels = {
    active: "Действует",
    draft: "Проект",
    review: "На экспертизе",
    archived: "Архив"
  };

  const tabs = [
    { id: "overview", label: "Основное" },
    { id: "structure", label: "Структура (A/B/C) и уровни" },
    { id: "standards", label: "Профстандарты и трудовые функции" },
    { id: "assessment", label: "Оценочные средства" },
    { id: "international", label: "Международные эквиваленты" }
  ];

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            to="/search"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Вернуться к поиску
          </Link>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-mono text-blue-600">{competency.id}</span>
                <span className={`px-2 py-1 rounded text-xs ${statusColors[competency.status]}`}>
                  {statusLabels[competency.status]}
                </span>
                <span className="text-sm text-gray-500">Версия {competency.version}</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {competency.title}
              </h1>
              <div className="flex items-center gap-6 text-sm text-gray-600">
                <span>Отрасль: {competency.industry}</span>
                <span>Уровень: {competency.educationLevel}</span>
                <span>Разработчик: {competency.developer}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                <Edit className="w-4 h-4" />
                Редактировать
              </button>
              <button className="flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                <Download className="w-4 h-4" />
                Экспорт
              </button>
              <button className="flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                <Share2 className="w-4 h-4" />
                Поделиться
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-8 border-b border-gray-200">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-4 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Описание</h2>
              <p className="text-gray-700 leading-relaxed">{competency.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  Трудоёмкость
                </h3>
                <p className="text-xl font-semibold text-gray-900">{competency.workload}</p>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  Дата обновления
                </h3>
                <p className="text-xl font-semibold text-gray-900">
                  {new Date(competency.lastUpdated).toLocaleDateString('ru-RU')}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Уровни освоения</h2>
              <div className="space-y-4">
                {competency.levels.map((level, index) => (
                  <div key={index} className="border-l-4 border-blue-500 pl-4">
                    <h3 className="font-semibold text-gray-900 mb-1">{level.name}</h3>
                    <p className="text-gray-600">{level.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "structure" && (
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold">
                  A
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Знания</h2>
              </div>
              <ul className="space-y-2">
                {competency.structure.knowledge.map((item, index) => (
                  <li key={index} className="flex gap-2 text-sm text-gray-700">
                    <span className="text-blue-600 flex-shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-green-600 font-bold">
                  B
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Умения</h2>
              </div>
              <ul className="space-y-2">
                {competency.structure.skills.map((item, index) => (
                  <li key={index} className="flex gap-2 text-sm text-gray-700">
                    <span className="text-green-600 flex-shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 font-bold">
                  C
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Навыки</h2>
              </div>
              <ul className="space-y-2">
                {competency.structure.abilities.map((item, index) => (
                  <li key={index} className="flex gap-2 text-sm text-gray-700">
                    <span className="text-purple-600 flex-shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {activeTab === "standards" && (
          <div className="space-y-6">
            {competency.professionalStandards.length > 0 ? (
              competency.professionalStandards.map((standard, index) => (
                <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 mb-1">
                        {standard.name}
                      </h2>
                      <p className="text-sm text-gray-600">Код: {standard.code}</p>
                    </div>
                    <button className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
                      <ExternalLink className="w-4 h-4" />
                      Открыть профстандарт
                    </button>
                  </div>

                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">Трудовые функции:</h3>
                    <div className="space-y-2">
                      {standard.functions.map((func, idx) => (
                        <div key={idx} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                          <span className="text-sm font-mono text-blue-600">{func.code}</span>
                          <span className="text-sm text-gray-700">{func.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <p className="text-gray-500">Связи с профессиональными стандартами не указаны</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "assessment" && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Типовые задания</h2>
              <p className="text-gray-700">{competency.assessmentTools.typicalTasks}</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Рекомендуемые методы обучения
              </h2>
              <div className="flex flex-wrap gap-2">
                {competency.assessmentTools.methods.map((method, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                  >
                    {method}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Примеры оценочных материалов
              </h2>
              <ul className="space-y-2">
                {competency.assessmentTools.examples.map((example, index) => (
                  <li key={index} className="flex items-center gap-2 text-gray-700">
                    <Download className="w-4 h-4 text-blue-600" />
                    {example}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {activeTab === "international" && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Международные эквиваленты
              </h2>
              <div className="grid grid-cols-2 gap-6">
                {competency.international.escoId && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">ESCO ID</h3>
                    <a
                      href="#"
                      className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      {competency.international.escoId}
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                )}
                {competency.international.iscedCode && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">ISCED код</h3>
                    <p className="text-gray-900">{competency.international.iscedCode}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Страны признания
              </h2>
              <div className="flex flex-wrap gap-2">
                {competency.international.countries.map((country, index) => (
                  <span
                    key={index}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg"
                  >
                    {country}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Использование в экосистеме
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="font-medium text-gray-900 mb-1">ПОА</h3>
              <p className="text-xs text-gray-600">Персональные образовательные активы</p>
            </div>
            <div className="bg-white p-4 rounded-lg text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-2xl">🎓</span>
              </div>
              <h3 className="font-medium text-gray-900 mb-1">Целевое обучение</h3>
              <p className="text-xs text-gray-600">Смарт-контракты</p>
            </div>
            <div className="bg-white p-4 rounded-lg text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-2xl">👤</span>
              </div>
              <h3 className="font-medium text-gray-900 mb-1">ЦОП</h3>
              <p className="text-xs text-gray-600">Цифровой образовательный профиль</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
