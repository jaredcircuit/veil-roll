import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { VeilRoll } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("VeilRollSepolia", function () {
  let signers: Signers;
  let veilRollContract: VeilRoll;
  let veilRollContractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const deployment = await deployments.get("VeilRoll");
      veilRollContractAddress = deployment.address;
      veilRollContract = await ethers.getContractAt("VeilRoll", deployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("buys a ticket and completes a draw", async function () {
    steps = 9;
    this.timeout(4 * 40000);

    progress("Encrypting ticket numbers...");
    const encryptedInput = await fhevm
      .createEncryptedInput(veilRollContractAddress, signers.alice.address)
      .add8(3)
      .add8(7)
      .encrypt();

    progress(`Calling buyTicket() on VeilRoll=${veilRollContractAddress}...`);
    const buyTx = await veilRollContract
      .connect(signers.alice)
      .buyTicket(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof, {
        value: ethers.parseEther("0.001"),
      });
    await buyTx.wait();

    progress("Calling startDraw()...");
    const drawTx = await veilRollContract.connect(signers.alice).startDraw();
    await drawTx.wait();

    progress("Fetching encrypted points...");
    const encryptedPoints = await veilRollContract.getPoints(signers.alice.address);
    expect(encryptedPoints).to.not.eq(ethers.ZeroHash);

    progress("Decrypting points...");
    const clearPoints = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedPoints,
      veilRollContractAddress,
      signers.alice,
    );

    progress(`Clear points: ${clearPoints}`);
    expect([0, 10000]).to.include(clearPoints);
  });
});
