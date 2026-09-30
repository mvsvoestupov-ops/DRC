export type EducationSegment =
  | "vo_bachelor"
  | "vo_specialist_master"
  | "vo_postgrad"
  | "spo"
  | "dpo"
  | "profobuchenie";

export type CatalogItemKind = "discipline" | "module" | "practice";

export type DisciplineCatalogItem = {
  name: string;
  kind: CatalogItemKind;
  segments: EducationSegment[];
};

const VO_ALL: EducationSegment[] = ["vo_bachelor", "vo_specialist_master", "vo_postgrad"];
const VO_BASIC: EducationSegment[] = ["vo_bachelor", "vo_specialist_master"];
const PROF_CYCLE: EducationSegment[] = ["vo_bachelor", "vo_specialist_master", "spo", "dpo", "profobuchenie"];

const item = (
  name: string,
  kind: CatalogItemKind,
  segments: EducationSegment[],
): DisciplineCatalogItem => ({ name, kind, segments });

/**
 * Справочник наиболее частых дисциплин, модулей и практик.
 * Источники: обязательная часть ФГОС ВО 3++ (бакалавриат/специалитет),
 * типовые циклы ФГОС СПО (ОГСЭ/СГ, ЕН, ОП, ПМ), структура ДПП
 * (приказ Минобрнауки № 499 / обновления 2025) и типовые программы
 * профессионального обучения рабочих и служащих.
 */
