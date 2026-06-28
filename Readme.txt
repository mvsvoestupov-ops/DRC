Национальный реестр компетенций (ДРК)
Цифровая платформа для управления профессиональными стандартами, квалификациями и компетенциями

📖 О проекте
Платформа предназначена для:

Парсинга и хранения профессиональных стандартов (из реестра Минтруда)

Обогащения стандартов — автоматическое извлечение знаний, умений и навыков с привязкой к трудовым действиям

Парсинга квалификаций (с сайта НАРК) с сохранением в БД

Разработки компетенций через пошаговую стратегическую сессию (10 шагов)

Управления проектами с ролевой моделью (администратор / пользователь)

🚀 Стек технологий
Бэкенд
Python 3.12+

FastAPI 0.104.1 (веб-фреймворк)

SQLAlchemy 2.0.23 (ORM)

SQLite (база данных, может быть заменена на PostgreSQL)

Alembic (миграции)

Selenium + webdriver-manager (парсинг)

BeautifulSoup4 + lxml (парсинг XML/HTML)

sentence-transformers + torch (обогащение)

JWT (аутентификация через python-jose и passlib[bcrypt])

Фронтенд
React 19 (Create React App)

React Router v6 (маршрутизация)

Ant Design 6 (UI-библиотека)

Axios (HTTP-запросы)

React Flow + Dagre (визуализация графов)

Серверное окружение
Ubuntu 24.04

Nginx (веб-сервер + прокси)

Systemd (управление сервисами)

📁 Структура проекта
text
drc/
├── backend/
│   ├── app/
│   │   ├── db/                # модели БД (raw, enriched, qualifications, competences, users)
│   │   ├── auth.py            # JWT-аутентификация
│   │   ├── main.py            # FastAPI эндпоинты
│   │   ├── parser.py          # парсинг XML профессиональных стандартов
│   │   ├── qualifications_parser.py  # парсинг квалификаций с НАРК
│   │   ├── enrichment.py      # обогащение стандартов
│   │   ├── db_operations.py   # операции с БД
│   │   └── models.py          # Pydantic-схемы
│   ├── venv/                  # виртуальное окружение Python
│   ├── profstandart.db        # SQLite база данных
│   ├── requirements.txt
│   └── create_test_users.py   # скрипт создания пользователей
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── api.js             # API-клиент с интерцептором JWT
│   │   ├── App.js             # маршрутизация и меню
│   │   ├── context/AuthContext.js  # контекст аутентификации
│   │   ├── pages/             # страницы (Login, Register, MyProjects, Dashboard и др.)
│   │   └── components/        # переиспользуемые компоненты
│   ├── package.json
│   └── build/                 # собранная статика (генерируется)
├── .gitignore
└── README.md
🛠 Установка и запуск (локально)
1. Клонируйте репозиторий
bash
git clone https://github.com/mvsvoestupov-ops/DRC.git
cd DRC
2. Настройка бэкенда
bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
⚠️ Если при установке torch возникают проблемы, удалите строку с torch==2.1.0 из requirements.txt и установите CPU-версию:

bash
pip install torch==2.2.2 --index-url https://download.pytorch.org/whl/cpu
3. Настройка базы данных
bash
# Создание таблиц
python -c "from app.db import Base, engine; Base.metadata.create_all(bind=engine)"

# Создание тестовых пользователей
python create_test_users.py
Пользователи:

Администратор: admin@admin.ru / Aonk2019!

Тестовые пользователи: stol1@mail.ru / pass1 ... stol7@mail.ru / pass7

4. Запуск бэкенда
bash
uvicorn app.main:app --reload
5. Настройка фронтенда
bash
cd ../frontend
npm install
npm start
Приложение будет доступно по адресу http://localhost:3000.

🌐 Развертывание на сервере (Ubuntu 24.04)
1. Подготовка сервера
bash
apt update && apt install -y python3-pip python3-venv nginx git
2. Клонирование и настройка
bash
cd /var/www
git clone https://github.com/mvsvoestupov-ops/DRC drc.ao-nk.ru
cd drc.ao-nk.ru
3. Бэкенд (как systemd-сервис)
Создайте файл /etc/systemd/system/fastapi-backend.service:

ini
[Unit]
Description=FastAPI Backend
After=network.target

