pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";


contract NaanBar is ERC20("NaanBar", "xNAAN"){
    using SafeMath for uint256;
    IERC20 public naan;

    constructor(IERC20 _naan) public {
        require(address(_naan) != address(0), "invalid address");
        naan = _naan;
    }

    // Enter the bar. Pay some NAANs. Earn some shares.
    function enter(uint256 _amount) public {
        uint256 totalNaan = naan.balanceOf(address(this));
        uint256 totalShares = totalSupply();
        if (totalShares == 0 || totalNaan == 0) {
            _mint(msg.sender, _amount);
        } else {
            uint256 what = _amount.mul(totalShares).div(totalNaan);
            _mint(msg.sender, what);
        }
        naan.transferFrom(msg.sender, address(this), _amount);
    }

    // Leave the bar. Claim back your NAANs.
    function leave(uint256 _share) public {
        uint256 totalShares = totalSupply();
        uint256 what = _share.mul(naan.balanceOf(address(this))).div(totalShares);
        _burn(msg.sender, _share);
        naan.transfer(msg.sender, what);
    }
}