export const DISCIPLINE_CATALOG: DisciplineCatalogItem[] = [
  // --- ВО: обязательная часть ФГОС 3++ ---
  item("Философия", "discipline", VO_BASIC),
  item("История России", "discipline", ["vo_bachelor", "vo_specialist_master", "spo"]),
  item("Всеобщая история", "discipline", VO_BASIC),
  item("Иностранный язык", "discipline", VO_ALL),
  item("Безопасность жизнедеятельности", "discipline", ["vo_bachelor", "vo_specialist_master", "spo"]),
  item("Физическая культура и спорт", "discipline", VO_BASIC),

  // --- ВО: сквозной гуманитарный и базовый цикл ---
  item("Русский язык и культура речи", "discipline", ["vo_bachelor", "vo_specialist_master", "spo"]),
  item("Деловой иностранный язык", "discipline", VO_BASIC),
  item("Правоведение", "discipline", VO_BASIC),
  item("Экономика", "discipline", VO_BASIC),
  item("Экономическая теория", "discipline", VO_BASIC),
  item("Социология", "discipline", VO_BASIC),
  item("Психология", "discipline", VO_BASIC),
  item("Политология", "discipline", VO_BASIC),
  item("Культурология", "discipline", VO_BASIC),
  item("Экология", "discipline", ["vo_bachelor", "vo_specialist_master", "spo"]),
  item("Основы проектной деятельности", "discipline", VO_BASIC),
  item("Введение в специальность", "discipline", VO_BASIC),
  item("Цифровая культура", "discipline", VO_BASIC),
  item("Информатика", "discipline", ["vo_bachelor", "vo_specialist_master", "spo"]),
  item("Информационные технологии", "discipline", VO_BASIC),
  item("Математика", "discipline", ["vo_bachelor", "vo_specialist_master", "spo"]),
  item("Высшая математика", "discipline", VO_BASIC),
  item("Теория вероятностей и математическая статистика", "discipline", VO_BASIC),
  item("Дискретная математика", "discipline", VO_BASIC),
  item("Физика", "discipline", ["vo_bachelor", "vo_specialist_master", "spo"]),
  item("Химия", "discipline", ["vo_bachelor", "vo_specialist_master", "spo"]),

  // --- ВО: магистратура / аспирантура ---
  item("История и философия науки", "discipline", ["vo_postgrad"]),
  item("Методология научных исследований", "discipline", ["vo_specialist_master", "vo_postgrad"]),
  item("Иностранный язык в профессиональной сфере", "discipline", ["vo_specialist_master", "vo_postgrad"]),
  item("Педагогика высшей школы", "discipline", ["vo_specialist_master", "vo_postgrad"]),
  item("Современные проблемы науки и производства", "discipline", ["vo_specialist_master"]),
  item("Управление проектами", "discipline", ["vo_specialist_master", "dpo"]),
  item("Научно-исследовательская работа", "practice", ["vo_specialist_master", "vo_postgrad"]),
  item("Научно-исследовательская практика", "practice", ["vo_specialist_master", "vo_postgrad"]),
  item("Педагогическая практика", "practice", VO_ALL),

  // --- ВО: практики ---
  item("Учебная практика", "practice", ["vo_bachelor", "vo_specialist_master", "spo", "profobuchenie"]),
  item("Производственная практика", "practice", ["vo_bachelor", "vo_specialist_master", "spo", "dpo", "profobuchenie"]),
  item("Преддипломная практика", "practice", ["vo_bachelor", "vo_specialist_master", "spo"]),
  item("Технологическая практика", "practice", VO_BASIC),
  item("Проектно-технологическая практика", "practice", VO_BASIC),
  item("Ознакомительная практика", "practice", VO_BASIC),

  // --- СПО: социально-гуманитарный / ОГСЭ ---
  item("Основы философии", "discipline", ["spo"]),
  item("Основы бережливого производства", "discipline", ["spo", "dpo", "profobuchenie"]),
  item("Иностранный язык в профессиональной деятельности", "discipline", ["spo"]),
  item("Физическая культура", "discipline", ["spo"]),
  item("Психология общения", "discipline", ["spo", "dpo"]),
  item("История", "discipline", ["spo"]),

  // --- СПО: ЕН ---
  item("Экологические основы природопользования", "discipline", ["spo"]),

  // --- СПО / сквозные ОП ---
  item("Правовое обеспечение профессиональной деятельности", "discipline", ["spo", "dpo"]),
  item("Экономика организации", "discipline", ["spo", "dpo"]),
  item("Менеджмент", "discipline", ["vo_bachelor", "vo_specialist_master", "spo", "dpo"]),
  item("Маркетинг", "discipline", ["vo_bachelor", "vo_specialist_master", "spo", "dpo"]),
  item("Охрана труда", "discipline", PROF_CYCLE),
  item("Информационные технологии в профессиональной деятельности", "discipline", ["spo", "dpo", "profobuchenie"]),
  item("Документационное обеспечение управления", "discipline", ["vo_bachelor", "spo", "dpo"]),
  item("Статистика", "discipline", ["vo_bachelor", "vo_specialist_master", "spo"]),
  item("Бухгалтерский учёт", "discipline", ["vo_bachelor", "vo_specialist_master", "spo", "dpo"]),
  item("Финансы, денежное обращение и кредит", "discipline", ["spo"]),
  item("Основы финансовой грамотности", "discipline", ["spo", "profobuchenie"]),
  item("Основы предпринимательской деятельности", "discipline", ["spo", "dpo", "profobuchenie"]),
  item("Материаловедение", "discipline", ["vo_bachelor", "spo", "profobuchenie"]),
  item("Метрология, стандартизация и сертификация", "discipline", ["vo_bachelor", "spo"]),
  item("Инженерная графика", "discipline", ["vo_bachelor", "spo", "profobuchenie"]),
  item("Техническая механика", "discipline", ["vo_bachelor", "spo"]),
  item("Электротехника и электроника", "discipline", ["vo_bachelor", "spo", "profobuchenie"]),
  item("Электробезопасность", "discipline", ["spo", "dpo", "profobuchenie"]),

  // --- СПО: профессиональный цикл ---
  item("Профессиональный модуль", "module", ["spo"]),
  item("Междисциплинарный курс", "module", ["spo"]),
  item("Производственная практика (по профилю специальности)", "practice", ["spo"]),
  item("Демонстрационный экзамен", "practice", ["spo"]),

  // --- Частотные профильные дисциплины (ВО/СПО/ДПО) ---
  item("Проектирование информационных систем", "discipline", ["vo_bachelor", "vo_specialist_master", "spo", "dpo"]),
  item("Базы данных", "discipline", ["vo_bachelor", "vo_specialist_master", "spo", "dpo"]),
  item("Программирование", "discipline", ["vo_bachelor", "vo_specialist_master", "spo"]),
  item("Операционные системы", "discipline", ["vo_bachelor", "spo"]),
  item("Компьютерные сети", "discipline", ["vo_bachelor", "spo", "dpo"]),
  item("Информационная безопасность", "discipline", ["vo_bachelor", "vo_specialist_master", "spo", "dpo"]),
  item("Веб-технологии", "discipline", ["vo_bachelor", "spo", "dpo"]),
  item("Практикум по разработке программного обеспечения", "module", ["vo_bachelor", "spo", "dpo"]),
  item("Управление персоналом", "discipline", ["vo_bachelor", "vo_specialist_master", "spo", "dpo"]),
  item("Кадровое делопроизводство", "discipline", ["spo", "dpo"]),
  item("Педагогика", "discipline", ["vo_bachelor", "vo_specialist_master", "dpo"]),
  item("Методика профессионального обучения", "discipline", ["vo_bachelor", "spo", "dpo"]),
  item("Педагогический дизайн", "discipline", ["dpo"]),
  item("Технология строительных процессов", "discipline", ["vo_bachelor", "spo"]),
  item("Организация строительного производства", "discipline", ["vo_bachelor", "spo", "dpo"]),
  item("Электрические машины и аппараты", "discipline", ["vo_bachelor", "spo", "profobuchenie"]),
  item("Промышленная безопасность", "discipline", ["vo_bachelor", "spo", "dpo", "profobuchenie"]),
  item("Интернет-маркетинг", "discipline", ["vo_bachelor", "spo", "dpo"]),
  item("Маркетинговая аналитика", "discipline", ["vo_bachelor", "vo_specialist_master", "dpo"]),

  // --- ДПО ---
  item("Общепрофессиональный модуль", "module", ["dpo"]),
  item("Профессиональный (специальный) модуль", "module", ["dpo"]),
  item("Нормативно-правовое обеспечение профессиональной деятельности", "module", ["dpo"]),
  item("Цифровая трансформация профессиональной деятельности", "module", ["dpo"]),
  item("Оценка и развитие компетенций", "module", ["dpo"]),
  item("Современные образовательные технологии", "module", ["dpo"]),
  item("Стажировка", "practice", ["dpo"]),
  item("Практикум", "module", ["dpo", "profobuchenie"]),
  item("Итоговая аттестация", "practice", ["dpo", "profobuchenie"]),
  item("Итоговая аттестационная работа", "practice", ["dpo"]),

  // --- Профессиональное обучение ---
  item("Специальная технология", "discipline", ["profobuchenie"]),
  item("Производственное обучение", "practice", ["profobuchenie"]),
  item("Техническое черчение", "discipline", ["profobuchenie"]),
  item("Допуски, посадки и технические измерения", "discipline", ["profobuchenie"]),
  item("Основы рыночной экономики", "discipline", ["profobuchenie"]),
  item("Квалификационный экзамен", "practice", ["profobuchenie"]),
];

