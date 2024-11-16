const hre = require("hardhat");

async function main() {
  // Constants for constructor arguments
  const USDC_PRICE_FEED = '0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165';
  const USDC_TOKEN = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

  // Deploy PayFlipSubscriptions with constructor arguments
  const PayFlipSubscriptions = await hre.ethers.deployContract("PayFlipSubscriptions", [
    USDC_PRICE_FEED,
    USDC_TOKEN
  ]);

  await PayFlipSubscriptions.waitForDeployment();
  console.log(`PayFlipSubscriptions deployed to: ${PayFlipSubscriptions.target}`);

  // Verify contracts on Etherscan
  if (process.env.ETHERSCAN_API_KEY) {
    console.log("Verifying contract...");
    try {
      await hre.run("verify:verify", {
        address: PayFlipSubscriptions.target,
        constructorArguments: [
          USDC_PRICE_FEED, // Price feed address
          USDC_TOKEN      // USDC token address
        ],
      });
      console.log("Contract verified successfully");
    } catch (error) {
      if (error.message.toLowerCase().includes("already verified")) {
        console.log("Contract is already verified!");
      } else {
        console.error("Error verifying contract:", error);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });