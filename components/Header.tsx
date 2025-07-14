import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useRouter } from "next/router"; // Import useRouter from next/router
import React from "react"; // Explicitly import React for TSX
import Link from "next/link";
function Header() {
  const router = useRouter(); // Initialize the router

  // Function to open the modal by setting a URL query parameter
  const openModal = (modalType: string) => {
    // Use router.push to update the URL with the new query parameter
    // shallow: true ensures the page component state isn't reset,
    // and it won't trigger data fetching methods like getServerSideProps.
    router.push(
      {
        pathname: router.pathname, // Keep the current path
        query: { modal: modalType }, // Add or update the 'modal' query parameter
      },
      undefined, // as argument (optional, typically same as href for simple cases)
      { shallow: true }
    );
  };
  
  return (
    <header className="text-white p-4">
      <div className="container mx-auto flex items-center justify-between">
        {/* Left-aligned buttons */}
        <div className="flex items-center">
          <button
            onClick={() => openModal('howtoplay')}
            className="text-xl text-white hover:bg-blue-200/20 font-bold py-2 px-4 rounded mr-2 transition duration-200 max-[750px]:hidden shadow-lg"
          >
            How To Play
          </button>
          <button
            onClick={() => openModal('bets')}
            className="text-xl text-white hover:bg-blue-200/20 font-bold py-2 px-4 rounded mr-2 transition duration-200 max-[750px]:hidden shadow-lg"
          >
            My Bets
          </button>

        </div>
        <div>
          <ConnectButton.Custom>
          {({
            account,
            chain,
            openAccountModal,
            openChainModal,
            openConnectModal,
            mounted,
          }) => {
            const ready = mounted;
            const connected = ready && account && chain;

            return (
              <div
                {...(!ready && {
                  'aria-hidden': true,
                  'style': {
                    opacity: 0,
                    pointerEvents: 'none',
                    userSelect: 'none',
                  },
                })}
                className="hover:bg-blue-200/20 p-2 rounded"
              >
                {(() => {
                  if (!connected) {
                    return (
                      <button onClick={openConnectModal} type="button">
                        Connect Wallet
                      </button>
                    );
                  }

                  if (chain.unsupported) {
                    return (
                      <button onClick={openChainModal} type="button">
                        Wrong network
                      </button>
                    );
                  }

                  return (
                    <div style={{ display: 'flex', gap: 12 }}>
                      <button
                        onClick={openAccountModal}
                        type="button"
                        style={{
                            border: 'none',
                            background: 'transparent',
                            outline: 'none',
                            padding: 0, // Ensure no padding around the balance text
                            boxShadow: 'none',
                            // Add other styles to remove any default button appearance
                        }}
                      >
                        {account.displayBalance ? (
                          <span>{account.displayBalance}</span>
                        ) : (
                          <span>Loading Balance...</span> // Or empty if you prefer
                        )}
                      </button>
                    </div>
                  );
                })()}
              </div>
            );
          }}
        </ConnectButton.Custom>
        </div>
      </div>
    </header>
  );
}

export default Header;