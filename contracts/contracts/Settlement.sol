// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title Settlement
 * @notice Basic settlement contract for Agentic Treasury MVP
 * @dev This contract handles the execution of payments authorized by the agent
 */
contract Settlement {
    event PaymentExecuted(bytes32 indexed intentHash, address indexed recipient, uint256 amount);
    event Deposited(address indexed sender, uint256 amount);

    address public owner;

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Executes a settlement based on a verified intent
     * @param intentHash The hash of the payment intent
     * @param recipient The address receiving the funds
     * @param amount The amount to transfer
     */
    function executeSettlement(bytes32 intentHash, address payable recipient, uint256 amount) external {
        // TODO: Add proper access control (only authorized executor/facilitator)
        // require(msg.sender == owner, "Unauthorized");

        require(address(this).balance >= amount, "Insufficient balance");

        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Transfer failed");

        emit PaymentExecuted(intentHash, recipient, amount);
    }

    /**
     * @notice Deposit funds into the treasury
     */
    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }
}

