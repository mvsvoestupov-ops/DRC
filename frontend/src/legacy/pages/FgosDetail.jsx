import React, { useState, useEffect } from 'react';

import { useParams, useNavigate, useSearchParams } from 'react-router';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Button } from '@/components/ui/button';

import { Badge } from '@/components/ui/badge';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

import { ArrowLeft, BookOpen, FileText, ExternalLink, Clock } from 'lucide-react';

import { getFgosById } from '@/api/compat';



const InfoItem = ({ icon, label, value }) => (

  <div className="space-y-1">

    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">

      {icon}

      {label}

    </div>

    <div className="text-sm">{value || '—'}</div>

  </div>

);



const ListSection = ({ title, items }) => (

  <div>

    {title ? <h3 className="text-sm font-semibold mb-2">{title}</h3> : null}

    {items?.length ? (

      <ul className="list-decimal list-inside text-sm space-y-1.5 text-gray-800">

        {items.map((item, idx) => (

          <li key={idx} className="leading-snug">{item}</li>

        ))}

      </ul>

    ) : (

      <p className="text-sm text-muted-foreground">—</p>

    )}

  </div>

);



const DurationBlock = ({ duration }) => {

  const d = duration || {};

  if (!d.on_base_of_school && !d.on_base_of_primary) return '—';

  return (

    <>

      {d.on_base_of_school && <div>{d.on_base_of_school}</div>}

      {d.on_base_of_primary && <div>{d.on_base_of_primary}</div>}

    </>

  );

};



const TrackCompetencies = ({ track }) => (

  <div className="space-y-6">

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

      <InfoItem icon={<FileText className="w-4 h-4" />} label="Квалификация" value={track.qualification_name} />

      <InfoItem icon={<Clock className="w-4 h-4" />} label="Срок обучения" value={<DurationBlock duration={track.study_duration} />} />

    </div>



    <Accordion type="multiple" defaultValue={['ok', 'pk']} className="w-full">

      <AccordionItem value="ok">

        <AccordionTrigger>

          Общие компетенции (ОК) — {track.ok_competencies?.length || 0}

        </AccordionTrigger>

        <AccordionContent>

          <ListSection title="" items={track.ok_competencies} />

        </AccordionContent>

      </AccordionItem>

      <AccordionItem value="pk">

        <AccordionTrigger>

          Профессиональные компетенции (ПК) — {track.pk_competencies?.length || 0}

        </AccordionTrigger>

        <AccordionContent>

          {track.pk_by_activity?.length ? (

            <div className="space-y-4">

              {track.pk_by_activity.map((group, idx) => (

                <div key={idx} className="border rounded-lg p-3 bg-muted/30">

                  <p className="text-sm font-medium mb-2">{group.activity}</p>

                  <ListSection title="" items={group.competencies} />

                </div>

              ))}

            </div>

          ) : (

            <ListSection title="" items={track.pk_competencies} />

          )}

        </AccordionContent>

      </AccordionItem>

    </Accordion>

  </div>

);



