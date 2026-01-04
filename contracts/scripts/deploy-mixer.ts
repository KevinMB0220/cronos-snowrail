import { ethers } from "hardhat";

async function main() {
  console.log("Deploying ZKMixer to Cronos Testnet...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "CRO\n");

  // Deploy ZKMixer
  console.log("Deploying ZKMixer contract...");
  const ZKMixer = await ethers.getContractFactory("ZKMixer");
  const mixer = await ZKMixer.deploy();
  await mixer.waitForDeployment();

  const mixerAddress = await mixer.getAddress();
  console.log("ZKMixer deployed to:", mixerAddress);

  // Get contract info
  const denomination = await mixer.DENOMINATION();
  const root = await mixer.getLastRoot();
  const depositCount = await mixer.getDepositCount();

  console.log("\nContract Configuration:");
  console.log("- Denomination:", ethers.formatEther(denomination), "CRO");
  console.log("- Initial root:", root);
  console.log("- Deposit count:", depositCount.toString());

  console.log("\n========================================");
  console.log("Add this to your .env file:");
  console.log(`MIXER_CONTRACT_ADDRESS=${mixerAddress}`);
  console.log("========================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
