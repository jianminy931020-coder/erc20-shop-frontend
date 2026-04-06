import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";

describe("MemoStorage", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [sender, recipient] = await viem.getWalletClients();

  async function getLatestMemoEvent(contract, fromBlock) {
    const events = await publicClient.getContractEvents({
      address: contract.address,
      abi: contract.abi,
      eventName: "MemoStored",
      fromBlock,
      strict: true,
    });

    assert.ok(events.length > 0, "MemoStored event should exist");
    return events[events.length - 1];
  }

  it("should transfer value and emit correct event fields", async function () {
    const contract = await viem.deployContract("MemoStorage");
    const deploymentBlock = await publicClient.getBlockNumber();
    const amount = 10n ** 15n; // 0.001 ETH
    const memo = "happy birthday";

    const balanceBefore = await publicClient.getBalance({
      address: recipient.account.address,
    });

    await contract.write.sendWithMemo([recipient.account.address, memo], {
      value: amount,
      account: sender.account,
    });

    const balanceAfter = await publicClient.getBalance({
      address: recipient.account.address,
    });

    assert.equal(balanceAfter - balanceBefore, amount);

    const event = await getLatestMemoEvent(contract, deploymentBlock);
    assert.equal(event.args.from.toLowerCase(), sender.account.address.toLowerCase());
    assert.equal(event.args.to.toLowerCase(), recipient.account.address.toLowerCase());
    assert.equal(event.args.amount, amount);
    assert.equal(event.args.memo, memo);
    assert.ok(event.args.timestamp > 0n);
  });

  it("should support empty memo", async function () {
    const contract = await viem.deployContract("MemoStorage");
    const deploymentBlock = await publicClient.getBlockNumber();

    await contract.write.sendWithMemo([recipient.account.address, ""], {
      value: 1n,
      account: sender.account,
    });

    const event = await getLatestMemoEvent(contract, deploymentBlock);
    assert.equal(event.args.memo, "");
  });

  it("should support long memo", async function () {
    const contract = await viem.deployContract("MemoStorage");
    const deploymentBlock = await publicClient.getBlockNumber();
    const longMemo = "x".repeat(4000);

    await contract.write.sendWithMemo([recipient.account.address, longMemo], {
      value: 1n,
      account: sender.account,
    });

    const event = await getLatestMemoEvent(contract, deploymentBlock);
    assert.equal(event.args.memo, longMemo);
  });

  it("should allow zero-value transfer and still emit event", async function () {
    const contract = await viem.deployContract("MemoStorage");
    const deploymentBlock = await publicClient.getBlockNumber();
    const memo = "zero value";

    const balanceBefore = await publicClient.getBalance({
      address: recipient.account.address,
    });

    await contract.write.sendWithMemo([recipient.account.address, memo], {
      value: 0n,
      account: sender.account,
    });

    const balanceAfter = await publicClient.getBalance({
      address: recipient.account.address,
    });
    assert.equal(balanceAfter, balanceBefore);

    const event = await getLatestMemoEvent(contract, deploymentBlock);
    assert.equal(event.args.amount, 0n);
    assert.equal(event.args.memo, memo);
  });
});
