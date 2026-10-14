import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/api/client";
import type { CompetencePresenceUser } from "@/api/types";

const HEARTBEAT_MS = 4000;

const FRAGMENT_I18N: Record<string, string> = {
  title: "presence.fragTitle",
  description: "presence.fragDescription",
  area: "presence.fragArea",
  educationKind: "presence.fragEducationKind",
  educationLevel: "presence.fragEducationLevel",
  fgos: "presence.fragFgos",
  profession: "presence.fragProfession",
  competenceType: "presence.fragKind",
  developer: "presence.fragDeveloper",
  workload: "presence.fragWorkload",
  ps: "presence.fragPs",
  tf: "presence.fragTf",
  "structure:A": "presence.fragA",
  "structure:B": "presence.fragB",
  "structure:C": "presence.fragC",
  descriptors: "presence.fragDescriptors",
  discipline: "presence.fragDiscipline",
  assessment: "presence.fragAssessment",
  resources: "presence.fragResources",
  expertise: "presence.fragExpertise",
  international: "presence.fragInternational",
  preview: "presence.fragPreview",
};

export function presenceShortName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return name;
  if (parts.length === 1) return parts[0];
  const last = parts[0];
  const initials = parts
    .slice(1)
    .map((part) => `${part[0]?.toUpperCase() || ""}.`)
    .join("");
  return `${last} ${initials}`.trim();
}

export function presenceFragmentLabel(
  t: (key: string, vars?: Record<string, string | number>) => string,
  fragment: string,
  step: number,
) {
  const key = FRAGMENT_I18N[fragment];
  if (key) return t(key);
  if (fragment.startsWith("step:")) {
    return t("presence.onStep", { n: fragment.slice(5) });
  }
  return t("presence.onStep", { n: step });
}

export function useCollaborationPresence(options: {
  competenceId: number | null;
  step: number;
  enabled: boolean;
}) {
  const { competenceId, step, enabled } = options;
  const [peers, setPeers] = useState<CompetencePresenceUser[]>([]);
  const [fragment, setFragment] = useState(`step:${step}`);
  const fragmentRef = useRef(fragment);
  const stepRef = useRef(step);
  fragmentRef.current = fragment;
  stepRef.current = step;

  const applyUsers = useCallback((users?: CompetencePresenceUser[]) => {
    setPeers(Array.isArray(users) ? users : []);
  }, []);

  useEffect(() => {
    setFragment(`step:${step}`);
  }, [step]);

  useEffect(() => {
    if (!competenceId || !enabled) {
      setPeers([]);
      return;
    }
    let cancelled = false;
    const beat = async (online = true) => {
      try {
        const data = await apiClient.updateCompetencePresence(
          competenceId,
          online
            ? { step: stepRef.current, fragment: fragmentRef.current, online: true }
            : { online: false },
          online ? undefined : { keepalive: true },
        );
        if (!cancelled && online) applyUsers(data?.users);
      } catch {
        /* ignore transient presence errors */
      }
    };
    void beat(true);
    const timer = window.setInterval(() => void beat(true), HEARTBEAT_MS);
    const leave = () => {
      void beat(false);
    };
    window.addEventListener("pagehide", leave);
    window.addEventListener("beforeunload", leave);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("beforeunload", leave);
      void beat(false);
    };
  }, [applyUsers, competenceId, enabled]);

  useEffect(() => {
    if (!competenceId || !enabled) return;
    let cancelled = false;
    apiClient
      .updateCompetencePresence(competenceId, { step, fragment, online: true })
      .then((data) => {
        if (!cancelled) applyUsers(data?.users);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [applyUsers, competenceId, enabled, fragment, step]);

  return { peers, fragment, setFragment };
}
