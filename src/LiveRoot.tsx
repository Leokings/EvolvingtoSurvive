import {PrivyProvider} from "@privy-io/react-auth";

import PrivySessionApp from "./PrivySessionApp";
import {privyStudionet} from "./studionet";

export default function LiveRoot({appId}: {appId: string}) {
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["wallet"],
        defaultChain: privyStudionet,
        supportedChains: [privyStudionet],
        appearance: {
          theme: "dark",
          accentColor: "#b8ef72",
          showWalletLoginFirst: true,
          walletChainType: "ethereum-only",
          walletList: [
            "metamask",
            "okx_wallet",
            "detected_ethereum_wallets",
            "wallet_connect_qr",
          ],
        },
      }}
    >
      <PrivySessionApp />
    </PrivyProvider>
  );
}
