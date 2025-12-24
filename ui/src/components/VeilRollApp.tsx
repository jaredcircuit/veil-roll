import { useMemo, useState } from 'react';
import { Contract } from 'ethers';
import { useAccount, useReadContract } from 'wagmi';
import { Header } from './Header';
import { CONTRACT_ABI, CONTRACT_ADDRESS, TICKET_PRICE_WEI } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import '../styles/VeilRollApp.css';

const EMPTY_HANDLE = '0x' + '0'.repeat(64);
const IS_CONFIGURED = true;

const formatHandle = (handle?: string) => {
  if (!handle) {
    return '-';
  }
  return `${handle.slice(0, 10)}...${handle.slice(-8)}`;
};

export function VeilRollApp() {
  const { address } = useAccount();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [firstNumber, setFirstNumber] = useState('');
  const [secondNumber, setSecondNumber] = useState('');
  const [isBuying, setIsBuying] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptedPoints, setDecryptedPoints] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const canInteract = !!address && IS_CONFIGURED;

  const { data: hasTicket, refetch: refetchTicket } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'hasTicket',
    args: address ? [address] : undefined,
    query: {
      enabled: canInteract,
    },
  });

  const { data: hasDraw, refetch: refetchDraw } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'hasDraw',
    args: address ? [address] : undefined,
    query: {
      enabled: canInteract,
    },
  });

  const hasTicketValue = Boolean(hasTicket);
  const hasDrawValue = Boolean(hasDraw);

  const { data: encryptedPoints, refetch: refetchPoints, isFetching: isPointsLoading } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getPoints',
    args: address ? [address] : undefined,
    query: {
      enabled: canInteract && hasTicketValue,
    },
  });

  const { data: encryptedDraw } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getLastDraw',
    args: address ? [address] : undefined,
    query: {
      enabled: canInteract && hasDrawValue,
    },
  });

  const encryptedPointsHandle = encryptedPoints as string | undefined;
  const encryptedDrawFirst = useMemo(() => {
    if (!encryptedDraw || !Array.isArray(encryptedDraw)) {
      return undefined;
    }
    return encryptedDraw[0] as string;
  }, [encryptedDraw]);
  const encryptedDrawSecond = useMemo(() => {
    if (!encryptedDraw || !Array.isArray(encryptedDraw)) {
      return undefined;
    }
    return encryptedDraw[1] as string;
  }, [encryptedDraw]);

  const resetMessages = () => {
    setErrorMessage('');
    setStatusMessage('');
  };

  const buyTicket = async () => {
    resetMessages();
    setDecryptedPoints(null);

    if (!IS_CONFIGURED) {
      setErrorMessage('Contract address is not configured.');
      return;
    }
    if (!address || !instance || !signerPromise) {
      setErrorMessage('Connect your wallet and wait for encryption to load.');
      return;
    }

    const firstValue = Number(firstNumber);
    const secondValue = Number(secondNumber);
    if (!Number.isInteger(firstValue) || firstValue < 1 || firstValue > 9) {
      setErrorMessage('First number must be between 1 and 9.');
      return;
    }
    if (!Number.isInteger(secondValue) || secondValue < 1 || secondValue > 9) {
      setErrorMessage('Second number must be between 1 and 9.');
      return;
    }

    setIsBuying(true);
    try {
      const input = instance.createEncryptedInput(CONTRACT_ADDRESS, address);
      input.add8(firstValue);
      input.add8(secondValue);
      const encryptedInput = await input.encrypt();

      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Signer not available');
      }

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.buyTicket(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.inputProof,
        { value: TICKET_PRICE_WEI }
      );
      await tx.wait();

      setStatusMessage('Ticket purchased. Your encrypted numbers are locked.');
      await refetchTicket();
      await refetchPoints();
    } catch (error) {
      console.error('buyTicket failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to buy ticket.');
    } finally {
      setIsBuying(false);
    }
  };

  const startDraw = async () => {
    resetMessages();
    setDecryptedPoints(null);

    if (!IS_CONFIGURED) {
      setErrorMessage('Contract address is not configured.');
      return;
    }
    if (!address || !signerPromise) {
      setErrorMessage('Connect your wallet first.');
      return;
    }

    setIsDrawing(true);
    try {
      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Signer not available');
      }

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.startDraw();
      await tx.wait();

      setStatusMessage('Draw completed. Points updated if you matched.');
      await refetchDraw();
      await refetchPoints();
    } catch (error) {
      console.error('startDraw failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to start draw.');
    } finally {
      setIsDrawing(false);
    }
  };

  const decryptPoints = async () => {
    resetMessages();

    if (!instance || !address || !encryptedPointsHandle || !signerPromise) {
      setErrorMessage('Missing encrypted points or wallet connection.');
      return;
    }
    if (encryptedPointsHandle === EMPTY_HANDLE) {
      setErrorMessage('Points have not been initialized yet.');
      return;
    }

    setIsDecrypting(true);
    try {
      const keypair = instance.generateKeypair();
      const handleContractPairs = [
        {
          handle: encryptedPointsHandle,
          contractAddress: CONTRACT_ADDRESS,
        },
      ];

      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const contractAddresses = [CONTRACT_ADDRESS];

      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);
      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Signer not available');
      }

      const signature = await signer.signTypedData(
        eip712.domain,
        {
          UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
        },
        eip712.message
      );

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays
      );

      const decrypted = result[encryptedPointsHandle] ?? '0';
      setDecryptedPoints(String(decrypted));
      setStatusMessage('Points decrypted successfully.');
    } catch (error) {
      console.error('decryptPoints failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to decrypt points.');
    } finally {
      setIsDecrypting(false);
    }
  };

  return (
    <div className="veil-roll-app">
      <Header />
      <main className="veil-roll-main">
        <section className="hero">
          <div className="hero-copy">
            <p className="hero-label">Sepolia - Encrypted Draw</p>
            <h2>Pick two numbers. Let the veil decide.</h2>
            <p className="hero-subtitle">
              Your picks stay encrypted, the draw stays encrypted, and only you can reveal your points.
            </p>
          </div>
          <div className="hero-badge">
            <div className="badge-title">Ticket</div>
            <div className="badge-value">0.001 ETH</div>
            <div className="badge-foot">2 encrypted balls / 1-9</div>
          </div>
        </section>

        {!IS_CONFIGURED && (
          <div className="notice warning">
            Contract address is not configured. Update `ui/src/config/contracts.ts` after deployment.
          </div>
        )}

        {zamaError && <div className="notice warning">{zamaError}</div>}

        <div className="panel-grid">
          <section className="panel">
            <h3>Buy a Ticket</h3>
            <p className="panel-subtitle">
              Choose two numbers between 1 and 9. Your picks are encrypted before hitting the chain.
            </p>
            <div className="number-row">
              <div className="number-field">
                <label htmlFor="first-number">First ball</label>
                <input
                  id="first-number"
                  type="number"
                  min={1}
                  max={9}
                  value={firstNumber}
                  onChange={(event) => setFirstNumber(event.target.value)}
                  placeholder="1-9"
                />
              </div>
              <div className="number-field">
                <label htmlFor="second-number">Second ball</label>
                <input
                  id="second-number"
                  type="number"
                  min={1}
                  max={9}
                  value={secondNumber}
                  onChange={(event) => setSecondNumber(event.target.value)}
                  placeholder="1-9"
                />
              </div>
            </div>
            <button
              className="primary-button"
              onClick={buyTicket}
              disabled={!canInteract || zamaLoading || isBuying}
            >
              {isBuying ? 'Encrypting & Buying...' : 'Buy Ticket'}
            </button>
            {!address && <p className="panel-hint">Connect your wallet to buy a ticket.</p>}
          </section>

          <section className="panel highlight">
            <h3>Start the Draw</h3>
            <p className="panel-subtitle">
              Two encrypted random numbers are generated on-chain. Match both to earn 10,000 points.
            </p>
            <div className="draw-status">
              <div>
                <span className="status-label">Ticket</span>
                <span className="status-value">{hasTicketValue ? 'Ready' : 'None'}</span>
              </div>
              <div>
                <span className="status-label">Last draw</span>
                <span className="status-value">{hasDrawValue ? 'Stored' : '-'}</span>
              </div>
            </div>
            <button className="primary-button" onClick={startDraw} disabled={!canInteract || !hasTicketValue || isDrawing}>
              {isDrawing ? 'Drawing...' : 'Start Draw'}
            </button>
            {hasDrawValue && (
              <div className="encrypted-readout">
                <div>
                  <span className="status-label">Encrypted draw</span>
                </div>
                <div className="handle-list">
                  <span>{formatHandle(encryptedDrawFirst)}</span>
                  <span>{formatHandle(encryptedDrawSecond)}</span>
                </div>
              </div>
            )}
          </section>

          <section className="panel">
            <h3>Your Encrypted Points</h3>
            <p className="panel-subtitle">
              Points stay encrypted on-chain. Request a decrypt when you want to reveal them.
            </p>
            <div className="encrypted-readout">
              <span className="status-label">Handle</span>
              <code>{isPointsLoading ? 'Loading...' : formatHandle(encryptedPointsHandle)}</code>
            </div>
            <button
              className="secondary-button"
              onClick={decryptPoints}
              disabled={!canInteract || !encryptedPointsHandle || isDecrypting}
            >
              {isDecrypting ? 'Decrypting...' : 'Decrypt Points'}
            </button>
            {decryptedPoints !== null && (
              <div className="points-reveal">
                <span className="status-label">Clear points</span>
                <span className="points-value">{decryptedPoints}</span>
              </div>
            )}
            {encryptedPointsHandle === EMPTY_HANDLE && hasTicketValue && (
              <p className="panel-hint">Draw at least once to initialize points.</p>
            )}
          </section>
        </div>

        {(statusMessage || errorMessage) && (
          <div className={`notice ${errorMessage ? 'warning' : 'success'}`}>
            {errorMessage || statusMessage}
          </div>
        )}
      </main>
    </div>
  );
}
