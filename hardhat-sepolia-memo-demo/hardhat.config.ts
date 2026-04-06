import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { defineConfig } from "hardhat/config";
import dotenv from "dotenv";

dotenv.config();

const privateKey = process.env.PRIVATE_KEY ?? "";
const hasValidPrivateKey = /^0x[0-9a-fA-F]{64}$/.test(privateKey);

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    version: "0.8.28",
  },
  verify: {
    etherscan: {
      apiKey: process.env.ETHERSCAN_API_KEY ?? "",
    },
  },
  networks: {
    sepolia: {
      type: "http",
      chainType: "l1",
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_KEY ?? ""}`,
      accounts: hasValidPrivateKey ? [privateKey] : [],
    },
  },
});
