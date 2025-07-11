import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ethers } from 'ethers';


// Define the type for a decoded Roll event
interface RollEvent {
  blockNumber: number;
  transactionHash: string;
  player: string;
  choice: number;
  outcome: number;
  won: boolean;
}

// Define the ABI for the Roll event
// This ABI is crucial for ethers.js to decode the log data correctly.
// Based on your specific input, this is how you defined it.
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
// Using the exact value you provided.
const ROLL_EVENT_TOPIC0 = "0x6a36edc3de667e6793a2ba35d399e66bc104715b2cf33cf36188c64c5c90fc83";

// Replace with your actual contract address on Polygon
const CONTRACT_ADDRESS = "0x74e7f9C3056f4921c3f0078dE2B8c662265BB66C"; // <<< IMPORTANT: Confirm this is correct for Polygon!

// Accessing API key using import.meta.env, as specified for Vite
const ETHERSCAN_API_KEY = 'KMVNWD4VA4QV6USFD52CQJ32YKV37KU7UP';

const POLLING_INTERVAL = 5000; // Poll every 5 seconds (adjust based on PolygonScan rate limits)

const RollEvents: React.FC = () => {
  const [events, setEvents] = useState<RollEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // State to keep track of the highest block number we've processed
  const [lastBlock, setLastBlock] = useState<number | null>(null);

  useEffect(() => {
    // Explicitly type as number for browser's setInterval ID
    let pollingIntervalId: number | null = null; 

    const fetchRollEvents = async () => {
      // Only show full-screen loading on the very first fetch
      if (lastBlock === null) {
        setLoading(true);
      }
      setError(null); // Clear previous errors on a new fetch attempt

      // Initial validation for essential configurations
      if (!ETHERSCAN_API_KEY) {
        setError("Loading past bets");
        setLoading(false);
        return;
      }
      

      // Determine the 'fromBlock' for the API query
      // For the first fetch, start from block 0 to get all historical events.
      // For subsequent fetches, start from lastBlock + 1 to get only new events.
      const currentFromBlock = lastBlock ? lastBlock + 1 : 0;
      const toBlock = 'latest'; // Always query up to the latest block

      // Construct the PolygonScan API URL
      const url = `https://api.polygonscan.com/api?module=logs&action=getLogs&address=${CONTRACT_ADDRESS}&fromBlock=${currentFromBlock}&toBlock=${toBlock}&topic0=${ROLL_EVENT_TOPIC0}&apikey=${ETHERSCAN_API_KEY}`;

      try {
        const response = await axios.get(url);
        const data = response.data;

        if (data.status === "1") {
          const rawEvents = data.result;
          const decodedNewEvents: RollEvent[] = [];
          let highestBlockInThisFetch = lastBlock || 0; // Initialize with last known or 0

          // Create an ethers.js Interface to decode logs based on the ABI
          const iface = new ethers.Interface(ROLL_EVENT_ABI);

          // Iterate through raw events received from PolygonScan and decode them
          for (const eventLog of rawEvents) {
            try {
              // Parse the log using the ABI; ethers.js handles indexed/non-indexed based on ABI
              const parsedLog = iface.parseLog(eventLog);

              // Ensure the log was successfully parsed and is our 'Roll' event
              if (parsedLog && parsedLog.name === "Roll") {
                const blockNum = parseInt(eventLog.blockNumber, 16);
                decodedNewEvents.push({
                  blockNumber: blockNum,
                  transactionHash: eventLog.transactionHash,
                  player: parsedLog.args.player,
                  choice: Number(parsedLog.args.choice), // Convert BigInt to number for display
                  outcome: Number(parsedLog.args.outcome),
                  won: parsedLog.args.won,
                });
                // Update the highest block number found in this batch of events
                highestBlockInThisFetch = Math.max(highestBlockInThisFetch, blockNum);
              }
            } catch (parseError) {
              // Log errors for individual log parsing without crashing the component
              console.error("Error parsing a log:", parseError, eventLog);
            }
          }

          if (decodedNewEvents.length > 0) {
            // Sort newly fetched events by blockNumber in descending order (most recent first)
            decodedNewEvents.sort((a, b) => b.blockNumber - a.blockNumber);

            setEvents((prevEvents) => {
              // Create a Set of existing transaction hashes for efficient duplicate checking
              const existingTxHashes = new Set(prevEvents.map(e => e.transactionHash));
              // Filter out new events that are already present in the current list
              const uniqueNewEvents = decodedNewEvents.filter(e => !existingTxHashes.has(e.transactionHash));
              
              // Combine unique new events with previous ones and re-sort the entire list.
              // This guarantees the 'most recent on top' order even after multiple fetches.
              const combinedEvents = [...uniqueNewEvents, ...prevEvents];
              return combinedEvents.sort((a, b) => b.blockNumber - a.blockNumber);
            });
            
            // Update the last processed block number for the next polling interval
            setLastBlock(highestBlockInThisFetch);
          }
          // If no new events were found, no update to 'events' state is needed.
          // Loading state handled in finally block.
        } else {
          // Handle API-specific errors (e.g., rate limits, invalid params)
          setError(`API error`);
          console.error("PolygonScan API Error:", data.message, "Result:", data.result);
        }
      } catch (err) {
        // Handle network errors (e.g., no internet connection)
        if (axios.isAxiosError(err)) {
          setError(`Network error: ${err.message}`);
        } else {
          setError("An unexpected error occurred.");
        }
        console.error("Failed to fetch past bets", err);
      } finally {
        // Ensure loading is set to false after any fetch attempt (success or failure)
        setLoading(false);
      }
    };

    // --- Component Lifecycle Setup ---
    // Perform an initial fetch when the component mounts
    fetchRollEvents();

    // Set up a polling interval to repeatedly fetch new events
    // Cast to 'number' to satisfy TypeScript's expectation for setInterval ID in browsers
    pollingIntervalId = setInterval(fetchRollEvents, POLLING_INTERVAL) as unknown as number;

    // Cleanup function: This runs when the component unmounts
    // It's crucial to clear the interval to prevent memory leaks and unnecessary requests
    return () => {
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
      }
    };
  }, []); // Empty dependency array ensures this effect runs only once on mount/initial render

  // --- Conditional Rendering for UI Feedback ---
  // Show loading indicator only if no events have been loaded yet
  if (loading && events.length === 0) {
    return <div className="p-4 text-center text-blue-600">Loading past bets...</div>;
  }

  // Display error message if an error occurred
  if (error) {
    return <div className="p-4 text-red-600 text-center">Error: {error}</div>;
  }

  // Display message if no events are found after loading
  if (events.length === 0) {
    return <div className="p-4 text-center text-gray-500">No past bets found for this contract.</div>;
  }

  // --- Main Event Display ---
  return (
    <div className="p-2 rounded-lg shadow-md max-w-2xl mx-auto">

      <div className="space-y-4 border border-yellow-700 p-2 rounded items-center flex flex-col ">
        {events.slice(0, 6).map((event) => (
          <div key={event.transactionHash} className=" p-2 rounded-md text-white">
            <p>
              Player: <span className="font-medium text-white">{event.player?.slice(0, 6)}...{event.player?.slice(-4)} chose {event.choice == 0 ? "Heads" : "Tails"} and <span className="text-white">{event.won ? "Won" : "Lost"}</span>
              </span>
            </p>
          
          </div>
        ))}
      </div>
    </div>
  );
};

export default RollEvents;
