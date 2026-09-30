import { useEffect, type ReactNode } from "react";
import { Link } from "react-router";
import {
  BookOpen,
  ClipboardCheck,
  FolderOpen,
  LogIn,
  Search,
  Shield,
  UserPlus,
  Users,
} from "lucide-react";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import { useI18n } from "@/context/I18nContext";

function GuideStep({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-primary">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

export function UserGuidePage() {
  const { t } = useI18n();

  const SECTIONS = [
    {
      id: "start",
      icon: Search,
      title: t("guide.tocStart"),
      description: t("guide.tocStartDesc"),
    },
    {
      id: "account",
      icon: LogIn,
      title: t("guide.tocAccount"),
      description: t("guide.tocAccountDesc"),
    },
    {
      id: "wizard",
      icon: UserPlus,
      title: t("guide.tocWizard"),
      description: t("guide.tocWizardDesc"),
    },
    {
      id: "projects",
      icon: FolderOpen,
      title: t("guide.tocProjects"),
      description: t("guide.tocProjectsDesc"),
    },
    {
      id: "group",
      icon: Users,
      title: t("guide.tocGroup"),
      description: t("guide.tocGroupDesc"),
    },
    {
      id: "review",
      icon: ClipboardCheck,
      title: t("guide.tocReview"),
      description: t("guide.tocReviewDesc"),
    },
    {
      id: "staff",
      icon: Shield,
      title: t("guide.tocStaff"),
      description: t("guide.tocStaffDesc"),
    },
  ];

  const WIZARD_ROWS = [
    { step: t("guide.w1"), fill: t("guide.w1f"), required: t("guide.w1r") },
    { step: t("guide.w2"), fill: t("guide.w2f"), required: t("guide.w2r") },
    { step: t("guide.w3"), fill: t("guide.w3f"), required: t("guide.w3r") },
    { step: t("guide.w4"), fill: t("guide.w4f"), required: t("guide.w4r") },
    { step: t("guide.w5"), fill: t("guide.w5f"), required: t("guide.w5r") },
    { step: t("guide.w6"), fill: t("guide.w6f"), required: t("guide.w6r") },
    { step: t("guide.w7"), fill: t("guide.w7f"), required: t("guide.w7r") },
    { step: t("guide.w8"), fill: t("guide.w8f"), required: t("guide.w8r") },
    { step: t("guide.w9"), fill: t("guide.w9f"), required: t("guide.w9r") },
    { step: t("guide.w10"), fill: t("guide.w10f"), required: t("guide.w10r") },
  ];

  useEffect(() => {
    const id = window.location.hash.replace("#", "");
    if (!id) return;
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  return (
    <PageShell>
      <PageHeader title={t("guide.title")} description={t("guide.lead")} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
        {SECTIONS.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="block surface p-5 hover:shadow-md hover:border-primary/40 transition-all"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-primary flex items-center justify-center shrink-0">
                <item.icon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-1">{item.title}</h2>
                <p className="text-base text-gray-500">{item.description}</p>
              </div>
            </div>
          </a>
        ))}
      </div>

      <article className="space-y-16">
        <section id="start" className="scroll-mt-28 space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">{t("guide.tocStart")}</h2>
          <p className="text-base text-gray-700 leading-relaxed max-w-4xl">
            {t("guide.startLead")}{" "}
            <Link to="/about" className="text-primary font-medium hover:underline">
              {t("about.title")}
            </Link>
            {t("guide.startLeadMid")}{" "}
            <Link to="/methodology" className="text-primary font-medium hover:underline">
              {t("guide.methodology")}
            </Link>
            .
          </p>
          <div className="surface p-6 md:p-8 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">{t("guide.homeTitle")}</h3>
            <ul className="space-y-2 text-base text-gray-700 leading-relaxed">
              <li>{t("guide.homeL1")}</li>
              <li>{t("guide.homeL2")}</li>
              <li>
                {t("guide.homeL3a")}{" "}
                <Link to="/search" className="text-primary font-medium hover:underline">
                  {t("guide.homeL3b")}
                </Link>{" "}
                {t("guide.homeL3c")}
              </li>
            </ul>
          </div>
          <div className="surface p-6 md:p-8 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">{t("guide.searchTitle")}</h3>
            <ol className="space-y-3 text-base text-gray-700 leading-relaxed">
              <GuideStep n={1}>{t("guide.searchS1")}</GuideStep>
              <GuideStep n={2}>{t("guide.searchS2")}</GuideStep>
              <GuideStep n={3}>
                {t("guide.searchS3a")} <strong>{t("guide.searchS3b")}</strong> {t("guide.searchS3c")}{" "}
                <strong>{t("guide.searchS3d")}</strong>, <strong>{t("guide.searchS3e")}</strong>,{" "}
                <strong>{t("guide.searchS3f")}</strong>.
              </GuideStep>
            </ol>
          </div>
          <div className="surface p-6 md:p-8 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">{t("guide.cardTitle")}</h3>
            <p className="text-base text-gray-700 leading-relaxed">{t("guide.cardText")}</p>
          </div>
        </section>

        <section id="account" className="scroll-mt-28 space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">{t("guide.tocAccount")}</h2>
          <p className="text-base text-gray-700 leading-relaxed max-w-4xl">{t("guide.accountLead")}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="surface p-5 space-y-3">
              <h3 className="text-base font-semibold text-gray-900">{t("guide.howAccount")}</h3>
              <ol className="space-y-3 text-base text-gray-700 leading-relaxed">
                <GuideStep n={1}>
                  {t("guide.accS1a")}{" "}
                  <Link to="/register" className="text-primary font-medium hover:underline">
                    {t("guide.accS1b")}
                  </Link>{" "}
                  {t("guide.accS1c")}
                </GuideStep>
                <GuideStep n={2}>{t("guide.accS2")}</GuideStep>
                <GuideStep n={3}>
                  {t("guide.accS3a")}{" "}
                  <Link to="/login" className="text-primary font-medium hover:underline">
                    {t("guide.accS3b")}
                  </Link>
                  .
                </GuideStep>
              </ol>
            </div>
            <div className="surface p-5 space-y-3">
              <h3 className="text-base font-semibold text-gray-900">{t("guide.afterLogin")}</h3>
              <ul className="space-y-2 text-base text-gray-700 leading-relaxed">
                <li>
                  <Link to="/profile" className="text-primary font-medium hover:underline">
                    {t("guide.afterL1a")}
                  </Link>{" "}
                  {t("guide.afterL1b")}
                </li>
                <li>
                  {t("guide.afterL2a")}{" "}
                  <Link to="/forgot-password" className="text-primary font-medium hover:underline">
                    {t("guide.afterL2b")}
                  </Link>
                  {t("guide.afterL2c")}
                </li>
                <li>{t("guide.afterL3")}</li>
              </ul>
            </div>
          </div>
        </section>

        <section id="wizard" className="scroll-mt-28 space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">{t("guide.wizardTitle")}</h2>
          <p className="text-base text-gray-700 leading-relaxed max-w-4xl">
            {t("guide.wizardLeadA")}{" "}
            <Link to="/new" className="text-primary font-medium hover:underline">
              /new
            </Link>
            {t("guide.wizardLeadB")}
          </p>

          <div className="overflow-x-auto surface">
            <table className="w-full text-base text-left">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t("guide.colStep")}</th>
                  <th className="px-4 py-3 font-semibold">{t("guide.colFill")}</th>
                  <th className="px-4 py-3 font-semibold">{t("guide.colRequired")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {WIZARD_ROWS.map((row) => (
                  <tr key={row.step}>
                    <td className="px-4 py-3 font-medium">{row.step}</td>
                    <td className="px-4 py-3">{row.fill}</td>
                    <td className="px-4 py-3">{row.required}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-base text-amber-950 leading-relaxed max-w-4xl">
            {t("guide.calloutA")}{" "}
            <Link to="/methodology/fos" className="font-semibold underline">
              {t("guide.fos")}
            </Link>
            {t("guide.calloutB")}{" "}
            <Link to="/methodology/scoring" className="font-semibold underline">
              {t("guide.scoring")}
            </Link>
            .
          </div>
        </section>

        <section id="projects" className="scroll-mt-28 space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">{t("guide.tocProjects")}</h2>
          <p className="text-base text-gray-700 leading-relaxed max-w-4xl">
            {t("guide.projectsLeadA")}{" "}
            <Link to="/my-projects" className="text-primary font-medium hover:underline">
              {t("guide.tocProjects")}
            </Link>{" "}
            {t("guide.projectsLeadB")}
          </p>
          <div className="surface p-6 md:p-8 space-y-3 text-base text-gray-700 leading-relaxed">
            <ul className="space-y-2">
              <li>{t("guide.pL1")}</li>
              <li>{t("guide.pL2")}</li>
              <li>{t("guide.pL3")}</li>
              <li>{t("guide.pL4")}</li>
            </ul>
          </div>
        </section>

        <section id="group" className="scroll-mt-28 space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">{t("guide.tocGroup")}</h2>
          <p className="text-base text-gray-700 leading-relaxed max-w-4xl">{t("guide.groupLead")}</p>
          <div className="surface p-6 md:p-8 space-y-3 text-base text-gray-700 leading-relaxed">
            <ol className="space-y-3">
              <GuideStep n={1}>{t("guide.g1")}</GuideStep>
              <GuideStep n={2}>{t("guide.g2")}</GuideStep>
              <GuideStep n={3}>{t("guide.g3")}</GuideStep>
              <GuideStep n={4}>{t("guide.g4")}</GuideStep>
            </ol>
          </div>
        </section>

        <section id="review" className="scroll-mt-28 space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">{t("guide.tocReview")}</h2>
          <p className="text-base text-gray-700 leading-relaxed max-w-4xl">{t("guide.reviewLead")}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="surface p-5 space-y-3">
              <h3 className="text-base font-semibold text-gray-900">{t("guide.moderator")}</h3>
              <ol className="space-y-3 text-base text-gray-700 leading-relaxed">
                <GuideStep n={1}>{t("guide.m1")}</GuideStep>
                <GuideStep n={2}>{t("guide.m2")}</GuideStep>
                <GuideStep n={3}>{t("guide.m3")}</GuideStep>
              </ol>
            </div>
            <div className="surface p-5 space-y-3">
              <h3 className="text-base font-semibold text-gray-900">{t("guide.expert")}</h3>
              <ol className="space-y-3 text-base text-gray-700 leading-relaxed">
                <GuideStep n={1}>{t("guide.e1")}</GuideStep>
                <GuideStep n={2}>{t("guide.e2")}</GuideStep>
                <GuideStep n={3}>{t("guide.e3")}</GuideStep>
              </ol>
            </div>
          </div>
        </section>

        <section id="staff" className="scroll-mt-28 space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">{t("guide.tocStaff")}</h2>
          <p className="text-base text-gray-700 leading-relaxed max-w-4xl">{t("guide.staffLead")}</p>
          <div className="surface p-6 md:p-8">
            <ul className="space-y-3 text-base text-gray-700 leading-relaxed">
              <li>{t("guide.s1")}</li>
              <li>{t("guide.s2")}</li>
              <li>{t("guide.s3")}</li>
              <li>
                {t("guide.s4a")}{" "}
                <Link to="/integration" className="text-primary font-medium hover:underline">
                  {t("guide.s4b")}
                </Link>{" "}
                {t("guide.s4c")}
              </li>
            </ul>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">{t("guide.helpTitle")}</h2>
          <div className="surface p-6 md:p-8 space-y-3 text-base text-gray-700 leading-relaxed">
            <p>
              <strong>{t("guide.h1t")}</strong>
              {t("guide.h1")}
            </p>
            <p>
              <strong>{t("guide.h2t")}</strong>
              {t("guide.h2")}
            </p>
            <p>
              <strong>{t("guide.h3t")}</strong>
              {t("guide.h3")}
            </p>
            <p>
              <strong>{t("guide.h4t")}</strong>
              {t("guide.h4")}
            </p>
          </div>
        </section>

        <section className="flex flex-wrap gap-3">
          <Link
            to="/search"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-base font-semibold hover:bg-primary/90"
          >
            {t("guide.openSearch")}
          </Link>
          <Link
            to="/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-200 bg-white text-base font-semibold text-gray-800 hover:border-primary/40"
          >
            {t("nav.propose")}
          </Link>
          <Link
            to="/methodology"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-200 bg-white text-base font-semibold text-gray-800 hover:border-primary/40"
          >
            <BookOpen className="w-4 h-4" />
            {t("methodology.title")}
          </Link>
        </section>
      </article>
    </PageShell>
  );
}
