// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./erc8004/IdentityRegistry.sol";
import "./erc8004/ReputationRegistry.sol";

/// @title YieldRiskAgent - DeFi Risk Assessment Agent with Reputation-as-Stake
/// @notice Simplified agent that implements escrow-based payment with reputation management
/// @dev Integrates with ERC8004 registries for identity and reputation
contract YieldRiskAgent {
    IdentityRegistry public immutable identityRegistry;
    ReputationRegistry public immutable reputationRegistry;
    
    uint256 public immutable agentId;
    address public immutable agentOwner;
    uint256 public serviceFee; // in wei
    uint256 public escrowTimeout; // in seconds (e.g., 24 hours)
    
    // Service request management
    uint256 private _requestIdCounter;
    
    struct ServiceRequest {
        address client;
        uint256 payment;
        uint256 timestamp;
        bool completed;
        bool refunded;
        bytes32 protocolDescriptionHash;
    }
    
    mapping(uint256 => ServiceRequest) public requests;
    
    // Escrow management
    mapping(uint256 => uint256) public escrowBalances;
    
    // Statistics
    uint256 public totalRequests;
    uint256 public totalEarned;
    uint256 public totalRefunded;
    
    event ServiceRequested(
        uint256 indexed requestId,
        address indexed client,
        uint256 payment,
        bytes32 protocolDescriptionHash
    );
    
    event ServiceCompleted(
        uint256 indexed requestId,
        bytes32 riskReportHash
    );
    
    event EscrowReleased(
        uint256 indexed requestId,
        address indexed recipient,
        uint256 amount,
        bool isRefund
    );
    
    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event TimeoutUpdated(uint256 oldTimeout, uint256 newTimeout);
    
    modifier onlyAgentOwner() {
        require(msg.sender == agentOwner, "Not agent owner");
        _;
    }
    
    modifier validRequest(uint256 requestId) {
        require(requestId < _requestIdCounter, "Invalid request ID");
        require(!requests[requestId].completed, "Request already completed");
        require(!requests[requestId].refunded, "Request already refunded");
        _;
    }
    
    /// @notice Initialize the agent with ERC8004 registries
    /// @param _identityRegistry Address of IdentityRegistry
    /// @param _reputationRegistry Address of ReputationRegistry
    /// @param _agentId The agent's ID from IdentityRegistry
    /// @param _serviceFee Initial service fee in wei
    /// @param _escrowTimeout Escrow timeout in seconds
    constructor(
        address _identityRegistry,
        address _reputationRegistry,
        uint256 _agentId,
        uint256 _serviceFee,
        uint256 _escrowTimeout
    ) {
        identityRegistry = IdentityRegistry(_identityRegistry);
        reputationRegistry = ReputationRegistry(_reputationRegistry);
        
        // Verify agent exists and get owner
        agentOwner = identityRegistry.ownerOf(_agentId);
        require(agentOwner != address(0), "Invalid agent ID");
        
        agentId = _agentId;
        serviceFee = _serviceFee;
        escrowTimeout = _escrowTimeout;
    }
    
    /// @notice Request risk assessment service
    /// @param protocolDescriptionHash Hash of the protocol description
    /// @return requestId The request ID
    function requestService(bytes32 protocolDescriptionHash) 
        external 
        payable 
        returns (uint256 requestId) 
    {
        require(msg.value >= serviceFee, "Insufficient payment");
        require(protocolDescriptionHash != bytes32(0), "Invalid description hash");
        
        requestId = _requestIdCounter++;
        
        requests[requestId] = ServiceRequest({
            client: msg.sender,
            payment: msg.value,
            timestamp: block.timestamp,
            completed: false,
            refunded: false,
            protocolDescriptionHash: protocolDescriptionHash
        });
        
        escrowBalances[requestId] = msg.value;
        totalRequests++;
        
        emit ServiceRequested(requestId, msg.sender, msg.value, protocolDescriptionHash);
    }
    
    /// @notice Complete service (called by agent owner)
    /// @param requestId The request ID
    /// @param riskReportHash Hash of the risk assessment report
    function completeService(uint256 requestId, bytes32 riskReportHash) 
        external 
        onlyAgentOwner 
        validRequest(requestId) 
    {
        require(riskReportHash != bytes32(0), "Invalid report hash");
        
        ServiceRequest storage request = requests[requestId];
        request.completed = true;
        
        emit ServiceCompleted(requestId, riskReportHash);
        
        // Note: Escrow must be explicitly released via releaseEscrow() or refundOnBadFeedback()
    }
    
    /// @notice Release escrow to agent (after good feedback or timeout)
    /// @param requestId The request ID
    function releaseEscrow(uint256 requestId) external validRequest(requestId) {
        ServiceRequest storage request = requests[requestId];
        require(request.completed, "Service not completed");
        require(
            block.timestamp >= request.timestamp + escrowTimeout,
            "Escrow timeout not reached"
        );
        
        _releaseEscrow(requestId, false);
    }
    
    /// @notice Refund client (after bad feedback)
    /// @param requestId The request ID
    /// @param feedbackScore The feedback score given (must be <= 30 for refund)
    function refundOnBadFeedback(uint256 requestId, uint8 feedbackScore) 
        external 
        validRequest(requestId) 
    {
        ServiceRequest storage request = requests[requestId];
        require(msg.sender == request.client, "Not the client");
        require(request.completed, "Service not completed");
        require(feedbackScore <= 30, "Feedback score too high for refund");
        
        // Verify feedback was actually given by checking ReputationRegistry
        uint64 lastIndex = reputationRegistry.getLastIndex(agentId, msg.sender);
        require(lastIndex > 0, "No feedback given");
        
        // Read the latest feedback
        (uint8 actualScore, , , bool isRevoked) = reputationRegistry.readFeedback(
            agentId, 
            msg.sender, 
            lastIndex
        );
        
        require(!isRevoked, "Feedback was revoked");
        require(actualScore <= 30, "Actual feedback score too high");
        
        _releaseEscrow(requestId, true);
    }
    
    /// @notice Internal function to release escrow
    /// @param requestId The request ID
    /// @param isRefund True if refunding to client, false if paying agent
    function _releaseEscrow(uint256 requestId, bool isRefund) private {
        ServiceRequest storage request = requests[requestId];
        uint256 amount = escrowBalances[requestId];
        
        require(amount > 0, "No escrow balance");
        
        escrowBalances[requestId] = 0;
        
        address recipient;
        if (isRefund) {
            recipient = request.client;
            request.refunded = true;
            totalRefunded += amount;
        } else {
            recipient = agentOwner;
            totalEarned += amount;
        }
        
        emit EscrowReleased(requestId, recipient, amount, isRefund);
        
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Transfer failed");
    }
    
    /// @notice Update service fee (only agent owner)
    /// @param newFee New service fee in wei
    function updateServiceFee(uint256 newFee) external onlyAgentOwner {
        uint256 oldFee = serviceFee;
        serviceFee = newFee;
        emit FeeUpdated(oldFee, newFee);
    }
    
    /// @notice Update escrow timeout (only agent owner)
    /// @param newTimeout New timeout in seconds
    function updateEscrowTimeout(uint256 newTimeout) external onlyAgentOwner {
        require(newTimeout >= 1 hours && newTimeout <= 7 days, "Invalid timeout");
        uint256 oldTimeout = escrowTimeout;
        escrowTimeout = newTimeout;
        emit TimeoutUpdated(oldTimeout, newTimeout);
    }
    
    /// @notice Get agent reputation summary
    /// @return count Number of feedbacks
    /// @return averageScore Average reputation score
    function getReputationSummary() 
        external 
        view 
        returns (uint64 count, uint8 averageScore) 
    {
        address[] memory emptyArray;
        return reputationRegistry.getSummary(
            agentId,
            emptyArray,
            bytes32(0),
            bytes32(0)
        );
    }
    
    /// @notice Get request details
    /// @param requestId The request ID
    /// @return client The client address
    /// @return payment The payment amount
    /// @return timestamp The request timestamp
    /// @return completed Whether service is completed
    /// @return refunded Whether payment was refunded
    function getRequestDetails(uint256 requestId) 
        external 
        view 
        returns (
            address client,
            uint256 payment,
            uint256 timestamp,
            bool completed,
            bool refunded
        ) 
    {
        require(requestId < _requestIdCounter, "Invalid request ID");
        ServiceRequest memory request = requests[requestId];
        return (
            request.client,
            request.payment,
            request.timestamp,
            request.completed,
            request.refunded
        );
    }
    
    /// @notice Get agent statistics
    /// @return _totalRequests Total number of requests
    /// @return _totalEarned Total amount earned
    /// @return _totalRefunded Total amount refunded
    /// @return activeEscrow Total active escrow balance
    function getStatistics() 
        external 
        view 
        returns (
            uint256 _totalRequests,
            uint256 _totalEarned,
            uint256 _totalRefunded,
            uint256 activeEscrow
        ) 
    {
        return (totalRequests, totalEarned, totalRefunded, address(this).balance);
    }
}

