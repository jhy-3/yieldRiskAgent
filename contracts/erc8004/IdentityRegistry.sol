// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title IdentityRegistry - ERC8004 Identity Registry
/// @notice ERC-721 based agent identity registry
/// @dev Each agent is represented by a unique NFT
contract IdentityRegistry is ERC721URIStorage, Ownable {
    uint256 private _lastId = 0;

    // agentId => key => value
    mapping(uint256 => mapping(string => bytes)) private _metadata;

    struct MetadataEntry {
        string key;
        bytes value;
    }

    event Registered(uint256 indexed agentId, string tokenURI, address indexed owner);
    event MetadataSet(uint256 indexed agentId, string indexed indexedKey, string key, bytes value);
    event UriUpdated(uint256 indexed agentId, string newUri, address indexed updatedBy);

    constructor() ERC721("AegisAgent", "AEGIS") Ownable(msg.sender) {}

    /// @notice Register a new agent identity
    /// @return agentId The newly created agent ID
    function register() external returns (uint256 agentId) {
        agentId = _lastId++;
        _safeMint(msg.sender, agentId);
        emit Registered(agentId, "", msg.sender);
    }

    /// @notice Register a new agent identity with metadata URI
    /// @param tokenUri The URI pointing to agent metadata (JSON)
    /// @return agentId The newly created agent ID
    function register(string memory tokenUri) external returns (uint256 agentId) {
        agentId = _lastId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, tokenUri);
        emit Registered(agentId, tokenUri, msg.sender);
    }

    /// @notice Register a new agent identity with metadata URI and key-value pairs
    /// @param tokenUri The URI pointing to agent metadata
    /// @param metadata Array of key-value metadata entries
    /// @return agentId The newly created agent ID
    function register(
        string memory tokenUri,
        MetadataEntry[] memory metadata
    ) external returns (uint256 agentId) {
        agentId = _lastId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, tokenUri);
        emit Registered(agentId, tokenUri, msg.sender);

        for (uint256 i = 0; i < metadata.length; i++) {
            _metadata[agentId][metadata[i].key] = metadata[i].value;
            emit MetadataSet(agentId, metadata[i].key, metadata[i].key, metadata[i].value);
        }
    }

    /// @notice Get metadata value for an agent
    /// @param agentId The agent ID
    /// @param key The metadata key
    /// @return The metadata value
    function getMetadata(uint256 agentId, string memory key) external view returns (bytes memory) {
        return _metadata[agentId][key];
    }

    /// @notice Set metadata for an agent (owner only)
    /// @param agentId The agent ID
    /// @param key The metadata key
    /// @param value The metadata value
    function setMetadata(uint256 agentId, string memory key, bytes memory value) external {
        require(
            msg.sender == _ownerOf(agentId) ||
            isApprovedForAll(_ownerOf(agentId), msg.sender) ||
            msg.sender == getApproved(agentId),
            "Not authorized"
        );
        _metadata[agentId][key] = value;
        emit MetadataSet(agentId, key, key, value);
    }

    /// @notice Update agent token URI (owner only)
    /// @param agentId The agent ID
    /// @param newUri The new URI
    function setAgentUri(uint256 agentId, string calldata newUri) external {
        address owner = ownerOf(agentId);
        require(
            msg.sender == owner ||
            isApprovedForAll(owner, msg.sender) ||
            msg.sender == getApproved(agentId),
            "Not authorized"
        );
        _setTokenURI(agentId, newUri);
        emit UriUpdated(agentId, newUri, msg.sender);
    }

    /// @notice Get the total number of agents registered
    /// @return The total count of agents
    function totalAgents() external view returns (uint256) {
        return _lastId;
    }
}

