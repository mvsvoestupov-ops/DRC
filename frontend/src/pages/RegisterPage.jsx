import React, { useState } from 'react';
import { Form, Input, Button, message, Select, Typography, Checkbox } from 'antd';
import { useNavigate } from 'react-router-dom';

const { Option } = Select;
const { Title } = Typography;

const RegisterPage = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      console.log('Registration data:', values);
      await new Promise(resolve => setTimeout(resolve, 1500));
      message.success('Спасибо! Ваша заявка принята. Мы свяжемся с вами для подтверждения.');
      form.resetFields();
    } catch (error) {
      message.error('Ошибка регистрации. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      fontFamily: "'Inter', sans-serif",
      backgroundColor: '#f5f7fc',
      padding: '24px',
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <div style={{
        maxWidth: '1200px',
        width: '100%',
        background: '#ffffff',
        borderRadius: '40px',
        boxShadow: '0 20px 60px rgba(0, 20, 50, 0.08)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Кнопка "Войти" в правом верхнем углу (улучшенная видимость) */}
        <div style={{
          position: 'absolute',
          top: 24,
          right: 32,
          zIndex: 10,
        }}>
          <Button
            type="default"
            onClick={() => navigate('/login')}
            style={{
              borderRadius: 20,
              backgroundColor: '#ffffff',
              color: '#0b1a33',
              borderColor: '#ffffff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              fontWeight: 500,
              padding: '0 24px',
              height: 40,
            }}
          >
            Войти
          </Button>
        </div>

        {/* Hero-блок (без изменений) */}
        <div style={{
          background: 'linear-gradient(145deg, #0b1a33 0%, #1d3b66 100%)',
          padding: '48px 56px 40px',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            right: '-40px',
            top: '-40px',
            width: '320px',
            height: '320px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '50%',
            pointerEvents: 'none',
          }} />
          <div style={{
            display: 'inline-block',
            background: 'rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(4px)',
            padding: '6px 18px',
            borderRadius: '40px',
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '0.3px',
            textTransform: 'uppercase',
            color: '#b6d0f0',
            marginBottom: '20px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}>
            <i className="fas fa-calendar-alt" style={{ marginRight: '6px' }}></i> 30 июня 2026
          </div>
          <h1 style={{
            fontSize: '42px',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            maxWidth: '800px',
            marginBottom: '12px',
          }}>
            Стратегическая сессия<br />
            <span style={{ color: '#8bb9ff' }}>«Цифровой реестр компетенций – жизненный цикл»</span>
          </h1>
          <p style={{
            fontSize: '18px',
            color: '#c9dbf5',
            maxWidth: '640px',
            marginBottom: '28px',
            fontWeight: 400,
          }}>
            Цифровая трансформация системы оценки качества образования. 
            Создание Цифрового реестра компетенций с учётом запросов рынка труда, 
            сетевого международного сотрудничества и экспорта российского образования.
          </p>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '28px 48px',
            fontSize: '15px',
            color: '#d6e4fa',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            paddingTop: '24px',
            marginTop: '8px',
          }}>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <i className="fas fa-map-pin" style={{ width: '20px', color: '#8bb9ff', marginRight: '8px' }}></i>
              Москва, Ленинградский пр-т, 49/2
            </span>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <i className="fas fa-building" style={{ width: '20px', color: '#8bb9ff', marginRight: '8px' }}></i>
              Финансовый университет
            </span>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <i className="fas fa-clock" style={{ width: '20px', color: '#8bb9ff', marginRight: '8px' }}></i>
              15:30 (очный формат)
            </span>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <i className="fas fa-users" style={{ width: '20px', color: '#8bb9ff', marginRight: '8px' }}></i>
              Для руководителей и экспертов
            </span>
          </div>
        </div>

        {/* Остальной контент (без изменений) */}
        <div style={{ padding: '48px 56px 56px' }}>
          {/* Организаторы + цель */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '40px 48px',
            marginTop: '8px',
          }}>
            <div style={{
              background: '#f8faff',
              borderRadius: '24px',
              padding: '28px 32px',
              border: '1px solid #eef3fc',
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: 600,
                color: '#0b1a33',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}>
                <i className="fas fa-bullhorn" style={{ color: '#1d3b66', fontSize: '20px', width: '28px' }}></i>
                Организаторы
              </h3>
              <p style={{ marginBottom: '12px', fontSize: '15px', color: '#2c3a56', lineHeight: 1.6 }}>
                <strong>АО «Национальные квалификации»</strong> (АО «НК») и 
                <strong> ФГБУ «Росаккредагентство»</strong> при поддержке 
                Национального совета при Президенте РФ по профессиональным квалификациям 
                и Рособрнадзора.
              </p>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px 24px',
                marginTop: '12px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#1d3b66',
              }}>
                <span style={{
                  background: '#eef3fc',
                  padding: '4px 16px',
                  borderRadius: '40px',
                  fontWeight: 500,
                  fontSize: '13px',
                  color: '#0b1a33',
                }}>АО «НК»</span>
                <span style={{
                  background: '#eef3fc',
                  padding: '4px 16px',
                  borderRadius: '40px',
                  fontWeight: 500,
                  fontSize: '13px',
                  color: '#0b1a33',
                }}>Росаккредагентство</span>
                <span style={{
                  background: '#eef3fc',
                  padding: '4px 16px',
                  borderRadius: '40px',
                  fontWeight: 500,
                  fontSize: '13px',
                  color: '#0b1a33',
                }}>Национальный совет</span>
                <span style={{
                  background: '#eef3fc',
                  padding: '4px 16px',
                  borderRadius: '40px',
                  fontWeight: 500,
                  fontSize: '13px',
                  color: '#0b1a33',
                }}>Рособрнадзор</span>
              </div>
            </div>

            <div style={{
              background: '#f8faff',
              borderRadius: '24px',
              padding: '28px 32px',
              border: '1px solid #eef3fc',
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: 600,
                color: '#0b1a33',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}>
                <i className="fas fa-bullseye" style={{ color: '#1d3b66', fontSize: '20px', width: '28px' }}></i>
                Цель сессии
              </h3>
              <p style={{ fontSize: '15px', color: '#2c3a56', lineHeight: 1.6 }}>
                Проанализировать <strong>жизненный цикл формирования профессиональных компетенций</strong> 
                как совокупного результата обучения по запросу работодателя. 
                Обсуждение с участием представителей Национального совета, Рособрнадзора, 
                Росаккредагентства, ФУМО и отраслевых ФОИВов.
              </p>
            </div>
          </div>

          {/* Ключевые направления */}
          <div style={{ marginTop: '32px' }}>
            <div style={{
              fontSize: '26px',
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: '#0b1a33',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <i className="fas fa-arrow-trend-up" style={{ color: '#1d3b66', fontSize: '24px', opacity: 0.7 }}></i>
              Ключевые направления
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '40px 48px',
            }}>
              <div style={{
                background: '#f8faff',
                borderRadius: '24px',
                padding: '28px 32px',
                border: '1px solid #eef3fc',
              }}>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#0b1a33',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}>
                  <i className="fas fa-database" style={{ color: '#1d3b66', fontSize: '20px', width: '28px' }}></i>
                  Цифровой реестр компетенций
                </h3>
                <ul style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: '8px 0 0',
                  fontSize: '15px',
                  color: '#2c3a56',
                  lineHeight: 1.6,
                }}>
                  <li style={{ padding: '4px 0 4px 28px', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '6px', color: '#1d3b66', fontWeight: 700, fontSize: '18px' }}>•</span>
                    Учёт запросов рынка труда при формировании образовательных программ
                  </li>
                  <li style={{ padding: '4px 0 4px 28px', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '6px', color: '#1d3b66', fontWeight: 700, fontSize: '18px' }}>•</span>
                    Интеграция с системой профессиональных квалификаций
                  </li>
                  <li style={{ padding: '4px 0 4px 28px', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '6px', color: '#1d3b66', fontWeight: 700, fontSize: '18px' }}>•</span>
                    Пилотный проект по созданию реестра
                  </li>
                </ul>
              </div>
              <div style={{
                background: '#f8faff',
                borderRadius: '24px',
                padding: '28px 32px',
                border: '1px solid #eef3fc',
              }}>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#0b1a33',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}>
                  <i className="fas fa-globe" style={{ color: '#1d3b66', fontSize: '20px', width: '28px' }}></i>
                  Международное сотрудничество
                </h3>
                <ul style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: '8px 0 0',
                  fontSize: '15px',
                  color: '#2c3a56',
                  lineHeight: 1.6,
                }}>
                  <li style={{ padding: '4px 0 4px 28px', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '6px', color: '#1d3b66', fontWeight: 700, fontSize: '18px' }}>•</span>
                    Сетевое взаимодействие с зарубежными партнёрами
                  </li>
                  <li style={{ padding: '4px 0 4px 28px', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '6px', color: '#1d3b66', fontWeight: 700, fontSize: '18px' }}>•</span>
                    Экспорт российского образования
                  </li>
                  <li style={{ padding: '4px 0 4px 28px', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '6px', color: '#1d3b66', fontWeight: 700, fontSize: '18px' }}>•</span>
                    Гармонизация стандартов
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Программа */}
          <div style={{ marginTop: '40px' }}>
            <div style={{
              fontSize: '26px',
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: '#0b1a33',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <i className="fas fa-list-ul" style={{ color: '#1d3b66', fontSize: '24px', opacity: 0.7 }}></i>
              Программа сессии
            </div>
            <div style={{
              background: '#f8faff',
              borderRadius: '24px',
              padding: '20px 28px',
              border: '1px solid #eef3fc',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '16px',
                  padding: '12px 0',
                  borderBottom: '1px solid #eef3fc',
                  fontSize: '15px',
                }}>
                  <span style={{ fontWeight: 600, color: '#1d3b66', minWidth: '72px', fontSize: '14px' }}>15:30 – 15:45</span>
                  <span style={{ color: '#2c3a56' }}><strong>Открытие.</strong> Приветственные слова организаторов</span>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '16px',
                  padding: '12px 0',
                  borderBottom: '1px solid #eef3fc',
                  fontSize: '15px',
                }}>
                  <span style={{ fontWeight: 600, color: '#1d3b66', minWidth: '72px', fontSize: '14px' }}>15:45 – 16:30</span>
                  <span style={{ color: '#2c3a56' }}><strong>Ключевой доклад.</strong> Цифровая трансформация образования: вызовы и решения</span>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '16px',
                  padding: '12px 0',
                  borderBottom: '1px solid #eef3fc',
                  fontSize: '15px',
                }}>
                  <span style={{ fontWeight: 600, color: '#1d3b66', minWidth: '72px', fontSize: '14px' }}>16:30 – 17:15</span>
                  <span style={{ color: '#2c3a56' }}><strong>Панельная дискуссия.</strong> Жизненный цикл компетенций: от запроса до оценки</span>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '16px',
                  padding: '12px 0',
                  borderBottom: '1px solid #eef3fc',
                  fontSize: '15px',
                }}>
                  <span style={{ fontWeight: 600, color: '#1d3b66', minWidth: '72px', fontSize: '14px' }}>17:15 – 17:45</span>
                  <span style={{ color: '#2c3a56' }}><strong>Презентация пилотного проекта.</strong> Цифровой реестр компетенций</span>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '16px',
                  padding: '12px 0',
                  fontSize: '15px',
                }}>
                  <span style={{ fontWeight: 600, color: '#1d3b66', minWidth: '72px', fontSize: '14px' }}>17:45 – 18:00</span>
                  <span style={{ color: '#2c3a56' }}><strong>Заключение.</strong> Итоги и резолюция</span>
                </div>
              </div>
              <p style={{
                fontSize: '14px',
                color: '#4a5a7a',
                marginTop: '12px',
              }}>
                <i className="fas fa-print"></i> Полная программа будет раздана участникам в день мероприятия.
              </p>
            </div>
          </div>

          {/* Форма регистрации */}
          <div style={{
            marginTop: '48px',
            background: '#f8faff',
            borderRadius: '32px',
            padding: '40px 44px',
            border: '1px solid #eef3fc',
          }}>
            <div style={{
              fontSize: '26px',
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: '#0b1a33',
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <i className="fas fa-pen-to-square" style={{ color: '#1d3b66', fontSize: '24px', opacity: 0.7 }}></i>
              Регистрация на сессию
            </div>
            <p style={{
              fontSize: '15px',
              color: '#4a5a7a',
              marginBottom: '28px',
            }}>
              Заполните форму, чтобы подтвердить участие в мероприятии. 
              Регистрация открыта до 28 июня 2026 года.
            </p>

            <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '20px 28px',
              }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Form.Item
                    name="fullName"
                    label={<><span style={{ color: '#c72a2a' }}>*</span> ФИО</>}
                    rules={[{ required: true, message: 'Введите ФИО' }]}
                  >
                    <Input placeholder="Иванов Иван Иванович" size="large" />
                  </Form.Item>
                </div>
                <Form.Item
                  name="email"
                  label={<><span style={{ color: '#c72a2a' }}>*</span> E-mail</>}
                  rules={[{ required: true, type: 'email', message: 'Введите корректный email' }]}
                >
                  <Input placeholder="ivanov@example.ru" size="large" />
                </Form.Item>
                <Form.Item
                  name="phone"
                  label={<><span style={{ color: '#c72a2a' }}>*</span> Телефон</>}
                  rules={[{ required: true, message: 'Введите телефон' }]}
                >
                  <Input placeholder="+7 (999) 123-45-67" size="large" />
                </Form.Item>
                <Form.Item
                  name="organization"
                  label={<><span style={{ color: '#c72a2a' }}>*</span> Организация</>}
                  rules={[{ required: true, message: 'Введите организацию' }]}
                >
                  <Input placeholder="Название компании / вуза" size="large" />
                </Form.Item>
                <Form.Item name="position" label="Должность">
                  <Input placeholder="Руководитель, эксперт ..." size="large" />
                </Form.Item>
                <Form.Item name="participantType" label="Категория участия">
                  <Select placeholder="Выберите" size="large">
                    <Option value="offline">Очное участие</Option>
                    <Option value="online">Онлайн-подключение (по запросу)</Option>
                  </Select>
                </Form.Item>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Form.Item name="comment" label="Дополнительная информация / вопросы">
                    <Input.TextArea rows={3} placeholder="Если у вас есть особые пожелания или вопросы, напишите здесь..." />
                  </Form.Item>
                </div>
              </div>

              <Form.Item
                name="agree"
                valuePropName="checked"
                rules={[{ validator: (_, value) => value ? Promise.resolve() : Promise.reject('Необходимо согласие') }]}
                style={{ marginTop: '8px' }}
              >
                <Checkbox>
                  Я согласен(на) на обработку персональных данных и подтверждаю, 
                  что ознакомлен(а) с <a href="#" style={{ color: '#1d3b66', textDecoration: 'underline' }}>политикой конфиденциальности</a>.
                  <span style={{ color: '#c72a2a' }}> *</span>
                </Checkbox>
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                size="large"
                style={{
                  background: '#0b1a33',
                  border: 'none',
                  borderRadius: '60px',
                  padding: '16px 40px',
                  fontWeight: 600,
                  fontSize: '16px',
                  height: 'auto',
                  marginTop: '8px',
                }}
              >
                <i className="fas fa-paper-plane" style={{ marginRight: '8px' }}></i>
                Отправить заявку
              </Button>
            </Form>
          </div>

          {/* Футер */}
          <div style={{
            marginTop: '24px',
            textAlign: 'center',
            fontSize: '14px',
            color: '#6a7a9a',
            padding: '8px 0 4px',
            borderTop: '1px solid #eef3fc',
            paddingTop: '24px',
          }}>
            <p>
              <i className="fas fa-calendar-check" style={{ marginRight: '6px' }}></i>
              30 июня 2026 · 15:30 · Финансовый университет, Москва
            </p>
            <p style={{ marginTop: '6px' }}>
              <a href="https://conference.spkchs.ru/home" target="_blank" rel="noopener noreferrer" style={{ color: '#1d3b66', textDecoration: 'none', fontWeight: 500 }}>
                conference.spkchs.ru
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;