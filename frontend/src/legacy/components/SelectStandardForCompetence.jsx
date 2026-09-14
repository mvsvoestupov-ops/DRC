import React, { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Search, Shield, CheckCircle2, Folder } from 'lucide-react';
import { getStandards, getEnrichedStandard, getStandard, getQualificationsByStandard, calculateCoverage } from '@/api/compat';

const AREAS = [
  { code: '01', name: 'Образование и наука' },
  { code: '02', name: 'Здравоохранение' },
  { code: '03', name: 'Социальное обслуживание' },
  { code: '04', name: 'Культура и искусство' },
  { code: '05', name: 'Физическая культура и спорт' },
  { code: '06', name: 'Связь, информационные и коммуникационные технологии' },
  { code: '07', name: 'Административно-управленческая и офисная деятельность' },
  { code: '08', name: 'Финансы и экономика' },
  { code: '09', name: 'Юриспруденция' },
  { code: '10', name: 'Архитектура, проектирование, геодезия, топография и дизайн' },
  { code: '11', name: 'Средства массовой информации, издательство и полиграфия' },
  { code: '12', name: 'Сельское хозяйство' },
  { code: '13', name: 'Лесное хозяйство, охота' },
  { code: '14', name: 'Рыболовство и рыбоводство' },
  { code: '15', name: 'Строительство и жилищно-коммунальное хозяйство' },
  { code: '16', name: 'Транспорт' },
  { code: '17', name: 'Добыча, переработка угля, руд и других полезных ископаемых' },
  { code: '18', name: 'Добыча, переработка, транспортировка нефти и газа' },
  { code: '19', name: 'Электроэнергетика' },
  { code: '20', name: 'Лёгкая и текстильная промышленность' },
  { code: '21', name: 'Пищевая промышленность' },
  { code: '22', name: 'Деревообрабатывающая и целлюлозно-бумажная промышленность, мебельное производство' },
  { code: '23', name: 'Атомная промышленность' },
  { code: '24', name: 'Ракетно-космическая промышленность' },
  { code: '25', name: 'Химическая и биотехнологическая промышленность' },
  { code: '26', name: 'Металлургическое производство' },
  { code: '27', name: 'Машиностроение' },
  { code: '28', name: 'Производство электрооборудования, электронного и оптического оборудования' },
  { code: '29', name: 'Судостроение' },
  { code: '30', name: 'Авиастроение' },
  { code: '31', name: 'Автомобилестроение' },
  { code: '32', name: 'Железнодорожное машиностроение' },
  { code: '33', name: 'Оборонная промышленность' },
  { code: '34', name: 'Другие виды деятельности' },
  { code: '35', name: 'Обеспечение безопасности' },
  { code: '36', name: 'Сервис, оказание услуг населению' },
  { code: '37', name: 'Торговля' },
  { code: '38', name: 'Туризм и гостиничный бизнес' },
  { code: '39', name: 'Финансовые услуги' },
  { code: '40', name: 'Сквозные виды профессиональной деятельности в промышленности' },
];

