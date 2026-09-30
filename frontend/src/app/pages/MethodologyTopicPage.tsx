import type { ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import { LevelMatrixOverview } from "@/app/components/LevelMatrixOverview";
import { VolumeModelPassport } from "@/app/components/VolumeModelPassport";
import { ComponentScoringGuide } from "@/app/components/ComponentScoringGuide";
import { AssessmentFosGuide } from "@/app/components/AssessmentFosGuide";
import { HarmonizationGuide } from "@/app/components/HarmonizationGuide";
import { useI18n } from "@/context/I18nContext";
import { isMethodologyTopicId, METHODOLOGY_TOPICS, type MethodologyTopicId } from "@/lib/methodologyTopics";

const TOPIC_CONTENT: Record<MethodologyTopicId, () => ReactNode> = {
  harmonization: () => (
    <div className="surface p-6 md:p-8">
      <HarmonizationGuide />
    </div>
  ),
  scoring: () => (
    <div className="surface p-6 md:p-8">
      <ComponentScoringGuide />
    </div>
  ),
  fos: () => (
    <div className="surface p-6 md:p-8">
      <AssessmentFosGuide />
    </div>
  ),
  passport: () => (
    <div className="surface p-6 md:p-8">
      <VolumeModelPassport />
    </div>
  ),
  matrix: () => <LevelMatrixOverview />,
};

export function MethodologyTopicPage() {
  const { t } = useI18n();
  const { topicId = "" } = useParams();

  if (!isMethodologyTopicId(topicId)) {
    return <Navigate to="/methodology" replace />;
  }

  const topic = METHODOLOGY_TOPICS.find((item) => item.id === topicId);
  const Content = TOPIC_CONTENT[topicId];

  return (
    <PageShell>
      <Link
        to="/methodology"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("methodology.backToIndex")}
      </Link>
      {topicId === "harmonization" && topic ? (
        <PageHeader title={t(topic.titleKey)} />
      ) : topicId !== "matrix" && topic ? (
        <PageHeader title={t(topic.titleKey)} description={t(topic.descKey)} />
      ) : null}
      <Content />
    </PageShell>
  );
}
