import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/app/components/ui/dialog';

const STICKY_TOP = 0;
const TD_STACK_OFFSET = 36;

const CardComponent = ({ label, sub, type, onClick }) => {
  const colors = {
    otf: { bg: '#ffffff', border: '#e0e0e0' },
    tf: { bg: '#f3e5f5', border: '#ce93d8' },
    td: { bg: '#fff3e0', border: '#ffb74d' },
    skill: { bg: '#e8f5e9', border: '#81c784' },
    knowledge: { bg: '#e3f2fd', border: '#64b5f6' },
  };
  const { bg, border } = colors[type] || colors.otf;

  return (
    <div
      onClick={onClick}
      className="w-full shrink-0 rounded-lg text-xs leading-snug text-gray-800 mb-1 transition-shadow"
      style={{
        padding: '6px 10px',
        background: bg,
        border: `1px solid ${border}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onMouseEnter={(e) => {
        if (onClick) e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
      }}
    >
      <div className="font-bold mb-0.5">{label}</div>
      {sub && <div className="text-[10px] text-gray-500">{sub}</div>}
    </div>
  );
};

const StickyCard = ({ top = STICKY_TOP, zIndex = 10, children }) => (
  <div className="sticky self-start w-full" style={{ top, zIndex }}>
    {children}
  </div>
);

const StandardCardGraph = ({ standard }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState(null);

  const showModal = (data, type) => {
    if (!data) return;
    let fields = [];
    let title = '';
    if (type === 'otf') {
      title = `ОТФ ${data.code || ''}: ${data.name || ''}`;
      fields = [
        { label: 'Код', value: data.code || '—' },
        { label: 'Уровень квалификации', value: data.level || '—' },
        { label: 'Возможные должности', value: data.possible_job_titles?.join(', ') || '—' },
        { label: 'ОКЗ', value: data.okz_codes?.length ? data.okz_codes.join(', ') : '—' },
        { label: 'ОКПДТР', value: data.okpdtr_codes?.length ? data.okpdtr_codes.join(', ') : '—' },
        { label: 'ОКСО', value: data.okso_codes?.length ? data.okso_codes.join(', ') : '—' },
      ];
    } else if (type === 'tf') {
      const parentOtf = standard.generalized_functions?.find((gf) =>
        gf.particular_functions?.some((pf) => pf.code === data.code)
      );
      const gf = parentOtf || {};
      title = `ТФ ${data.code || ''}: ${data.name || ''}`;
      fields = [
        { label: 'Код ТФ', value: data.code || '—' },
        { label: 'Подуровень', value: data.sub_qualification || '—' },
        { label: 'ОКЗ (ОТФ)', value: gf.okz_codes?.length ? gf.okz_codes.join(', ') : '—' },
        { label: 'ОКПДТР (ОТФ)', value: gf.okpdtr_codes?.length ? gf.okpdtr_codes.join(', ') : '—' },
        { label: 'ОКСО (ОТФ)', value: gf.okso_codes?.length ? gf.okso_codes.join(', ') : '—' },
      ];
    }
    setModalData({ title, fields });
    setModalOpen(true);
  };

  if (!standard || !standard.generalized_functions) {
    return <div>Нет данных для отображения</div>;
  }

  return (
    <div className="p-3">
      {standard.generalized_functions.map((gf, gfIdx) => {
        const rows = gf.particular_functions || [];
        if (rows.length === 0) return null;

        return (
          <div
            key={gf.code || gfIdx}
            className="mb-6 pb-4 border-b border-gray-200 last:border-b-0"
          >
            {/* OTF block: левая колонка на всю высоту блока */}
            <div className="flex gap-3 items-stretch">
              <div className="w-[180px] shrink-0">
                <StickyCard zIndex={30}>
                  <CardComponent
                    label={`${gf.code || 'ОТФ'}: ${gf.name}`}
                    sub={`Уровень ${gf.level || ''}`}
                    type="otf"
                    onClick={() => showModal(gf, 'otf')}
                  />
                </StickyCard>
              </div>

              <div className="flex-1 min-w-0 flex flex-col gap-2">
                {rows.map((pf, pfIdx) => {
                  const laborActions = pf.labor_actions || [];

                  return (
                    <div key={pf.code || pfIdx} className="flex gap-3 items-stretch">
                      {/* TF: левая колонка на высоту всех ТД этой ТФ */}
                      <div className="w-[180px] shrink-0">
                        <StickyCard zIndex={20}>
                          <CardComponent
                            label={`${pf.code || 'ТФ'}: ${pf.name}`}
                            type="tf"
                            onClick={() => showModal(pf, 'tf')}
                          />
                        </StickyCard>
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col gap-2">
                        {laborActions.length === 0 ? (
                          <div className="text-[11px] text-gray-400 py-1">—</div>
                        ) : (
                          laborActions.map((la, laIdx) => {
                            const skills = la.skills || [];
                            const knowledges = la.knowledges || [];
                            const allItems = [...skills, ...knowledges];

                            return (
                              <div key={laIdx} className="flex gap-3 items-stretch">
                                {/* TD: левая колонка на высоту У/З */}
                                <div className="w-[30%] min-w-[180px] shrink-0">
                                  <StickyCard
                                    top={STICKY_TOP + laIdx * TD_STACK_OFFSET}
                                    zIndex={10 - laIdx}
                                  >
                                    <CardComponent
                                      label={`ТД ${laIdx + 1}: ${la.text}`}
                                      type="td"
                                    />
                                  </StickyCard>
                                </div>

                                <div className="flex-1 min-w-0 flex flex-col gap-1">
                                  {allItems.length === 0 ? (
                                    <div className="text-[11px] text-gray-400 py-1">—</div>
                                  ) : (
                                    allItems.map((item, itemIdx) => {
                                      const isSkill = itemIdx < skills.length;
                                      const prefix = isSkill ? 'У' : 'З';
                                      return (
                                        <CardComponent
                                          key={itemIdx}
                                          label={`${prefix} ${itemIdx + 1}: ${item.text}`}
                                          type={isSkill ? 'skill' : 'knowledge'}
                                        />
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{modalData?.title || 'Детали'}</DialogTitle>
          </DialogHeader>
          {modalData && (
            <dl className="space-y-2 text-sm">
              {modalData.fields.map((field, idx) => (
                <div key={idx} className="grid grid-cols-3 gap-2 border-b border-gray-100 pb-2">
                  <dt className="font-medium text-muted-foreground">{field.label}</dt>
                  <dd className="col-span-2">{field.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Закрыть</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StandardCardGraph;