[Service]
User=root
WorkingDirectory=/var/www/drc.ao-nk.ru/backend
ExecStart=/var/www/drc.ao-nk.ru/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
Затем:

bash
cd /var/www/drc.ao-nk.ru/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
systemctl enable fastapi-backend.service
systemctl start fastapi-backend.service
4. Фронтенд (сборка и Nginx)
bash
cd /var/www/drc.ao-nk.ru/frontend
npm install
npm run build
chown -R www-data:www-data build
chmod -R 755 build
Конфиг Nginx (/etc/nginx/sites-available/drc):

nginx
server {
    listen 80;
    server_name 186.246.7.200;  # или ваш домен

    root /var/www/drc.ao-nk.ru/frontend/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
    }
}
Активация:

bash
ln -s /etc/nginx/sites-available/drc /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
🔐 Аутентификация и роли
JWT-токены хранятся в localStorage.

Все запросы к API (/api/...) требуют валидного токена.

Администратор — доступ ко всем разделам (управление ПС, квалификациями, обогащение).

Пользователь — доступ только к стратегической сессии и своим проектам.

📊 Основные эндпоинты API
Эндпоинт	Метод	Описание	Доступ
/token	POST	Получение JWT-токена	Публичный
/standards	GET	Список профстандартов	Админ / Пользователь
/standards/{reg_number}	GET	Полный стандарт с ОТФ и ТФ	Админ / Пользователь
/standards/search	GET	Поиск по содержанию (FTS)	Админ / Пользователь
/enriched-standards	GET	Список обогащённых ПС	Админ / Пользователь
/enriched-standards/{reg_number}	GET	Обогащённый стандарт	Админ / Пользователь
/qualifications/by-standard/{id}	GET	Квалификации по ПС	Админ / Пользователь
/competences	POST / GET / PUT / DELETE	Управление компетенциями (с привязкой к пользователю)	Админ / Пользователь
/competence/coverage	POST	Расчёт покрытия ТФ	Админ / Пользователь
/feedback	POST / GET	Сбор обратной связи (просмотр только админ)	Все
🧩 Стратегическая сессия (10 шагов)
Шаг	Название	Описание
1	Выбор ПС и квалификации	Поиск и выбор ПС, выбор ТФ, расчёт покрытия
2	Структура A/B/C	Распределение знаний, умений и навыков
3	Дескрипторы	Описание уровней (базовый, продвинутый, экспертный)
4	Привязка к дисциплинам	Связь компонентов с учебными дисциплинами
5	Образовательные технологии	Выбор методов обучения
6	Оценочные средства	Тестовые и практические задания с уровнями и НОК
7	Материально-техническая база	Ресурсы для обучения
8	Валидация	Экспертиза по чек-листу
9	Доработка	Исправление замечаний
10	Защита	Финальная сводка и сохранение компетенции
🧪 Парсинг квалификаций (на сервере)
bash
cd /var/www/drc.ao-nk.ru/backend
source venv/bin/activate
nohup python -c "from app.qualifications_parser import fetch_all_qualifications; fetch_all_qualifications(save=True)" > quals_parser.log 2>&1 &
tail -f quals_parser.log
После завершения проверьте количество:

bash
python -c "from app.db import SessionLocal; from app.db.qualifications_models import Qualification; session=SessionLocal(); print(session.query(Qualification).count()); session.close()"
🔄 Обновление проекта на сервере
bash
cd /var/www/drc.ao-nk.ru
git pull origin main

# Обновление бэкенда
cd backend
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart fastapi-backend.service

# Обновление фронтенда
cd ../frontend
npm install
npm run build
chown -R www-data:www-data build
chmod -R 755 build
sudo systemctl reload nginx
📝 Переменные окружения (.env)
env
DATABASE_URL=sqlite:////var/www/drc.ao-nk.ru/backend/profstandart.db
SECRET_KEY=your-secret-key-here
⚠️ Известные особенности
Обогащение требует torch и sentence-transformers. На сервере рекомендуется использовать CPU-версию torch.

Парсинг квалификаций требует установленного Google Chrome или Chromium + chromedriver.

При переносе базы данных с локальной машины на сервер убедитесь, что все таблицы созданы, а user_id в competences существует.

📬 Контакты
Разработчик: Михаил Воступов
Email: mvsvoestupov-ops@github.com

🏷️ Лицензия
MIT / Proprietary – уточняйте у правообладателя.

