import React from 'react';
import { Folder, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const StandardStructureViewer = ({ standard }) => {
  if (!standard) return <div>Нет данных</div>;

  const renderList = (items, label) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="ml-4 mb-2">
        <p className="text-xs font-semibold text-muted-foreground mb-1">{label}:</p>
        <ul className="list-disc pl-5 text-sm space-y-0.5">
          {items.map((item, idx) => {
            const value = typeof item === 'string' ? item : item.text || item;
            return <li key={idx}>{value}</li>;
          })}
        </ul>
      </div>
    );
  };

  const functions = standard.generalized_functions || [];
  if (functions.length === 0) {
    return <div>В этом стандарте нет трудовых функций</div>;
  }

  return (
    <Accordion type="multiple" defaultValue={functions.map((_, idx) => `gf-${idx}`)} className="w-full">
      {functions.map((gf, gfIdx) => {
        const particularFunctions = gf.particular_functions || [];
        return (
          <AccordionItem key={gfIdx} value={`gf-${gfIdx}`}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2 text-left">
                <Folder className="w-4 h-4 shrink-0 text-blue-600" />
                <Badge variant="secondary" className="shrink-0">{gf.code}</Badge>
                <span className="font-medium">{gf.name}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {gf.level && (
                <p className="text-sm text-muted-foreground mb-2">Уровень квалификации: {gf.level}</p>
              )}
              {gf.possible_job_titles?.length > 0 && (
                <p className="text-sm text-muted-foreground mb-3">
                  Возможные должности: {gf.possible_job_titles.join(', ')}
                </p>
              )}
              <Accordion
                type="multiple"
                defaultValue={particularFunctions.map((_, idx) => `pf-${gfIdx}-${idx}`)}
              >
                {particularFunctions.map((pf, pfIdx) => (
                  <AccordionItem key={pfIdx} value={`pf-${gfIdx}-${pfIdx}`}>
                    <AccordionTrigger className="hover:no-underline pl-4">
                      <div className="flex items-center gap-2 text-left">
                        <FileText className="w-4 h-4 shrink-0 text-green-600" />
                        <Badge variant="outline" className="shrink-0">{pf.code}</Badge>
                        <span className="font-medium text-sm">{pf.name}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pl-8">
                      {renderList(pf.labor_actions, 'Трудовые действия (ТД)')}
                      {renderList(pf.required_skills || pf.skills, 'Умения (У)')}
                      {renderList(pf.necessary_knowledges || pf.knowledges, 'Знания (З)')}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
};

export default StandardStructureViewer;
