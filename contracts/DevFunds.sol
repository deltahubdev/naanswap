pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./NaanToken.sol";

contract DevFunds {
    using SafeMath for uint;

    // the naan token
    NaanToken public naan;
    // dev address to receive naan
    address public devaddr;
    // last withdraw block, use naanswap online block as default
    uint public lastWithdrawBlock = 10821000;
    // withdraw interval ~ 2 weeks
    uint public constant WITHDRAW_INTERVAL = 89600;
    // current total amount bigger than the threshold, withdraw half, otherwise withdraw all
    uint public constant WITHDRAW_HALF_THRESHOLD = 89600*10**18;

    constructor(NaanToken _naan, address _devaddr) public {
        require(address(_naan) != address(0) && _devaddr != address(0), "invalid address");
        naan = _naan;
        devaddr = _devaddr;
    }

    function withdraw() public {
        uint unlockBlock = lastWithdrawBlock.add(WITHDRAW_INTERVAL);
        require(block.number >= unlockBlock, "naan locked");
        uint _amount = naan.balanceOf(address(this));
        require(_amount > 0, "zero naan amount");
        uint amountReal = _amount;
        if (_amount > WITHDRAW_HALF_THRESHOLD) amountReal = _amount.div(2);
        lastWithdrawBlock = block.number;
        naan.transfer(devaddr, amountReal);
    }
}