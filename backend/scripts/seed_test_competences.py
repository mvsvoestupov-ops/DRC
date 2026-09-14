"""
Создание 10 тестовых компетенций с реалистичным наполнением.

Запуск:
  cd backend
  venv\\Scripts\\python.exe scripts\\seed_test_competences.py

Повторный запуск не дублирует записи (по имени + seed_tag в raw_data).
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import SessionLocal
from app.db.competence_models import Competence, CompetenceStatus
from app.db.raw_models import StandardRaw
from app.db.qualifications_models import Qualification
from app.db.user_models import User

SEED_TAG = "test_seed_v1"


def _pick_standards(session, n: int = 10):
    rows = (
        session.query(StandardRaw)
        .filter(StandardRaw.name.isnot(None))
        .order_by(StandardRaw.id.asc())
        .limit(max(n, 20))
        .all()
    )
    return rows


def _pick_qualification(session, hint: str | None = None):
    q = session.query(Qualification)
    if hint:
        found = (
            q.filter(Qualification.name.ilike(f"%{hint}%"))
            .order_by(Qualification.id.asc())
            .first()
        )
        if found:
            return found
    return q.order_by(Qualification.id.asc()).first()


def _base_descriptors(domain: str) -> dict:
    return {
        "A": {
            "базовый": f"Воспроизводит базовые понятия и нормативные требования в области «{domain}».",
            "продвинутый": f"Систематизирует знания и применяет отраслевые стандарты «{domain}» в типовых ситуациях.",
            "экспертный": f"Критически оценивает и развивает знаниевую базу «{domain}», формирует методические рекомендации.",
        },
        "B": {
            "базовый": f"Выполняет типовые операции под контролем наставника в сфере «{domain}».",
            "продвинутый": f"Самостоятельно решает рабочие задачи и выбирает инструменты в «{domain}».",
            "экспертный": f"Проектирует процессы, обучает коллег и оптимизирует практики «{domain}».",
        },
        "C": {
            "базовый": f"Демонстрирует начальные навыки безопасной работы в «{domain}».",
            "продвинутый": f"Устойчиво применяет навыки в изменяющихся условиях «{domain}».",
            "экспертный": f"Формирует эталонные практики и оценивает навыки других в «{domain}».",
        },
    }


def build_seed_payloads(standards: list, admin_id: int | None) -> list[dict]:
    """10 компетенций: смесь статусов, отраслей, уровней."""
    std = standards or [None] * 10

    def sid(i: int):
        if not standards:
            return None
        return standards[i % len(standards)].id

    def sname(i: int, fallback: str):
        if not standards:
            return fallback
        return standards[i % len(standards)].name or fallback

    items = [
        {
            "name": "Разработка и сопровождение веб-приложений на современных стеках",
            "qualification_name": "Программист",
            "qualification_level": "6",
            "industry": "Информационные технологии",
            "description": (
                "Компетенция охватывает проектирование клиент-серверных веб-приложений, "
                "работу с REST API, контроль качества кода и базовую DevOps-практику деплоя."
            ),
            "hours": "144",
            "status": CompetenceStatus.APPROVED,
            "developer": "НИУ ВШЭ — факультет компьютерных наук",
            "validator": "СПК в области информационных технологий",
            "labor_functions": [
                {"code": "A/01.6", "name": "Разработка требований и проектирование ПО"},
                {"code": "B/02.6", "name": "Разработка и отладка программного кода"},
                {"code": "C/01.6", "name": "Проверка работоспособности и рефакторинг кода"},
            ],
            "structure": {
                "A": [
                    "Архитектура клиент-серверных приложений и HTTP",
                    "Принципы REST и модели данных",
                    "Основы безопасности веб-приложений (OWASP Top 10)",
                    "Системы контроля версий и code review",
                ],
                "B": [
                    "Проектировать API и схему данных",
                    "Реализовывать UI и серверную логику",
                    "Писать автотесты и проводить регрессионную проверку",
                    "Настраивать CI/CD для типового веб-проекта",
                ],
                "C": [
                    "Разработка SPA/MPA на React/Vue или аналоге",
                    "Работа с реляционными СУБД и ORM",
                    "Контейнеризация приложения (Docker)",
                ],
            },
            "discipline_mapping": [
                {"component": "A1", "discipline": "Веб-технологии", "hours": 72, "control": "экзамен"},
                {"component": "B1", "discipline": "Проектирование информационных систем", "hours": 54, "control": "зачёт"},
                {"component": "C1", "discipline": "Практикум по разработке ПО", "hours": 18, "control": "защита проекта"},
            ],
            "ed_technologies": ["проектная работа", "code review", "парное программирование", "кейс-метод"],
            "assessment_tools": [
                {
                    "level": "базовый",
                    "type": "test",
                    "taskText": "Выберите корректный код ответа HTTP при успешном создании ресурса",
                    "threshold": 70,
                    "for_nok": False,
                },
                {
                    "level": "продвинутый",
                    "type": "practical",
                    "taskText": "Реализовать CRUD API и простой клиент с авторизацией",
                    "criteria": "Работает API, есть тесты, README, пройден security checklist",
                    "for_nok": True,
                },
                {
                    "level": "экспертный",
                    "type": "practical",
                    "taskText": "Спроектировать и развернуть демо-сервис с мониторингом ошибок",
                    "criteria": "Архитектурное обоснование, метрики, план релизов",
                    "for_nok": True,
                },
            ],
            "resources": [
                "Компьютерный класс / удалённая IDE",
                "GitLab/GitHub",
                "Docker Desktop",
                "PostgreSQL / SQLite",
            ],
            "hint_qual": "программист",
            "std_idx": 0,
            "ps_fallback": "Программист",
        },
        {
            "name": "Обеспечение информационной безопасности инфраструктуры организации",
            "qualification_name": "Специалист по защите информации",
            "qualification_level": "6",
            "industry": "Обеспечение безопасности",
            "description": (
                "Формирование и контроль мер защиты ИТ-инфраструктуры: политики доступа, "
                "мониторинг инцидентов, соответствие требованиям 152-ФЗ и отраслевых регламентов."
            ),
            "hours": "108",
            "status": CompetenceStatus.APPROVED,
            "developer": "МГТУ им. Н.Э. Баумана",
            "validator": "СПК в негосударственной сфере безопасности",
            "labor_functions": [
                {"code": "A/01.6", "name": "Анализ угроз и уязвимостей"},
                {"code": "B/01.6", "name": "Внедрение средств защиты информации"},
                {"code": "C/02.6", "name": "Реагирование на инциденты ИБ"},
            ],
            "structure": {
                "A": [
                    "Модели угроз и риски информационной безопасности",
                    "Нормативная база (152-ФЗ, ГОСТ Р ИБ)",
                    "Сетевые протоколы и типичные векторы атак",
                ],
                "B": [
                    "Проводить аудит конфигураций и прав доступа",
                    "Настраивать SIEM/средства мониторинга",
                    "Составлять план реагирования на инциденты",
                ],
                "C": [
                    "Hardening ОС и сетевого периметра",
                    "Расследование типовых инцидентов",
                    "Подготовка отчётов для руководства и регулятора",
                ],
            },
            "discipline_mapping": [
                {"component": "A1", "discipline": "Основы информационной безопасности", "hours": 36, "control": "экзамен"},
                {"component": "B1", "discipline": "Защита компьютерных сетей", "hours": 54, "control": "курсовая"},
                {"component": "C1", "discipline": "Управление инцидентами ИБ", "hours": 18, "control": "зачёт"},
            ],
            "ed_technologies": ["лабораторный практикум", "симуляция инцидентов", "кейс-метод"],
            "assessment_tools": [
                {
                    "level": "базовый",
                    "type": "test",
                    "taskText": "Соотнесите классы угроз с мерами защиты",
                    "threshold": 70,
                    "for_nok": False,
                },
                {
                    "level": "продвинутый",
                    "type": "practical",
                    "taskText": "Провести экспресс-аудит учебной сети и оформить отчёт",
                    "criteria": "Карта рисков, рекомендации, приоритизация",
                    "for_nok": True,
                },
            ],
            "resources": ["Виртуальный полигон", "Wireshark", "Учебные SIEM-стенды"],
            "hint_qual": "защит",
            "std_idx": 1,
            "ps_fallback": "Специалист по защите информации",
        },
        {
            "name": "Организация строительно-монтажных работ на объекте капитального строительства",
            "qualification_name": "Производитель работ (прораб)",
            "qualification_level": "6",
            "industry": "Строительство и ЖКХ",
            "description": (
                "Планирование и контроль СМР, обеспечение охраны труда, взаимодействие "
                "с подрядчиками и ведение исполнительной документации."
            ),
            "hours": "120",
            "status": CompetenceStatus.APPROVED,
            "developer": "НИУ МГСУ",
            "validator": "СПК в строительстве",
            "labor_functions": [
                {"code": "A/01.6", "name": "Подготовка строительного производства"},
                {"code": "B/02.6", "name": "Оперативное управление строительными работами"},
                {"code": "C/01.6", "name": "Контроль качества и приёмка работ"},
            ],
            "structure": {
                "A": [
                    "Технологии общестроительных и монтажных работ",
                    "Состав проектной и исполнительной документации",
                    "Требования охраны труда на строительной площадке",
                ],
                "B": [
                    "Составлять графики производства работ",
                    "Организовывать рабочие места и снабжение",
                    "Вести журналы работ и акты скрытых работ",
                ],
                "C": [
                    "Контроль соответствия СНиП/СП",
                    "Координация субподрядчиков",
                    "Участие в приёмке этапов строительства",
                ],
            },
            "discipline_mapping": [
                {"component": "A1", "discipline": "Технология строительных процессов", "hours": 72, "control": "экзамен"},
                {"component": "B1", "discipline": "Организация строительного производства", "hours": 48, "control": "курсовая"},
            ],
            "ed_technologies": ["выездная практика", "проектная работа", "деловая игра"],
            "assessment_tools": [
                {
                    "level": "продвинутый",
                    "type": "practical",
                    "taskText": "Подготовить недельный график СМР и комплект актов для учебного объекта",
                    "criteria": "Согласованность ресурсов, полнота документации, ОТ",
                    "for_nok": True,
                }
            ],
            "resources": ["Учебная строительная площадка", "ПО для календарного планирования", "СИЗ"],
            "hint_qual": "строитель",
            "std_idx": 2,
            "ps_fallback": "Производитель работ",
        },
        {
            "name": "Оказание первичной медико-санитарной помощи взрослому населению",
            "qualification_name": "Врач-терапевт участковый",
            "qualification_level": "7",
            "industry": "Здравоохранение",
            "description": (
                "Диагностика и лечение наиболее распространённых заболеваний в амбулаторных условиях, "
                "диспансеризация, маршрутизация пациентов и ведение медицинской документации."
            ),
            "hours": "216",
            "status": CompetenceStatus.REVIEW,
            "developer": "Первый МГМУ им. И.М. Сеченова",
            "validator": "СПК в здравоохранении",
            "labor_functions": [
                {"code": "A/01.7", "name": "Проведение обследования пациента"},
                {"code": "A/02.7", "name": "Назначение лечения и контроль его эффективности"},
                {"code": "B/01.7", "name": "Ведение медицинской документации"},
            ],
            "structure": {
                "A": [
                    "Клинические рекомендации по терапии",
                    "Алгоритмы неотложной помощи на догоспитальном этапе",
                    "Правила назначения лекарственных препаратов",
                ],
                "B": [
                    "Собирать анамнез и интерпретировать результаты обследований",
                    "Формировать план лечения и наблюдения",
                    "Оформлять направления и рецепты",
                ],
                "C": [
                    "Физикальное обследование",
                    "Базовые манипуляции ПМСП",
                    "Коммуникация с пациентом и родственниками",
                ],
            },
            "discipline_mapping": [
                {"component": "A1", "discipline": "Поликлиническая терапия", "hours": 108, "control": "экзамен"},
                {"component": "B1", "discipline": "Клиническая фармакология", "hours": 54, "control": "зачёт"},
                {"component": "C1", "discipline": "Производственная практика", "hours": 54, "control": "отчёт"},
            ],
            "ed_technologies": ["симуляционный центр", "разбор клинических случаев", "наставничество"],
            "assessment_tools": [
                {
                    "level": "базовый",
                    "type": "test",
                    "taskText": "Клинический кейс: дифференциальная диагностика гипертензии",
                    "threshold": 75,
                    "for_nok": False,
                },
                {
                    "level": "экспертный",
                    "type": "practical",
                    "taskText": "ОСКИ: приём пациента с жалобами на боль в груди",
                    "criteria": "Алгоритм, безопасность, коммуникация, документация",
                    "for_nok": True,
                },
            ],
            "resources": ["Симуляционный центр", "МИС учебной поликлиники", "Манекены"],
            "hint_qual": "терапевт",
            "std_idx": 3,
            "ps_fallback": "Врач-терапевт",
            "validation_notes": "Требуется уточнить перечень манипуляций для уровня НОК.",
        },
        {
            "name": "Проектирование и реализация основных образовательных программ СПО",
            "qualification_name": "Педагог профессионального обучения",
            "qualification_level": "6",
            "industry": "Образование и наука",
            "description": (
                "Разработка рабочих программ, оценочных средств и организация учебного процесса "
                "в соответствии с ФГОС СПО и требованиями работодателей."
            ),
            "hours": "96",
            "status": CompetenceStatus.APPROVED,
            "developer": "РГППУ",
            "validator": "СПК в сфере образования",
            "labor_functions": [
                {"code": "A/01.6", "name": "Разработка программно-методического обеспечения"},
                {"code": "B/01.6", "name": "Организация учебной деятельности обучающихся"},
                {"code": "C/01.6", "name": "Педагогический контроль и оценка"},
            ],
            "structure": {
                "A": [
                    "Структура ФГОС СПО и профессиональных стандартов",
                    "Таксономия учебных целей и дескрипторы",
                    "Требования к фонду оценочных средств",
                ],
                "B": [
                    "Составлять РПД и календарно-тематический план",
                    "Подбирать активные методы обучения",
                    "Организовывать практику и демонстрационный экзамен",
                ],
                "C": [
                    "Проведение занятий и консультаций",
                    "Разработка КОС/ФОС",
                    "Анализ результатов освоения компетенции",
                ],
            },
            "discipline_mapping": [
                {"component": "A1", "discipline": "Методика профессионального обучения", "hours": 72, "control": "экзамен"},
                {"component": "B1", "discipline": "Педагогический дизайн", "hours": 24, "control": "проект"},
            ],
            "ed_technologies": ["микроteaching", "проектная работа", "peer review"],
            "assessment_tools": [
                {
                    "level": "продвинутый",
                    "type": "practical",
                    "taskText": "Разработать фрагмент РПД и комплект оценочных средств по одной компетенции",
                    "criteria": "Согласованность с ПС/ФГОС, валидность заданий",
                    "for_nok": True,
                }
            ],
            "resources": ["LMS", "Шаблоны РПД/ФОС", "Видеостудия для микроteaching"],
            "hint_qual": "педагог",
            "std_idx": 4,
            "ps_fallback": "Педагог профессионального обучения",
        },
        {
            "name": "Ведение бухгалтерского учёта и формирование отчётности организации",
            "qualification_name": "Бухгалтер",
            "qualification_level": "5",
            "industry": "Финансы и экономика",
            "description": (
                "Отражение хозяйственных операций, инвентаризация, подготовка бухгалтерской "
                "(финансовой) отчётности и взаимодействие с налоговыми органами."
            ),
            "hours": "180",
            "status": CompetenceStatus.APPROVED,
            "developer": "Финансовый университет при Правительстве РФ",
            "validator": "СПК финансового рынка",
            "labor_functions": [
                {"code": "A/01.5", "name": "Принятие к учёту первичных учётных документов"},
                {"code": "B/01.5", "name": "Денежное измерение объектов бухгалтерского учёта"},
                {"code": "C/01.5", "name": "Составление бухгалтерской отчётности"},
            ],
            "structure": {
                "A": [
                    "План счетов и учётная политика",
                    "Федеральные стандарты бухгалтерского учёта",
                    "Налогообложение организаций (базовый уровень)",
                ],
                "B": [
                    "Оформлять и проверять первичные документы",
                    "Вести регистры учёта",
                    "Формировать баланс и отчёт о финансовых результатах",
                ],
                "C": [
                    "Работа в 1С:Бухгалтерия (или аналог)",
                    "Инвентаризация активов и обязательств",
                    "Подготовка пояснений к отчётности",
                ],
            },
            "discipline_mapping": [
                {"component": "A1", "discipline": "Бухгалтерский финансовый учёт", "hours": 108, "control": "экзамен"},
                {"component": "B1", "discipline": "Бухгалтерская отчётность", "hours": 72, "control": "курсовая"},
            ],
            "ed_technologies": ["работа в учётной системе", "кейс-метод", "разбор ошибок"],
            "assessment_tools": [
                {
                    "level": "базовый",
                    "type": "test",
                    "taskText": "Проводка типовых операций и заполнение оборотно-сальдовой ведомости",
                    "threshold": 70,
                    "for_nok": False,
                },
                {
                    "level": "продвинутый",
                    "type": "practical",
                    "taskText": "Сформировать комплект отчётности по учебному предприятию за квартал",
                    "criteria": "Корректность проводок, сверка, пояснения",
                    "for_nok": True,
                },
            ],
            "resources": ["1С:Бухгалтерия (учебная)", "Комплект первичных документов", "Калькуляторы/таблицы"],
            "hint_qual": "бухгалтер",
            "std_idx": 5,
            "ps_fallback": "Бухгалтер",
        },
        {
            "name": "Эксплуатация и техническое обслуживание электроустановок потребителей",
            "qualification_name": "Электромонтёр по ремонту и обслуживанию электрооборудования",
            "qualification_level": "4",
            "industry": "Электроэнергетика",
            "description": (
                "Обслуживание электроустановок до 1000 В, проведение измерений, "
                "соблюдение правил электробезопасности и оформление нарядов-допусков."
            ),
            "hours": "160",
            "status": CompetenceStatus.REVIEW,
            "developer": "Московский энергетический институт (НИУ МЭИ)",
            "validator": "СПК в электроэнергетике",
            "labor_functions": [
                {"code": "A/01.4", "name": "Подготовка к ремонту электрооборудования"},
                {"code": "B/01.4", "name": "Ремонт и обслуживание электрооборудования"},
                {"code": "C/01.4", "name": "Контроль состояния электроустановок"},
            ],
            "structure": {
                "A": [
                    "ПТЭЭП и правила по охране труда при эксплуатации электроустановок",
                    "Схемы электроснабжения потребителей",
                    "Виды защит и средства измерений",
                ],
                "B": [
                    "Выполнять переключения по бланкам",
                    "Проводить ТО распределительных устройств",
                    "Оформлять оперативную документацию",
                ],
                "C": [
                    "Измерение сопротивления изоляции",
                    "Поиск неисправностей в цепях управления",
                    "Оказание первой помощи при электротравме",
                ],
            },
            "discipline_mapping": [
                {"component": "A1", "discipline": "Электробезопасность", "hours": 40, "control": "экзамен"},
                {"component": "B1", "discipline": "Электрические машины и аппараты", "hours": 80, "control": "экзамен"},
                {"component": "C1", "discipline": "Производственное обучение", "hours": 40, "control": "квалификационный экзамен"},
            ],
            "ed_technologies": ["мастер-класс", "тренажёрный стенд", "инструктаж"],
            "assessment_tools": [
                {
                    "level": "продвинутый",
                    "type": "practical",
                    "taskText": "Выполнить ТО учебной электроустановки с оформлением наряда-допуска",
                    "criteria": "Безопасность, правильность операций, полнота документов",
                    "for_nok": True,
                }
            ],
            "resources": ["Электромонтажный стенд", "СИЗ", "Измерительные приборы"],
            "hint_qual": "электромонт",
            "std_idx": 6,
            "ps_fallback": "Электромонтёр",
            "validation_notes": "Добавить требования к группе по электробезопасности.",
        },
        {
            "name": "Управление персоналом и кадровое администрирование организации",
            "qualification_name": "Специалист по управлению персоналом",
            "qualification_level": "6",
            "industry": "Административно-управленческая деятельность",
            "description": (
                "Подбор и адаптация персонала, ведение кадрового документооборота, "
                "организация оценки и развития сотрудников в соответствии с трудовым законодательством."
            ),
            "hours": "112",
            "status": CompetenceStatus.DRAFT,
            "developer": "РАНХиГС",
            "validator": None,
            "labor_functions": [
                {"code": "A/01.6", "name": "Документационное обеспечение работы с персоналом"},
                {"code": "B/01.6", "name": "Обеспечение персоналом"},
                {"code": "C/01.6", "name": "Оценка и развитие персонала"},
            ],
            "structure": {
                "A": [
                    "Трудовой кодекс РФ: приём, перевод, увольнение",
                    "Локальные нормативные акты по персоналу",
                    "Методы оценки компетенций сотрудников",
                ],
                "B": [
                    "Оформлять кадровые документы",
                    "Организовывать процедуры подбора и адаптации",
                    "Формировать планы обучения",
                ],
                "C": [
                    "Работа в HRM-системе",
                    "Проведение структурированного интервью",
                    "Подготовка аналитики по текучести",
                ],
            },
            "discipline_mapping": [
                {"component": "A1", "discipline": "Кадровое делопроизводство", "hours": 56, "control": "зачёт"},
                {"component": "B1", "discipline": "Управление персоналом", "hours": 56, "control": "экзамен"},
            ],
            "ed_technologies": ["ролевые игры", "кейс-метод", "работа с шаблонами документов"],
            "assessment_tools": [
                {
                    "level": "базовый",
                    "type": "practical",
                    "taskText": "Оформить пакет документов при приёме на работу",
                    "criteria": "Полнота, соответствие ТК РФ, сроки",
                    "for_nok": False,
                }
            ],
            "resources": ["Шаблоны кадровых документов", "Учебная HRM", "Справочно-правовые системы"],
            "hint_qual": "персонал",
            "std_idx": 7,
            "ps_fallback": "Специалист по управлению персоналом",
        },
        {
            "name": "Цифровой маркетинг и продвижение продуктов в интернет-каналах",
            "qualification_name": "Маркетолог",
            "qualification_level": "6",
            "industry": "Средства массовой информации и коммуникации",
            "description": (
                "Планирование digital-кампаний, настройка рекламных кабинетов, "
                "аналитика воронки и подготовка креативов с учётом правовых ограничений рекламы."
            ),
            "hours": "96",
            "status": CompetenceStatus.APPROVED,
            "developer": "НИУ ВШЭ — факультет креативных индустрий",
            "validator": "СПК в сфере коммуникационной индустрии",
            "labor_functions": [
                {"code": "A/01.6", "name": "Разработка маркетинговой стратегии"},
                {"code": "B/02.6", "name": "Реализация маркетинговых программ"},
                {"code": "C/01.6", "name": "Анализ эффективности маркетинговых мероприятий"},
            ],
            "structure": {
                "A": [
                    "Модели атрибуции и метрики digital-маркетинга",
                    "Каналы привлечения (search, social, media)",
                    "Требования законодательства о рекламе",
                ],
                "B": [
                    "Составлять медиаплан и бюджет",
                    "Настраивать кампании в рекламных кабинетах",
                    "Интерпретировать отчёты и гипотезы роста",
                ],
                "C": [
                    "Работа с веб-аналитикой",
                    "A/B-тестирование лендингов",
                    "Подготовка брифов для креативной команды",
                ],
            },
            "discipline_mapping": [
                {"component": "A1", "discipline": "Интернет-маркетинг", "hours": 72, "control": "проект"},
                {"component": "B1", "discipline": "Маркетинговая аналитика", "hours": 24, "control": "зачёт"},
            ],
            "ed_technologies": ["проектная работа", "разбор кампаний", "хакатон"],
            "assessment_tools": [
                {
                    "level": "продвинутый",
                    "type": "practical",
                    "taskText": "Запустить учебную кампанию и подготовить отчёт с рекомендациями",
                    "criteria": "KPI, прозрачность бюджета, выводы",
                    "for_nok": True,
                }
            ],
            "resources": ["Рекламные кабинеты (учебные)", "Яндекс Метрика / GA", "Редакторы креативов"],
            "hint_qual": "маркетолог",
            "std_idx": 8,
            "ps_fallback": "Маркетолог",
        },
        {
            "name": "Обеспечение охраны труда и промышленной безопасности на производстве",
            "qualification_name": "Специалист по охране труда",
            "qualification_level": "6",
            "industry": "Сквозные виды деятельности в промышленности",
            "description": (
                "Идентификация опасностей, оценка профессиональных рисков, организация инструктажей, "
                "расследование несчастных случаев и взаимодействие с надзорными органами."
            ),
            "hours": "128",
            "status": CompetenceStatus.APPROVED,
            "developer": "Уральский федеральный университет",
            "validator": "СПК в сфере безопасности труда, социальной защиты и занятости населения",
            "labor_functions": [
                {"code": "A/01.6", "name": "Нормативное обеспечение системы управления охраной труда"},
                {"code": "B/01.6", "name": "Мониторинг функционирования системы управления охраной труда"},
                {"code": "C/01.6", "name": "Планирование и организация мероприятий по охране труда"},
            ],
            "structure": {
                "A": [
                    "Трудовое законодательство в части охраны труда",
                    "Методы оценки профессиональных рисков",
                    "Порядок расследования НС и профзаболеваний",
                ],
                "B": [
                    "Проводить специальную оценку условий труда (взаимодействие)",
                    "Организовывать инструктажи и стажировки",
                    "Вести журналы и локальные акты по ОТ",
                ],
                "C": [
                    "Аудит рабочих мест",
                    "Расследование микротравм и НС",
                    "Разработка программ улучшения условий труда",
                ],
            },
            "discipline_mapping": [
                {"component": "A1", "discipline": "Охрана труда", "hours": 72, "control": "экзамен"},
                {"component": "B1", "discipline": "Промышленная безопасность", "hours": 56, "control": "зачёт"},
            ],
            "ed_technologies": ["деловая игра", "разбор НС", "выезд на предприятие"],
            "assessment_tools": [
                {
                    "level": "базовый",
                    "type": "test",
                    "taskText": "Классификация инструктажей и обязанности работодателя",
                    "threshold": 70,
                    "for_nok": False,
                },
                {
                    "level": "экспертный",
                    "type": "practical",
                    "taskText": "Провести оценку рисков для учебного участка и составить план мероприятий",
                    "criteria": "Методика, карта рисков, сроки, ответственные",
                    "for_nok": True,
                },
            ],
            "resources": ["Учебный участок", "Шаблоны карт рисков", "СИЗ демонстрационные"],
            "hint_qual": "охране труда",
            "std_idx": 9,
            "ps_fallback": "Специалист по охране труда",
            "is_active": 1,
        },
    ]

    # Bind standard ids into payloads
    out = []
    for i, item in enumerate(items):
        item = dict(item)
        item["prof_standard_id"] = sid(item.pop("std_idx"))
        item["ps_name_fallback"] = item.pop("ps_fallback")
        item["user_id"] = admin_id
        item["_i"] = i
        out.append(item)
    return out


def seed():
    session = SessionLocal()
    try:
        admin = (
            session.query(User)
            .filter(User.email.in_(["admin@aonk.ru", "admin@admin.ru"]))
            .order_by(User.id.asc())
            .first()
        )
        if not admin:
            admin = session.query(User).filter(User.role == "admin").first()
        admin_id = admin.id if admin else None

        standards = _pick_standards(session, 10)
        print(f"ПС в БД для привязки: {len(standards)}")
        if not standards:
            print("⚠ Нет профстандартов — компетенции будут без prof_standard_id")

        payloads = build_seed_payloads(standards, admin_id)
        created = 0
        skipped = 0
        now = datetime.utcnow()

        for item in payloads:
            existing = (
                session.query(Competence)
                .filter(Competence.name == item["name"])
                .all()
            )
            already = False
            for row in existing:
                raw = row.raw_data or {}
                if raw.get("seed_tag") == SEED_TAG:
                    already = True
                    break
            if already:
                print(f"  skip: {item['name'][:60]}…")
                skipped += 1
                continue

            hint = item.pop("hint_qual", None)
            ps_fallback = item.pop("ps_name_fallback", "")
            idx = item.pop("_i", 0)
            qual = _pick_qualification(session, hint)

            qual_id = qual.id if qual else None
            if qual:
                item["qualification_name"] = item.get("qualification_name") or qual.name
                if qual.level:
                    item["qualification_level"] = str(qual.level)

            if item["prof_standard_id"] is None and standards:
                item["prof_standard_id"] = standards[0].id

            status = item.pop("status")
            validation_notes = item.pop("validation_notes", None)
            is_active = item.pop("is_active", 1)

            raw_data = {
                "description": item.pop("description", ""),
                "industry": item.pop("industry", ""),
                "hours": item.pop("hours", ""),
                "seed_tag": SEED_TAG,
                "education_level": (
                    "Магистратура"
                    if str(item.get("qualification_level", "")).startswith("7")
                    else "Бакалавриат"
                    if str(item.get("qualification_level", "")).startswith(("6", "5"))
                    else "СПО"
                ),
                "linked_ps_name": (
                    next((s.name for s in standards if s.id == item["prof_standard_id"]), None)
                    if item.get("prof_standard_id")
                    else ps_fallback
                ),
            }

            created_at = now - timedelta(days=30 - idx * 2)
            comp = Competence(
                name=item["name"],
                qualification_name=item["qualification_name"],
                qualification_level=item["qualification_level"],
                prof_standard_id=item.get("prof_standard_id"),
                qualification_id=qual_id,
                labor_functions=item["labor_functions"],
                structure=item["structure"],
                descriptors=_base_descriptors(item["name"].split()[0]),
                discipline_mapping=item["discipline_mapping"],
                ed_technologies=item["ed_technologies"],
                assessment_tools=item["assessment_tools"],
                resources=item["resources"],
                developer=item["developer"],
                validator=item.get("validator"),
                validation_notes=validation_notes,
                status=status,
                raw_data=raw_data,
                user_id=item.get("user_id"),
                is_active=is_active,
                created_at=created_at,
                updated_at=created_at + timedelta(days=1),
            )
            session.add(comp)
            created += 1
            print(f"  + [{status.value}] {comp.name[:70]}")

        session.commit()
        total = session.query(Competence).count()
        public = (
            session.query(Competence)
            .filter(
                Competence.is_active == 1,
                Competence.status.in_([CompetenceStatus.APPROVED, CompetenceStatus.REVIEW]),
            )
            .count()
        )
        print("=" * 60)
        print(f"Создано: {created}, пропущено: {skipped}")
        print(f"Всего компетенций в БД: {total}, в публичном реестре: {public}")
        print("=" * 60)
    except Exception as exc:
        session.rollback()
        print(f"Ошибка: {exc}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    seed()
