import { Link } from "react-router";
import { useI18n } from "@/context/I18nContext";

const STEPS = [1, 2, 3, 4, 5, 6, 7] as const;

function StepFigure({ step }: { step: (typeof STEPS)[number] }) {
  const { t } = useI18n();
  const src = `/methodology/step${step}.jpg`;
  return (
    <figure className="space-y-2">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-slate-50 shadow-sm">
        <img
          src={src}
          alt={t(`devGuide.s${step}figAlt`)}
          className="w-full h-auto object-cover object-top max-h-[420px]"
          loading="lazy"
          onError={(e) => {
            const el = e.currentTarget;
            el.style.display = "none";
            const fallback = el.parentElement?.querySelector("[data-fallback]");
            if (fallback instanceof HTMLElement) fallback.hidden = false;
          }}
        />
        <div data-fallback hidden className="p-4 md:p-6">
          <StepSvg step={step} />
        </div>
      </div>
      <figcaption className="text-xs text-gray-500 text-center px-2">
        {t(`devGuide.s${step}figCap`)}
      </figcaption>
    </figure>
  );
}

function StepSvg({ step }: { step: (typeof STEPS)[number] }) {
  const { t } = useI18n();
  return (
    <svg viewBox="0 0 720 360" className="w-full h-auto" role="img" aria-label={t(`devGuide.s${step}figAlt`)}>
      <rect width="720" height="360" rx="12" fill="#f8fafc" />
      <rect x="16" y="16" width="140" height="328" rx="10" fill="#fff" stroke="#e2e8f0" />
      {STEPS.map((n) => (
        <g key={n}>
          <rect
            x="28"
            y={28 + (n - 1) * 42}
            width="116"
            height="34"
            rx="8"
            fill={n === step ? "#1e40af" : "#f1f5f9"}
          />
          <text
            x="86"
            y={50 + (n - 1) * 42}
            textAnchor="middle"
            fontSize="12"
            fill={n === step ? "#fff" : "#64748b"}
            fontFamily="Segoe UI, sans-serif"
          >
            {n}. {t(`devGuide.nav${n}`)}
          </text>
        </g>
      ))}
      <rect x="172" y="16" width="532" height="328" rx="10" fill="#fff" stroke="#e2e8f0" />
      <text x="196" y="52" fontSize="18" fontWeight="700" fill="#0f172a" fontFamily="Segoe UI, sans-serif">
        {t(`devGuide.s${step}title`)}
      </text>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x="196" y={78 + i * 58} width="484" height="44" rx="8" fill="#f8fafc" stroke="#e2e8f0" />
          <text x="214" y={104 + i * 58} fontSize="13" fill="#475569" fontFamily="Segoe UI, sans-serif">
            {t(`devGuide.s${step}box${i + 1}`)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function OverviewFigure() {
  const { t } = useI18n();
  return (
    <figure className="space-y-2">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-slate-50 shadow-sm">
        <img
          src="/methodology/overview.jpg"
          alt={t("devGuide.overviewAlt")}
          className="w-full h-auto object-cover object-top max-h-[380px]"
          loading="eager"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            const fallback = e.currentTarget.parentElement?.querySelector("[data-fallback]");
            if (fallback instanceof HTMLElement) fallback.hidden = false;
          }}
        />
        <div data-fallback hidden className="p-4 overflow-x-auto">
          <div className="flex flex-wrap gap-2 justify-center min-w-[640px]">
            {STEPS.map((n, idx) => (
              <div key={n} className="flex items-center gap-2">
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-center min-w-[88px]">
                  <div className="text-xs font-bold text-primary">{n}</div>
                  <div className="text-[11px] text-gray-700 leading-tight">{t(`devGuide.nav${n}`)}</div>
                </div>
                {idx < STEPS.length - 1 ? <span className="text-gray-400">→</span> : null}
              </div>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="text-xs text-gray-500 text-center">{t("devGuide.overviewCap")}</figcaption>
    </figure>
  );
}

export function CompetenceDevelopmentGuide() {
  const { t } = useI18n();

  return (
    <article className="space-y-12">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t("devGuide.kicker")}</p>
        <h2 className="text-2xl font-bold text-gray-900">{t("devGuide.title")}</h2>
        <p className="text-sm text-gray-700 leading-relaxed max-w-3xl">{t("devGuide.lead")}</p>
        <p className="text-sm text-gray-600 leading-relaxed max-w-3xl">
          {t("devGuide.lead2")}{" "}
          <Link to="/new" className="text-primary font-medium hover:underline">
            {t("devGuide.openWizard")}
          </Link>
          .
        </p>
      </header>

      <OverviewFigure />

      <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 space-y-2">
        <h3 className="text-sm font-semibold text-amber-950">{t("devGuide.beforeTitle")}</h3>
        <ul className="list-disc pl-5 text-sm text-amber-950/90 space-y-1">
          <li>{t("devGuide.before1")}</li>
          <li>{t("devGuide.before2")}</li>
          <li>{t("devGuide.before3")}</li>
        </ul>
      </section>

      {STEPS.map((step) => (
        <section key={step} id={`dev-step-${step}`} className="space-y-4 scroll-mt-24">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-sm font-bold">
              {step}
            </span>
            <h3 className="text-xl font-semibold text-gray-900">{t(`devGuide.s${step}title`)}</h3>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{t(`devGuide.s${step}purpose`)}</p>
          <StepFigure step={step} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 space-y-2">
              <h4 className="text-sm font-semibold text-primary">{t("devGuide.whatTitle")}</h4>
              <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1.5">
                <li>{t(`devGuide.s${step}w1`)}</li>
                <li>{t(`devGuide.s${step}w2`)}</li>
                <li>{t(`devGuide.s${step}w3`)}</li>
              </ul>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 space-y-2">
              <h4 className="text-sm font-semibold text-emerald-800">{t("devGuide.howTitle")}</h4>
              <ol className="list-decimal pl-5 text-sm text-gray-700 space-y-1.5">
                <li>{t(`devGuide.s${step}h1`)}</li>
                <li>{t(`devGuide.s${step}h2`)}</li>
                <li>{t(`devGuide.s${step}h3`)}</li>
              </ol>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
            <h4 className="text-sm font-semibold text-gray-900">{t("devGuide.resultTitle")}</h4>
            <p className="text-sm text-gray-700 leading-relaxed">{t(`devGuide.s${step}result`)}</p>
            <p className="text-sm text-gray-600 leading-relaxed">
              <span className="font-medium text-gray-800">{t("devGuide.noteLabel")}: </span>
              {t(`devGuide.s${step}note`)}
            </p>
          </div>
        </section>
      ))}

      <section className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">{t("devGuide.afterTitle")}</h3>
        <p className="text-sm text-gray-700 leading-relaxed">{t("devGuide.afterText")}</p>
        <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
          <li>{t("devGuide.after1")}</li>
          <li>{t("devGuide.after2")}</li>
          <li>{t("devGuide.after3")}</li>
        </ul>
      </section>
    </article>
  );
}
