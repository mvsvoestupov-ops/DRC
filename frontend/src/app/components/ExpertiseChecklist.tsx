import { EXPERTISE_CRITERIA, criterionKey, type ExpertiseChecklist } from "@/lib/expertiseCriteria";
import { cn } from "@/lib/utils";
import { useI18n } from "@/context/I18nContext";

interface ExpertiseChecklistFormProps {
  value: ExpertiseChecklist;
  onChange: (next: ExpertiseChecklist) => void;
  disabled?: boolean;
}

export function ExpertiseChecklistForm({
  value,
  onChange,
  disabled = false,
}: ExpertiseChecklistFormProps) {
  const { t } = useI18n();

  const handleChange = (index: number, field: "value" | "comment", nextValue: string) => {
    const key = criterionKey(index);
    onChange({
      ...value,
      [key]: { ...value[key], [field]: nextValue },
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="data-table min-w-full">
        <thead>
          <tr>
            <th>{t("review.criterion")}</th>
            <th className="w-32">{t("review.yesNo")}</th>
            <th>{t("review.comment")}</th>
          </tr>
        </thead>
        <tbody>
          {EXPERTISE_CRITERIA.map((_, index) => {
            const row = value[criterionKey(index)] || {};
            const commentRequired = row.value === "нет";
            const commentMissing = commentRequired && !(row.comment || "").trim();
            return (
              <tr key={criterionKey(index)} className="hover:bg-transparent">
                <td className="align-middle">{t(`review.c${index}`)}</td>
                <td className="align-middle">
                  <select
                    className="form-control py-1.5"
                    value={row.value || ""}
                    disabled={disabled}
                    onChange={(e) => handleChange(index, "value", e.target.value)}
                  >
                    <option value="">—</option>
                    <option value="да">{t("common.yes")}</option>
                    <option value="нет">{t("common.no")}</option>
                  </select>
                </td>
                <td className="align-middle">
                  <input
                    className={cn(
                      "form-control py-1.5",
                      commentMissing && "border-red-400 focus:ring-red-400"
                    )}
                    value={row.comment || ""}
                    disabled={disabled}
                    required={commentRequired}
                    aria-required={commentRequired}
                    placeholder={commentRequired ? t("review.commentRequired") : t("review.commentOptional")}
                    onChange={(e) => handleChange(index, "comment", e.target.value)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