const LEVEL_TO_SEGMENT: Record<string, EducationSegment> = {
  "среднее профессиональное образование": "spo",
  "высшее образование - бакалавриат": "vo_bachelor",
  "высшее образование - специалитет, магистратура": "vo_specialist_master",
  "высшее образование - подготовка кадров высшей квалификации": "vo_postgrad",
};

export function educationToSegment(
  educationKind?: string | null,
  educationLevel?: string | null,
): EducationSegment | null {
  if (educationKind === "профессиональное обучение") return "profobuchenie";
  if (educationKind === "дополнительное образование") return "dpo";
  if (educationKind === "профессиональное образование") {
    return LEVEL_TO_SEGMENT[educationLevel || ""] || null;
  }
  return null;
}

export function listCatalogItems(
  educationKind?: string | null,
  educationLevel?: string | null,
): DisciplineCatalogItem[] {
  const segment = educationToSegment(educationKind, educationLevel);
  const items = segment
    ? DISCIPLINE_CATALOG.filter((entry) => entry.segments.includes(segment))
    : DISCIPLINE_CATALOG;
  const byName = new Map<string, DisciplineCatalogItem>();
  for (const entry of items) {
    if (!byName.has(entry.name)) byName.set(entry.name, entry);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export function listCatalogDisciplines(
  educationKind?: string | null,
  educationLevel?: string | null,
): string[] {
  return listCatalogItems(educationKind, educationLevel).map((entry) => entry.name);
}

export const CATALOG_KIND_LABELS: Record<CatalogItemKind, string> = {
  discipline: "Дисциплины",
  module: "Модули",
  practice: "Практики",
};

export const CATALOG_KIND_BADGE: Record<CatalogItemKind, string> = {
  discipline: "Дисциплина",
  module: "Модуль",
  practice: "Практика",
};
