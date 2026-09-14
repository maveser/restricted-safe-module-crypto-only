import { expect } from "chai";
import { network } from "hardhat";

const USDT = "0x55d398326f99059ff775485246999027b3197955";
const ROUTER = "0x1b81D678ffb9C0263b24A97847620C99d213eB14";

describe("RestrictedSafeModuleCryptoOnly — delegado EOA", function () {
  it("rechaza una llamada del delegado contrato durante su constructor", async function () {
    const { ethers } = await network.create("bscLocal");
    const [safe, eoaDelegate] = await ethers.getSigners();
    const Module = await ethers.getContractFactory("RestrictedSafeModuleCryptoOnly");
    const module = await Module.deploy(safe.address, eoaDelegate.address, USDT, ROUTER);
    const ConstructorDelegate = await ethers.getContractFactory("ConstructorDelegateCryptoOnly");

    await expect(ConstructorDelegate.deploy(safe.address))
      .to.be.revertedWithCustomError(module, "DelegateNoLongerEOA");
  });
});
