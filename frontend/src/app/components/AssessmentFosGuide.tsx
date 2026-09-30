import { useI18n } from "@/context/I18nContext";

function RefTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="data-table min-w-full">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="align-top whitespace-pre-line">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AssessmentFosGuide() {
  const { t } = useI18n();

  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {t("fosGuide.kicker")}
        </p>
        <h2 className="text-2xl font-bold text-gray-900">
          {t("fosGuide.title")}
        </h2>
        <p className="text-sm text-gray-600 max-w-3xl">
          {t("fosGuide.lead")}
        </p>
      </header>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">{t("fosGuide.s1title")}</h3>
        <p className="text-sm text-gray-700 leading-relaxed">{t("fosGuide.s1p1")}</p>
        <p className="text-sm text-gray-700 leading-relaxed">{t("fosGuide.s1p2")}</p>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">{t("fosGuide.s2title")}</h3>
        <p className="text-sm text-gray-700 leading-relaxed">{t("fosGuide.s2p1")}</p>
        <RefTable
          headers={[t("fosGuide.hMethod"), t("fosGuide.hEvidence"), t("fosGuide.hMeasures"), t("fosGuide.hMistake")]}
          rows={[
            [t("fosGuide.mTest"), t("fosGuide.mTestE"), t("fosGuide.mTestM"), t("fosGuide.mTestX")],
            [t("fosGuide.mCase"), t("fosGuide.mCaseE"), t("fosGuide.mCaseM"), t("fosGuide.mCaseX")],
            [t("fosGuide.mPrac"), t("fosGuide.mPracE"), t("fosGuide.mPracM"), t("fosGuide.mPracX")],
            [t("fosGuide.mGame"), t("fosGuide.mGameE"), t("fosGuide.mGameM"), t("fosGuide.mGameX")],
            [t("fosGuide.mProj"), t("fosGuide.mProjE"), t("fosGuide.mProjM"), t("fosGuide.mProjX")],
          ]}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">{t("fosGuide.s3title")}</h3>
        <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700 leading-relaxed">
          <li>{t("fosGuide.s3l1")}</li>
          <li>{t("fosGuide.s3l2")}</li>
          <li>{t("fosGuide.s3l3")}</li>
          <li>{t("fosGuide.s3l4")}</li>
          <li>{t("fosGuide.s3l5")}</li>
        </ol>
        <p className="text-sm text-gray-700 leading-relaxed">{t("fosGuide.s3p")}</p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">{t("fosGuide.s4title")}</h3>
        <p className="text-sm text-gray-700 leading-relaxed">{t("fosGuide.s4p1")}</p>
        <p className="text-sm text-gray-700 leading-relaxed">{t("fosGuide.s4p2")}</p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">{t("fosGuide.s5title")}</h3>
        <RefTable
          headers={[t("scoring.hError"), t("fosGuide.hBreaks"), t("fosGuide.hDo")]}
          rows={[
            [t("fosGuide.f1n"), t("fosGuide.f1w"), t("fosGuide.f1d")],
            [t("fosGuide.f2n"), t("fosGuide.f2w"), t("fosGuide.f2d")],
            [t("fosGuide.f3n"), t("fosGuide.f3w"), t("fosGuide.f3d")],
            [t("fosGuide.f4n"), t("fosGuide.f4w"), t("fosGuide.f4d")],
          ]}
        />
      </section>
    </article>
  );
}
