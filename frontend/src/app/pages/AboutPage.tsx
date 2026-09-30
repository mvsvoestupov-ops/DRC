import { Link } from "react-router";
import {
  BookOpen,
  Briefcase,
  Building2,
  ClipboardCheck,
  GraduationCap,
  Link2,
  Search,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import { useI18n } from "@/context/I18nContext";

export function AboutPage() {
  const { t } = useI18n();

  const AUDIENCES = [
    {
      icon: GraduationCap,
      title: t("about.audEdu"),
      text: t("about.audEduText"),
    },
    {
      icon: Briefcase,
      title: t("about.audEmp"),
      text: t("about.audEmpText"),
    },
    {
      icon: ClipboardCheck,
      title: t("about.audExp"),
      text: t("about.audExpText"),
    },
    {
      icon: Search,
      title: t("about.audLearn"),
      text: t("about.audLearnText"),
    },
  ];

  return (
    <PageShell>
      <PageHeader title={t("about.title")} description={t("about.lead")} />

      <article className="space-y-10">
        <section className="surface p-6 md:p-8 space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">{t("about.foundations")}</h2>
          <p className="text-base text-gray-700 leading-relaxed max-w-4xl">{t("about.foundationsP1")}</p>
          <p className="text-base text-gray-700 leading-relaxed max-w-4xl">{t("about.foundationsP2")}</p>
          <p className="text-base text-gray-700 leading-relaxed max-w-4xl">{t("about.foundationsP3")}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">{t("about.significance")}</h2>
          <p className="text-base text-gray-700 leading-relaxed max-w-4xl">{t("about.significanceLead")}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {AUDIENCES.map((item) => (
              <div key={item.title} className="surface p-5 flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-primary flex items-center justify-center shrink-0">
                  <item.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-base text-gray-600 leading-relaxed">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="surface p-6 md:p-8 space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">{t("about.how")}</h2>
          <p className="text-base text-gray-700 leading-relaxed max-w-4xl">{t("about.howLead")}</p>
          <ul className="space-y-3 text-base text-gray-700 leading-relaxed max-w-4xl">
            <li className="flex gap-3">
              <Link2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <span>{t("about.how1")}</span>
            </li>
            <li className="flex gap-3">
              <BookOpen className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <span>{t("about.how2")}</span>
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <span>{t("about.how3")}</span>
            </li>
            <li className="flex gap-3">
              <Building2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <span>{t("about.how4")}</span>
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-base text-amber-950 leading-relaxed max-w-4xl">
          {t("about.disclaimer")}
        </section>

        <section className="flex flex-wrap gap-3">
          <Link
            to="/search"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-base font-semibold hover:bg-primary/90"
          >
            {t("about.openRegistry")}
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
            {t("methodology.title")}
          </Link>
          <Link
            to="/user-guide"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-200 bg-white text-base font-semibold text-gray-800 hover:border-primary/40"
          >
            {t("guide.title")}
          </Link>
        </section>
      </article>
    </PageShell>
  );
}
