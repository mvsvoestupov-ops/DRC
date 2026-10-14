import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/context/I18nContext";
import {
  RESOURCE_GROUPS,
  type CompetenceResources,
  type ResourceGroupId,
} from "@/lib/competenceResources";

const GROUP_META: Record<
  ResourceGroupId,
  { titleKey: string; badgeClass: string }
> = {
  A: {
    titleKey: "wizard.resourcesForKnowledge",
    badgeClass: "bg-blue-100 text-primary",
  },
  B: {
    titleKey: "wizard.resourcesForSkills",
    badgeClass: "bg-green-100 text-green-700",
  },
  C: {
    titleKey: "wizard.resourcesForPractice",
    badgeClass: "bg-purple-100 text-purple-700",
  },
};

type Props = {
  value: CompetenceResources;
  onChange: (next: CompetenceResources) => void;
};

export function ResourcesMtoEditor({ value, onChange }: Props) {
  const { t } = useI18n();

  const updateGroup = (group: ResourceGroupId, items: string[]) => {
    onChange({ ...value, [group]: items.length ? items : [""] });
  };

  return (
    <div className="space-y-4">
      {RESOURCE_GROUPS.map((group) => {
        const meta = GROUP_META[group];
        const items = value[group].length ? value[group] : [""];
        return (
          <section key={group} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-8 h-8 rounded flex items-center justify-center text-sm font-bold ${meta.badgeClass}`}
              >
                {group}
              </span>
              <h3 className="text-sm font-semibold text-gray-900">{t(meta.titleKey)}</h3>
            </div>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={`${group}-${index}`} className="flex gap-2">
                  <Input
                    value={item}
                    placeholder={t("wizard.resourcePlaceholder")}
                    onChange={(event) =>
                      updateGroup(
                        group,
                        items.map((row, i) => (i === index ? event.target.value : row)),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0 text-red-600 border-gray-300 hover:bg-red-50"
                    onClick={() =>
                      updateGroup(
                        group,
                        items.filter((_, i) => i !== index),
                      )
                    }
                    aria-label={t("wizard.removeResource")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="gap-2 border-dashed"
                onClick={() => updateGroup(group, [...items, ""])}
              >
                <Plus className="w-4 h-4" />
                {t("wizard.addResource")}
              </Button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
