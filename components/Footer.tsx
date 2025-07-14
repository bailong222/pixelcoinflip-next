import Image from "next/image";
import Link from "next/link";


export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="
      text-gray-200
      py-1 // Vertical padding
      shadow-inner-xl
      border-t border-yellow-700
      text-xs // Smaller default text size for the entire footer
    ">
      <div className="
        container mx-auto
        px-2
        flex flex-col items-center justify-between
        md:flex-row
        md:items-center
      ">

        {/* Brand/Logo Section */}
        <div className="mb-2 md:mb-0 md:w-1/3 text-center md:text-left">
            <h3 className="
              text-lg font-extrabold
              text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500
            ">
              PIXELCOINFLIP
            </h3>
          <p className="text-xxs mt-0.5 text-gray-400"> {/* Assuming text-xxs is defined, otherwise use text-xs */}
            Decentralized Gaming
          </p>
        </div>

        {/* Social Media/Contact - Only icons remain */}
        <div className="md:w-1/3 text-center md:text-right">
          <div className="flex justify-center md:justify-end space-x-2"> {/* space-x-2 for spacing between icons */}
            <Link href="https://pixelcoindice.com" target="blank"><Image src="/pixelcoindice.png" alt="pixelcoindice" width={40} height={40}/></Link>
            <Link href="https://x.com/pixelcoinfl1p?s=21" target="blank"><Image src="/icons8-x.svg" alt="X" width={40} height={40}/></Link>
        
          </div>
        </div>

      </div>

      {/* Copyright Section - No padding or margin */}
      <div className="
        border-t border-gray-700
        text-center text-gray-500 text-xxs // Assuming text-xxs is defined, otherwise use text-xs
        // Removed mt-2 and pt-1 for no margin/padding
      ">
        &copy; {currentYear} PIXELCOINFLIP. All rights reserved.
      </div>
    </footer>
  );
}