# Veil Roll

Veil Roll is a fully encrypted two-ball draw built on Zama FHEVM. Players buy a ticket with two numbers (1-9), the draw happens on-chain with encrypted randomness, and points are stored and revealed only by the player.

## Overview

Veil Roll demonstrates how fully homomorphic encryption (FHE) makes games private by design. Every sensitive value stays encrypted in the smart contract: user picks, draw results, and points. The UI can display encrypted handles and only the wallet owner can request a decryption via the Zama relayer flow.

## What Problem It Solves

Most on-chain games leak player inputs and outcomes because data must be public to be verifiable. Veil Roll keeps the entire draw lifecycle confidential:

- Player picks are never revealed on-chain.
- Draw results remain encrypted; only the player can decrypt.
- Points are accumulated privately and can be selectively revealed by the owner.

This makes lotteries, raffles, and reward systems possible without exposing personal choices or gameplay outcomes to the public mempool.

## How It Works (End-to-End Flow)

1. Player connects a wallet on Sepolia.
2. Player selects two numbers between 1 and 9.
3. The frontend encrypts the numbers client-side using the Zama relayer SDK.
4. The encrypted ticket is sent to the VeilRoll contract with a fixed ticket price of 0.001 ETH.
5. Player starts a draw; the contract generates two encrypted random numbers.
6. The contract compares encrypted ticket and draw numbers. If both match, it adds 10,000 points.
7. The UI displays encrypted handles for points and draw results.
8. Player signs an EIP-712 request to decrypt their own points through the relayer.
9. The UI shows decrypted points only to the player.

## Key Features

- Fully encrypted ticket purchase and draw flow using FHEVM primitives.
- Encrypted points accounting with selective decryption by the owner.
- On-chain encrypted randomness for two independent draws.
- Simple, transparent prize rule: match both numbers to earn 10,000 points.
- CLI tasks for encrypted ticket purchase, draws, and point decryption.
- React + Vite UI that reads with viem and writes with ethers.

## Advantages

- Privacy by default: inputs, outputs, and points remain encrypted.
- No trusted server: encryption, computation, and storage live on-chain.
- Clear user control: only the wallet owner can decrypt their points.
- Minimal surface area: small contract and straightforward UI flow.
- Easy to extend into larger confidential game mechanics.

## Smart Contract Design

Contract: `contracts/VeilRoll.sol`

- `TICKET_PRICE` is fixed at 0.001 ETH.
- `WIN_REWARD` is fixed at 10,000 points.
- Ticket numbers are stored as `euint8`.
- Points are stored as `euint32`.
- Per-player state:
  - ticket: encrypted numbers + existence flag
  - last draw: encrypted numbers + existence flag
  - points: encrypted balance + initialization flag
- The contract never decrypts. All comparisons and additions are done on ciphertext.
- View methods accept a `player` address to fetch encrypted values, avoiding `msg.sender` in view logic.

Events:

- `TicketPurchased(address player)`
- `DrawCompleted(address player)`

## Frontend App

Location: `ui/`

The UI is built for Sepolia and uses the Zama relayer SDK to handle encryption and decryption requests.

Main responsibilities:

- Encrypt ticket numbers locally and submit `buyTicket`.
- Call `startDraw` to trigger encrypted randomness.
- Read encrypted handles for points and draw results.
- Request user decryption with EIP-712 signing.

Important configuration steps:

- Update `ui/src/config/contracts.ts` with:
  - The deployed contract address.
  - The ABI copied from `deployments/sepolia/VeilRoll.json`.
- Update `ui/src/config/wagmi.ts` with a valid WalletConnect project id.

## Project Structure

```
contracts/        Veil Roll contract (FHEVM)
deploy/           Hardhat deploy scripts
docs/             Zama FHEVM and relayer references
tasks/            Hardhat tasks for CLI interaction
test/             Local and Sepolia tests
ui/               React + Vite frontend
```

## Tech Stack

Smart Contracts:

- Solidity 0.8.27
- Zama FHEVM library and hardhat plugin
- Hardhat, hardhat-deploy, typechain, chai
- Ethers v6

Frontend:

- React + TypeScript + Vite
- wagmi + RainbowKit for wallet connectivity
- viem for contract reads
- ethers for contract writes
- @zama-fhe/relayer-sdk for encryption and decryption

## Setup and Usage

### Prerequisites

- Node.js 20+
- npm

### Install Dependencies

```bash
npm install
```

### Environment Setup

Create a `.env` file in the project root:

```bash
PRIVATE_KEY=your_private_key
INFURA_API_KEY=your_infura_api_key
ETHERSCAN_API_KEY=optional_etherscan_api_key
```

### Compile and Test (Local)

```bash
npm run compile
npm run test
```

### Local Hardhat Node + Deploy

```bash
npx hardhat node
npx hardhat deploy --network localhost
```

### Sepolia Deploy

```bash
npx hardhat deploy --network sepolia
```

### CLI Tasks

```bash
npx hardhat --network sepolia task:address
npx hardhat --network sepolia task:buy-ticket --first 3 --second 7
npx hardhat --network sepolia task:draw
npx hardhat --network sepolia task:decrypt-points
```

### Frontend Setup

```bash
cd ui
npm install
npm run dev
```

After deploying on Sepolia, update `ui/src/config/contracts.ts` with the deployed address and ABI.

## Operational Notes and Limitations

- Randomness is provided by FHEVM encrypted random generation. It is not a VRF.
- Points are internal to the app and are not transferable value.
- Encrypted values appear as handles; they must be decrypted through the relayer flow.
- The UI is configured for Sepolia only.

## Future Roadmap

- Multi-ticket support per address with history and batch draws.
- Configurable ticket pricing and reward tiers.
- Optional public leaderboard with opt-in disclosure of points.
- Additional encrypted game modes with more balls or weighted odds.
- UX improvements for decrypt history and export of receipts.
- Security review and gas optimizations for production readiness.

## License

BSD-3-Clause-Clear. See `LICENSE`.