const FgosDetail = () => {

  const { id } = useParams();

  const navigate = useNavigate();

  const [searchParams] = useSearchParams();

  const backSection = searchParams.get('section') || 'spo';

  const [item, setItem] = useState(null);

  const [loading, setLoading] = useState(true);



  useEffect(() => {

    getFgosById(id)

      .then((res) => setItem(res.data))

      .catch(() => setItem(null))

      .finally(() => setLoading(false));

  }, [id]);



  if (loading) {

    return (

      <div className="flex justify-center py-12">

        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />

      </div>

    );

  }



  if (!item) {

    return <div className="p-6">ФГОС не найден</div>;

  }



  const tracks = item.qualification_tracks?.length

    ? item.qualification_tracks

    : (item.ok_competencies?.length || item.pk_competencies?.length)

      ? [{

          track: 'standard',

          track_label: 'Программа подготовки',

          qualification_name: item.qualification,

          study_duration: item.study_duration,

          ok_competencies: item.ok_competencies,

          pk_competencies: item.pk_competencies,

          pk_by_activity: [],

        }]

      : [];



  const defaultTab = tracks[0]?.track || 'standard';



  return (

    <div className="space-y-6">

      <Button variant="ghost" onClick={() => navigate(`/fgos?section=${item.category || backSection}`)}>

        <ArrowLeft className="w-4 h-4 mr-2" />

        Назад к списку

      </Button>



      <Card>

        <CardHeader>

          <div className="flex flex-wrap items-start justify-between gap-3">

            <div>

              <CardTitle className="font-bold text-2xl">{item.name}</CardTitle>

              <div className="flex flex-wrap gap-2 mt-2">

                {item.category_label && (

                  <Badge variant="secondary">{item.category_label}</Badge>

                )}

                {item.kind === 'profession' ? (

                  <Badge variant="outline">профессия</Badge>

                ) : (

                  item.level && <Badge variant="outline">{item.level}</Badge>

                )}

                {item.code && <code className="text-sm bg-muted px-2 py-0.5 rounded">{item.code}</code>}

                {tracks.length > 1 && (

                  <Badge variant="outline">{tracks.length} квалификации</Badge>

                )}

              </div>

              {(item.industry_name || item.group_name) && (

                <p className="text-sm text-muted-foreground mt-2">

                  {[item.industry_code && `${item.industry_code} ${item.industry_name}`, item.group_code && `${item.group_code} ${item.group_name}`]

                    .filter(Boolean)

                    .join(' · ')}

                </p>

              )}

            </div>

            <div className="flex flex-wrap gap-2">

              {item.pdf_url && (

                <Button variant="outline" size="sm" asChild>

                  <a href={item.pdf_url} target="_blank" rel="noopener noreferrer">

                    <ExternalLink className="w-4 h-4 mr-2" />

                    PDF

                  </a>

                </Button>

              )}

              {item.source_url && (

                <Button variant="outline" size="sm" asChild>

                  <a href={item.source_url} target="_blank" rel="noopener noreferrer">

                    <ExternalLink className="w-4 h-4 mr-2" />

                    classinform.ru

                  </a>

                </Button>

              )}

            </div>

          </div>

        </CardHeader>

        <CardContent className="space-y-6">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <InfoItem icon={<BookOpen className="w-4 h-4" />} label="Код специальности" value={item.code} />

            <InfoItem icon={<FileText className="w-4 h-4" />} label="Квалификации" value={item.qualification} />

            <InfoItem icon={<FileText className="w-4 h-4" />} label="Приказ" value={item.order} />

          </div>



          <ListSection title="Области профессиональной деятельности" items={item.activity_areas} />



          {tracks.length > 0 ? (

            tracks.length === 1 ? (

              <div>

                <h3 className="text-base font-semibold mb-4">

                  {tracks[0].track_label || 'Компетенции'}

                </h3>

                <TrackCompetencies track={tracks[0]} />

              </div>

            ) : (

              <Tabs defaultValue={defaultTab} className="w-full">

                <TabsList className="flex flex-wrap h-auto gap-1">

                  {tracks.map((track) => (

                    <TabsTrigger key={track.track} value={track.track} className="text-xs sm:text-sm">

                      {track.qualification_name || track.track_label}

                    </TabsTrigger>

                  ))}

                </TabsList>

                {tracks.map((track) => (

                  <TabsContent key={track.track} value={track.track} className="mt-4">

                    <p className="text-sm text-muted-foreground mb-4">{track.track_label}</p>

                    <TrackCompetencies track={track} />

                  </TabsContent>

                ))}

              </Tabs>

            )

          ) : (

            <p className="text-sm text-muted-foreground">Компетенции не распознаны — запустите run-reparse-fgos-tracks.bat</p>

          )}

        </CardContent>

      </Card>

    </div>

  );

};



export default FgosDetail;

