import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/app/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import {
  CATALOG_KIND_BADGE,
  type CatalogItemKind,
  type DisciplineCatalogItem,
} from "@/lib/disciplineCatalog";
import { cn } from "@/lib/utils";
import { useI18n } from "@/context/I18nContext";

const KIND_FILTERS: Array<{ id: "all" | CatalogItemKind; key: string }> = [
  { id: "all", key: "discipline.all" },
  { id: "discipline", key: "discipline.disciplines" },
  { id: "module", key: "discipline.modules" },
  { id: "practice", key: "discipline.practices" },
];

const KIND_BADGE_CLASS: Record<CatalogItemKind, string> = {
  discipline: "bg-blue-50 text-primary border-blue-100",
  module: "bg-purple-50 text-purple-700 border-purple-100",
  practice: "bg-green-50 text-green-700 border-green-100",
};

type DisciplineCatalogPickerProps = {
  value: string;
  items: DisciplineCatalogItem[];
  extraNames?: string[];
  excludeNames?: string[];
  onChange: (value: string) => void;
};

export function DisciplineCatalogPicker({
  value,
  items,
  extraNames = [],
  excludeNames = [],
  onChange,
}: DisciplineCatalogPickerProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | CatalogItemKind>("all");

  const excluded = useMemo(
    () => new Set(excludeNames.map((name) => name.trim().toLowerCase()).filter(Boolean)),
    [excludeNames],
  );
  const catalogNames = useMemo(() => new Set(items.map((item) => item.name)), [items]);
  const visibleItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.name === value || !excluded.has(item.name.trim().toLowerCase()),
      ),
    [excluded, items, value],
  );
  const customNames = useMemo(
    () =>
      [...new Set(extraNames.map((name) => name.trim()).filter((name) => name.length >= 3))].filter(
        (name) =>
          !catalogNames.has(name) &&
          (name === value || !excluded.has(name.toLowerCase())),
      ),
    [catalogNames, excluded, extraNames, value],
  );

  const grouped = useMemo(() => {
    const source =
      kindFilter === "all" ? visibleItems : visibleItems.filter((item) => item.kind === kindFilter);
    const buckets: Record<CatalogItemKind, DisciplineCatalogItem[]> = {
      discipline: [],
      module: [],
      practice: [],
    };
    source.forEach((item) => buckets[item.kind].push(item));
    return buckets;
  }, [kindFilter, visibleItems]);

  const filteredCustom = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customNames.filter((name) => !q || name.toLowerCase().includes(q));
  }, [customNames, query]);

  const canAddCustom = useMemo(() => {
    const q = query.trim();
    if (q.length < 3) return false;
    const lower = q.toLowerCase();
    const source =
      kindFilter === "all" ? visibleItems : visibleItems.filter((item) => item.kind === kindFilter);
    if (source.some((item) => item.name.toLowerCase().includes(lower))) return false;
    if (excluded.has(lower)) return false;
    return !customNames.some((name) => name.toLowerCase() === lower);
  }, [customNames, excluded, kindFilter, query, visibleItems]);

  const selectValue = (next: string) => {
    const name = next.trim();
    if (!name) return;
    if (excluded.has(name.toLowerCase()) && name !== value) return;
    onChange(name);
    setOpen(false);
    setQuery("");
    setKindFilter("all");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery("");
          setKindFilter("all");
        }
      }}
    >
      <div className="relative">
        <PopoverTrigger asChild>
          <button
            type="button"
            className="form-control flex items-center justify-between gap-2 text-left min-h-[42px] pr-16"
            aria-expanded={open}
            aria-haspopup="listbox"
          >
            <span className={cn("truncate", value ? "text-gray-900" : "text-gray-400")}>
              {value || "Выберите из справочника или введите название"}
            </span>
            <ChevronsUpDown className="w-4 h-4 text-gray-400 shrink-0" />
          </button>
        </PopoverTrigger>
        {value ? (
          <button
            type="button"
            className="absolute right-8 top-1/2 -translate-y-1/2 z-10 p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            aria-label="Очистить"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onChange("");
            }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[360px]"
      >
        <div className="px-3 pt-3 pb-2 border-b border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-2">
            {t("discipline.catalog")} · {items.length}
          </p>
          <div className="flex flex-wrap gap-1">
            {KIND_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setKindFilter(filter.id)}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                  kindFilter === filter.id
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50",
                )}
              >
                {t(filter.key)}
              </button>
            ))}
          </div>
        </div>
        <Command shouldFilter>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Начните вводить название…"
          />
          <CommandList className="max-h-64">
            <CommandEmpty>
              {canAddCustom ? "Ничего не найдено — можно добавить своё название" : "Ничего не найдено"}
            </CommandEmpty>
            {canAddCustom ? (
              <CommandGroup heading="Своё название">
                <CommandItem value={query.trim()} onSelect={() => selectValue(query)}>
                  <Plus className="w-4 h-4 text-primary" />
                  <span>
                    Использовать «{query.trim()}»
                  </span>
                </CommandItem>
              </CommandGroup>
            ) : null}
            {filteredCustom.length > 0 ? (
              <CommandGroup heading="Ранее введённые">
                {filteredCustom.map((name) => (
                  <CommandItem key={`extra-${name}`} value={name} onSelect={() => selectValue(name)}>
                    <Check className={cn("w-4 h-4", value === name ? "opacity-100" : "opacity-0")} />
                    <span className="flex-1 leading-snug">{name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {(["discipline", "module", "practice"] as const).map((kind) =>
              grouped[kind].length ? (
                <CommandGroup key={kind} heading={t(
                  kind === "discipline"
                    ? "discipline.disciplines"
                    : kind === "module"
                      ? "discipline.modules"
                      : "discipline.practices",
                )}>
                  {grouped[kind].map((item) => (
                    <CommandItem
                      key={item.name}
                      value={item.name}
                      onSelect={() => selectValue(item.name)}
                    >
                      <Check className={cn("w-4 h-4 shrink-0", value === item.name ? "opacity-100" : "opacity-0")} />
                      <span className="flex-1 leading-snug">{item.name}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                          KIND_BADGE_CLASS[item.kind],
                        )}
                      >
                        {CATALOG_KIND_BADGE[item.kind]}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null,
            )}
          </CommandList>
        </Command>
        <p className="px-3 py-2 text-[11px] text-gray-400 border-t border-gray-100">
          Можно выбрать из списка или ввести название, которого нет в справочнике
        </p>
      </PopoverContent>
    </Popover>
  );
}
