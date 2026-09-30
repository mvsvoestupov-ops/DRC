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

export function ComponentScoringGuide() {
  const { t } = useI18n();

  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {t("scoring.kicker")}
        </p>
        <h2 className="text-2xl font-bold text-gray-900">
          {t("scoring.title")}
        </h2>
        <p className="text-sm text-gray-600 max-w-3xl">
          {t("scoring.lead")}
        </p>
      </header>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">{t("scoring.s1title")}</h3>
        <p className="text-sm text-gray-700 leading-relaxed">{t("scoring.s1p1")}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 space-y-2">
            <h4 className="text-sm font-semibold text-primary">{t("scoring.importanceTitle")}</h4>
            <p className="text-sm text-gray-700 leading-relaxed">{t("scoring.importanceText")}</p>
          </div>
          <div className="rounded-xl border border-purple-100 bg-purple-50/70 p-4 space-y-2">
            <h4 className="text-sm font-semibold text-purple-800">{t("scoring.volumeTitle")}</h4>
            <p className="text-sm text-gray-700 leading-relaxed">{t("scoring.volumeText")}</p>
          </div>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">{t("scoring.s1p2")}</p>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">{t("scoring.s2title")}</h3>
        <p className="text-sm text-gray-700 leading-relaxed">{t("scoring.s2p1")}</p>
        <RefTable
          headers={[t("scoring.hCriterion"), t("scoring.hQuestion"), t("scoring.hRaises")]}
          rows={[
            [t("scoring.ic1n"), t("scoring.ic1q"), t("scoring.ic1u")],
            [t("scoring.ic2n"), t("scoring.ic2q"), t("scoring.ic2u")],
            [t("scoring.ic3n"), t("scoring.ic3q"), t("scoring.ic3u")],
            [t("scoring.ic4n"), t("scoring.ic4q"), t("scoring.ic4u")],
            [t("scoring.ic5n"), t("scoring.ic5q"), t("scoring.ic5u")],
            [t("scoring.ic6n"), t("scoring.ic6q"), t("scoring.ic6u")],
          ]}
        />
        <RefTable
          headers={[t("scoring.hScore"), t("scoring.hImpLevel"), t("scoring.hGuide")]}
          rows={[
            ["1–2", t("scoring.ib12"), t("scoring.ib12h")],
            ["3–4", t("scoring.ib34"), t("scoring.ib34h")],
            ["5–6", t("scoring.ib56"), t("scoring.ib56h")],
            ["7–8", t("scoring.ib78"), t("scoring.ib78h")],
            ["9–10", t("scoring.ib910"), t("scoring.ib910h")],
          ]}
        />
        <p className="text-sm text-gray-700 leading-relaxed">{t("scoring.s2p2")}</p>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">{t("scoring.s3title")}</h3>
        <p className="text-sm text-gray-700 leading-relaxed">{t("scoring.s3p1")}</p>
        <RefTable
          headers={[t("scoring.hCriterion"), t("scoring.hQuestion"), t("scoring.hRaises")]}
          rows={[
            [t("scoring.vc1n"), t("scoring.vc1q"), t("scoring.vc1u")],
            [t("scoring.vc2n"), t("scoring.vc2q"), t("scoring.vc2u")],
            [t("scoring.vc3n"), t("scoring.vc3q"), t("scoring.vc3u")],
            [t("scoring.vc4n"), t("scoring.vc4q"), t("scoring.vc4u")],
            [t("scoring.vc5n"), t("scoring.vc5q"), t("scoring.vc5u")],
          ]}
        />
        <RefTable
          headers={[t("scoring.hScore"), t("scoring.hVolLevel"), t("scoring.hGuide")]}
          rows={[
            ["1–2", t("scoring.vb12"), t("scoring.vb12h")],
            ["3–4", t("scoring.vb34"), t("scoring.vb34h")],
            ["5–6", t("scoring.vb56"), t("scoring.vb56h")],
            ["7–8", t("scoring.vb78"), t("scoring.vb78h")],
            ["9–10", t("scoring.vb910"), t("scoring.vb910h")],
          ]}
        />
        <p className="text-sm text-gray-700 leading-relaxed">{t("scoring.s3p2")}</p>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">{t("scoring.s4title")}</h3>
        <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700 leading-relaxed">
          <li>{t("scoring.s4l1")}</li>
          <li>{t("scoring.s4l2")}</li>
          <li>{t("scoring.s4l3")}</li>
          <li>{t("scoring.s4l4")}</li>
          <li>{t("scoring.s4l5")}</li>
          <li>{t("scoring.s4l6")}</li>
        </ol>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">{t("scoring.s5title")}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
            <h4 className="text-sm font-semibold text-emerald-800 mb-2">{t("scoring.doesTitle")}</h4>
            <p className="text-sm text-gray-700 leading-relaxed">{t("scoring.doesText")}</p>
          </div>
          <div className="rounded-xl border border-rose-100 bg-rose-50/70 p-4">
            <h4 className="text-sm font-semibold text-rose-800 mb-2">{t("scoring.doesntTitle")}</h4>
            <p className="text-sm text-gray-700 leading-relaxed">{t("scoring.doesntText")}</p>
          </div>
        </div>
        <RefTable
          headers={[t("scoring.hError"), t("scoring.hWhy"), t("scoring.hFix")]}
          rows={[
            [t("scoring.e1n"), t("scoring.e1w"), t("scoring.e1f")],
            [t("scoring.e2n"), t("scoring.e2w"), t("scoring.e2f")],
            [t("scoring.e3n"), t("scoring.e3w"), t("scoring.e3f")],
            [t("scoring.e4n"), t("scoring.e4w"), t("scoring.e4f")],
            [t("scoring.e5n"), t("scoring.e5w"), t("scoring.e5f")],
            [t("scoring.e6n"), t("scoring.e6w"), t("scoring.e6f")],
          ]}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">{t("scoring.s6title")}</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          {t("scoring.s6p1a")} <span className="font-medium">{t("scoring.s6p1b")}</span>{" "}
          {t("scoring.s6p1c")} <span className="font-medium">{t("scoring.s6p1d")}</span> {t("scoring.s6p1e")}
        </p>
        <p className="text-sm text-gray-700 leading-relaxed">{t("scoring.s6p2")}</p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">{t("scoring.s7title")}</h3>
        <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700 leading-relaxed">
          <li>{t("scoring.s7l1")}</li>
          <li>{t("scoring.s7l2")}</li>
          <li>{t("scoring.s7l3")}</li>
          <li>{t("scoring.s7l4")}</li>
        </ul>
      </section>
    </article>
  );
}
