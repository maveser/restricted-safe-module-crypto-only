// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

contract MockErc20Allowance {
    mapping(address => mapping(address => uint256)) private _allowances;

    function setAllowance(address owner, address spender, uint256 amount) external {
        _allowances[owner][spender] = amount;
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return _allowances[owner][spender];
    }
}
