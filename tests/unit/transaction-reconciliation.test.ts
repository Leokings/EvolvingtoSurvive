import {describe, expect, it} from "vitest";

import {calldataAddress} from "../../src/genlayer-game";
import {receiptExecution} from "../../src/transaction-reconciliation";

describe("GenLayer receipt reconciliation", () => {
  it("recognizes consensus-chain and Studionet success shapes", () => {
    expect(receiptExecution({txExecutionResultName: "FINISHED_WITH_RETURN"}).outcome).toBe("success");
    expect(receiptExecution({
      consensus_data: {leader_receipt: [{execution_result: "SUCCESS"}]},
    }).outcome).toBe("success");
  });

  it("preserves contract execution errors", () => {
    const result = receiptExecution({
      tx_execution_result_name: "FINISHED_WITH_ERROR",
      genvm_result: {error_description: "[EXPECTED] not_your_turn"},
    });
    expect(result).toEqual({outcome: "failure", detail: "[EXPECTED] not_your_turn"});
  });

  it("extracts Studionet leader stderr from the finalized receipt", () => {
    const result = receiptExecution({
      consensus_data: {
        leader_receipt: [{
          execution_result: "ERROR",
          genvm_result: {stderr: "called non-payable method with non-zero value"},
        }],
      },
    });
    expect(result).toEqual({
      outcome: "failure",
      detail: "called non-payable method with non-zero value",
    });
  });

  it("encodes wallet arguments with the address calldata type", () => {
    const encoded = calldataAddress("0x1111111111111111111111111111111111111111");
    expect(encoded.bytes).toHaveLength(20);
    expect(Array.from(encoded.bytes)).toEqual(new Array(20).fill(17));
  });
});
