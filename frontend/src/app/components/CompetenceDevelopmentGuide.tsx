import type { ReactNode, SyntheticEvent } from "react";
import { Link } from "react-router";
import { useI18n } from "@/context/I18nContext";

const STEPS = [1, 2, 3, 4, 5, 6, 7] as const;

/** Скриншоты конструктора: png в /methodology-media, иначе SVG-схема. */
function mediaSrc(file: string) {
  return `/methodology-media/${file}`;
}

function onMediaError(e: SyntheticEvent<HTMLImageElement>) {
  const el = e.currentTarget;
  el.style.display = "none";
  const fallback = el.parentElement?.querySelector("[data-fallback]");
  if (fallback instanceof HTMLElement) fallback.hidden = false;
}

function GuideFigure({
  file,
  alt,
  caption,
  eager,
  fallback,
  skipImage,
}: {
  file: string;
  alt: string;
  caption: string;
  eager?: boolean;
  fallback: ReactNode;
  /** Не показывать устаревший PNG — сразу схема. */
  skipImage?: boolean;
}) {
  return (
    <figure className="space-y-2 w-full">
      <div className="rounded-xl border border-gray-200 bg-slate-100/80 shadow-sm">
        {!skipImage ? (
          <img
            src={mediaSrc(file)}
            alt={alt}
            className="block w-full h-auto object-contain"
            loading={eager ? "eager" : "lazy"}
            onError={onMediaError}
          />
        ) : null}
        <div data-fallback hidden={!skipImage} className="p-4 md:p-6">
          {fallback}
        </div>
      </div>
      <figcaption className="text-xs text-gray-500 text-center px-2">{caption}</figcaption>
    </figure>
  );
}

