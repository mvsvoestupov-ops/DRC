import { Link } from "react-router";
import {
  BookOpen,
  Briefcase,
  Building2,
  ClipboardCheck,
  GraduationCap,
  Link2,
  Search,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";

const AUDIENCES = [
  {
    icon: GraduationCap,
    title: "Образовательные организации",
    text: "Собрать компетенцию из трудовых функций, разложить её на знания, умения и навыки, привязать к дисциплинам, модулям и практикам и получить воспроизводимый паспорт для ОПОП, ДПО и программ профобучения — вместо свободной формулировки в учебном плане.",
  },
  {
    icon: Briefcase,
    title: "Работодатели и советы по профессиональным квалификациям",
    text: "Перевести требования профессионального стандарта в единицу, которую можно освоить и оценить. Компетенция остаётся связанной с трудовыми функциями и уровнем по приказу № 148н, а не с названием курса.",
  },
  {
    icon: ClipboardCheck,
    title: "Эксперты и методисты",
    text: "Работать по одной процедуре: структура A/B/C, дескрипторы уровней сформированности, экспертные шкалы важности и объёма, оценочные средства, чек-лист экспертизы. Решение можно проверить и воспроизвести.",
  },
  {
    icon: Search,
    title: "Обучающиеся и независимая оценка",
    text: "Видеть, из каких действий состоит компетенция, чем она подтверждается и к каким квалификациям относится. Это общий язык для обучения, аттестации и НОК — без подмены компетенции названием дисциплины.",
  },
];

export function AboutPage() {
  return (
    <PageShell>
      <PageHeader
        title="О проекте"
        description="Национальный реестр компетенций — институциональная платформа, которая делает компетенцию проверяемой единицей: от трудовой функции профессионального стандарта до дисциплины, оценки и публикации в открытом реестре."
      />

      <article className="space-y-10">
        <section className="surface p-6 md:p-8 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Концептуальные основания</h2>
          <p className="text-sm text-gray-700 leading-relaxed max-w-4xl">
            Профессиональные стандарты, квалификации, ФГОС и образовательные программы описывают одно и то же
            поле деятельности разными языками. В стандарте — трудовые функции и действия. В квалификации — допуск
            к работе. В ФГОС и ОПОП — компетенция как результат освоения. На практике эти слои часто живут
            отдельно: программа пишет «способен…», а связь с конкретной трудовой функцией, объёмом освоения
            и способом оценки остаётся в голове разработчика.
          </p>
          <p className="text-sm text-gray-700 leading-relaxed max-w-4xl">
            Реестр задуман как общий контур. Компетенция здесь — не слоган и не строка учебного плана, а
            собранный паспорт: выбранные трудовые функции одного уровня квалификации, структура знаний, умений
            и практических навыков (A / B / C), дескрипторы сформированности, привязка к дисциплинам и практикам,
            экспертная оценка важности и объёма компонентов, оценочные средства и решение экспертизы.
            Такую единицу можно найти, сравнить, встроить в программу и при необходимости вернуть на доработку.
          </p>
          <p className="text-sm text-gray-700 leading-relaxed max-w-4xl">
            Платформа не подменяет ФГОС, профессиональный стандарт и трудоёмкость образовательной программы.
            Она даёт способ согласовать их на уровне конкретной компетенции и сохранить след этого согласования
            в карточке, доступной образованию и рынку труда.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Практическая значимость</h2>
          <p className="text-sm text-gray-700 leading-relaxed max-w-4xl">
            Значимость проекта в том, что он сокращает разрыв между «что требуется на работе» и «чему учат
            и что оценивают». Ниже — что это даёт основным участникам.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {AUDIENCES.map((item) => (
              <div key={item.title} className="surface p-5 flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-primary flex items-center justify-center shrink-0">
                  <item.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="surface p-6 md:p-8 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Как это устроено</h2>
          <p className="text-sm text-gray-700 leading-relaxed max-w-4xl">
            Реестр держит вместе справочники и процедуру. Справочники — профессиональные стандарты, квалификации
            и ФГОС, области профессиональной деятельности. Процедура — предложение компетенции, стратегическая
            сессия, экспертиза и публикация утверждённых записей.
          </p>
          <ul className="space-y-3 text-sm text-gray-700 leading-relaxed max-w-4xl">
            <li className="flex gap-3">
              <Link2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <span>
                Компетенция собирается из трудовых функций одного уровня по приказу Минтруда № 148н. Знания
                и умения не копируются списком из XML стандарта: они дедуплицируются в структуру A / B / C,
                умения можно перенести в практические навыки.
              </span>
            </li>
            <li className="flex gap-3">
              <BookOpen className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <span>
                Для каждого компонента эксперт задаёт важность и объём по 10-балльной шкале и привязывает
                его к дисциплинам, модулям или практикам. Рекомендуемый объём компетенции в зачётных единицах
                считается отдельно по методике МОВК-ЗЕ — как ориентир для программы, а не как норма учебного плана.
              </span>
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <span>
                Перед публикацией компетенция проходит экспертизу: модератор назначает рецензентов, эксперт
                работает по чек-листу, заявку можно утвердить, вернуть или отклонить. В открытом поиске видны
                утверждённые записи и записи на рассмотрении.
              </span>
            </li>
            <li className="flex gap-3">
              <Building2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <span>
                Карточка компетенции становится точкой сборки для ОПОП, ДПО, профобучения и независимой оценки:
                её можно выгрузить, сопоставить с ФГОС и областью профессиональной деятельности, использовать
                как общий идентификатор результата обучения.
              </span>
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 leading-relaxed max-w-4xl">
          Реестр — институциональный инструмент, а не федеральная норма. Он не заменяет требования ФГОС,
          профессиональных стандартов и не назначает трудоёмкость образовательной программы. Сумма рекомендуемых
          объёмов компетенций не должна равняться объёму программы: содержание программ пересекается.
        </section>

        <section className="flex flex-wrap gap-3">
          <Link
            to="/search"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90"
          >
            Открыть реестр
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
            Методология
          </Link>
          <Link
            to="/user-guide"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-800 hover:border-primary/40"
          >
            Руководство пользователя
          </Link>
        </section>
      </article>
    </PageShell>
  );
}
