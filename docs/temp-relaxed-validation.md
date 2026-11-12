# Временно снятые контроли валидации (вернуть позже)

Список ослаблений для ручного/серверного тестирования потока экспертизы.
**Не считать это целевой бизнес-логикой.** Перед релизом контролей — вернуть или явно утвердить снятие.

| # | Что снято | Где | Как вернуть |
|---|---|---|---|
| 1 | Обязательный профстандарт при отправке на экспертизу | `NewCompetencyPage` (step 2), `backend/app/main.py` create, `competence_profile.validate_competence_payload` (ТФ при strict) | Снова требовать ПС для `professional` при статусе ≠ черновик; при наличии ПС — ТФ |
| 2 | Полнота оценочных средств (шаг 6 / V2) перед «Направить на экспертизу» | `NewCompetencyPage.validateForm` / `validateStep(7)`; strict `assessment_tools` в `competence_profile.py` | Вернуть вызов `assessmentV2WizardErrorMessage`; вернуть проверку ОС в `validate_competence_payload` |
| 3 | Наполнение каждого трудового действия знаниями и умениями (≥1 З и ≥1 У) | `NewCompetencyPage` case 2 — закомментирован `incompleteTdZuCards` | Раскомментировать проверку `needTdZu` |
| 4 | *(справочно, не «снятие»)* Дескрипторы «экспертный» только если уровень не заблокирован образованием | `formationLevelsForEducation` / backend `formation_levels_for_education` | Оставить как есть (это корректное поведение) |
| 5 | Шаги 9 / 9.1 / 9.2 только у руководителя, админа и методиста-международника | `can_edit` для участника РГ при статусе «утверждена»; `NewCompetencyPage` (`showStep92`); API паспорта `/competences/{id}/harmonization*` (`_require_passport_mapping_editor`) | Снова: участник РГ правит только черновик; шаг 9.2 и API гармонизации — только admin и intl_methodologist. Справочник мостов не открывать участникам |

Дата ослаблений: 2026-11-11. Пункт 5 — 2026-11-12.  
Коммит-маркер: `TEMP: restore later — relaxed validation gates`.
