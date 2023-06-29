import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: "0.8.4",
  networks: {
    hardhat: {
      forking: {
        // @ts-ignore
        url: `http://cloudflare-eth.com`, // process.env.MAINNET_URL,
        blockNumber: 17564694,
      },
    },
    "truffle-dashboard": {
      url: "http://127.0.0.1:8545/",
    },
  },
  gasReporter: {
    enabled: true, // process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: `free-key`, // process.env.ETHERSCAN_API_KEY,
  },
  mocha: {
    timeout: 240000,
  },
};

export default config;
