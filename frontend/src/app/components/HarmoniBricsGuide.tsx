import type { ReactNode } from "react";
import {
  ArrowRight,
  Bot,
  Flag,
  GitCompare,
  Globe2,
  Network,
  Scale,
  Shield,
  Waypoints,
} from "lucide-react";
import { useI18n } from "@/context/I18nContext";

function Details({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-xs font-semibold text-primary hover:underline">
        {summary}
      </summary>
      <div className="mt-2 text-sm text-gray-600 leading-relaxed space-y-2">{children}</div>
    </details>
  );
}

export function HarmoniBricsGuide() {
  const { t } = useI18n();
  const d = (key: string) => t(`harmoniBrics.${key}`);

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{d("kicker")}</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 leading-tight">{d("title")}</h1>
        <p className="text-base text-gray-600 leading-relaxed max-w-3xl">{d("lead")}</p>
      </header>

      <section className="rounded-2xl border border-gray-200 overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-gray-900">{d("requisites")}</div>
        <table className="w-full text-sm">
          <tbody>
            {[
              ["rId", "rIdV"],
              ["rVer", "rVerV"],
              ["rStatus", "rStatusV"],
              ["rScope", "rScopeV"],
              ["rUnit", "rUnitV"],
              ["rAnchor", "rAnchorV"],
              ["rAi", "rAiV"],
            ].map(([k, v]) => (
              <tr key={k} className="border-t border-gray-100">
                <th className="text-left font-medium text-gray-500 px-4 py-2.5 w-1/3">{d(k)}</th>
                <td className="px-4 py-2.5 text-gray-900">{d(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">{d("s1title")}</h2>
        <p className="text-sm text-gray-600 leading-relaxed">{d("s1p1")}</p>
        <p className="text-sm text-gray-600 leading-relaxed">{d("s1p2")}</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">{d("s2title")}</h2>
        <p className="text-sm text-gray-600 leading-relaxed">{d("s2p1")}</p>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {[
            { icon: Flag, label: d("vizRu") },
            { icon: Waypoints, label: d("vizIsco") },
            { icon: Globe2, label: d("vizEqf") },
            { icon: Network, label: d("vizNqf") },
            { icon: Bot, label: d("vizAi") },
            { icon: Shield, label: d("vizExpert") },
          ].map((node, index, arr) => (
            <div key={node.label} className="contents">
              <div className="flex flex-col items-center gap-2 min-w-[4.5rem]">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-primary flex items-center justify-center">
                  <node.icon className="w-6 h-6" />
                </div>
                <div className="text-[11px] font-semibold text-center text-gray-800 max-w-[5rem] leading-tight">
                  {node.label}
                </div>
              </div>
              {index < arr.length - 1 ? <ArrowRight className="w-4 h-4 text-gray-300 hidden md:block" /> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">{d("s3title")}</h2>
        <div className="overflow-x-auto rounded-2xl border border-gray-200">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-2.5 font-semibold">{d("hLayer")}</th>
                <th className="px-4 py-2.5 font-semibold">{d("hRu")}</th>
                <th className="px-4 py-2.5 font-semibold">{d("hPartner")}</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((n) => (
                <tr key={n} className="border-t border-gray-100">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{d(`ly${n}n`)}</td>
                  <td className="px-4 py-2.5 text-gray-600">{d(`ly${n}r`)}</td>
                  <td className="px-4 py-2.5 text-gray-600">{d(`ly${n}i`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">{d("s4title")}</h2>
        <p className="text-sm text-gray-600 leading-relaxed">{d("s4p1")}</p>
        <ul className="space-y-2 text-sm text-gray-700">
          {["cBR", "cIN", "cCN", "cZA", "cID", "cAE"].map((key) => (
            <li key={key} className="rounded-xl border border-gray-100 bg-white px-4 py-3">
              {d(key)}
            </li>
          ))}
        </ul>
        <Details summary={d("vizMore")}>
          <p>{d("s4p2")}</p>
        </Details>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">{d("s5title")}</h2>
        <ol className="space-y-3 list-decimal pl-5 text-sm text-gray-700">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <li key={n}>
              <span className="font-semibold text-gray-900">{d(`st${n}t`)}. </span>
              {d(`st${n}`)}
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" /> {d("s6title")}
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed">{d("s6p1")}</p>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-emerald-950">
            <div className="font-semibold mb-2">{d("aiYesTitle")}</div>
            <ul className="space-y-1 list-disc pl-4">
              <li>{d("aiYes1")}</li>
              <li>{d("aiYes2")}</li>
              <li>{d("aiYes3")}</li>
              <li>{d("aiYes4")}</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4 text-sm text-rose-950">
            <div className="font-semibold mb-2">{d("aiNoTitle")}</div>
            <ul className="space-y-1 list-disc pl-4">
              <li>{d("aiNo1")}</li>
              <li>{d("aiNo2")}</li>
              <li>{d("aiNo3")}</li>
              <li>{d("aiNo4")}</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-primary" /> {d("s7title")}
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed">{d("s7p1")}</p>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { title: d("regNotify"), body: d("regNotifyD") },
            { title: d("regAdapt"), body: d("regAdaptD") },
            { title: d("regRefuse"), body: d("regRefuseD") },
          ].map((card) => (
            <div key={card.title} className="rounded-2xl border border-gray-200 p-4">
              <div className="text-sm font-semibold text-gray-900 mb-1">{card.title}</div>
              <p className="text-sm text-gray-600 leading-relaxed">{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Scale className="w-5 h-5 text-primary" /> {d("s8title")}
        </h2>
        <ul className="space-y-2 text-sm text-gray-700">
          {["c1", "c2", "c3", "c4", "c5", "c6"].map((key) => (
            <li key={key} className="rounded-xl border border-amber-100 bg-amber-50/50 px-4 py-3">
              {d(key)}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">{d("s9title")}</h2>
        <p className="text-sm text-gray-600 leading-relaxed">{d("s9p1")}</p>
        <p className="text-sm text-gray-600 leading-relaxed">{d("s9p2")}</p>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-slate-50 p-5 space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">{d("closeTitle")}</h2>
        <p className="text-sm text-gray-600 leading-relaxed">{d("closeP1")}</p>
        <p className="text-sm text-gray-600 leading-relaxed">{d("closeP2")}</p>
      </section>
    </div>
  );
}
