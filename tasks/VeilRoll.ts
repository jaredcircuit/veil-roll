import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Local usage:
 *   - npx hardhat --network localhost deploy
 *   - npx hardhat --network localhost task:buy-ticket --first 3 --second 7
 *   - npx hardhat --network localhost task:draw
 *   - npx hardhat --network localhost task:decrypt-points
 *
 * Sepolia usage:
 *   - npx hardhat --network sepolia deploy
 *   - npx hardhat --network sepolia task:buy-ticket --first 3 --second 7
 *   - npx hardhat --network sepolia task:draw
 *   - npx hardhat --network sepolia task:decrypt-points
 */

task("task:address", "Prints the VeilRoll address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;
  const veilRoll = await deployments.get("VeilRoll");
  console.log("VeilRoll address is " + veilRoll.address);
});

task("task:buy-ticket", "Buys a ticket with two encrypted numbers")
  .addOptionalParam("address", "Optionally specify the VeilRoll contract address")
  .addParam("first", "The first number (1-9)")
  .addParam("second", "The second number (1-9)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const first = parseInt(taskArguments.first);
    const second = parseInt(taskArguments.second);
    if (!Number.isInteger(first) || first < 1 || first > 9) {
      throw new Error(`Argument --first must be an integer between 1 and 9`);
    }
    if (!Number.isInteger(second) || second < 1 || second > 9) {
      throw new Error(`Argument --second must be an integer between 1 and 9`);
    }

    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("VeilRoll");
    console.log(`VeilRoll: ${deployment.address}`);

    const signers = await ethers.getSigners();
    const veilRollContract = await ethers.getContractAt("VeilRoll", deployment.address);

    const encryptedInput = await fhevm
      .createEncryptedInput(deployment.address, signers[0].address)
      .add8(first)
      .add8(second)
      .encrypt();

    const tx = await veilRollContract
      .connect(signers[0])
      .buyTicket(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof, {
        value: ethers.parseEther("0.001"),
      });

    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
    console.log(`Ticket purchased: ${first}, ${second}`);
  });

task("task:draw", "Starts a draw for the caller")
  .addOptionalParam("address", "Optionally specify the VeilRoll contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("VeilRoll");
    console.log(`VeilRoll: ${deployment.address}`);

    const signers = await ethers.getSigners();
    const veilRollContract = await ethers.getContractAt("VeilRoll", deployment.address);

    const tx = await veilRollContract.connect(signers[0]).startDraw();
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
    console.log(`Draw completed.`);
  });

task("task:decrypt-points", "Decrypts the caller's encrypted points")
  .addOptionalParam("address", "Optionally specify the VeilRoll contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("VeilRoll");
    console.log(`VeilRoll: ${deployment.address}`);

    const signers = await ethers.getSigners();
    const veilRollContract = await ethers.getContractAt("VeilRoll", deployment.address);

    const encryptedPoints = await veilRollContract.getPoints(signers[0].address);
    if (encryptedPoints === ethers.ZeroHash) {
      console.log(`Encrypted points: ${encryptedPoints}`);
      console.log("Clear points    : 0");
      return;
    }

    const clearPoints = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedPoints,
      deployment.address,
      signers[0],
    );
    console.log(`Encrypted points: ${encryptedPoints}`);
    console.log(`Clear points    : ${clearPoints}`);
  });
