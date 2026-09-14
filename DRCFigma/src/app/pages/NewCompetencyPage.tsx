import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, ArrowRight, Save, Send, Plus, X } from "lucide-react";
import { industries } from "../data/competencies";

export function NewCompetencyPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    industry: "",
    educationLevel: "",
    workload: "",
    knowledge: [""],
    skills: [""],
    abilities: [""],
    professionalStandard: "",
    laborFunction: "",
    typicalTasks: "",
    methods: [] as string[],
    files: [] as string[]
  });

  const steps = [
    { number: 1, name: "Общая информация" },
    { number: 2, name: "Структура A/B/C" },
    { number: 3, name: "Связь с профстандартами" },
    { number: 4, name: "Оценочные средства" },
    { number: 5, name: "Предпросмотр" }
  ];

  const educationLevels = ["Бакалавриат", "Магистратура", "СПО", "ДПО"];
  const assessmentMethods = ["Кейс-метод", "Деловая игра", "Практические задания", "Тестирование", "Проектная работа"];

  const addArrayItem = (field: keyof typeof formData) => {
    setFormData({
      ...formData,
      [field]: [...(formData[field] as string[]), ""]
    });
  };

  const removeArrayItem = (field: keyof typeof formData, index: number) => {
    const items = formData[field] as string[];
    setFormData({
      ...formData,
      [field]: items.filter((_, i) => i !== index)
    });
  };

  const updateArrayItem = (field: keyof typeof formData, index: number, value: string) => {
    const items = [...(formData[field] as string[])];
    items[index] = value;
    setFormData({
      ...formData,
      [field]: items
    });
  };

  const toggleMethod = (method: string) => {
    setFormData({
      ...formData,
      methods: formData.methods.includes(method)
        ? formData.methods.filter(m => m !== method)
        : [...formData.methods, method]
    });
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Вернуться на главную
          </Link>

          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Предложить новую компетенцию
          </h1>

          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center">
                <div className="flex items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                      currentStep === step.number
                        ? "bg-blue-600 text-white"
                        : currentStep > step.number
                        ? "bg-green-500 text-white"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {step.number}
                  </div>
                  <span
                    className={`ml-3 text-sm font-medium ${
                      currentStep === step.number ? "text-gray-900" : "text-gray-500"
                    }`}
                  >
                    {step.name}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-16 h-1 mx-4 ${
                      currentStep > step.number ? "bg-green-500" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              {currentStep === 1 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">
                    Общая информация о компетенции
                  </h2>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Название компетенции <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Например: Способен применять..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Описание компетенции <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Подробное описание компетенции..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Отрасль <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.industry}
                        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Выберите отрасль</option>
                        {industries.map((industry) => (
                          <option key={industry} value={industry}>
                            {industry}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Уровень образования <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.educationLevel}
                        onChange={(e) => setFormData({ ...formData, educationLevel: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Выберите уровень</option>
                        {educationLevels.map((level) => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Рекомендуемая трудоёмкость
                    </label>
                    <input
                      type="text"
                      value={formData.workload}
                      onChange={(e) => setFormData({ ...formData, workload: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Например: 180 часов"
                    />
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">
                    Структура компетенции (A/B/C)
                  </h2>

                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center text-blue-600 font-bold">
                        A
                      </div>
                      <label className="text-sm font-medium text-gray-700">
                        Знания <span className="text-red-500">*</span>
                      </label>
                    </div>
                    {formData.knowledge.map((item, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => updateArrayItem("knowledge", index, e.target.value)}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Введите знание..."
                        />
                        {formData.knowledge.length > 1 && (
                          <button
                            onClick={() => removeArrayItem("knowledge", index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => addArrayItem("knowledge")}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mt-2"
                    >
                      <Plus className="w-4 h-4" />
                      Добавить знание
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-green-100 rounded flex items-center justify-center text-green-600 font-bold">
                        B
                      </div>
                      <label className="text-sm font-medium text-gray-700">
                        Умения <span className="text-red-500">*</span>
                      </label>
                    </div>
                    {formData.skills.map((item, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => updateArrayItem("skills", index, e.target.value)}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Введите умение..."
                        />
                        {formData.skills.length > 1 && (
                          <button
                            onClick={() => removeArrayItem("skills", index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => addArrayItem("skills")}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mt-2"
                    >
                      <Plus className="w-4 h-4" />
                      Добавить умение
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-purple-100 rounded flex items-center justify-center text-purple-600 font-bold">
                        C
                      </div>
                      <label className="text-sm font-medium text-gray-700">
                        Навыки <span className="text-red-500">*</span>
                      </label>
                    </div>
                    {formData.abilities.map((item, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => updateArrayItem("abilities", index, e.target.value)}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Введите навык..."
                        />
                        {formData.abilities.length > 1 && (
                          <button
                            onClick={() => removeArrayItem("abilities", index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => addArrayItem("abilities")}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mt-2"
                    >
                      <Plus className="w-4 h-4" />
                      Добавить навык
                    </button>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">
                    Связь с профессиональными стандартами
                  </h2>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Профессиональный стандарт
                    </label>
                    <input
                      type="text"
                      value={formData.professionalStandard}
                      onChange={(e) => setFormData({ ...formData, professionalStandard: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Введите код или название профстандарта..."
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Начните вводить, чтобы увидеть подсказки
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Трудовая функция
                    </label>
                    <input
                      type="text"
                      value={formData.laborFunction}
                      onChange={(e) => setFormData({ ...formData, laborFunction: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Выберите трудовую функцию..."
                      disabled={!formData.professionalStandard}
                    />
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      💡 Связь с профессиональными стандартами не является обязательной для общекультурных компетенций
                    </p>
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">
                    Оценочные средства и технологии
                  </h2>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Типовые задания
                    </label>
                    <textarea
                      value={formData.typicalTasks}
                      onChange={(e) => setFormData({ ...formData, typicalTasks: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Опишите типовые задания для оценки компетенции..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Рекомендуемые методы обучения
                    </label>
                    <div className="space-y-2">
                      {assessmentMethods.map((method) => (
                        <label key={method} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.methods.includes(method)}
                            onChange={() => toggleMethod(method)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{method}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Оценочные материалы (файлы)
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <p className="text-sm text-gray-600 mb-2">
                        Перетащите файлы сюда или нажмите для выбора
                      </p>
                      <button className="text-sm text-blue-600 hover:text-blue-700">
                        Выбрать файлы
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 5 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">
                    Предпросмотр компетенции
                  </h2>

                  <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Название</h3>
                      <p className="text-gray-900">{formData.title || "Не указано"}</p>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Описание</h3>
                      <p className="text-gray-900">{formData.description || "Не указано"}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-1">Отрасль</h3>
                        <p className="text-gray-900">{formData.industry || "Не указано"}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-1">Уровень</h3>
                        <p className="text-gray-900">{formData.educationLevel || "Не указано"}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-2">Знания (A)</h3>
                        <p className="text-sm text-gray-700">
                          {formData.knowledge.filter(k => k).length} элементов
                        </p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-2">Умения (B)</h3>
                        <p className="text-sm text-gray-700">
                          {formData.skills.filter(s => s).length} элементов
                        </p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-2">Навыки (C)</h3>
                        <p className="text-sm text-gray-700">
                          {formData.abilities.filter(a => a).length} элементов
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      ⚠️ После отправки заявка будет направлена на экспертизу. Вы сможете отслеживать её статус в личном кабинете.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                  disabled={currentStep === 1}
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Назад
                </button>

                <div className="flex gap-2">
                  <button className="flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                    <Save className="w-4 h-4" />
                    Сохранить черновик
                  </button>

                  {currentStep < 5 ? (
                    <button
                      onClick={() => setCurrentStep(Math.min(5, currentStep + 1))}
                      className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Далее
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                      <Send className="w-4 h-4" />
                      Отправить на экспертизу
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-6">
              <h3 className="font-semibold text-gray-900 mb-4">Правила заполнения</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Название должно быть кратким и содержательным</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Используйте конкретные формулировки для A/B/C</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Связь с профстандартами повышает ценность компетенции</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Приложите примеры оценочных средств</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
