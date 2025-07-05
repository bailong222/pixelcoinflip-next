'use client'
import React, { useState, useEffect, useRef } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent} from 'wagmi';
import { parseEther, Hex, formatEther } from 'viem';
import { ABI } from "../../components/ABI";
import Image from 'next/image';
import { readContract } from '@wagmi/core';
import { config } from '../wagmi';
import Head from 'next/head';
import Modal from '../../components/Modal';
import { useRouter } from 'next/router';
import PlayerEvents from "../../components/playerEvents"
import RollEvents from "../../components/events"

const COIN_CONTRACT_ADDRESS: Hex = "0x74e7f9C3056f4921c3f0078dE2B8c662265BB66C";

function CoinFlipGame() {
  const { address: playerAddress, isConnected } = useAccount();
  const [choice, setChoice] = useState<string>('0');
  const [bet, setBet] = useState<string>('0');
  const [isLoadingOutcome, setIsLoadingOutcome] = useState<boolean>(false);
  const [outcome, setOutcome] = useState<{ won: boolean } | null>(null);
  const [showResultScreen, setShowResultScreen] = useState<boolean>(false);

  // Wagmi hooks for sending the 'flip' transaction
  const { writeContract: flip, error: flipError} = useWriteContract();
  

  // State and hooks for managing player's withdrawable balance
  const [withdrawableBalance, setWithdrawableBalance] = useState<bigint>(0n);
    const { data: withdrawTxHash, writeContract: withdraw, isPending: isWithdrawTxPending, error: withdrawError } = useWriteContract();
    const { isLoading: isWithdrawTxConfirming, isSuccess: isWithdrawTxConfirmed } = useWaitForTransactionReceipt({
        hash: withdrawTxHash,
    });

  // Use a ref to store the latest playerAddress, useful for event listeners
  const playerAddressRef = useRef(playerAddress);
  useEffect(() => {
    playerAddressRef.current = playerAddress;
  }, [playerAddress]);

  const fetchPlayerBalance = async () => {
    if (!playerAddress) {
      setWithdrawableBalance(0n); // Reset if no player connected
      return;
    }
    try {
      const balance = await readContract(config, {
        abi: ABI,
        address: COIN_CONTRACT_ADDRESS,
        functionName: 'getPlayerBalance',
        args: [playerAddress],
      });
      setWithdrawableBalance(balance as bigint);
    } catch (err) {
      console.error("Error fetching player balance:", err);
    }
  };

  useEffect(() => {
    fetchPlayerBalance()
  },[isWithdrawTxConfirmed])

  useEffect(() => {
    fetchPlayerBalance()
  },[])

  // Listen for the Roll event (this is what determines win/loss)
  useWatchContractEvent({
    address: COIN_CONTRACT_ADDRESS,
    abi: ABI,
    eventName: 'Roll',
    enabled: !!playerAddress && isLoadingOutcome, 
    onLogs(logs) {
      const relevantLogs = logs.filter(log =>
        (log.args as { player: string, choice: BigInt, outcome: BigInt, won: boolean }).player === playerAddressRef.current
      );

      if (relevantLogs.length > 0) {
        const lastLog = relevantLogs[relevantLogs.length - 1];
        const args = lastLog.args as { won: boolean };
        setShowResultScreen(true);
        setOutcome({
          won: args.won
        });
        setIsLoadingOutcome(false); // Outcome received, stop loading
        fetchPlayerBalance(); // Fetch updated balance after a flip
      }
    },
  });

  // Handler for submitting the coin flip transaction
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerAddress) {
      // Potentially show a "Connect Wallet" message here instead of just returning
      return;
    }
    if (parseFloat(bet) <= 0 || isNaN(parseFloat(bet))) {
      // Potentially show an error for invalid bet
      return;
    }

 
    setOutcome(null);
    setShowResultScreen(false);
    setIsLoadingOutcome(true); 
  
    try {
      await flip({
        abi: ABI,
        address: COIN_CONTRACT_ADDRESS,
        functionName: 'flip',
        args: [BigInt(choice)],
        value: parseEther(bet),
      });
      console.log(isLoadingOutcome)
      // isFlippingTxPending will become true after this call, triggering loading UI
    } catch (err) {
      console.error("Error submitting flip transaction:", err);
      // Handle error: maybe show a user-friendly message
    }
  };
  useEffect(() => {
    if (flipError) {
      console.error("Flip transaction write error:", flipError);
      setIsLoadingOutcome(false);
      setOutcome(null);
      setShowResultScreen(false);
   
    }
  }, [flipError]);
  
  const handleWithdraw = async () => {
    if(!playerAddress){
      return;
    }
    if(withdrawableBalance === 0n){
      return;
    }
    try{
      await withdraw({
        abi: ABI,
        address: COIN_CONTRACT_ADDRESS,
        functionName: 'withdrawWinnings',
      });
    } catch(err){
      console.log("ror withdrawing")
    }
  }
  const handleWithdrawAndPlayAgain = async () => {
    if (!playerAddress) {
      return;
    }
    if (withdrawableBalance === 0n) {
      // If no winnings, just reset the screen to allow playing again
      setOutcome(null);
      setShowResultScreen(false);
      setIsLoadingOutcome(false);
      return;
    }

    try {
      // Initiate the withdrawal transaction
      await withdraw({
        abi: ABI,
        address: COIN_CONTRACT_ADDRESS,
        functionName: 'withdrawWinnings',
      });
     setIsLoadingOutcome(false);
     setShowResultScreen(false)
    } catch (err) {
      console.error("Error withdrawing:", err);
      // If withdrawal fails, still allow playing again by resetting the screen
      setOutcome(null);
      setShowResultScreen(false);
      setIsLoadingOutcome(false);
    }
  };
  // Combined disabled state for flip button
  const isFlipButtonDisabled = isLoadingOutcome || !isConnected;

  const router = useRouter(); // Initialize the router
  const { modal } = router.query; // Destructure the 'modal' query parameter

  // State variables for each specific modal's open/closed status
  const [isHowToPlayModalOpen, setIsHowToPlayModalOpen] = useState(false);
  const [isBetsModalOpen, setIsBetsModalOpen] = useState(false);
  // useEffect to react to changes in the 'modal' query parameter
  useEffect(() => {
    // If 'modal' query is 'howtoplay', open the how-to-play modal, close others
    if (modal === 'howtoplay') {
      setIsHowToPlayModalOpen(true);
      setIsBetsModalOpen(false);
    } 
    else if (modal === 'bets') {
      setIsBetsModalOpen(true);
      setIsHowToPlayModalOpen(false);
    }
    // If 'modal' query is not present or not recognized, close all modals
    else {
      setIsHowToPlayModalOpen(false);
      setIsBetsModalOpen(false);
    }
  }, [modal]);
  const closeModal = () => {
    setIsHowToPlayModalOpen(false);
    setIsBetsModalOpen(false);
    // Remove the 'modal' query parameter from the URL
    // router.pathname gets the current path (e.g., "/").
    // The second argument `undefined` makes it remove the query string.
    // { shallow: true } prevents a full page reload.
    router.push(router.pathname, undefined, { shallow: true });
  };

  return (
    <>
     <Head>
        <title>Pixelcoinflip: Decentralized gambling on the Polygon Blockchain</title>
        <meta
          content="Coinflip betting game on the Polygon blockchain. Decentralized and fair. Connect your wallet, flip and withdraw"
          name="description"
        />
        <link href="/favicon.png" rel="icon" />
      </Head>
    <div className=" mx-auto rounded-lg w-1/3">
          {isLoadingOutcome ? (
            <div className="flex flex-col items-center justify-center min-h-[200px] gap-5 p-4">
                <Image src="/giftest.gif" alt='loading' height={300} width={300} unoptimized/>
              </div>
          ) : showResultScreen && outcome ? (
            // Result state: Show "You Won!" or "You Lost!" and a "Withdraw Winnings" button
            <div className={`mt-5 p-8 rounded-lg text-center min-h-[200px] flex flex-col items-center justify-center
                          ${outcome.won ? 'bg-green-100 border border-green-400 text-green-700' : 'bg-red-100 border border-red-400 text-red-700'}`}>
              <h2 className="text-5xl font-extrabold mb-4 animate-bounce">
                {outcome.won ? 'YOU WON!' : 'YOU LOST.'}
              </h2>
              <button
                onClick={handleWithdrawAndPlayAgain}
                className="px-8 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 transition-colors duration-200 text-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isWithdrawTxPending ? 'Withdrawing...' : (withdrawableBalance > 0n ? 'Claim Winnings' : 'Play Again')}
              </button>
            </div>
          ) : (
            // Default state: Show betting form
            <>
             <form onSubmit={handleSubmit}>
  {/* Main grid container for the entire form: now 3 columns */}
  <div className="grid grid-cols-6 gap-4 mb-6 p-4 rounded-lg">

    {/* Heads and Tails Buttons Section */}
    <h1 className='col-span-6 text-white text-center text-2xl mb-2'><strong>CHOOSE WHAT TO BET ON</strong></h1>

    <button
      type="button"
      onClick={() => setChoice('0')}
      className={`
        col-span-3
        px-8 py-5
        bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600
        text-white font-bold text-2xl
        rounded-xl mb-4
        shadow-lg
        transition-all duration-300 ease-in-out
        ${choice === '0' ? "border-3 border-white" : "border-3 border-transparent"}
        hover:from-yellow-500 hover:via-yellow-600 hover:to-yellow-700
        hover:shadow-xl hover:-translate-y-1
        active:scale-95 active:shadow-inner
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
    >
      HEADS
    </button>
    <button
      type="button"
      onClick={() => setChoice('1')}
      className={`
        col-span-3
        px-8 py-5
        bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600
        text-white font-bold text-2xl
        rounded-xl mb-4
        shadow-lg
        transition-all duration-300 ease-in-out
        ${choice === '1' ? "border-3 border-white" : "border-3 border-transparent"}
        hover:from-yellow-500 hover:via-yellow-600 hover:to-yellow-700
        hover:shadow-xl hover:-translate-y-1
        active:scale-95 active:shadow-inner
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
    >
      TAILS
    </button>

    {/* Bet Amount Buttons Section */}
    <h1 className='col-span-6 text-white text-center text-2xl mb-2'><strong>CHOOSE A BET AMOUNT</strong></h1>

    {/* Each bet button naturally flows into a 3-column layout */}
     <button
      type="button"
      onClick={() => setBet('5')}
      className={`
        col-span-2
        px-4 py-4
        bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600
        text-white font-bold text-xl
        rounded-xl
        shadow-lg
        transition-all duration-300 ease-in-out
        ${bet === '5' ? "border-3 border-white" : "border-3 border-transparent"}
        hover:from-yellow-500 hover:via-yellow-600 hover:to-yellow-700
        hover:shadow-xl hover:-translate-y-1
        active:scale-95 active:shadow-inner
        disabled:opacity-50 disabled:cursor-not-allowed
        flex items-center justify-center
        gap-2
      `}
    >
      5 <Image src="/polygon-logo.png" alt='polygon' height={30} width={30}/>
    </button>
    <button
      type="button"
      onClick={() => setBet('10')}
      className={`
        col-span-2
        px-4 py-4
        bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600
        text-white font-bold text-xl
        rounded-xl
        shadow-lg
        transition-all duration-300 ease-in-out
        ${bet === '10' ? "border-3 border-white" : "border-3 border-transparent"}
        hover:from-yellow-500 hover:via-yellow-600 hover:to-yellow-700
        hover:shadow-xl hover:-translate-y-1
        active:scale-95 active:shadow-inner
        disabled:opacity-50 disabled:cursor-not-allowed
        flex items-center justify-center
        gap-2
      `}
    >
      10 <Image src="/polygon-logo.png" alt='polygon' height={30} width={30}/>
    </button>
    <button
      type="button"
      onClick={() => setBet('20')}
      className={`
        col-span-2
        px-4 py-4
        bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600
        text-white font-bold text-xl
        rounded-xl
        shadow-lg
        transition-all duration-300 ease-in-out
        ${bet === '20' ? "border-3 border-white" : "border-3 border-transparent"}
        hover:from-yellow-500 hover:via-yellow-600 hover:to-yellow-700
        hover:shadow-xl hover:-translate-y-1
        active:scale-95 active:shadow-inner
        disabled:opacity-50 disabled:cursor-not-allowed
        flex items-center justify-center
        gap-2
      `}
    >
      20 <Image src="/polygon-logo.png" alt='polygon' height={30} width={30}/>
    </button>
    <button
      type="button"
      onClick={() => setBet('30')}
      className={`
        col-span-2
        px-4 py-4
        bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600
        text-white font-bold text-xl
        rounded-xl
        shadow-lg
        transition-all duration-300 ease-in-out
        ${bet === '30' ? "border-3 border-white" : "border-3 border-transparent"}
        hover:from-yellow-500 hover:via-yellow-600 hover:to-yellow-700
        hover:shadow-xl hover:-translate-y-1
        active:scale-95 active:shadow-inner
        disabled:opacity-50 disabled:cursor-not-allowed
        flex items-center justify-center
        gap-2
      `}
    >
      30 <Image src="/polygon-logo.png" alt='polygon' height={30} width={30}/>
    </button>
    <button
      type="button"
      onClick={() => setBet('40')}
      className={`
        col-span-2
        px-4 py-4
        bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600
        text-white font-bold text-xl
        rounded-xl
        shadow-lg
        transition-all duration-300 ease-in-out
        ${bet === '40' ? "border-3 border-white" : "border-3 border-transparent"}
        hover:from-yellow-500 hover:via-yellow-600 hover:to-yellow-700
        hover:shadow-xl hover:-translate-y-1
        active:scale-95 active:shadow-inner
        disabled:opacity-50 disabled:cursor-not-allowed
        flex items-center justify-center
        gap-2
      `}
    >
      40 <Image src="/polygon-logo.png" alt='polygon' height={30} width={30}/>
    </button>
    <button
      type="button"
      onClick={() => setBet('50')}
      className={`
        col-span-2
        px-4 py-4
        bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600
        text-white font-bold text-xl
        rounded-xl
        shadow-lg
        transition-all duration-300 ease-in-out
        ${bet === '50' ? "border-3 border-white" : "border-3 border-transparent"}
        hover:from-yellow-500 hover:via-yellow-600 hover:to-yellow-700
        hover:shadow-xl hover:-translate-y-1
        active:scale-95 active:shadow-inner
        disabled:opacity-50 disabled:cursor-not-allowed
        flex items-center justify-center
        gap-2
      `}
    >
      50 <Image src="/polygon-logo.png" alt='polygon' height={30} width={30}/>
    </button>

    {/* Flip Button */}
    <button
      type="submit"
      disabled={isFlipButtonDisabled}
      className="
        col-span-6
        px-8 py-4
        bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600
        text-white font-bold text-xl
        rounded-xl
        shadow-lg
        transition-all duration-300 ease-in-out
        hover:from-yellow-500 hover:via-yellow-600 hover:to-yellow-700
        hover:shadow-xl hover:-translate-y-1
        active:scale-95 active:shadow-inner
        focus:outline-none focus:ring-4 focus:ring-white focus:ring-opacity-75
        disabled:cursor-not-allowed
      "
    >
      FLIP COIN
    </button>
  </div>
</form>
       </>
          )}
    {!isConnected && <RollEvents/>}
    </div>

      {/* How To Play Modal */}
      <Modal isOpen={isHowToPlayModalOpen} onClose={closeModal}>
        <div className="mt-2 text-lg/6 text-white/70">
          <ol className="list-decimal list-inside text-gray-300">
            <li>Connect your wallet</li>
            <li>Choose Heads or Tails</li>
            <li>Choose a bet amount and flip</li>
            <li>Wait for the outcome</li>
            <li>Withdraw and play again</li>
          </ol>
          <p className="mt-4 text-sm text-gray-300">
            If your bet gets stuck for too long, dont worry. Everything is handled on the blockchain. Refresh and check your bets
          </p>
        </div>
      </Modal>
      <Modal isOpen={isBetsModalOpen} onClose={closeModal}>
        <PlayerEvents/>
        <div className='flex flex-row justify-between mt-2 text-white items-center'>
        <p>Your withdrawable balance: {formatEther(withdrawableBalance)} POL</p>
        <button onClick={handleWithdraw} className='text-white bg-green-700 p-1 rounded'>withdraw</button>
        </div>
      </Modal>
      </>
  );
}

export default CoinFlipGame;