function StepFigure({ step }: { step: (typeof STEPS)[number] }) {
  const { t } = useI18n();
  return (
    <GuideFigure
      file={`step${step}.png`}
      alt={t(`devGuide.s${step}figAlt`)}
      caption={t(`devGuide.s${step}figCap`)}
      // step6.png ещё показывает старый конструктор (таблица методов) — схема актуальнее
      skipImage={step === 6}
      fallback={step === 6 ? <Step6Svg /> : <StepSvg step={step} />}
    />
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

/** Схема актуального конструктора ОС: Теория | Практика. */
function Step6Svg() {
  const { t } = useI18n();
  return (
    <svg viewBox="0 0 720 400" className="w-full h-auto" role="img" aria-label={t("devGuide.s6figAlt")}>
      <rect width="720" height="400" rx="12" fill="#f8fafc" />
      <text x="28" y="36" fontSize="16" fontWeight="700" fill="#0f172a" fontFamily="Segoe UI, sans-serif">
        {t("devGuide.s6title")}
      </text>
      <text x="28" y="58" fontSize="12" fill="#64748b" fontFamily="Segoe UI, sans-serif">
        {t("devGuide.s6box1")}
      </text>

      <rect x="28" y="78" width="320" height="140" rx="12" fill="#eff6ff" stroke="#bfdbfe" />
      <text x="48" y="108" fontSize="14" fontWeight="700" fill="#1e40af" fontFamily="Segoe UI, sans-serif">
        {t("assessmentV2.theoryTitle")}
      </text>
      <text x="48" y="136" fontSize="12" fill="#334155" fontFamily="Segoe UI, sans-serif">
        {t("devGuide.s6box2")}
      </text>
      <text x="48" y="162" fontSize="12" fill="#64748b" fontFamily="Segoe UI, sans-serif">
        A → тест · содержание · критерии
      </text>
      <rect x="48" y="180" width="120" height="22" rx="6" fill="#1e40af" />
      <text x="108" y="195" textAnchor="middle" fontSize="11" fill="#fff" fontFamily="Segoe UI, sans-serif">
        {t("assessmentV2.editor")}
      </text>

      <rect x="372" y="78" width="320" height="140" rx="12" fill="#ecfdf5" stroke="#a7f3d0" />
      <text x="392" y="108" fontSize="14" fontWeight="700" fill="#047857" fontFamily="Segoe UI, sans-serif">
        {t("assessmentV2.practiceTitleShort")}
      </text>
      <text x="392" y="136" fontSize="12" fill="#334155" fontFamily="Segoe UI, sans-serif">
        {t("devGuide.s6box3")}
      </text>
      <text x="392" y="162" fontSize="12" fill="#64748b" fontFamily="Segoe UI, sans-serif">
        {t("devGuide.s6box4")}
      </text>
      <rect x="392" y="180" width="120" height="22" rx="6" fill="#047857" />
      <text x="452" y="195" textAnchor="middle" fontSize="11" fill="#fff" fontFamily="Segoe UI, sans-serif">
        {t("assessmentV2.editor")}
      </text>

      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <circle cx="48" cy={260 + i * 32} r="12" fill="#1e40af" />
          <text
            x="48"
            y={264 + i * 32}
            textAnchor="middle"
            fontSize="11"
            fill="#fff"
            fontFamily="Segoe UI, sans-serif"
          >
            {i + 1}
          </text>
          <text x="72" y={265 + i * 32} fontSize="13" fill="#334155" fontFamily="Segoe UI, sans-serif">
            {t(`devGuide.s6p${i + 1}title`)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function OverviewFallback() {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap gap-2 justify-center">
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
  );
}

function OverviewFigure() {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
        <OverviewFallback />
      </div>
      <GuideFigure
        file="overview.png"
        alt={t("devGuide.overviewAlt")}
        caption={t("devGuide.overviewCap")}
        eager
        fallback={<span className="text-sm text-gray-500">{t("devGuide.overviewAlt")}</span>}
      />
    </div>
  );
}

function Step6Body() {
  const { t } = useI18n();
  const phases = [1, 2, 3, 4] as const;

  return (
    <>
      <p className="text-sm text-gray-700 leading-relaxed">{t("devGuide.s6purpose")}</p>
      <StepFigure step={6} />

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-900">{t("devGuide.s6flowTitle")}</h4>
        <ol className="space-y-3">
          {phases.map((n) => (
            <li
              key={n}
              className="rounded-xl border border-gray-200 bg-white p-4 flex gap-3 items-start"
            >
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">
                {n}
              </span>
              <div className="space-y-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900">{t(`devGuide.s6p${n}title`)}</div>
                <p className="text-sm text-gray-700 leading-relaxed">{t(`devGuide.s6p${n}body`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 space-y-2">
          <h4 className="text-sm font-semibold text-primary">{t("devGuide.whatTitle")}</h4>
          <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1.5">
            <li>{t("devGuide.s6w1")}</li>
            <li>{t("devGuide.s6w2")}</li>
            <li>{t("devGuide.s6w3")}</li>
            <li>{t("devGuide.s6w4")}</li>
          </ul>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 space-y-2">
          <h4 className="text-sm font-semibold text-emerald-800">{t("devGuide.howTitle")}</h4>
          <ol className="list-decimal pl-5 text-sm text-gray-700 space-y-1.5">
            <li>{t("devGuide.s6h1")}</li>
            <li>{t("devGuide.s6h2")}</li>
            <li>{t("devGuide.s6h3")}</li>
            <li>{t("devGuide.s6h4")}</li>
            <li>{t("devGuide.s6h5")}</li>
          </ol>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
        <h4 className="text-sm font-semibold text-gray-900">{t("devGuide.resultTitle")}</h4>
        <p className="text-sm text-gray-700 leading-relaxed">{t("devGuide.s6result")}</p>
        <p className="text-sm text-gray-600 leading-relaxed">
          <span className="font-medium text-gray-800">{t("devGuide.noteLabel")}: </span>
          {t("devGuide.s6note")}
        </p>
        <p className="text-sm pt-1">
          <Link to="/methodology/fos" className="text-primary font-medium hover:underline">
            {t("devGuide.s6fosLink")}
          </Link>
        </p>
      </div>
    </>
  );
}

function GenericStepBody({ step }: { step: Exclude<(typeof STEPS)[number], 6> }) {
  const { t } = useI18n();
  return (
    <>
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
    </>
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
          {step === 6 ? <Step6Body /> : <GenericStepBody step={step} />}
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
