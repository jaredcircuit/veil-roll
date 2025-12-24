import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="header-left">
            <h1 className="header-title">Veil Roll</h1>
            <p className="header-subtitle">Encrypted two-ball draw with Zama FHE</p>
          </div>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
