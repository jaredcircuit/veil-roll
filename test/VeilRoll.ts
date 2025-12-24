import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { VeilRoll, VeilRoll__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("VeilRoll")) as VeilRoll__factory;
  const veilRollContract = (await factory.deploy()) as VeilRoll;
  const veilRollContractAddress = await veilRollContract.getAddress();

  return { veilRollContract, veilRollContractAddress };
}

describe("VeilRoll", function () {
  let signers: Signers;
  let veilRollContract: VeilRoll;
  let veilRollContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ veilRollContract, veilRollContractAddress } = await deployFixture());
  });

  it("requires a ticket price to buy", async function () {
    const encryptedInput = await fhevm
      .createEncryptedInput(veilRollContractAddress, signers.alice.address)
      .add8(3)
      .add8(7)
      .encrypt();

    await expect(
      veilRollContract
        .connect(signers.alice)
        .buyTicket(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof),
    ).to.be.revertedWith("Invalid ticket price");
  });

  it("allows buying a ticket and decrypting zero points", async function () {
    const encryptedInput = await fhevm
      .createEncryptedInput(veilRollContractAddress, signers.alice.address)
      .add8(3)
      .add8(7)
      .encrypt();

    const tx = await veilRollContract
      .connect(signers.alice)
      .buyTicket(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof, {
        value: ethers.parseEther("0.001"),
      });
    await tx.wait();

    const hasTicket = await veilRollContract.hasTicket(signers.alice.address);
    expect(hasTicket).to.eq(true);

    const encryptedPoints = await veilRollContract.getPoints(signers.alice.address);
    const clearPoints = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedPoints,
      veilRollContractAddress,
      signers.alice,
    );
    expect(clearPoints).to.eq(0);
  });

  it("draws numbers and awards points on a match", async function () {
    const encryptedInput = await fhevm
      .createEncryptedInput(veilRollContractAddress, signers.alice.address)
      .add8(3)
      .add8(7)
      .encrypt();

    const buyTx = await veilRollContract
      .connect(signers.alice)
      .buyTicket(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof, {
        value: ethers.parseEther("0.001"),
      });
    await buyTx.wait();

    const drawTx = await veilRollContract.connect(signers.alice).startDraw();
    await drawTx.wait();

    const encryptedDraw = await veilRollContract.getLastDraw(signers.alice.address);
    const clearFirst = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      encryptedDraw[0],
      veilRollContractAddress,
      signers.alice,
    );
    const clearSecond = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      encryptedDraw[1],
      veilRollContractAddress,
      signers.alice,
    );

    expect(clearFirst).to.be.gte(1);
    expect(clearFirst).to.be.lte(9);
    expect(clearSecond).to.be.gte(1);
    expect(clearSecond).to.be.lte(9);

    const encryptedPoints = await veilRollContract.getPoints(signers.alice.address);
    const clearPoints = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedPoints,
      veilRollContractAddress,
      signers.alice,
    );

    expect([0, 10000]).to.include(clearPoints);
  });
});
