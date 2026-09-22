import { useEffect, type ReactNode } from "react";
import { Link } from "react-router";
import {
  BookOpen,
  ClipboardCheck,
  FolderOpen,
  LogIn,
  Search,
  Shield,
  UserPlus,
} from "lucide-react";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";

const SECTIONS = [
  {
    id: "start",
    icon: Search,
    title: "Просмотр реестра",
    description: "Главная, поиск и карточка компетенции без входа в систему",
  },
  {
    id: "account",
    icon: LogIn,
    title: "Регистрация и вход",
    description: "Аккаунт, подтверждение почты, профиль и восстановление пароля",
  },
  {
    id: "wizard",
    icon: UserPlus,
    title: "Предложить компетенцию",
    description: "Семь шагов конструктора: от ФГОС до оценочных средств",
  },
  {
    id: "projects",
    icon: FolderOpen,
    title: "Мои проекты",
    description: "Черновики, отправка на экспертизу и удаление своих записей",
  },
  {
    id: "review",
    icon: ClipboardCheck,
    title: "Экспертиза",
    description: "Назначение рецензентов, чек-лист и решение по заявке",
  },
  {
    id: "staff",
    icon: Shield,
    title: "Служебные разделы",
    description: "Справочники, пользователи и выгрузка документов",
  },
];

