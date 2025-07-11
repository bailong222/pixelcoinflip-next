import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ethers } from 'ethers';
import { useAccount } from 'wagmi'; // Import useAccount from wagmi

// Define the type for a decoded Roll event
interface RollEvent {
  blockNumber: number;
  transactionHash: string;
  player: string;
  choice: number;
  outcome: number;
  won: boolean;
  timestamp: number;
}

const ROLL_EVENT_ABI = [
  {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "address",
          "name": "player",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "choice",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "outcome",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "bool",
          "name": "won",
          "type": "bool"
        }
      ],
      "name": "Roll",
      "type": "event"
    }
];

// Calculate the event topic0 (Keccak-256 hash of the signature)
const ROLL_EVENT_TOPIC0 = "0x6a36edc3de667e6793a2ba35d399e66bc104715b2cf33cf36188c64c5c90fc83";

// Replace with your actual contract address on Polygon
const CONTRACT_ADDRESS = "0x74e7f9C3056f4921c3f0078dE2B8c662265BB66C"; 

// Accessing API key using import.meta.env, as specified for Vite
const ETHERSCAN_API_KEY = 'KMVNWD4VA4QV6USFD52CQJ32YKV37KU7UP';

const POLLING_INTERVAL = 5000; // Poll every 5 seconds

const PlayerEvents: React.FC = () => {
  // Use useAccount from wagmi to get the connected address
  const { address: currentAccount, isConnected } = useAccount();
  const [events, setEvents] = useState<RollEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastBlock, setLastBlock] = useState<number | null>(null);
  

  useEffect(() => {
    let pollingIntervalId: number | null = null; 

    const fetchRollEvents = async () => {
      if (lastBlock === null) {
        setLoading(true);
      }
      setError(null); 

      if (!ETHERSCAN_API_KEY) {
        setError("Loading");
        setLoading(false);
        return;
      }
      
      const currentFromBlock = lastBlock ? lastBlock + 1 : 0;
      const toBlock = 'latest'; 

      const url = `https://api.polygonscan.com/api?module=logs&action=getLogs&address=${CONTRACT_ADDRESS}&fromBlock=${currentFromBlock}&toBlock=${toBlock}&topic0=${ROLL_EVENT_TOPIC0}&apikey=${ETHERSCAN_API_KEY}`;

      try {
        const response = await axios.get(url);
        const data = response.data;

        if (data.status === "1") {
          const rawEvents = data.result;
          const decodedNewEvents: RollEvent[] = [];
          let highestBlockInThisFetch = lastBlock || 0; 

          const iface = new ethers.Interface(ROLL_EVENT_ABI);

          for (const eventLog of rawEvents) {
            try {
              const parsedLog = iface.parseLog(eventLog);

              if (parsedLog && parsedLog.name === "Roll") {
                const blockNum = parseInt(eventLog.blockNumber, 16);
                const eventTimestamp = parseInt(eventLog.timeStamp, 16);
                decodedNewEvents.push({
                  blockNumber: blockNum,
                  transactionHash: eventLog.transactionHash,
                  player: parsedLog.args.player,
                  choice: Number(parsedLog.args.choice), 
                  outcome: Number(parsedLog.args.outcome),
                  won: parsedLog.args.won,
                  timestamp: eventTimestamp,
                });
                highestBlockInThisFetch = Math.max(highestBlockInThisFetch, blockNum);
              }
            } catch (parseError) {
              console.error("Error parsing a log:", parseError, eventLog);
            }
          }

          if (decodedNewEvents.length > 0) {
            decodedNewEvents.sort((a, b) => b.blockNumber - a.blockNumber);

            setEvents((prevEvents) => {
              const existingTxHashes = new Set(prevEvents.map(e => e.transactionHash));
              const uniqueNewEvents = decodedNewEvents.filter(e => !existingTxHashes.has(e.transactionHash));
              
              const combinedEvents = [...uniqueNewEvents, ...prevEvents];
              return combinedEvents.sort((a, b) => b.blockNumber - a.blockNumber);
            });
            
            setLastBlock(highestBlockInThisFetch);
          }
        } else {
          setError(`Error`);
          console.error("PolygonScan API Error:", data.message, "Result:", data.result);
        }
      } catch (err) {
        if (axios.isAxiosError(err)) {
          setError(`Network error: ${err.message}`);
        } else {
          setError("An unexpected error occurred.");
        }
        console.error("Failed to fetch your bets", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRollEvents();

    pollingIntervalId = setInterval(fetchRollEvents, POLLING_INTERVAL) as unknown as number;

    return () => {
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
      }
    };
  }, []); // Empty dependency array. Polling handles updates.

  // --- Conditional Rendering for UI Feedback ---
  if (loading && events.length === 0) {
    return <div className="p-4 text-center text-blue-600">Loading past bets...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-600 text-center">Error: {error}</div>;
  }

  if (!isConnected || !currentAccount) {
    return <div className="p-4 text-center text-yellow-600">Please connect your wallet to see your past bets.</div>;
  }

   const formatTimestamp = (timestamp: number): string => {
    // Unix timestamp from PolygonScan is in seconds, Date() expects milliseconds
    const date = new Date(timestamp * 1000); 
    return date.toLocaleString(); // Formats to local date and time string
  };
  // Filter events based on the current connected account
  const filteredEvents = events.filter(event => 
    event.player.toLowerCase() === currentAccount.toLowerCase()
  );

  // Display message if no events are found for the connected account after filtering
  if (filteredEvents.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No bets found for your connected address ({currentAccount.slice(0, 6)}...{currentAccount.slice(-4)}).
      </div>
    );
  }

  // --- Main Event Display ---
  return (
    <div className="p-2 rounded-lg shadow-md max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-4 text-center text-white">Your Bets</h2>
      <p className="text-center text-sm text-gray-400 mb-4">
        Showing past bets for connected address: <span className=" text-white">{currentAccount.slice(0, 6)}...{currentAccount.slice(-4)}</span>
      </p>

      {/* Scrollable div with max-height and overflow-y-auto */}
      <div className="space-y-4 border border-yellow-700 p-2 rounded h-80 overflow-y-auto"> {/* Added h-80 (max height) and overflow-y-auto */}
        {filteredEvents.map((event) => ( // Display all filtered events
          <div key={event.transactionHash} className="p-2 rounded-md text-white">
            <p>
              You chose {event.choice === 0 ? "Heads" : "Tails"} and <span className="text-white">{event.won ? "Won" : "Lost"}</span>
            </p>
            {/* You can add more event details here if needed */}
            <p className="text-xs text-gray-400">Block: {event.blockNumber} - Time: {formatTimestamp(event.timestamp)}</p>
           
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlayerEvents;