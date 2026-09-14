import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Checkbox } from '../components/ui/Checkbox';
import { Calendar, MapPin, Clock, Users, ArrowRight, Send } from 'lucide-react';
import axios from 'axios';

const scheduleItems = [
  { time: '09:30 – 10:00', description: 'Сбор, регистрация, кофе' },
  { time: '10:00 – 10:15', description: 'Открытие и приветствие' },
  { time: '10:15 – 11:00', description: 'Обзорная лекция «Цифровой реестр компетенций: результаты первой сессии и ключевые вызовы»' },
  { time: '11:00 – 11:15', description: 'Инструктаж по работам в группах' },
  { time: '11:15 – 13:00', description: 'Групповая работа. Блок 1 – Разработка компетенции' },
  { time: '13:00 – 14:00', description: 'Обед' },
  { time: '14:00 – 15:15', description: 'Групповая работа. Блок 2 – Валидация и экспертиза' },
  { time: '15:15 – 15:30', description: 'Кофе-пауза' },
  { time: '15:30 – 16:45', description: 'Деловая игра – защита компетенции перед руководством' },
  { time: '16:45 – 17:15', description: 'Подведение итогов, принятие решений. Анонс и приглашение на 3 сессию' },
];

const RegisterPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [agree, setAgree] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    organization: '',
    position: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agree) {
      setMessage({ type: 'error', text: 'Необходимо согласие на обработку персональных данных' });
      return;
    }
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      await axios.post('/api/register', formData);
      setMessage({ type: 'success', text: 'Спасибо! Ваша заявка принята. Мы свяжемся с вами для подтверждения.' });
      setFormData({ fullName: '', email: '', phone: '', organization: '', position: '' });
      setAgree(false);
    } catch (error) {
      setMessage({ type: 'error', text: 'Ошибка регистрации. Попробуйте позже.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/50">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-[#0b1a33] to-[#1d3b66] text-white overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute top-6 right-8 z-10">
          <Button
            variant="outline"
            className="border-white/30 bg-white/10 text-white hover:bg-white/20 backdrop-blur"
            onClick={() => navigate('/login')}
          >
            Войти <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="inline-block bg-white/10 backdrop-blur px-4 py-1.5 rounded-full text-sm font-semibold uppercase tracking-wider text-blue-200 border border-white/10 mb-4">
            <Calendar className="inline w-4 h-4 mr-2" />
            30 июня 2026
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 max-w-3xl">
            Стратегическая сессия<br />
            <span className="text-blue-300">«Цифровой реестр компетенций – жизненный цикл»</span>
          </h1>
          <p className="text-lg text-blue-100 max-w-2xl mb-8">
            Цифровая трансформация системы оценки качества образования. Создание Цифрового реестра компетенций с учётом запросов рынка труда, сетевого международного сотрудничества и экспорта российского образования.
          </p>
          <div className="flex flex-wrap gap-x-12 gap-y-4 text-sm text-blue-200 border-t border-white/10 pt-6">
            <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-300" /> Москва, Ленинградский пр-т, 49/2</span>
            <span className="flex items-center gap-2"><Users className="w-4 h-4 text-blue-300" /> Финансовый университет</span>
            <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-blue-300" /> 15:30 (очный формат)</span>
            <span className="flex items-center gap-2"><Users className="w-4 h-4 text-blue-300" /> Для руководителей и экспертов</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Organizers & Purpose */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <Card>
            <CardHeader>
              <CardTitle>Организаторы</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                <strong>АО «Национальные квалификации» (АО «НК»)</strong> при поддержке Национального совета при Президенте РФ по профессиональным квалификациям, Рособрнадзора и ФГБУ «Росаккредагентство». На площадке Финансового университета.
              </p>
              <div className="flex flex-wrap gap-3">
                <a href="https://ao-nk.ru/" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">АО «НК»</a>
                <a href="https://nspkrf.ru/" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">Национальный совет</a>
                <a href="https://obrnadzor.gov.ru/" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">Рособрнадзор</a>
                <a href="https://www.nica.ru/" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">Росаккредагентство</a>
                <a href="https://www.fa.ru/" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">Финансовый университет</a>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Цель сессии</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Проанализировать жизненный цикл формирования профессиональных компетенций как совокупного результата обучения по запросу работодателя. Обсуждение с участием представителей Национального совета, Рособрнадзора, Росаккредагентства, ФУМО и отраслевых ФОИВов.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Schedule */}
        <div className="mb-12">
          <h3 className="text-xl font-medium mb-4">Программа сессии</h3>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-2">
                {scheduleItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-1.5 border-b border-border last:border-0">
                    <span className="font-semibold text-primary whitespace-nowrap mr-4">{item.time}</span>
                    <span className="text-right">{item.description}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Registration Form */}
        <Card className="bg-accent/30 border-border">
          <CardHeader>
            <CardTitle>Регистрация на сессию</CardTitle>
            <CardDescription>
              Заполните форму, чтобы подтвердить участие в мероприятии. Регистрация открыта до 28 июня 2026 года.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {message.text && (
              <div className={`mb-6 p-3 rounded-md text-sm ${
                message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-destructive/10 text-destructive border border-destructive/20'
              }`}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 flex flex-col gap-2">
                  <Label htmlFor="fullName">
                    <span className="text-destructive">*</span> ФИО
                  </Label>
                  <Input id="fullName" name="fullName" required value={formData.fullName} onChange={handleChange} placeholder="Иванов Иван Иванович" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">
                    <span className="text-destructive">*</span> E-mail
                  </Label>
                  <Input id="email" name="email" type="email" required value={formData.email} onChange={handleChange} placeholder="ivanov@example.ru" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="phone">
                    <span className="text-destructive">*</span> Телефон
                  </Label>
                  <Input id="phone" name="phone" type="tel" required value={formData.phone} onChange={handleChange} placeholder="+7 (999) 123-45-67" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="organization">
                    <span className="text-destructive">*</span> Организация
                  </Label>
                  <Input id="organization" name="organization" required value={formData.organization} onChange={handleChange} placeholder="Название компании / вуза" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="position">
                    <span className="text-destructive">*</span> Должность
                  </Label>
                  <Input id="position" name="position" required value={formData.position} onChange={handleChange} placeholder="Руководитель, эксперт ..." />
                </div>
              </div>

              <div className="mt-6 flex items-start gap-3">
                <Checkbox
                  id="agree"
                  className="mt-0.5"
                  checked={agree}
                  onCheckedChange={(checked) => setAgree(checked === true)}
                />
                <Label htmlFor="agree" className="text-sm">
                  Я согласен(на) на обработку персональных данных и подтверждаю, что ознакомлен(а) с{' '}
                  <a href="https://ao-nk.ru/upload/a60/Politika-v-oblasti-obrabotki-i-zashhity-PDn-27082025.pdf" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
                    политикой конфиденциальности
                  </a>.
                  <span className="text-destructive"> *</span>
                </Label>
              </div>

              <Button type="submit" disabled={loading} size="lg" className="mt-6 bg-[#0b1a33] hover:bg-[#0b1a33]/90 rounded-full px-10">
                <Send className="mr-2 w-4 h-4" />
                {loading ? 'Отправка...' : 'Отправить заявку'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RegisterPage;
