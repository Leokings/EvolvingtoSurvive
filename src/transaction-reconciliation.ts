type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function text(source: UnknownRecord | null, ...keys: string[]): string {
  if (!source) return "";
  for (const key of keys) {
    if (typeof source[key] === "string") return source[key] as string;
  }
  return "";
}

function executionDetail(source: UnknownRecord | null): string {
  const genvm = record(source?.genvm_result ?? source?.genvmResult);
  return text(genvm, "error_description", "errorDescription", "stderr")
    || text(source, "error_description", "errorDescription", "stderr");
}

export function receiptExecution(value: unknown): {
  outcome: "success" | "failure" | "unknown";
  detail?: string;
} {
  const receipt = record(value);
  if (!receipt) return {outcome: "unknown"};
  const top = text(receipt, "txExecutionResultName", "tx_execution_result_name").toUpperCase();
  if (["SUCCESS", "FINISHED_WITH_RETURN"].includes(top)) return {outcome: "success"};
  if (["ERROR", "FAILURE", "FINISHED_WITH_ERROR"].includes(top)) {
    return {outcome: "failure", detail: executionDetail(receipt)};
  }
  const consensus = record(receipt.consensus_data ?? receipt.consensusData);
  const rawLeaders = consensus?.leader_receipt ?? consensus?.leaderReceipt;
  const leaders = (Array.isArray(rawLeaders) ? rawLeaders : rawLeaders ? [rawLeaders] : [])
    .map(record)
    .filter((entry): entry is UnknownRecord => Boolean(entry));
  for (const leader of leaders) {
    const result = text(leader, "execution_result", "executionResult").toUpperCase();
    if (["SUCCESS", "FINISHED_WITH_RETURN"].includes(result)) return {outcome: "success"};
  }
  for (const leader of leaders) {
    const result = text(leader, "execution_result", "executionResult").toUpperCase();
    if (["ERROR", "FAILURE", "FINISHED_WITH_ERROR"].includes(result)) {
      return {outcome: "failure", detail: executionDetail(leader)};
    }
  }
  return {outcome: "unknown"};
}
