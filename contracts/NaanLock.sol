pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./NaanToken.sol";
import "./NaanMaster.sol";

contract NaanLock is ERC20("NaanLockToken", "NaanLock"), Ownable {
    using SafeMath for uint256;
    using Address for address;

    NaanToken public naan;
    NaanMaster public naanMaster;
    address public withDrawAddr;

    constructor(NaanToken _naan, NaanMaster _naanMaster) public {
        require(address(_naan) != address(0) && address(_naanMaster) != address(0), "invalid address");
        naan = _naan;
        naanMaster = _naanMaster;
        _mint(address(this), 1);
    }

    function deposit(uint256 _pid) public onlyOwner {
        _approve(address(this), address(naanMaster), 1);
        naanMaster.deposit(_pid, 1);
    }

    function withdrawFromNaanMaster(uint256 _pid) public {
        naanMaster.deposit(_pid, 0);
    }

    function withdrawToContract(uint256 _amount) public onlyOwner {
        require(withDrawAddr != address(0), "invalid address");
        uint256 totalAmount = naan.balanceOf(address(this));
        require(_amount > 0 && _amount <= totalAmount, "invalid amount");
        naan.transfer(withDrawAddr, _amount);
    }

    function setwithdrawContractAddr(address _withDrawaddr) public onlyOwner {
        withDrawAddr = _withDrawaddr;
    }
}
