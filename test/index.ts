import { expect } from "chai";
import { ethers, network } from "hardhat";
import { waffle } from "hardhat";
import { BigNumber, Contract, Wallet } from "ethers";
import {
  GOVERNOR_BRAVO_ABI,
  TIMELOCK_ABI,
  ENS_REGISTRY_ABI,
  ENS_PUBLIC_RESOLVER_ABI,
  UNI_ABI,
} from "./utils";
import { namehash } from "@ethersproject/hash";
import { keccak256 } from "@ethersproject/keccak256";
import { utils } from "ethers";
import { Interface } from "@ethersproject/abi";
import "hardhat";

const { provider } = waffle;

describe("Uniswap v4 core license date change", async () => {
  let wallet;

  async function advanceBlockHeight(blocks: number) {
    const txns = [];
    for (let i = 0; i < blocks; i++) {
      txns.push(network.provider.send("evm_mine"));
    }
    await Promise.all(txns);
  }

  const PUBLIC_ENS_RESOLVER_ADDRESS =
    "0x4976fb03c32e5b8cfe2b6ccb31c09ba78ebaba41";
  const ENS_REGISTRY_ADDRESS = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";

  const ensPublicResolver = new Contract(
    PUBLIC_ENS_RESOLVER_ADDRESS,
    ENS_PUBLIC_RESOLVER_ABI,
    provider
  );

  const ensRegistry = new Contract(
    ENS_REGISTRY_ADDRESS,
    ENS_REGISTRY_ABI,
    provider
  );

  it("proposal simulation", async () => {
    // get the governor bravo contract
    const governorBravoAddress = "0x408ED6354d4973f66138C91495F2f2FCbd8724C3";
    const governorBravo = new Contract(
      governorBravoAddress,
      GOVERNOR_BRAVO_ABI,
      provider
    );

    // get signers
    [wallet] = await ethers.getSigners();

    const TTL = 0;
    const NODE_TOP_LEVEL = namehash("uniswap.eth");
    const LABEL = keccak256(utils.toUtf8Bytes("v4-core-license-date"));
    const OWNER_UNISWAP_GOVERNANCE_TIMELOCK =
      "0x1a9C8182C09F50C8318d769245beA52c32BE35BC";
    const RESOLVER_PUBLIC_ENS_RESOLVER =
      "0x4976fb03c32e5b8cfe2b6ccb31c09ba78ebaba41";

    const NODE = namehash("v4-core-license-date.uniswap.eth");
    const KEY = "Change Date";
    const VALUE = "July 21, 2023";

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

    const ensPublicResolverInterface = new Interface(ENS_PUBLIC_RESOLVER_ABI);
    const setTextCalldata = ensPublicResolverInterface.encodeFunctionData(
      "setText",
      [NODE, KEY, VALUE]
    );

    const targets = [RESOLVER_PUBLIC_ENS_RESOLVER, ENS_REGISTRY_ADDRESS];
    const values = [0, 0];
    const sigs = ["", ""];
    const calldatas = [setSubnodeRecordCalldata, setTextCalldata];
    const description = "Change GPL Date ...";

    const michiganAddress = "0x13BDaE8c5F0fC40231F0E6A4ad70196F59138548";
    // delegate votes from whales to the wallet
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [michiganAddress], // michigan
    });

    const michiganSigner = await ethers.getSigner(michiganAddress);

    // make the proposal
    await governorBravo
      .connect(michiganSigner)
      .propose(targets, values, sigs, calldatas, description);

    await advanceBlockHeight(13141); // fast forward through review period

    const expectedProposalId = "40"; // based on a block at fork height 17564694 after submitting the proposal

    const currentProposalCount = await governorBravo.proposalCount();
    expect(currentProposalCount.toString()).to.equal(expectedProposalId);

    let proposalInfo = await governorBravo.proposals(expectedProposalId);
    console.log(proposalInfo);

    const uniWhaleAddresses = [
      "0x2b1ad6184a6b0fac06bd225ed37c2abc04415ff4",
      "0xe02457a1459b6c49469bf658d4fe345c636326bf",
      "0x8e4ed221fa034245f14205f781e0b13c5bd6a42e",
      "0x61c8d4e4be6477bb49791540ff297ef30eaa01c2",
      "0xa2bf1b0a7e079767b4701b5a1d9d5700eb42d1d1",
      "0xe7925d190aea9279400cd9a005e33ceb9389cc2b",
      "0x7e4a8391c728fed9069b2962699ab416628b19fa",
    ];

    // start casting votes
    for (let i = 0; i < uniWhaleAddresses.length; i++) {
      const whaleAddress = uniWhaleAddresses[i];

      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [whaleAddress], // michigan
      });

      const whaleSigner = await ethers.getSigner(whaleAddress);

      // send ether to the whale address

      await wallet.sendTransaction({
        to: whaleAddress,
        value: ethers.utils.parseEther("1"),
      });
      console.log("Voting Yes with address", whaleAddress);
      await governorBravo.connect(whaleSigner).castVote(expectedProposalId, 1);
    }

    await advanceBlockHeight(40320); // fast forward through voting period
    console.log("Voting period ended");

    await governorBravo.connect(michiganSigner).queue(expectedProposalId);

    proposalInfo = await governorBravo.proposals(expectedProposalId);

    console.log(proposalInfo);

    await network.provider.request({
      method: "evm_increaseTime",
      params: [172800], // 2 days
    });

    await advanceBlockHeight(1);
    console.log("Executing proposal");
    await governorBravo.connect(michiganSigner).execute(expectedProposalId);
    console.log("Proposal executed");
    proposalInfo = await governorBravo.proposals(expectedProposalId);

    console.log(proposalInfo); // expect "executed" to be true

    // validate the proposal was executed
    expect(
      (await governorBravo.proposals(expectedProposalId)).executed
    ).to.equal(true);

    // check the ENS record was set
    const licenseText = await ensPublicResolver.text(NODE, KEY);
    const subnodeResolver = await ensRegistry.resolver(NODE);

    console.log("License Text", licenseText);
    expect(subnodeResolver.toLowerCase()).to.equal(
      PUBLIC_ENS_RESOLVER_ADDRESS.toLowerCase()
    );

    const subnodeRecordExists = await ensRegistry.recordExists(NODE);
    expect(subnodeRecordExists).to.equal(true);

    // check if the text record was set
    const recordExists = ensRegistry.recordExists(NODE);
    expect(recordExists).to.equal(true);
    expect(licenseText).to.equal(VALUE);
  });
});