const SelectStandardForCompetence = ({
  onSelect,
  initialStandardId,
  initialTFCodes,
  initialCoverage,
  initialLaborFunctions,
}) => {
  const [allStandards, setAllStandards] = useState([]);
  const [filteredStandards, setFilteredStandards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAreas, setSelectedAreas] = useState([]);
  const [selectedStandard, setSelectedStandard] = useState(null);
  const [laborFunctions, setLaborFunctions] = useState([]);
  const [selectedTFCodes, setSelectedTFCodes] = useState(initialTFCodes || []);
  const [coverageData, setCoverageData] = useState(initialCoverage || []);
  const [expandedTF, setExpandedTF] = useState({});
  const [confirmed, setConfirmed] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    setLoading(true);
    getStandards()
      .then(res => {
        setAllStandards(res.data);
        setFilteredStandards([]);
        setLoading(false);
      })
      .catch(() => {
        setMessage({ type: 'error', text: 'Ошибка загрузки списка ПС' });
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (initialStandardId && allStandards.length > 0 && !isInitialized) {
      const std = allStandards.find(s => s.id === initialStandardId);
      if (std) {
        if (initialLaborFunctions && initialLaborFunctions.length > 0) {
          setLaborFunctions(initialLaborFunctions);
          setSelectedStandard(std);
          if (initialCoverage && initialCoverage.length > 0) {
            setCoverageData(initialCoverage);
          } else if (initialTFCodes && initialTFCodes.length > 0) {
            calculateCoverage(std.id, initialTFCodes)
              .then(res => setCoverageData(res.data))
              .catch(() => {});
          }
          setIsInitialized(true);
          setConfirmed(true);
        } else {
          handleSelectStandard(std);
        }
        setIsInitialized(true);
      }
    }
  }, [initialStandardId, allStandards, isInitialized]);

  useEffect(() => {
    if (initialTFCodes && isInitialized) {
      setSelectedTFCodes(initialTFCodes);
    }
  }, [initialTFCodes, isInitialized]);

  useEffect(() => {
    const hasFilter = searchQuery.trim() || selectedAreas.length > 0;
    if (!hasFilter || allStandards.length === 0) {
      setFilteredStandards([]);
      return;
    }
    let result = allStandards;
    if (searchQuery.trim()) {
      const lower = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(lower) ||
        (s.kind_activity && s.kind_activity.toLowerCase().includes(lower)) ||
        (s.purpose && s.purpose.toLowerCase().includes(lower))
      );
    }
    if (selectedAreas.length > 0) {
      result = result.filter(s => s.professional_area_code && selectedAreas.includes(s.professional_area_code));
    }
    setFilteredStandards(result);
  }, [searchQuery, selectedAreas, allStandards]);

  const handleSelectStandard = async (std) => {
    setConfirmed(false);
    setSelectedStandard(std);
    setSelectedTFCodes([]);
    setCoverageData([]);
    setExpandedTF({});
    try {
      let fullStandard = null;
      try {
        const enrichedRes = await getEnrichedStandard(std.reg_number);
        if (enrichedRes.data && enrichedRes.data.generalized_functions) {
          fullStandard = enrichedRes.data;
        }
      } catch (e) {}
      if (!fullStandard) {
        const stdRes = await getStandard(std.reg_number);
        fullStandard = stdRes.data;
      }
      setLaborFunctions(buildLaborFunctions(fullStandard));
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Ошибка загрузки данных о стандарте' });
    }
  };

  const buildLaborFunctions = (fullStandard) => {
    const allTFs = [];
    if (fullStandard.generalized_functions) {
      fullStandard.generalized_functions.forEach(gf => {
        if (gf.particular_functions) {
          gf.particular_functions.forEach(pf => {
            allTFs.push({
              id: pf.code,
              code: pf.code,
              name: pf.name,
              otf_code: gf.code,
              otf_name: gf.name,
              labor_actions: (pf.labor_actions || []).map(la => ({
                text: la.text || la,
                skills: la.skills?.map(s => s.text || s) || pf.required_skills || [],
                knowledges: la.knowledges?.map(k => k.text || k) || pf.necessary_knowledges || []
              })),
              level: pf.sub_qualification || '',
            });
          });
        }
      });
    }
    return allTFs;
  };

  const handleToggleTF = (code) => {
    if (confirmed) return;
    let newSelected = [...selectedTFCodes];
    if (newSelected.includes(code)) {
      newSelected = newSelected.filter(c => c !== code);
    } else {
      newSelected.push(code);
    }
    setSelectedTFCodes(newSelected);
    if (selectedStandard && newSelected.length > 0) {
      calculateCoverage(selectedStandard.id, newSelected)
        .then(res => setCoverageData(res.data))
        .catch(() => setMessage({ type: 'error', text: 'Ошибка расчёта покрытия' }));
    } else {
      setCoverageData([]);
    }
  };

  const toggleTFExpand = (code) => {
    setExpandedTF(prev => ({ ...prev, [code]: !prev[code] }));
  };

  const handleConfirm = () => {
    if (!selectedStandard || selectedTFCodes.length === 0) {
      setMessage({ type: 'warning', text: 'Выберите хотя бы одну трудовую функцию' });
      return;
    }
    setConfirmed(true);
    const selectedLaborFunctions = laborFunctions.filter(tf => selectedTFCodes.includes(tf.code));
    const bestQual = coverageData.length > 0 ? coverageData[0] : null;
    onSelect({
      standard: selectedStandard,
      selectedTFCodes,
      selectedQualification: bestQual ? bestQual.qualification_id : null,
      coverageData,
      selectedLaborFunctions,
    });
    setMessage({ type: 'success', text: 'Выбор подтверждён' });
  };

  const groupedByOTF = useMemo(() => {
    const groups = {};
    laborFunctions.forEach(tf => {
      const key = tf.otf_code;
      if (!groups[key]) groups[key] = { code: key, name: tf.otf_name, tfs: [] };
      groups[key].tfs.push(tf);
    });
    return Object.values(groups);
  }, [laborFunctions]);

  const hasFilter = searchQuery.trim() || selectedAreas.length > 0;

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-3 rounded-md text-sm ${
          message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
          message.type === 'warning' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
          'bg-destructive/10 text-destructive border border-destructive/20'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по названию..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value="" onValueChange={(val) => setSelectedAreas(prev => prev.includes(val) ? prev.filter(a => a !== val) : [...prev, val])} disabled>
          <SelectTrigger>
            <SelectValue placeholder="Область деятельности..." />
          </SelectTrigger>
          <SelectContent>
            {AREAS.map(area => (
              <SelectItem key={area.code} value={area.code}>{area.code} – {area.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          {!hasFilter ? (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center">
                <Search className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground text-sm">Начните поиск, чтобы найти ПС</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-auto">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
              ) : (
                filteredStandards.map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectStandard(item)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedStandard?.id === item.id
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{item.name}</div>
                        {item.professional_area_code && (
                          <Badge variant="secondary" className="mt-1">{item.professional_area_code}</Badge>
                        )}
                      </div>
                      {selectedStandard?.id === item.id && (
                        <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {selectedStandard && laborFunctions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Трудовые функции</CardTitle>
                  <Badge variant="secondary">{selectedTFCodes.length} выбрано</Badge>
                </div>
              </CardHeader>
              <CardContent className="max-h-[50vh] overflow-auto">
                <Accordion type="multiple" className="w-full">
                  {groupedByOTF.map((group, idx) => (
                    <AccordionItem key={idx} value={`group-${idx}`}>
                      <AccordionTrigger className="text-sm py-2">
                        <div className="flex items-center gap-2">
                          <Folder className="w-4 h-4 text-muted-foreground" />
                          <Badge variant="outline" className="text-xs">{group.code}</Badge>
                          <span className="font-medium line-clamp-1">{group.name}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          {group.tfs.map(tf => {
                            const isChecked = selectedTFCodes.includes(tf.code);
                            return (
                              <div
                                key={tf.id}
                                className={`p-2 rounded-lg border ${
                                  isChecked ? 'border-primary/30 bg-primary/5' : 'border-border'
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={() => handleToggleTF(tf.code)}
                                    disabled={confirmed}
                                    className="mt-0.5"
                                  />
                                  <div className="flex-1">
                                    <span className="text-sm font-medium">{tf.code}</span>
                                    <span className="text-sm text-muted-foreground"> – {tf.name}</span>
                                  </div>
                                  {tf.labor_actions?.length > 0 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-xs"
                                      onClick={() => toggleTFExpand(tf.code)}
                                    >
                                      {expandedTF[tf.code] ? 'Скрыть ТД' : `Показать ТД (${tf.labor_actions.length})`}
                                    </Button>
                                  )}
                                </div>
                                {expandedTF[tf.code] && tf.labor_actions?.map((action, aIdx) => (
                                  <div key={aIdx} className="mt-2 ml-8 p-2 bg-muted/50 rounded text-sm">
                                    <div><strong>ТД:</strong> {action.text}</div>
                                    {action.skills?.length > 0 && <div className="mt-1"><strong>Умения:</strong> {action.skills.join(', ')}</div>}
                                    {action.knowledges?.length > 0 && <div className="mt-1"><strong>Знания:</strong> {action.knowledges.join(', ')}</div>}
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          )}

          {!selectedStandard && (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center">
                <Shield className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">Выберите стандарт для просмотра ТФ</p>
              </CardContent>
            </Card>
          )}

          {selectedTFCodes.length > 0 && (
            <Button className="w-full" onClick={handleConfirm} disabled={confirmed}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Подтвердить выбор ({selectedTFCodes.length} ТФ)
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SelectStandardForCompetence;
