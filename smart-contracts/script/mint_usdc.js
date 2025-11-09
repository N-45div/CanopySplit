// Mint Aave Sepolia USDC tokens
// Make sure you have ethers.js installed: npm install ethers

const { ethers } = require('ethers');

// Configuration
const USDC_ADDRESS = '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8';
const YOUR_ADDRESS = '0xa997440d6d6351bd881c8e437b992d26fb9fa23b';
const AMOUNT_TO_MINT = ethers.parseUnits('1000', 6); // 1000 USDC (6 decimals)

// Sepolia RPC URL - replace with your own from Alchemy, Infura, or other provider
const SEPOLIA_RPC = 'https://sepolia.infura.io/v3/bdc5f1768fc64bb19e207871175e935a';

// Your wallet private key - KEEP THIS SECURE!
const PRIVATE_KEY = 'dccf10c7fd46b7f20c2d69d7ef43a0bf3e70b89e79602497cac7a91c082618a1';

// Minimal ABI for TestnetERC20 mint function
const MINT_ABI = [
  'function mint(address to, uint256 amount) external returns (bool)'
];

async function mintUSDC() {
  try {
    // Connect to Sepolia
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    // Connect to USDC contract
    const usdcContract = new ethers.Contract(USDC_ADDRESS, MINT_ABI, wallet);
    
    console.log('Minting USDC to:', YOUR_ADDRESS);
    console.log('Amount:', ethers.formatUnits(AMOUNT_TO_MINT, 6), 'USDC');
    
    // Call mint function
    const tx = await usdcContract.mint(YOUR_ADDRESS, AMOUNT_TO_MINT);
    console.log('Transaction sent:', tx.hash);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    console.log('✅ Transaction confirmed in block:', receipt.blockNumber);
    console.log('Gas used:', receipt.gasUsed.toString());
    
    // Check balance
    const balanceABI = ['function balanceOf(address) view returns (uint256)'];
    const usdcView = new ethers.Contract(USDC_ADDRESS, balanceABI, provider);
    const balance = await usdcView.balanceOf(YOUR_ADDRESS);
    console.log('New USDC balance:', ethers.formatUnits(balance, 6), 'USDC');
    
  } catch (error) {
    console.error('❌ Error minting USDC:', error.message);
    
    if (error.message.includes('invalid private key')) {
      console.log('Please set your private key in the PRIVATE_KEY variable');
    }
  }
}

// Run the script
mintUSDC();