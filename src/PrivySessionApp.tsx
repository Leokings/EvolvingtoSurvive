import {usePrivy, useWallets} from "@privy-io/react-auth";

import App from "./App";
import type {ConnectedWallet} from "./wallet-network";

export default function PrivySessionApp() {
  const {ready, authenticated, login, logout} = usePrivy();
  const {wallets} = useWallets();
  const wallet = ready && authenticated && wallets.length
    ? wallets[0] as ConnectedWallet
    : null;

  return (
    <App
      wallet={wallet}
      authenticated={ready && authenticated}
      onConnect={login}
      onDisconnect={() => void logout()}
    />
  );
}