function GuideStep({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-primary">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

export function UserGuidePage() {
  useEffect(() => {
    const id = window.location.hash.replace("#", "");
    if (!id) return;
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  return (
    <PageShell>
      <PageHeader
        title="Руководство пользователя"
        description="Как пользоваться Национальным реестром компетенций: найти запись, предложить паспорт, пройти экспертизу и выгрузить документ."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
        {SECTIONS.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="block surface p-5 hover:shadow-md hover:border-primary/40 transition-all"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-primary flex items-center justify-center shrink-0">
                <item.icon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-1">{item.title}</h2>
                <p className="text-sm text-gray-500">{item.description}</p>
              </div>
            </div>
          </a>
        ))}
      </div>

      <article className="space-y-16">
        <section id="start" className="scroll-mt-28 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Просмотр реестра</h2>
          <p className="text-sm text-gray-700 leading-relaxed max-w-4xl">
            Открытый контур доступен без учётной записи. В поиске видны утверждённые компетенции
            и записи, которые находятся на экспертизе. Подробнее о назначении платформы — в разделе{" "}
            <Link to="/about" className="text-primary font-medium hover:underline">
              О проекте
            </Link>
            , о шкалах и ФОС — в{" "}
            <Link to="/methodology" className="text-primary font-medium hover:underline">
              Методологии
            </Link>
            .
          </p>
          <div className="surface p-6 md:p-8 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Главная страница</h3>
            <ul className="space-y-2 text-sm text-gray-700 leading-relaxed">
              <li>Счётчики показывают число записей в открытом реестре, в том числе утверждённых и на экспертизе.</li>
              <li>Блок последних компетенций ведёт сразу в карточку.</li>
              <li>
                Карточки областей профессиональной деятельности открывают{" "}
                <Link to="/search" className="text-primary font-medium hover:underline">
                  поиск
                </Link>{" "}
                с выбранной областью.
              </li>
            </ul>
          </div>
          <div className="surface p-6 md:p-8 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Поиск</h3>
            <ol className="space-y-3 text-sm text-gray-700 leading-relaxed">
              <GuideStep n={1}>
                Введите название, код или числовой ID в поле поиска в шапке либо на странице «Поиск компетенций».
              </GuideStep>
              <GuideStep n={2}>
                Сузьте выборку фильтрами: область профессиональной деятельности, статус и уровень образования.
              </GuideStep>
              <GuideStep n={3}>
                Откройте карточку по названию или коду. Статусы: <strong>действует</strong> (утверждена),{" "}
                <strong>на экспертизе</strong>, <strong>проект</strong>, <strong>архив</strong>.
              </GuideStep>
            </ol>
          </div>
          <div className="surface p-6 md:p-8 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Карточка компетенции</h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              Вкладки повторяют паспорт: основное, уровни освоения, структура A/B/C, дисциплины и технологии,
              оценочные средства, ресурсы. Кнопка «Скачать DOCX» выгружает документ паспорта. Авторизованный
              пользователь получает полный документ; без входа доступна публичная версия утверждённой записи.
            </p>
          </div>
        </section>

        <section id="account" className="scroll-mt-28 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Регистрация и вход</h2>
          <p className="text-sm text-gray-700 leading-relaxed max-w-4xl">
            Предложить компетенцию, вести проекты и участвовать в экспертизе можно только после входа.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="surface p-5 space-y-3">
              <h3 className="text-base font-semibold text-gray-900">Как создать аккаунт</h3>
              <ol className="space-y-3 text-sm text-gray-700 leading-relaxed">
                <GuideStep n={1}>
                  Откройте{" "}
                  <Link to="/register" className="text-primary font-medium hover:underline">
                    Регистрацию
                  </Link>{" "}
                  и укажите ФИО, организацию, email и пароль.
                </GuideStep>
                <GuideStep n={2}>Подтвердите адрес по ссылке из письма. До этого вход недоступен.</GuideStep>
                <GuideStep n={3}>
                  Войдите на странице{" "}
                  <Link to="/login" className="text-primary font-medium hover:underline">
                    Вход в систему
                  </Link>
                  .
                </GuideStep>
              </ol>
            </div>
            <div className="surface p-5 space-y-3">
              <h3 className="text-base font-semibold text-gray-900">После входа</h3>
              <ul className="space-y-2 text-sm text-gray-700 leading-relaxed">
                <li>
                  <Link to="/profile" className="text-primary font-medium hover:underline">
                    Профиль
                  </Link>{" "}
                  — ФИО, организация и смена пароля.
                </li>
                <li>
                  Если пароль забыт, воспользуйтесь{" "}
                  <Link to="/forgot-password" className="text-primary font-medium hover:underline">
                    восстановлением
                  </Link>
                  : ссылка приходит на email.
                </li>
                <li>
                  Роль задаёт администратор: пользователь, эксперт, модератор или администратор.
                  От роли зависит меню в шапке.
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section id="wizard" className="scroll-mt-28 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Как предложить компетенцию</h2>
          <p className="text-sm text-gray-700 leading-relaxed max-w-4xl">
            Конструктор открывается пунктом «Предложить компетенцию» или по адресу{" "}
            <Link to="/new" className="text-primary font-medium hover:underline">
              /new
            </Link>
            . Черновик можно сохранить с одним названием. На экспертизу система отправит только заполненный паспорт.
          </p>

          <div className="overflow-x-auto surface">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Шаг</th>
                  <th className="px-4 py-3 font-semibold">Что заполнить</th>
                  <th className="px-4 py-3 font-semibold">Обязательно для экспертизы</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                <tr>
                  <td className="px-4 py-3 font-medium">1. Общая информация</td>
                  <td className="px-4 py-3">
                    Название, описание, область деятельности, вид образования, уровень или профессию
                    рабочего / должность служащего, ФГОС (если применим), трудоёмкость, разработчик.
                  </td>
                  <td className="px-4 py-3">Да</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">2. Профстандарт и уровень</td>
                  <td className="px-4 py-3">
                    Уровень квалификации 1–9 по приказу № 148н, вид компетенции, профессиональный стандарт
                    и трудовые функции одного уровня. Для СПО доступны уровни 1–6.
                  </td>
                  <td className="px-4 py-3">Да, для профессиональной компетенции</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">3. Структура A/B/C</td>
                  <td className="px-4 py-3">
                    A — знания, B — умения, C — практические навыки. Компоненты подтягиваются из выбранных
                    трудовых функций; формулировки можно уточнить, умения — перенести в навыки.
                  </td>
                  <td className="px-4 py-3">Минимум одно знание и одно умение</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">4. Дескрипторы</td>
                  <td className="px-4 py-3">
                    Тексты для A/B/C на базовом, продвинутом и экспертном уровнях. Кнопка матрицы подставляет
                    типовые формулировки по выбранному уровню квалификации.
                  </td>
                  <td className="px-4 py-3">Все девять ячеек</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">5. Привязка к дисциплинам</td>
                  <td className="px-4 py-3">
                    Для каждого компонента — дисциплина, модуль или практика, форма контроля, важность и объём
                    по 10-балльной шкале. Один компонент можно связать с несколькими дисциплинами.
                  </td>
                  <td className="px-4 py-3">Рекомендуется заполнить</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">6. Оценочные средства</td>
                  <td className="px-4 py-3">
                    Распределите A/B/C по методам (тестирование, кейс, практика, деловая игра, проект) на трёх
                    уровнях. Затем заполните задания: формулировку, критерии, варианты ответа, при необходимости
                    вложения и отметку «для НОК».
                  </td>
                  <td className="px-4 py-3">Все запланированные задания должны быть готовы</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">7. Предпросмотр</td>
                  <td className="px-4 py-3">
                    Проверьте паспорт целиком, выгрузите DOCX или отправьте на экспертизу.
                  </td>
                  <td className="px-4 py-3">Проверка перед отправкой</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 leading-relaxed max-w-4xl">
            На шаге 6 конструктор не даст отправить заявку, если компонент не закрыт заданием или задание
            заполнено не полностью. Правила методов и покрытия описаны в{" "}
            <Link to="/methodology#fos" className="font-semibold underline">
              методологии ФОС
            </Link>
            . Шкалы важности и объёма — в разделе{" "}
            <Link to="/methodology#scoring" className="font-semibold underline">
              экспертной оценки
            </Link>
            .
          </div>
        </section>

        <section id="projects" className="scroll-mt-28 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Мои проекты</h2>
          <p className="text-sm text-gray-700 leading-relaxed max-w-4xl">
            Раздел{" "}
            <Link to="/my-projects" className="text-primary font-medium hover:underline">
              Мои проекты
            </Link>{" "}
            доступен после входа. Здесь лежат компетенции, которые вы создали.
          </p>
          <div className="surface p-6 md:p-8 space-y-3 text-sm text-gray-700 leading-relaxed">
            <ul className="space-y-2">
              <li>
                <strong>Создать новый проект</strong> открывает конструктор. У администратора эта кнопка ведёт
                в стратегическую сессию.
              </li>
              <li>
                Откройте карточку, чтобы продолжить работу, скачать документ или дождаться решения экспертизы.
              </li>
              <li>
                Удаление необратимо: система спрашивает подтверждение. Не удаляйте запись, если она уже
                на рассмотрении у экспертов, без согласования с модератором.
              </li>
              <li>
                Черновик со статусом «проект» можно доработать и отправить заново. После утверждения запись
                появляется в открытом поиске.
              </li>
            </ul>
          </div>
        </section>

        <section id="review" className="scroll-mt-28 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Экспертиза</h2>
          <p className="text-sm text-gray-700 leading-relaxed max-w-4xl">
            Заявка со статусом «на экспертизе» попадает в служебную панель. Модератор назначает рецензентов,
            эксперт заполняет чек-лист на карточке компетенции.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="surface p-5 space-y-3">
              <h3 className="text-base font-semibold text-gray-900">Модератор</h3>
              <ol className="space-y-3 text-sm text-gray-700 leading-relaxed">
                <GuideStep n={1}>Откройте «Модерация» в шапке.</GuideStep>
                <GuideStep n={2}>Выберите заявку на рассмотрении и перейдите в карточку.</GuideStep>
                <GuideStep n={3}>
                  Назначьте не менее трёх экспертов из списка. Без этого экспертиза не считается укомплектованной.
                </GuideStep>
              </ol>
            </div>
            <div className="surface p-5 space-y-3">
              <h3 className="text-base font-semibold text-gray-900">Эксперт</h3>
              <ol className="space-y-3 text-sm text-gray-700 leading-relaxed">
                <GuideStep n={1}>Откройте «Панель эксперта» и карточку назначенной заявки.</GuideStep>
                <GuideStep n={2}>
                  По каждому критерию поставьте «Да» или «Нет». Для ответа «Нет» комментарий обязателен.
                </GuideStep>
                <GuideStep n={3}>
                  «Утвердить» доступно, если все критерии, кроме пригодности для НОК, отмечены «Да».
                  «Вернуть на доработку» — если есть хотя бы один «Нет».
                </GuideStep>
              </ol>
            </div>
          </div>
        </section>

        <section id="staff" className="scroll-mt-28 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Служебные разделы</h2>
          <p className="text-sm text-gray-700 leading-relaxed max-w-4xl">
            Пункты ниже видят администратор и сотрудники с соответствующими ролями. Обычному разработчику
            компетенции они не нужны.
          </p>
          <div className="surface p-6 md:p-8">
            <ul className="space-y-3 text-sm text-gray-700 leading-relaxed">
              <li>
                <strong>Профстандарты, квалификации, ФГОС, оценочные средства</strong> — справочники, из которых
                конструктор подставляет трудовые функции, уровни и образовательные программы.
              </li>
              <li>
                <strong>Стратегическая сессия</strong> — расширенный контур сборки компетенции для администратора.
              </li>
              <li>
                <strong>Пользователи</strong> — назначение ролей, создание учётных записей, при необходимости
                вход от имени пользователя.
              </li>
              <li>
                <strong>Интеграция</strong> — описание внешних контуров и{" "}
                <Link to="/integration" className="text-primary font-medium hover:underline">
                  документации API
                </Link>{" "}
                для информационных систем.
              </li>
            </ul>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Если что-то не получается</h2>
          <div className="surface p-6 md:p-8 space-y-3 text-sm text-gray-700 leading-relaxed">
            <p>
              <strong>Не удаётся перейти к следующему шагу.</strong> Система показывает, какого поля не хватает:
              название, описание, ФГОС, область деятельности, уровень квалификации или структура A/B.
            </p>
            <p>
              <strong>Не отправляется на экспертизу.</strong> Проверьте дескрипторы (девять текстов) и конструктор
              ФОС: все запланированные задания должны быть заполнены.
            </p>
            <p>
              <strong>Карточка не находится в поиске.</strong> Черновик виден только автору в «Моих проектах».
              В открытом списке — утверждённые записи и заявки на экспертизе.
            </p>
            <p>
              <strong>Письмо подтверждения не пришло.</strong> Проверьте папку спама и правильность email.
              Ссылку можно запросить повторно у администратора площадки.
            </p>
          </div>
        </section>

        <section className="flex flex-wrap gap-3">
          <Link
            to="/search"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90"
          >
            Открыть поиск
          </Link>
          <Link
            to="/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-800 hover:border-primary/40"
          >
            Предложить компетенцию
          </Link>
          <Link
            to="/methodology"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-800 hover:border-primary/40"
          >
            <BookOpen className="w-4 h-4" />
            Методология
          </Link>
        </section>
      </article>
    </PageShell>
  );
}
