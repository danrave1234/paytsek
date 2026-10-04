/** Public durable-proof API. SQLite storage and network attempts have separate responsibilities. */
export { correctDraft, countLegacyDrafts, getDraft, listDrafts, pruneSynced, saveDraft, stageImage, type Draft } from './draft-store';
export { recoverLegacyDrafts, syncAll, syncDraft } from './draft-sync';
