const hre = require("hardhat");
const { ethers } = hre;
const { writeFileSync } = require("fs");
const { join } = require("path");

const DEPLOYMENTS_FILE = join(__dirname, "../deployments/arc-mainnet.json");
const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const PLATFORM_FEE_BPS = 500; // 5%

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log(`--- Arc Mainnet Deployment ---`);
  console.log(`Chain ID: ${network.chainId}`);
  console.log(`Deployer Address: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ARC`);
  console.log(`Using USDC Address: ${USDC_ADDRESS}`);

  // 1. Deploy TreasuryVault
  console.log('\n[1/3] Deploying TreasuryVault...');
  const TreasuryVault = await ethers.getContractFactory('TreasuryVault');
  const vault = await TreasuryVault.deploy(USDC_ADDRESS);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log(`✓ TreasuryVault deployed at: ${vaultAddress}`);

  // 2. Deploy ArcPaymentRouter
  console.log('\n[2/3] Deploying ArcPaymentRouter...');
  const ArcPaymentRouter = await ethers.getContractFactory('ArcPaymentRouter');
  const router = await ArcPaymentRouter.deploy(
    USDC_ADDRESS,
    vaultAddress,
    deployer.address,   // fee recipient = deployer wallet
    PLATFORM_FEE_BPS,
  );
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log(`✓ ArcPaymentRouter deployed at: ${routerAddress}`);

  // Wire TreasuryVault -> ArcPaymentRouter
  console.log('Wiring TreasuryVault.setRouter...');
  const vaultContract = await ethers.getContractAt('TreasuryVault', vaultAddress);
  const tx1 = await vaultContract.setRouter(routerAddress);
  await tx1.wait();
  console.log(`✓ TreasuryVault router updated to: ${routerAddress}`);

  // 3. Deploy SubscriptionManager
  console.log('\n[3/3] Deploying SubscriptionManager...');
  const SubscriptionManager = await ethers.getContractFactory('SubscriptionManager');
  const subManager = await SubscriptionManager.deploy();
  await subManager.waitForDeployment();
  const subManagerAddress = await subManager.getAddress();
  console.log(`✓ SubscriptionManager deployed at: ${subManagerAddress}`);

  // Wire SubscriptionManager -> ArcPaymentRouter
  console.log('Wiring SubscriptionManager.setRouter...');
  const tx2 = await subManager.setRouter(routerAddress);
  await tx2.wait();
  console.log(`✓ SubscriptionManager router updated to: ${routerAddress}`);

  // Save deployments
  const deployments = {
    usdc: USDC_ADDRESS,
    treasuryVault: vaultAddress,
    paymentRouter: routerAddress,
    subscriptionManager: subManagerAddress,
    deployer: deployer.address,
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString(),
  };

  writeFileSync(DEPLOYMENTS_FILE, JSON.stringify(deployments, null, 2));

  console.log('\n==================================================');
  console.log('✓ Arc Mainnet Deployment Complete!');
  console.log('==================================================');
  console.log(`USDC Address:                  ${USDC_ADDRESS}`);
  console.log(`TreasuryVault Address:         ${vaultAddress}`);
  console.log(`ArcPaymentRouter Address:      ${routerAddress}`);
  console.log(`SubscriptionManager Address:   ${subManagerAddress}`);
  console.log(`Saved to deployments/arc-mainnet.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
