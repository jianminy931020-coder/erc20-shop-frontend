import { network } from "hardhat";

async function main() {
  const { viem } = await network.connect("sepolia");
  const [deployer] = await viem.getWalletClients();

  console.log("Deploying MemoStorage with account:", deployer.account.address);

  const memoStorage = await viem.deployContract("MemoStorage");
  const txHash =
    memoStorage.deploymentTransaction?.hash ??
    memoStorage.deploymentTransactionHash ??
    memoStorage.transactionHash ??
    "N/A";

  console.log("Deployment txHash:", txHash);
  console.log("MemoStorage deployed at:", memoStorage.address);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
