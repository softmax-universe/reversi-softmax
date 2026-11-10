import type { RunExport } from "@softmax-universe/protocol/recordings";
export interface PolicyVerification {
  passed: boolean;
  averageScore: number | null;
  policyHash: string;
  evaluationId: string;
  recording: RunExport;
}
