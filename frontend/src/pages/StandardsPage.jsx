import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../components/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { Switch } from '../components/ui/Switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/Dialog';
import { Card, CardContent } from '../components/ui/Card';
import { Upload, RefreshCw, Zap, TreePine, LayoutGrid } from 'lucide-react';
import {
  uploadFile,
  getStandards,
  getStandard,
  fetchBulkRegistry,
  getEnrichedStandards,
  getEnrichedStandard,
  runEnrichment
} from '../api';
import StandardStructureViewer from '../components/StandardStructureViewer';
import StandardCardGraph from '../components/StandardCardGraph';

const MIN_MODAL_DISPLAY_TIME = 800;

const StandardsPage = () => {
  const [standards, setStandards] = useState([]);
  const [enrichedStandards, setEnrichedStandards] = useState([]);
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState('raw');
  const [viewMode, setViewMode] = useState('tree'); // 'tree' | 'cards'
  const [message, setMessage] = useState({ type: '', text: '' });

  // Loading states
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [enrichLoading, setEnrichLoading] = useState(false);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogText, setDialogText] = useState('');
  const [dialogSpinning, setDialogSpinning] = useState(false);

  const fileInputRef = useRef(null);

  const loadRawList = async () => {
    try {
      const res = await getStandards();
      setStandards(res.data);
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка загрузки сырых стандартов' });
    }
  };

  const loadEnrichedList = async () => {
    try {
      const res = await getEnrichedStandards();
      setEnrichedStandards(res.data);
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка загрузки обогащённых стандартов' });
    }
  };

  useEffect(() => {
    loadRawList();
    loadEnrichedList();
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      await uploadFile(file);
      setMessage({ type: 'success', text: 'Файл загружен' });
      await loadRawList();
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка загрузки: ' + (err.response?.data?.detail || '') });
    } finally {
      setLoading(false);
    }
  };

  const handleFetchBulk = async () => {
    setBulkLoading(true);
    setDialogOpen(true);
    setDialogTitle('Загрузка стандартов из реестра');
    setDialogText('Идёт сбор и загрузка данных...');
    setDialogSpinning(true);
    const startTime = Date.now();

    try {
      const res = await fetchBulkRegistry();
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, MIN_MODAL_DISPLAY_TIME - elapsed);
      if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
      setMessage({ type: 'success', text: `Загружено ${res.data.loaded?.length || 0} стандартов` });
      await loadRawList();
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, MIN_MODAL_DISPLAY_TIME - elapsed);
      if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
      setMessage({ type: 'error', text: 'Ошибка при массовой загрузке' });
    } finally {
      setBulkLoading(false);
      setDialogSpinning(false);
      setDialogOpen(false);
    }
  };

  const handleRunEnrichment = async () => {
    setEnrichLoading(true);
    setDialogOpen(true);
    setDialogTitle('Обогащение стандартов');
    setDialogText('Идёт обогащение данных...');
    setDialogSpinning(true);
    const startTime = Date.now();

    try {
      const res = await runEnrichment();
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, MIN_MODAL_DISPLAY_TIME - elapsed);
      if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
      setMessage({ type: 'success', text: `Обогащено ${res.data.processed?.length || 0} стандартов` });
      await loadEnrichedList();
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, MIN_MODAL_DISPLAY_TIME - elapsed);
      if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
      setMessage({ type: 'error', text: 'Ошибка при обогащении' });
    } finally {
      setEnrichLoading(false);
      setDialogSpinning(false);
      setDialogOpen(false);
    }
  };

  const handleSelectRaw = async (regNumber) => {
    try {
      const res = await getStandard(regNumber);
      setSelected({ ...res.data, type: 'raw' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка получения данных' });
    }
  };

  const handleSelectEnriched = async (regNumber) => {
    try {
      const res = await getEnrichedStandard(regNumber);
      setSelected({ ...res.data, type: 'enriched' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка получения обогащённых данных' });
    }
  };

  const renderStandardList = (items, onSelect) => (
    <div className="space-y-1">
      {items.map((item) => (
        <div
          key={item.reg_number}
          onClick={() => onSelect(item.reg_number)}
          className="cursor-pointer p-3 rounded-lg hover:bg-accent transition-colors"
        >
          <div className="font-medium text-sm line-clamp-2">{item.name}</div>
          <div className="text-xs text-muted-foreground mt-1">Рег. № {item.reg_number}</div>
        </div>
      ))}
      {items.length === 0 && (
        <div className="text-center text-muted-foreground text-sm py-8">Нет данных</div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xml"
          onChange={handleUpload}
          className="hidden"
        />
        <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={loading}>
          <Upload className="w-4 h-4 mr-2" />
          Загрузить XML
        </Button>
        <Button onClick={handleFetchBulk} disabled={bulkLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${bulkLoading ? 'animate-spin' : ''}`} />
          Загрузить все стандарты (bulk)
        </Button>
        <Button onClick={handleRunEnrichment} disabled={enrichLoading} variant="secondary">
          <Zap className="w-4 h-4 mr-2" />
          Обогатить все
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <Switch
            checked={viewMode === 'cards'}
            onCheckedChange={(checked) => setViewMode(checked ? 'cards' : 'tree')}
          />
          {viewMode === 'tree' ? (
            <TreePine className="w-4 h-4 text-muted-foreground" />
          ) : (
            <LayoutGrid className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`p-3 rounded-md text-sm ${
          message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-destructive/10 text-destructive border border-destructive/20'
        }`}>
          {message.text}
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left panel: list */}
        <div className="w-full md:w-72 shrink-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full mb-3">
              <TabsTrigger value="raw" className="flex-1">Сырые</TabsTrigger>
              <TabsTrigger value="enriched" className="flex-1">Обогащённые</TabsTrigger>
            </TabsList>
            <TabsContent value="raw" className="max-h-[70vh] overflow-auto">
              {renderStandardList(standards, handleSelectRaw)}
            </TabsContent>
            <TabsContent value="enriched" className="max-h-[70vh] overflow-auto">
              {renderStandardList(enrichedStandards, handleSelectEnriched)}
            </TabsContent>
          </Tabs>
        </div>

        {/* Right panel: viewer */}
        <div className="flex-1 min-h-[60vh]">
          {selected ? (
            <Card>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <span className="font-semibold text-sm">{selected.name}</span>
                  <span className="text-xs text-muted-foreground">Рег. № {selected.reg_number}</span>
                </div>
                {viewMode === 'tree' ? (
                  <StandardStructureViewer standard={selected} />
                ) : (
                  <StandardCardGraph standard={selected} />
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center">
                <Upload className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">Выберите стандарт из списка слева</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogText}</DialogDescription>
          </DialogHeader>
          {dialogSpinning && (
            <div className="flex justify-center py-4">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StandardsPage;
