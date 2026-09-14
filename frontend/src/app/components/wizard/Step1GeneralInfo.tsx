import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface Step1Data {
  name?: string;
  description?: string;
  industry?: string;
  level?: string;
  hours?: string;
}

interface Step1GeneralInfoProps {
  data: Step1Data;
  updateData: (data: Partial<Step1Data>) => void;
}

const Step1GeneralInfo: React.FC<Step1GeneralInfoProps> = ({ data, updateData }) => {
  const handleChange = (field: keyof Step1Data, value: string) => {
    updateData({ [field]: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Общая информация о компетенции</h3>
        <p className="text-muted-foreground text-sm">Заполните основные данные</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">
            <span className="text-destructive">*</span> Название компетенции
          </Label>
          <Input
            id="name"
            value={data.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Например: Способен применять..."
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="description">Описание компетенции</Label>
          <Textarea
            id="description"
            value={data.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Подробное описание компетенции..."
            rows={4}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="industry">
              <span className="text-destructive">*</span> Отрасль
            </Label>
            <Select value={data.industry || ''} onValueChange={(val) => handleChange('industry', val)}>
              <SelectTrigger id="industry">
                <SelectValue placeholder="Выберите отрасль" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="19">19 - Добыча нефти и газа</SelectItem>
                <SelectItem value="40">40 - Сквозные виды деятельности</SelectItem>
                <SelectItem value="01">01 - Образование</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="level">
              <span className="text-destructive">*</span> Уровень квалификации
            </Label>
            <Select value={data.level || ''} onValueChange={(val) => handleChange('level', val)}>
              <SelectTrigger id="level">
                <SelectValue placeholder="Выберите уровень" />
              </SelectTrigger>
              <SelectContent>
                {[1,2,3,4,5,6,7,8].map(l => (
                  <SelectItem key={l} value={String(l)}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="hours">Рекомендуемая трудоёмкость (часы)</Label>
          <Input
            id="hours"
            type="number"
            min="0"
            value={data.hours || ''}
            onChange={(e) => handleChange('hours', e.target.value)}
            placeholder="Например: 180"
          />
        </div>
      </div>
    </div>
  );
};

export default Step1GeneralInfo;
