import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { getRegistrations } from '../api';

const RegistrationsList = () => {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    getRegistrations()
      .then(res => {
        setRegistrations(res.data);
        setLoading(false);
      })
      .catch(() => {
        setMessage({ type: 'error', text: 'Ошибка загрузки списка регистраций' });
        setLoading(false);
      });
  }, []);

  const columns = [
    { key: 'id', label: 'ID', className: 'w-16' },
    { key: 'full_name', label: 'ФИО' },
    { key: 'email', label: 'E-mail' },
    { key: 'phone', label: 'Телефон' },
    { key: 'organization', label: 'Организация' },
    { key: 'position', label: 'Должность' },
    {
      key: 'created_at',
      label: 'Дата регистрации',
      render: (val) => (val ? new Date(val).toLocaleString('ru-RU') : '—'),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-medium">Регистрации на сессию</h2>
        <p className="text-muted-foreground text-sm mt-1">Список зарегистрированных участников</p>
      </div>

      {message.text && (
        <div className={`p-3 rounded-md text-sm ${
          message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-destructive/10 text-destructive border border-destructive/20'
        }`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Загрузка...</div>
      ) : registrations.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Нет зарегистрированных участников</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {columns.map((col) => (
                      <th key={col.key} className={`text-left p-3 font-medium ${col.className || ''}`}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((reg) => (
                    <tr key={reg.id} className="border-b hover:bg-muted/30 transition-colors">
                      {columns.map((col) => (
                        <td key={col.key} className="p-3">
                          {col.render ? col.render(reg[col.key]) : reg[col.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 text-xs text-muted-foreground border-t">
              Всего: {registrations.length}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RegistrationsList;
