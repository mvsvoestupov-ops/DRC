export type ProfessionalArea = {
  code: string;
  name: string;
};

export const PROFESSIONAL_AREAS: ProfessionalArea[] = [
  { code: "01", name: "Образование" },
  { code: "02", name: "Здравоохранение" },
  { code: "03", name: "Социальное обслуживание" },
  { code: "04", name: "Культура, искусство" },
  { code: "05", name: "Физическая культура и спорт" },
  { code: "06", name: "Связь, информационные и коммуникационные технологии" },
  { code: "07", name: "Административно-управленческая и офисная деятельность" },
  { code: "08", name: "Финансы и экономика" },
  { code: "09", name: "Юриспруденция" },
  { code: "10", name: "Архитектура, проектирование, геодезия, топография и дизайн" },
  { code: "11", name: "Средства массовой информации, издательство и полиграфия" },
  { code: "12", name: "Обеспечение безопасности" },
  { code: "13", name: "Сельское хозяйство" },
  { code: "14", name: "Лесное хозяйство, охота" },
  { code: "15", name: "Рыбоводство и рыболовство" },
  { code: "16", name: "Строительство и жилищно-коммунальное хозяйство" },
  { code: "17", name: "Транспорт" },
  { code: "18", name: "Добыча, переработка угля, руд и других полезных ископаемых" },
  { code: "19", name: "Добыча, переработка, транспортировка нефти и газа" },
  { code: "20", name: "Электроэнергетика" },
  { code: "21", name: "Легкая и текстильная промышленность" },
  { code: "22", name: "Пищевая промышленность, включая производство напитков и табака" },
  { code: "23", name: "Деревообрабатывающая и целлюлозно-бумажная промышленность, мебельное производство" },
  { code: "24", name: "Атомная промышленность" },
  { code: "25", name: "Ракетно-космическая промышленность" },
  { code: "26", name: "Химическое, химико-технологическое производство" },
  { code: "27", name: "Металлургическое производство" },
  { code: "28", name: "Производство машин и оборудования" },
  { code: "29", name: "Производство электрооборудования, электронного и оптического оборудования" },
  { code: "30", name: "Судостроение" },
  { code: "31", name: "Автомобилестроение" },
  { code: "32", name: "Авиастроение" },
  { code: "33", name: "Сервис, оказание услуг населению (торговля, техническое обслуживание, ремонт, предоставление персональных услуг, услуги гостеприимства, общественное питание и пр.)" },
  { code: "40", name: "Сквозные виды профессиональной деятельности в промышленности" },
];

const INDUSTRY_ALIASES: Record<string, string> = {
  "юриспруденция": "09",
  "финансы": "08",
  "финансы и экономика": "08",
  "it и цифровая экономика": "06",
  "it": "06",
  "информационные технологии": "06",
  "образование": "01",
  "образование и наука": "01",
  "здравоохранение": "02",
  "средства массовой информации и коммуникации": "11",
  "сквозные виды деятельности в промышленности": "40",
  "электроэнергетика": "20",
  "строительство и жкх": "16",
  "инженерия": "28",
  "маркетинг и pr": "11",
};

export function normalizeAreaCode(code?: string | null) {
  const digits = String(code || "").replace(/\D/g, "").slice(0, 2);
  return digits ? digits.padStart(2, "0") : "";
}

export function findProfessionalArea(code?: string | null) {
  const normalized = normalizeAreaCode(code);
  return PROFESSIONAL_AREAS.find((area) => area.code === normalized) || null;
}

export function areaDisplayCode(area: ProfessionalArea) {
  return area.code === "40" ? "40*" : area.code;
}

export function formatProfessionalAreaLabel(
  code?: string | null,
  fallback?: string | null,
  t?: (key: string) => string,
) {
  const area = findProfessionalArea(code);
  if (area) {
    const key = `areas.${area.code}`;
    const translated = t?.(key);
    const name = translated && translated !== key ? translated : area.name;
    return `${areaDisplayCode(area)} — ${name}`;
  }
  return (fallback || "").trim();
}

export function competenceMatchesArea(
  comp: { professional_area_code?: string | null; industry?: string | null },
  areaCode: string,
) {
  const area = findProfessionalArea(areaCode);
  if (!area) return false;
  if (normalizeAreaCode(comp.professional_area_code) === area.code) return true;

  const industry = (comp.industry || "").trim().toLowerCase();
  if (!industry || industry === "—") return false;
  if (INDUSTRY_ALIASES[industry] === area.code) return true;

  const name = area.name.toLowerCase();
  const shortName = name.split(",")[0].trim();
  return industry === name || industry === shortName || name.includes(industry) || industry.includes(shortName);
}
