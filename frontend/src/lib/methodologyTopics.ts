export const METHODOLOGY_TOPIC_IDS = [
  "harmonization",
  "scoring",
  "fos",
  "passport",
  "matrix",
] as const;

export type MethodologyTopicId = (typeof METHODOLOGY_TOPIC_IDS)[number];

export const METHODOLOGY_TOPICS: Array<{
  id: MethodologyTopicId;
  titleKey: string;
  descKey: string;
}> = [
  {
    id: "harmonization",
    titleKey: "methodology.harmonizationTitle",
    descKey: "methodology.harmonizationDesc",
  },
  {
    id: "scoring",
    titleKey: "methodology.scoringTitle",
    descKey: "methodology.scoringDesc",
  },
  {
    id: "fos",
    titleKey: "methodology.fosTitle",
    descKey: "methodology.fosDesc",
  },
  {
    id: "passport",
    titleKey: "methodology.passportTitle",
    descKey: "methodology.passportDesc",
  },
  {
    id: "matrix",
    titleKey: "methodology.matrixTitle",
    descKey: "methodology.matrixDesc",
  },
];

export function isMethodologyTopicId(value: string): value is MethodologyTopicId {
  return (METHODOLOGY_TOPIC_IDS as readonly string[]).includes(value);
}
