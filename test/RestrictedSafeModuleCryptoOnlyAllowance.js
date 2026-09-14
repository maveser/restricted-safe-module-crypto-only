import { expect } from "chai";
import { network } from "hardhat";

const USDT = "0x55d398326f99059ff775485246999027b3197955";
const ROUTER = "0x1b81D678ffb9C0263b24A97847620C99d213eB14";
const FACTORY = "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865";
const BTCB = "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c";
const POOL = "0x46cf1cf8c69595804ba91dfdd8d6b960c9b0a7c4";
const BTC_USD = "0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf";
const USDT_USD = "0xB97Ad0E74fa7d920791E90258A6E2085088b4320";

async function installAt({ ethers }, name, address) {
  const Factory = await ethers.getContractFactory(name);
  const deployed = await Factory.deploy();
  await deployed.waitForDeployment();
  await ethers.provider.send("hardhat_setCode", [address, await ethers.provider.getCode(await deployed.getAddress())]);
  return Factory.attach(address);
}

describe("RestrictedSafeModuleCryptoOnly — allowance residual", function () {
  it("rechaza una Safe con allowance USDT residual hacia el router", async function () {
    const { ethers } = await network.create("bscLocal");
    const [, delegate] = await ethers.getSigners();
    const safe = await (await ethers.getContractFactory("MockSafe")).deploy();
    const factory = await installAt({ ethers }, "MockPancakeV3Factory", FACTORY);
    const pool = await installAt({ ethers }, "MockV3Pool", POOL);
    const btc = await installAt({ ethers }, "MockAggregatorV3", BTC_USD);
    const usdtFeed = await installAt({ ethers }, "MockAggregatorV3", USDT_USD);
    const token = await installAt({ ethers }, "MockErc20Allowance", USDT);
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    await factory.setPool(USDT, BTCB, 500, POOL);
    await pool.setObservation(0, 0, 1n);
    await btc.setRoundData(100_000_000n, now);
    await usdtFeed.setRoundData(100_000_000n, now);
    const module = await (await ethers.getContractFactory("RestrictedSafeModuleCryptoOnly"))
      .deploy(await safe.getAddress(), delegate.address, USDT, ROUTER);
    await safe.setModule(await module.getAddress());
    await token.setAllowance(await safe.getAddress(), ROUTER, 1n);
    const amountIn = 1n * 10n ** 18n;
    const minimum = await module.minimumAmountOutFromGuards(BTCB, POOL, 500, amountIn);

    await expect(module.connect(delegate).executeExactInputSingle(BTCB, POOL, 500, amountIn, minimum, now + 60))
      .to.be.revertedWithCustomError(module, "UnexpectedRouterAllowance");
    expect(await safe.executionCount()).to.equal(0n);
    expect(await module.totalStrategySpent()).to.equal(0n);
  });
});
