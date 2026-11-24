# Деплой и секреты DRC (без O:/Public)

## Код

1. ПК: `git push` в GitLab `svoestupov/drc` (`push-and-deploy.cmd` или `/push`).
2. CT 228: `git fetch/reset` + `deploy-remote.sh` (через SSH на `10.100.28.44`, jump `hv1`/`pct exec`, или GitLab CI runner с тегом `aonk`).
3. **Запрещено:** копировать дерево через `O:\` / `\\dc1.ao-nk.site\Public`.

## Секреты

- Runtime: `/opt/drc/backend/.env` на CT (не в git).
- Источник значений: GitLab CI/CD Variables (masked/protected) **или** SSH с доверенной машины (`scripts\set-secret.cmd`).
- **Запрещено:** класть ключи/`.env` на Public.

## Проверка ключа (без heredoc)

На hv1 после деплоя:

```bash
pct exec 228 -- bash /opt/drc/scripts/check-deepseek-key.sh
```

Если вставить `pct exec … <<'PY'` и кавычки разъедутся — оболочка покажет `>` и будет ждать закрытия строки: `Ctrl+C`, затем однострочник из `deploy-on-hv1.sh`.

## Корпоративная справка vs факт

help.ao-nk.ru описывает GitLab → Jenkins → deb → Aptly → Puppet и `%SECRET_*%`. Живой Jenkins на кластере не найден; GitLab 113 жив. Пока переезды идут через `svoestupov/*` + `git pull` на CT. Долгосрочно — вернуть deb/`%SECRET_*%`/CI+Puppet, когда инфраструктура сборки снова есть.
