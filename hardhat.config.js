import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

const bscArchiveRpcUrl = process.env.BSC_ARCHIVE_RPC_URL;
const BSC_FORK_BLOCK_NUMBER = 121814123; // BSC block hash: 0x6ec666cbcd7d1ed268f4b019925dc0aea6eba9d4c6740fb87ff8d6e4f859542f
const networks = bscArchiveRpcUrl
  ? {
      bscFork: {
        type: "edr-simulated",
        chainId: 56,
        forking: { url: bscArchiveRpcUrl, blockNumber: BSC_FORK_BLOCK_NUMBER },
      },
    }
  : {};

const chainDescriptors = {
  56: {
    name: "BNB Smart Chain",
    chainType: "generic",
    hardforkHistory: {
      shanghai: { blockNumber: 0 },
    },
  },
};

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  chainDescriptors,
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks,
});
