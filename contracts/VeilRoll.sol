// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint8, euint32, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title VeilRoll
/// @notice A simple encrypted two-ball draw with FHE-based points.
contract VeilRoll is ZamaEthereumConfig {
    uint256 public constant TICKET_PRICE = 0.001 ether;
    uint32 public constant WIN_REWARD = 10000;

    struct Ticket {
        euint8 first;
        euint8 second;
        bool exists;
    }

    struct Draw {
        euint8 first;
        euint8 second;
        bool exists;
    }

    mapping(address => Ticket) private _tickets;
    mapping(address => Draw) private _lastDraw;
    mapping(address => euint32) private _points;
    mapping(address => bool) private _hasPoints;

    event TicketPurchased(address indexed player);
    event DrawCompleted(address indexed player);

    /// @notice Buy a ticket with two encrypted numbers between 1 and 9.
    /// @param first The encrypted first number.
    /// @param second The encrypted second number.
    /// @param inputProof Proof for the encrypted inputs.
    function buyTicket(externalEuint8 first, externalEuint8 second, bytes calldata inputProof) external payable {
        require(msg.value == TICKET_PRICE, "Invalid ticket price");

        euint8 firstValue = FHE.fromExternal(first, inputProof);
        euint8 secondValue = FHE.fromExternal(second, inputProof);

        _tickets[msg.sender] = Ticket({first: firstValue, second: secondValue, exists: true});

        if (!_hasPoints[msg.sender]) {
            _points[msg.sender] = FHE.asEuint32(0);
            _hasPoints[msg.sender] = true;
        }

        FHE.allowThis(_tickets[msg.sender].first);
        FHE.allowThis(_tickets[msg.sender].second);
        FHE.allow(_tickets[msg.sender].first, msg.sender);
        FHE.allow(_tickets[msg.sender].second, msg.sender);

        FHE.allowThis(_points[msg.sender]);
        FHE.allow(_points[msg.sender], msg.sender);

        emit TicketPurchased(msg.sender);
    }

    /// @notice Draw two random encrypted numbers and award points on exact match.
    function startDraw() external {
        Ticket storage ticket = _tickets[msg.sender];
        require(ticket.exists, "Ticket required");

        euint8 drawFirst = FHE.add(FHE.randEuint8(9), FHE.asEuint8(1));
        euint8 drawSecond = FHE.add(FHE.randEuint8(9), FHE.asEuint8(1));

        ebool firstMatch = FHE.eq(drawFirst, ticket.first);
        ebool secondMatch = FHE.eq(drawSecond, ticket.second);
        ebool win = FHE.and(firstMatch, secondMatch);

        euint32 bonus = FHE.select(win, FHE.asEuint32(WIN_REWARD), FHE.asEuint32(0));
        _points[msg.sender] = FHE.add(_points[msg.sender], bonus);

        _lastDraw[msg.sender] = Draw({first: drawFirst, second: drawSecond, exists: true});

        FHE.allowThis(_points[msg.sender]);
        FHE.allow(_points[msg.sender], msg.sender);

        FHE.allowThis(_lastDraw[msg.sender].first);
        FHE.allowThis(_lastDraw[msg.sender].second);
        FHE.allow(_lastDraw[msg.sender].first, msg.sender);
        FHE.allow(_lastDraw[msg.sender].second, msg.sender);

        emit DrawCompleted(msg.sender);
    }

    /// @notice Returns whether a player has a ticket.
    function hasTicket(address player) external view returns (bool) {
        return _tickets[player].exists;
    }

    /// @notice Returns whether a player has drawn at least once.
    function hasDraw(address player) external view returns (bool) {
        return _lastDraw[player].exists;
    }

    /// @notice Returns the encrypted ticket numbers for a player.
    function getTicket(address player) external view returns (euint8, euint8) {
        Ticket storage ticket = _tickets[player];
        return (ticket.first, ticket.second);
    }

    /// @notice Returns the encrypted last draw numbers for a player.
    function getLastDraw(address player) external view returns (euint8, euint8) {
        Draw storage draw = _lastDraw[player];
        return (draw.first, draw.second);
    }

    /// @notice Returns the encrypted points for a player.
    function getPoints(address player) external view returns (euint32) {
        return _points[player];
    }
}
