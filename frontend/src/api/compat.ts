/**
 * Совместимость с API старого фронтенда (axios-стиль: res.data)
 */
import { apiClient } from './client';

const wrap = <T>(promise: Promise<T>) => promise.then((data) => ({ data }));

export const uploadFile = (file: File) => wrap(apiClient.uploadStandardFile(file));
export const getStandards = () => wrap(apiClient.getStandards());
export const getStandardsPage = (params?: {
  page?: number;
  limit?: number;
  q?: string;
  spk?: string;
  area?: string;
  only_with_qualifications?: boolean;
}) => wrap(apiClient.getStandardsPage(params));
export const getStandardsSpkList = () => wrap(apiClient.getStandardsSpkList());
export const importSpkAssignments = () => wrap(apiClient.importSpkAssignments());
export const getStandard = (regNumber: string) => wrap(apiClient.getStandardByRegNumber(regNumber));
export const fetchBulkRegistry = () => wrap(apiClient.fetchBulkRegistry());
export const getEnrichedStandards = () => wrap(apiClient.getEnrichedStandards());
export const getEnrichedStandard = (regNumber: string) => wrap(apiClient.getEnrichedStandard(regNumber));
export const getEnrichmentStats = () => wrap(apiClient.getEnrichmentStats());
export const runEnrichment = (options?: { regNumber?: string; onlyMissing?: boolean }) =>
  wrap(apiClient.runEnrichment(options));
export const createCompetence = (data: unknown) => wrap(apiClient.createCompetence(data));
export const getCompetences = () => wrap(apiClient.getCompetences());
export const getCompetence = (id: number) => wrap(apiClient.getCompetenceById(id));
export const updateCompetence = (id: number, data: unknown) => wrap(apiClient.updateCompetence(id, data));
export const deleteCompetence = (id: number) => wrap(apiClient.deleteCompetence(id));
export const getCompetenceStats = () => wrap(apiClient.getCompetenceStats());
export const getQualifications = () => wrap(apiClient.getQualifications());
export const getQualification = (id: number | string) => wrap(apiClient.getQualificationById(Number(id)));
export const getQualificationsStats = () => wrap(apiClient.getQualificationsStats());
export const fetchQualificationsFromNark = (onlyMissing = true) =>
  wrap(apiClient.fetchQualificationsFromNark(onlyMissing));
export const getFetchQualificationsStatus = () => wrap(apiClient.getFetchQualificationsStatus());
export const getAssessmentTools = () => wrap(apiClient.getAssessmentTools());
export const getAssessmentTool = (id: number | string) => wrap(apiClient.getAssessmentToolById(Number(id)));
export const getAssessmentToolsStats = () => wrap(apiClient.getAssessmentToolsStats());
export const fetchAssessmentToolsFromNark = (onlyMissing = true) =>
  wrap(apiClient.fetchAssessmentToolsFromNark(onlyMissing));
export const getFetchAssessmentToolsStatus = () => wrap(apiClient.getFetchAssessmentToolsStatus());
export const searchStandards = (query: string, limit = 200, area?: string) =>
  wrap(apiClient.searchStandards(query, limit, area));
export const downloadStandardDocx = (regNumber: string) => apiClient.downloadStandardDocx(regNumber);
export const getStandardPrintHtmlUrl = (regNumber: string) => apiClient.getStandardPrintHtmlUrl(regNumber);
export const getQualificationsByStandard = (standardId: number) =>
  wrap(apiClient.getQualificationsByStandard(standardId));
export const relinkQualificationsToStandards = () => wrap(apiClient.relinkQualificationsToStandards());
export const getFgosCategories = () => wrap(apiClient.getFgosCategories());
export const getFgosList = (category?: string) => wrap(apiClient.getFgosList(category));
export const getFgosById = (id: number | string) => wrap(apiClient.getFgosById(Number(id)));
export const getFgosStats = (category?: string) => wrap(apiClient.getFgosStats(category));
export const calculateCoverage = (standardId: number, selectedTfCodes: string[]) =>
  wrap(apiClient.getCoverage(standardId, selectedTfCodes));
export const getRegistrations = () => wrap(apiClient.getRegistrations());
