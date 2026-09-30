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

function NormItem({ title, take, skip }: { title: string; take: string; skip: string }) {
  const { t } = useI18n();
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 space-y-2">
      <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
      <p className="text-sm text-gray-700">
        <span className="font-medium text-emerald-700">{t("passport.take")}</span>
        {take}
      </p>
      <p className="text-sm text-gray-700">
        <span className="font-medium text-rose-700">{t("passport.skip")}</span>
        {skip}
      </p>
    </div>
  );
}

export function VolumeModelPassport() {
  const { t } = useI18n();
  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {t("passport.kicker")}
        </p>
        <h2 className="text-2xl font-bold text-gray-900">
          {t("passport.title")}
        </h2>
        <p className="text-sm text-gray-600 max-w-3xl">
          {t("passport.lead")}
        </p>
      </header>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">{t("passport.requisites")}</h3>
        <RefTable
          headers={[t("passport.hParam"), t("passport.hValue")]}
          rows={[
            [t("passport.rId"), "МОВК-ЗЕ"],
            [t("passport.rVer"), "1.0-draft"],
            [t("passport.rUnit"), t("passport.rUnitV")],
            [t("passport.rForm"), t("passport.rFormV")],
            [t("passport.rAnchor"), t("passport.rAnchorV")],
            [t("passport.rHours"), t("passport.rHoursV")],
            [t("passport.rScope"), t("passport.rScopeV")],
            [t("passport.rStatus"), t("passport.rStatusV")],
          ]}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">{t("passport.legalTitle")}</h3>
        <p className="text-sm text-gray-700 leading-relaxed">{t("passport.legalP1")}</p>
        <p className="text-sm text-gray-700 leading-relaxed">{t("passport.legalP2")}</p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">{t("passport.s1title")}</h3>
        <p className="text-sm text-gray-700 leading-relaxed">{t("passport.s1p1")}</p>
        <p className="text-sm text-gray-700 leading-relaxed">{t("passport.s1p2")}</p>
        <p className="text-sm text-gray-700 leading-relaxed">{t("passport.s1p3")}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
            <h4 className="text-sm font-semibold text-emerald-800 mb-2">{t("passport.doesTitle")}</h4>
            <p className="text-sm text-gray-700 leading-relaxed">{t("passport.doesText")}</p>
          </div>
          <div className="rounded-xl border border-rose-100 bg-rose-50/70 p-4">
            <h4 className="text-sm font-semibold text-rose-800 mb-2">{t("passport.doesntTitle")}</h4>
            <p className="text-sm text-gray-700 leading-relaxed">{t("passport.doesntText")}</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">{t("passport.s2title")}</h3>
        <p className="text-sm text-gray-700 leading-relaxed">{t("passport.s2p")}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <NormItem title={t("passport.n1t")} take={t("passport.n1take")} skip={t("passport.n1skip")} />
          <NormItem title={t("passport.n2t")} take={t("passport.n2take")} skip={t("passport.n2skip")} />
          <NormItem title={t("passport.n3t")} take={t("passport.n3take")} skip={t("passport.n3skip")} />
          <NormItem title={t("passport.n4t")} take={t("passport.n4take")} skip={t("passport.n4skip")} />
          <NormItem title={t("passport.n5t")} take={t("passport.n5take")} skip={t("passport.n5skip")} />
          <NormItem title={t("passport.n6t")} take={t("passport.n6take")} skip={t("passport.n6skip")} />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">{t("passport.s3title")}</h3>
        <p className="text-sm text-gray-700 leading-relaxed">{t("passport.s3p")}</p>
        <h4 className="text-base font-semibold text-gray-900">{t("passport.s31")}</h4>
        <p className="text-sm text-gray-700 leading-relaxed">{t("passport.s31p")}</p>
        <div className="rounded-xl border border-gray-200 bg-slate-50 p-4 font-mono text-sm text-gray-800 space-y-1">
          <div>S = 1,0 · n<sub>A</sub><sup>0,75</sup> + 1,7 · n<sub>B</sub><sup>0,75</sup> + 2,4 · n<sub>C</sub><sup>0,75</sup></div>
          <div>V = S · m(L) · Ω(n<sub>TF</sub>)</div>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">{t("passport.s31p2")}</p>
        <RefTable
          headers={[t("passport.hType"), t("passport.hCode"), t("passport.hWeight")]}
          rows={[
            [t("passport.tA"), "A", "1,0"],
            [t("passport.tB"), "B", "1,7"],
            [t("passport.tC"), "C", "2,4"],
          ]}
        />

        <h4 className="text-base font-semibold text-gray-900">{t("passport.s32")}</h4>
        <RefTable
          headers={[t("passport.hQl"), t("passport.hML"), t("passport.hMeaning")]}
          rows={[
            ["1–2", "0,85", t("passport.m12")],
            ["3–4", "1,00", t("passport.m34")],
            ["5–6", "1,15", t("passport.m56")],
            ["7–8", "1,30", t("passport.m78")],
            ["9", "1,40", t("passport.m9")],
          ]}
        />
        <div className="rounded-xl border border-gray-200 bg-slate-50 p-4 font-mono text-sm text-gray-800">
          Ω = 1 − 0,15 · min(1; (n<sub>TF</sub> − 1) / 3)
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">{t("passport.s32p")}</p>

        <h4 className="text-base font-semibold text-gray-900">{t("passport.s33")}</h4>
        <div className="rounded-xl border border-gray-200 bg-slate-50 p-4 font-mono text-sm text-gray-800">
          R<sub>сырой</sub> = 0,10 · V
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">{t("passport.s33p")}</p>
        <RefTable
          headers={[t("passport.hEdu"), t("passport.hCorridor"), t("passport.hRead")]}
          rows={[
            [t("passport.eTrain"), t("passport.eTrainC"), t("passport.eTrainR")],
            [t("passport.eAdd"), t("passport.eAddC"), t("passport.eAddR")],
            [t("passport.eSpo"), t("passport.eSpoC"), t("passport.eSpoR")],
            [t("passport.eBach"), t("passport.eBachC"), t("passport.eBachR")],
            [t("passport.eMag"), t("passport.eMagC"), t("passport.eMagR")],
            [t("passport.eHi"), t("passport.eHiC"), t("passport.eHiR")],
          ]}
        />
        <p className="text-sm text-gray-700 leading-relaxed">{t("passport.s33p2")}</p>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">{t("passport.s4title")}</h3>
        <p className="text-sm text-gray-700 leading-relaxed">{t("passport.s4p")}</p>
        <h4 className="text-base font-semibold text-gray-900">{t("passport.s41")}</h4>
        <p className="text-sm text-gray-600">{t("passport.s41in")}</p>
        <RefTable
          headers={[t("passport.hStep"), t("passport.hVal"), t("passport.hNote")]}
          rows={[
            [t("passport.a1s"), "8 / 8 / 4", t("passport.a1n")],
            [t("passport.a2s"), "4,76 / 4,76 / 2,83", t("passport.a2n")],
            [t("passport.a3s"), "19,63", t("passport.a3n")],
            [t("passport.a4s"), "1,00", t("passport.a4n")],
            [t("passport.a5s"), "1,00", t("passport.a5n")],
            [t("passport.a6s"), "1,96", t("passport.a6n")],
            [t("passport.a7s"), "2,0 з.е.", t("passport.a7n")],
            [t("passport.a8s"), "1,5 – 2,0 – 2,5 з.е.", t("passport.a8n")],
          ]}
        />
        <h4 className="text-base font-semibold text-gray-900">{t("passport.s42")}</h4>
        <p className="text-sm text-gray-600">{t("passport.s42in")}</p>
        <RefTable
          headers={[t("passport.hStep"), t("passport.hVal"), t("passport.hNote")]}
          rows={[
            [t("passport.a1s"), "20 / 18 / 10", t("passport.a1n")],
            [t("passport.a2s"), "9,46 / 8,74 / 5,62", t("passport.a2n")],
            [t("passport.a3s"), "37,81", t("passport.a3n")],
            [t("passport.a4s"), "1,00", t("passport.b4n")],
            [t("passport.a5s"), "0,95", t("passport.b5n")],
            [t("passport.a6s"), "3,59", t("passport.a6n")],
            [t("passport.a7s"), "3,5 з.е.", t("passport.b7n")],
            [t("passport.a8s"), "2,5 – 3,5 – 4,5 з.е.", t("passport.b8n")],
          ]}
        />
        <p className="text-sm text-gray-700 leading-relaxed">{t("passport.s42p")}</p>
        <h4 className="text-base font-semibold text-gray-900">{t("passport.s43")}</h4>
        <p className="text-sm text-gray-600">{t("passport.s43in")}</p>
        <RefTable
          headers={[t("passport.hStep"), t("passport.hVal"), t("passport.hNote")]}
          rows={[
            [t("passport.a1s"), "4 / 3 / 2", t("passport.a1n")],
            [t("passport.a2s"), "2,83 / 2,28 / 1,68", t("passport.a2n")],
            [t("passport.a3s"), "10,74", t("passport.a3n")],
            [t("passport.a4s"), "0,85", t("passport.c4n")],
            [t("passport.a5s"), "1,00", t("passport.c5n")],
            [t("passport.a6s"), "0,91", t("passport.a6n")],
            [t("passport.a7s"), "1,0 з.е.", t("passport.c7n")],
            [t("passport.a8s"), "1,0 – 1,0 – 1,5 з.е.", t("passport.c8n")],
          ]}
        />
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">{t("passport.s5title")}</h3>
        <p className="text-sm text-gray-700 leading-relaxed">{t("passport.s5p")}</p>
        <RefTable
          headers={[t("passport.hStage"), t("passport.hWho"), t("passport.hFixed"), t("passport.hBasis")]}
          rows={[
            [t("passport.w1s"), t("passport.w1w"), t("passport.w1f"), t("passport.w1b")],
            [t("passport.w2s"), t("passport.w2w"), t("passport.w2f"), t("passport.w2b")],
            [t("passport.w3s"), t("passport.w3w"), t("passport.w3f"), t("passport.w3b")],
            [t("passport.w4s"), t("passport.w4w"), t("passport.w4f"), t("passport.w4b")],
          ]}
        />
        <p className="text-sm text-gray-700 leading-relaxed">{t("passport.s5p2")}</p>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">{t("passport.s6title")}</h3>
        <RefTable
          headers={[t("passport.hField"), t("passport.hExample"), t("passport.hCheck")]}
          rows={[
            [t("passport.p1f"), t("passport.p1e"), t("passport.p1c")],
            [t("passport.p2f"), t("passport.p2e"), t("passport.p2c")],
            [t("passport.p3f"), t("passport.p3e"), t("passport.p3c")],
            [t("passport.p4f"), t("passport.p4e"), t("passport.p4c")],
            [t("passport.p5f"), t("passport.p5e"), t("passport.p5c")],
            [t("passport.p6f"), t("passport.p6e"), t("passport.p6c")],
            [t("passport.p7f"), t("passport.p7e"), t("passport.p7c")],
          ]}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">{t("passport.s7title")}</h3>
        <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700 leading-relaxed">
          <li>{t("passport.s7l1")}</li>
          <li>{t("passport.s7l2")}</li>
          <li>{t("passport.s7l3")}</li>
          <li>{t("passport.s7l4")}</li>
          <li>{t("passport.s7l5")}</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">{t("passport.s8title")}</h3>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 leading-relaxed">
          {t("passport.s8text")}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">{t("passport.s9title")}</h3>
        <p className="text-sm text-gray-700 leading-relaxed">{t("passport.s9p")}</p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">{t("passport.s10title")}</h3>
        <p className="text-sm text-gray-700 leading-relaxed">{t("passport.s10p1")}</p>
        <p className="text-sm text-gray-700 leading-relaxed">{t("passport.s10p2")}</p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">{t("passport.closeTitle")}</h3>
        <p className="text-sm text-gray-700 leading-relaxed">{t("passport.closeP1")}</p>
        <p className="text-sm text-gray-700 leading-relaxed">{t("passport.closeP2")}</p>
      </section>
    </article>
  );
}
