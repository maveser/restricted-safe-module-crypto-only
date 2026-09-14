import { expect } from "chai";
import { network } from "hardhat";

const USDT = "0x55d398326f99059ff775485246999027b3197955";
const ROUTER = "0x1b81D678ffb9C0263b24A97847620C99d213eB14";

describe("RestrictedSafeModuleCryptoOnly — red BNB Chain", function () {
  it("rechaza el despliegue fuera de BNB Smart Chain", async function () {
    const { ethers } = await network.create("wrongChain");
    const [safe, delegate] = await ethers.getSigners();
    const Module = await ethers.getContractFactory("RestrictedSafeModuleCryptoOnly");

    await expect(Module.deploy(safe.address, delegate.address, USDT, ROUTER))
      .to.be.revertedWithCustomError(Module, "UnsupportedChain");
  });
});
