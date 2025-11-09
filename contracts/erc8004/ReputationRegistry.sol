// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";

interface IIdentityRegistry {
    function ownerOf(uint256 tokenId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    function getApproved(uint256 tokenId) external view returns (address);
}

/// @title ReputationRegistry - ERC8004 Reputation Registry
/// @notice Manages client feedback and agent reputation
/// @dev Feedback is authenticated via signatures and stored on-chain
contract ReputationRegistry {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    address private immutable identityRegistry;

    event NewFeedback(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint8 score,
        bytes32 indexed tag1,
        bytes32 tag2,
        string feedbackUri,
        bytes32 feedbackHash
    );

    event FeedbackRevoked(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 indexed feedbackIndex
    );

    event ResponseAppended(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 feedbackIndex,
        address indexed responder,
        string responseUri,
        bytes32 responseHash
    );

    struct Feedback {
        uint8 score;
        bytes32 tag1;
        bytes32 tag2;
        bool isRevoked;
    }

    struct FeedbackAuth {
        uint256 agentId;
        address clientAddress;
        uint64 indexLimit;
        uint256 expiry;
        uint256 chainId;
        address identityRegistry;
        address signerAddress;
    }

    // agentId => clientAddress => feedbackIndex => Feedback (1-indexed)
    mapping(uint256 => mapping(address => mapping(uint64 => Feedback))) private _feedback;

    // agentId => clientAddress => last feedback index
    mapping(uint256 => mapping(address => uint64)) private _lastIndex;

    // agentId => clientAddress => feedbackIndex => responder => response count
    mapping(uint256 => mapping(address => mapping(uint64 => mapping(address => uint64)))) private _responseCount;

    // Track all unique responders for each feedback
    mapping(uint256 => mapping(address => mapping(uint64 => address[]))) private _responders;
    mapping(uint256 => mapping(address => mapping(uint64 => mapping(address => bool)))) private _responderExists;

    // Track all unique clients that have given feedback for each agent
    mapping(uint256 => address[]) private _clients;
    mapping(uint256 => mapping(address => bool)) private _clientExists;

    constructor(address _identityRegistry) {
        require(_identityRegistry != address(0), "Invalid identity registry");
        identityRegistry = _identityRegistry;
    }

    function getIdentityRegistry() external view returns (address) {
        return identityRegistry;
    }

    /// @notice Submit feedback for an agent
    /// @param agentId The agent ID
    /// @param score Score from 0-100
    /// @param tag1 Primary tag for categorization
    /// @param tag2 Secondary tag for categorization
    /// @param feedbackUri URI to detailed feedback
    /// @param feedbackHash Hash of feedback content
    /// @param feedbackAuth Signed authorization from agent
    function giveFeedback(
        uint256 agentId,
        uint8 score,
        bytes32 tag1,
        bytes32 tag2,
        string calldata feedbackUri,
        bytes32 feedbackHash,
        bytes calldata feedbackAuth
    ) external {
        require(score <= 100, "Score must be <= 100");

        // Verify agent exists
        require(_agentExists(agentId), "Agent does not exist");

        // Get agent owner
        IIdentityRegistry registry = IIdentityRegistry(identityRegistry);
        address agentOwner = registry.ownerOf(agentId);

        // SECURITY: Prevent self-feedback from owner and operators
        require(
            msg.sender != agentOwner &&
            !registry.isApprovedForAll(agentOwner, msg.sender) &&
            registry.getApproved(agentId) != msg.sender,
            "Self-feedback not allowed"
        );

        // Verify feedbackAuth signature
        _verifyFeedbackAuth(agentId, msg.sender, feedbackAuth);

        // Get current index for this client-agent pair (1-indexed)
        uint64 currentIndex = _lastIndex[agentId][msg.sender] + 1;

        // Store feedback at 1-indexed position
        _feedback[agentId][msg.sender][currentIndex] = Feedback({
            score: score,
            tag1: tag1,
            tag2: tag2,
            isRevoked: false
        });

        // Update last index
        _lastIndex[agentId][msg.sender] = currentIndex;

        // Track new client
        if (!_clientExists[agentId][msg.sender]) {
            _clients[agentId].push(msg.sender);
            _clientExists[agentId][msg.sender] = true;
        }

        emit NewFeedback(agentId, msg.sender, score, tag1, tag2, feedbackUri, feedbackHash);
    }

    function _verifyFeedbackAuth(
        uint256 agentId,
        address clientAddress,
        bytes calldata feedbackAuth
    ) internal view {
        require(
            IIdentityRegistry(identityRegistry).ownerOf(agentId) != address(0),
            "Unregistered agent"
        );
        require(feedbackAuth.length >= 289, "Invalid auth length");

        // Decode the first 224 bytes into struct
        FeedbackAuth memory auth;
        (
            auth.agentId,
            auth.clientAddress,
            auth.indexLimit,
            auth.expiry,
            auth.chainId,
            auth.identityRegistry,
            auth.signerAddress
        ) = abi.decode(feedbackAuth[:224], (uint256, address, uint64, uint256, uint256, address, address));

        // Verify parameters
        require(auth.agentId == agentId, "AgentId mismatch");
        require(auth.clientAddress == clientAddress, "Client mismatch");
        require(block.timestamp < auth.expiry, "Auth expired");
        require(auth.chainId == block.chainid, "ChainId mismatch");
        require(auth.identityRegistry == identityRegistry, "Registry mismatch");
        require(auth.indexLimit >= _lastIndex[agentId][clientAddress] + 1, "IndexLimit exceeded");

        // Verify signature
        _verifySignature(auth, feedbackAuth[224:]);
    }

    function _verifySignature(
        FeedbackAuth memory auth,
        bytes calldata signature
    ) internal view {
        // Construct message hash
        bytes32 messageHash = keccak256(
            abi.encode(
                auth.agentId,
                auth.clientAddress,
                auth.indexLimit,
                auth.expiry,
                auth.chainId,
                auth.identityRegistry,
                auth.signerAddress
            )
        ).toEthSignedMessageHash();

        // Verify signature: EOA or ERC-1271 contract
        address recoveredSigner = messageHash.recover(signature);
        if (recoveredSigner != auth.signerAddress) {
            if (auth.signerAddress.code.length == 0) {
                revert("Invalid signature");
            }
            require(
                IERC1271(auth.signerAddress).isValidSignature(messageHash, signature) == IERC1271.isValidSignature.selector,
                "Bad ERC-1271 signature"
            );
        }

        // Verify signerAddress is owner or operator
        IIdentityRegistry registry = IIdentityRegistry(identityRegistry);
        address owner = registry.ownerOf(auth.agentId);
        require(
            auth.signerAddress == owner ||
            registry.isApprovedForAll(owner, auth.signerAddress) ||
            registry.getApproved(auth.agentId) == auth.signerAddress,
            "Signer not authorized"
        );
    }

    /// @notice Revoke previously given feedback
    /// @param agentId The agent ID
    /// @param feedbackIndex The feedback index to revoke (1-indexed)
    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external {
        require(feedbackIndex > 0, "Index must be > 0");
        require(feedbackIndex <= _lastIndex[agentId][msg.sender], "Index out of bounds");
        require(!_feedback[agentId][msg.sender][feedbackIndex].isRevoked, "Already revoked");

        _feedback[agentId][msg.sender][feedbackIndex].isRevoked = true;
        emit FeedbackRevoked(agentId, msg.sender, feedbackIndex);
    }

    /// @notice Append a response to feedback (typically by agent owner)
    /// @param agentId The agent ID
    /// @param clientAddress The client who gave feedback
    /// @param feedbackIndex The feedback index
    /// @param responseUri URI to response content
    /// @param responseHash Hash of response
    function appendResponse(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex,
        string calldata responseUri,
        bytes32 responseHash
    ) external {
        require(feedbackIndex > 0, "Index must be > 0");
        require(feedbackIndex <= _lastIndex[agentId][clientAddress], "Index out of bounds");
        require(bytes(responseUri).length > 0, "Empty URI");

        // Track new responder
        if (!_responderExists[agentId][clientAddress][feedbackIndex][msg.sender]) {
            _responders[agentId][clientAddress][feedbackIndex].push(msg.sender);
            _responderExists[agentId][clientAddress][feedbackIndex][msg.sender] = true;
        }

        // Increment response count for this responder
        _responseCount[agentId][clientAddress][feedbackIndex][msg.sender]++;

        emit ResponseAppended(agentId, clientAddress, feedbackIndex, msg.sender, responseUri, responseHash);
    }

    /// @notice Get last feedback index for a client-agent pair
    function getLastIndex(uint256 agentId, address clientAddress) external view returns (uint64) {
        return _lastIndex[agentId][clientAddress];
    }

    /// @notice Read specific feedback
    function readFeedback(uint256 agentId, address clientAddress, uint64 index)
        external
        view
        returns (uint8 score, bytes32 tag1, bytes32 tag2, bool isRevoked)
    {
        require(index > 0, "Index must be > 0");
        require(index <= _lastIndex[agentId][clientAddress], "Index out of bounds");
        Feedback storage f = _feedback[agentId][clientAddress][index];
        return (f.score, f.tag1, f.tag2, f.isRevoked);
    }

    /// @notice Get reputation summary for an agent
    /// @param agentId The agent ID
    /// @param clientAddresses Array of specific clients (empty for all)
    /// @param tag1 Filter by tag1 (bytes32(0) for no filter)
    /// @param tag2 Filter by tag2 (bytes32(0) for no filter)
    /// @return count Number of feedbacks
    /// @return averageScore Average score
    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        bytes32 tag1,
        bytes32 tag2
    ) external view returns (uint64 count, uint8 averageScore) {
        address[] memory clientList;
        if (clientAddresses.length > 0) {
            clientList = clientAddresses;
        } else {
            clientList = _clients[agentId];
        }

        uint256 totalScore = 0;
        count = 0;

        for (uint256 i = 0; i < clientList.length; i++) {
            uint64 lastIdx = _lastIndex[agentId][clientList[i]];
            for (uint64 j = 1; j <= lastIdx; j++) {
                Feedback storage fb = _feedback[agentId][clientList[i]][j];
                if (fb.isRevoked) continue;
                if (tag1 != bytes32(0) && fb.tag1 != tag1) continue;
                if (tag2 != bytes32(0) && fb.tag2 != tag2) continue;

                totalScore += fb.score;
                count++;
            }
        }

        averageScore = count > 0 ? uint8(totalScore / count) : 0;
    }

    /// @notice Get all clients who have given feedback to an agent
    function getClients(uint256 agentId) external view returns (address[] memory) {
        return _clients[agentId];
    }

    function _agentExists(uint256 agentId) internal view returns (bool) {
        try IIdentityRegistry(identityRegistry).ownerOf(agentId) returns (address owner) {
            return owner != address(0);
        } catch {
            return false;
        }
    }
}

