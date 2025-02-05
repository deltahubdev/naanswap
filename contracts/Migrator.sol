pragma solidity 0.6.12;

import "./naanswap/interfaces/INaanSwapPair.sol";
import "./naanswap/interfaces/INaanSwapFactory.sol";


contract Migrator {
    address public chef;
    address public oldFactory;
    INaanSwapFactory public factory;
    uint256 public notBeforeBlock;
    uint256 public desiredLiquidity = uint256(-1);

    constructor(
        address _chef,
        address _oldFactory,
        INaanSwapFactory _factory,
        uint256 _notBeforeBlock
    ) public {
        require(_chef != address(0) && _oldFactory != address(0) && address(_factory) != address(0), "invalid address");
        chef = _chef;
        oldFactory = _oldFactory;
        factory = _factory;
        notBeforeBlock = _notBeforeBlock;
    }

    function migrate(INaanSwapPair orig) public returns (INaanSwapPair) {
        require(msg.sender == chef, "not from master chef");
        require(block.number >= notBeforeBlock, "too early to migrate");
        require(orig.factory() == oldFactory, "not from old factory");
        address token0 = orig.token0();
        address token1 = orig.token1();
        INaanSwapPair pair = INaanSwapPair(factory.getPair(token0, token1));
        if (pair == INaanSwapPair(address(0))) {
            pair = INaanSwapPair(factory.createPair(token0, token1));
        }
        uint256 lp = orig.balanceOf(msg.sender);
        if (lp == 0) return pair;
        desiredLiquidity = lp;
        orig.transferFrom(msg.sender, address(orig), lp);
        orig.burn(address(pair));
        pair.mint(msg.sender);
        desiredLiquidity = uint256(-1);
        return pair;
    }
}
