import { keccak256 } from "@ethersproject/keccak256";
import {
  GOVERNOR_BRAVO_ABI,
  TIMELOCK_ABI,
  ENS_REGISTRY_ABI,
  ENS_PUBLIC_RESOLVER_ABI,
  UNI_ABI,
} from "./utils.mjs";
import ethers from "ethers";

import { namehash } from "@ethersproject/hash";
import { utils } from "ethers";
import { Interface } from "@ethersproject/abi";

async function main() {
  const governorBravoAddress = "0x408ED6354d4973f66138C91495F2f2FCbd8724C3";
  const governorBravo = new ethers.Contract(
    governorBravoAddress,
    GOVERNOR_BRAVO_ABI
  );

  const NODE_TOP_LEVEL = namehash("uniswap.eth");
  const LABEL = keccak256(utils.toUtf8Bytes("v4-core-license-date"));
  const OWNER_UNISWAP_GOVERNANCE_TIMELOCK = "0x1a9C8182C09F50C8318d769245beA52c32BE35BC";
  const RESOLVER_PUBLIC_ENS_RESOLVER = "0x4976fb03c32e5b8cfe2b6ccb31c09ba78ebaba41";
  const ENS_REGISTRY_ADDRESS = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
  const TTL = 0;

  const ensRegistryInterface = new Interface(ENS_REGISTRY_ABI);
  const setSubnodeRecordCalldata = ensRegistryInterface.encodeFunctionData(
    "setSubnodeRecord",
    [
      NODE_TOP_LEVEL,
      LABEL,
      OWNER_UNISWAP_GOVERNANCE_TIMELOCK,
      RESOLVER_PUBLIC_ENS_RESOLVER,
      TTL,
    ]
  );

  const NODE = namehash("v4-core-license-date.uniswap.eth");
  const KEY = "Change Date";
  const VALUE = ` July 21, 2023`;

  const ensPublicResolverInterface = new Interface(ENS_PUBLIC_RESOLVER_ABI);
  const setTextCalldata = ensPublicResolverInterface.encodeFunctionData(
    "setText",
    [NODE, KEY, VALUE]
  );

  const PUBLIC_ENS_RESOLVER_ADDRESS =
    "0x4976fb03c32e5b8cfe2b6ccb31c09ba78ebaba41";

  const targets = [ENS_REGISTRY_ADDRESS, PUBLIC_ENS_RESOLVER_ADDRESS];
  const values = [0, 0];
  const sigs = ["", ""];
  const calldatas = [setSubnodeRecordCalldata, setTextCalldata];
  const description = "Change GPL Date ...";

  // truffle dashboard (browser signer)
  const provider = new ethers.providers.JsonRpcProvider(
    "http://127.0.0.1:8545/"
  );
  const signer = provider.getSigner();

  // use with private key in .env
  // const provider = new ethers.providers.AlchemyProvider(null, process.env.ALCHEMY_KEY)
  // const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider)
  const governorBravoInterface = new Interface(GOVERNOR_BRAVO_ABI);
  const proposalCalldata = governorBravoInterface.encodeFunctionData(
    "propose",
    [targets, values, sigs, calldatas, description]
  );

  console.log(proposalCalldata);
  
  // make the proposal
  await governorBravo
    .connect(signer)
    .propose(targets, values, sigs, calldatas, description);
}

// uncomment and use process.env.PRIVATE_KEY when not using truffle dashboard
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
