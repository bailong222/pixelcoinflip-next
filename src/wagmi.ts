import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { webSocket } from 'wagmi';
import {
  polygon,
} from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'pixelcoinflip',
  projectId: 'YOUR_PROJECT_ID',
  chains: [
    polygon
  ],
  ssr: true,
  transports: {
    [polygon.id]: webSocket('wss://polygon-mainnet.g.alchemy.com/v2/YUnppYpYem2Jf6S6s_6wVgOC8EQEw-4L'),
    
  },
});
