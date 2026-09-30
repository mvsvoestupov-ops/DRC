import { Link } from "react-router";
import { ArrowRight, Database, Users, FileText, Globe, Share2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/app/components/PageShell";
import { useI18n } from "@/context/I18nContext";

export function IntegrationPage() {
  const { t } = useI18n();

  const integrations = [
    {
      id: "cop",
      icon: "👤",
      title: t("integration.copTitle"),
      description: t("integration.copDesc"),
      features: [
        t("integration.cop1"),
        t("integration.cop2"),
        t("integration.cop3"),
        t("integration.cop4"),
      ],
    },
    {
      id: "poa",
      icon: "📊",
      title: t("integration.poaTitle"),
      description: t("integration.poaDesc"),
      features: [
        t("integration.poa1"),
        t("integration.poa2"),
        t("integration.poa3"),
        t("integration.poa4"),
      ],
    },
    {
      id: "target",
      icon: "🎓",
      title: t("integration.targetTitle"),
      description: t("integration.targetDesc"),
      features: [
        t("integration.target1"),
        t("integration.target2"),
        t("integration.target3"),
        t("integration.target4"),
      ],
    },
    {
      id: "opop",
      icon: "📚",
      title: t("integration.opopTitle"),
      description: t("integration.opopDesc"),
      features: [
        t("integration.opop1"),
        t("integration.opop2"),
        t("integration.opop3"),
        t("integration.opop4"),
      ],
    },
    {
      id: "profstandard",
      icon: "🏢",
      title: t("integration.psTitle"),
      description: t("integration.psDesc"),
      features: [
        t("integration.ps1"),
        t("integration.ps2"),
        t("integration.ps3"),
        t("integration.ps4"),
      ],
    },
    {
      id: "international",
      icon: "🌍",
      title: t("integration.intTitle"),
      description: t("integration.intDesc"),
      features: [
        t("integration.int1"),
        t("integration.int2"),
        t("integration.int3"),
        t("integration.int4"),
      ],
    },
  ];

  return (
    <div>
      <div className="bg-gradient-to-br from-[#1E3A8A] via-[#1E40AF] to-[#3B82F6] text-white">
        <div className="max-w-[1440px] mx-auto px-8 py-16">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-blue-100 hover:text-white mb-6"
          >
            {t("integration.back")}
          </Link>
          <h1 className="text-4xl font-bold mb-4">{t("integration.title")}</h1>
          <p className="text-xl text-blue-100 max-w-3xl">{t("integration.lead")}</p>
        </div>
      </div>

      <PageShell>
        <div className="mb-12">
          <div className="surface-padded p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
              {t("integration.arch")}
            </h2>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <div className="text-center">
                <div className="w-32 h-32 bg-primary rounded-xl flex items-center justify-center text-white mb-2">
                  <Database className="w-16 h-16" />
                </div>
                <p className="font-semibold text-gray-900">{t("integration.registry")}</p>
                <p className="text-base text-gray-600">{t("integration.store")}</p>
              </div>

              <ArrowRight className="w-8 h-8 text-gray-400" />

              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Users, bg: "bg-primary", label: t("integration.students") },
                  { icon: FileText, bg: "bg-primary/80", label: t("integration.universities") },
                  { icon: Share2, bg: "bg-primary/70", label: t("integration.employers") },
                  { icon: Globe, bg: "bg-primary/60", label: t("integration.partners") },
                ].map((item, idx) => (
                  <div key={idx} className="text-center">
                    <div className={`w-24 h-24 ${item.bg} rounded-xl flex items-center justify-center text-white mb-2`}>
                      <item.icon className="w-12 h-12" />
                    </div>
                    <p className="text-base font-semibold text-gray-900">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className="surface border-l-4 border-l-primary p-6"
            >
              <div className="flex items-start gap-4 mb-4">
                <span className="text-4xl">{integration.icon}</span>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {integration.title}
                  </h3>
                  <p className="text-base text-gray-600">{integration.description}</p>
                </div>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-base font-medium text-gray-900 mb-2">
                  {t("integration.features")}
                </h4>
                <ul className="space-y-1">
                  {integration.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-base text-gray-700">
                      <span className="text-primary flex-shrink-0">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="surface-padded">
            <div className="flex items-center gap-3 mb-4">
              <Share2 className="w-8 h-8 text-primary" />
              <h3 className="text-xl font-semibold text-gray-900">{t("integration.apiTitle")}</h3>
            </div>
            <p className="text-gray-600 mb-4">{t("integration.apiLead")}</p>
            <ul className="space-y-2 text-base text-gray-700 mb-4">
              {[
                t("integration.api1"),
                t("integration.api2"),
                t("integration.api3"),
                t("integration.api4"),
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <a
              href="#"
              className="inline-flex items-center gap-1 text-primary hover:underline text-base font-medium"
            >
              {t("integration.apiDocs")}
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          <div className="surface-padded">
            <div className="flex items-center gap-3 mb-4">
              <Lock className="w-8 h-8 text-green-600" />
              <h3 className="text-xl font-semibold text-gray-900">{t("integration.securityTitle")}</h3>
            </div>
            <p className="text-gray-600 mb-4">{t("integration.securityLead")}</p>
            <ul className="space-y-2 text-base text-gray-700 mb-4">
              {[
                t("integration.sec1"),
                t("integration.sec2"),
                t("integration.sec3"),
                t("integration.sec4"),
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-green-600">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <a
              href="#"
              className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 text-base font-medium"
            >
              {t("integration.securityPolicy")}
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div className="mt-12 bg-gradient-to-br from-[#1E3A8A] via-[#1E40AF] to-[#3B82F6] rounded-xl p-8 text-white">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-2xl font-bold mb-2">{t("integration.joinTitle")}</h3>
              <p className="text-blue-100">{t("integration.joinLead")}</p>
            </div>
            <Button className="px-6 py-3 bg-white text-primary hover:bg-blue-50 font-semibold">
              {t("integration.joinCta")}
            </Button>
          </div>
        </div>
      </PageShell>
    </div>
  );
}
