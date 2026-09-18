const { ethers } = require('ethers');

async function check() {
  const provider = new ethers.JsonRpcProvider('https://rpc.mainnet.arc.io');
  const wallet = new ethers.Wallet('2c8c9f53186a35719544aa147a1c6dde678ceb83e6e5e759730fdc799b246ba0', provider);
  console.log('Deployer Address:', wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log('Native Arc Balance:', ethers.formatEther(balance), 'ARC');

  const usdcAbi = ['function balanceOf(address) view returns (uint256)'];
  const usdc = new ethers.Contract('0x3600000000000000000000000000000000000000', usdcAbi, provider);
  try {
    const usdcBal = await usdc.balanceOf(wallet.address);
    console.log('USDC Balance:', ethers.formatUnits(usdcBal, 6), 'USDC');
  } catch (e) {
    console.log('Error reading USDC balance:', e.message);
  }
}

check().catch(console.error);
