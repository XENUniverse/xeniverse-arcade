const arcade = require("express")();
const fs = require("fs");

require("dotenv").config();

const privateKey = fs.readFileSync("./privkey.pem", "utf8");
const certificate = fs.readFileSync("./fullchain.pem", "utf8");
const credentials = { key: privateKey, cert: certificate };

const https = require("https").Server(credentials, arcade);
// const https = require("http").Server(arcade);
const io = require("socket.io")(https);

const axios = require("axios");
const ethers = require("ethers");
const events = require("events");
const R = require("ramda");
const Rx = require("rxjs");
const { from, of, timer } = require("rxjs");
const { concatMap, filter, map, take } = require("rxjs/operators");

const Immer = require("immer");
const produce = Immer.produce;

const BLANK = "";
const SPACE = " ";
const ZERO = "0";

const {
    admin,
    store,
    /** Wallet Values **/
    API_KEY,
    HOST,
    NETWORK,
    ARCADE_ADDRESS,
    ROOT_ADDRESS,
    XEN_ADDRESS,
} = require("./config");

const arcadeInterface = require("./abis/arcade-abi");
const standardInterface = require("./abis/erc-abi");

const blocks = require("./blocks");

const blockArray = {};

blocks.forEach((block, index) => {
    if (blockArray[block.id]) {
        console.trace("[ERROR] BlockCopy Error!");
    } else {
        blockArray[block.id] = block;
    }
});

const rewardEmitter = new events.EventEmitter();

const TXN_PARAMS = (txn) => {
    return {
        jsonrpc: "2.0",
        method: "eth_getTransactionReceipt",
        params: [txn],
        id: 1,
    };
};

const PRIVATE_KEY = process.env.PK;

const Utils = {
    account: false,
    signer: false,
    provider: false,
    contract: {},
    nonce: false,

    async setProvider() {
        try {
            const wallet = new ethers.Wallet(PRIVATE_KEY);

            this.provider = new ethers.providers.InfuraProvider(NETWORK, API_KEY);
            this.account = wallet.connect(this.provider);
            this.contract["arcade"] = new ethers.Contract(ARCADE_ADDRESS, arcadeInterface, this.account);
            this.nonce = await this.provider.getTransactionCount(this.account.address);

            // const allowance_source = await this.currency.allowance(this.account.address, this.router.address);
            // const allowance_source_receipt = allowance_source.toString();

            return this.provider;
        } catch (exception) {
            console.trace("[ERROR]", exception);
        }
    },
    addContract(name, address, abi) {
        this.contract[name] = new ethers.Contract(address, abi, this.account);
    },
};

const guid = () => {
    const s4 = () => {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    };

    return s4() + s4() + "-" + s4() + "-" + s4() + "-" + s4() + "-" + s4() + s4() + s4();
};

const shuffler = R.curry((random, list) => {
    let idx = -1;
    const len = list.length;
    let position;
    const result = [];

    while (++idx < len) {
        position = Math.floor((idx + 1) * random());
        result[idx] = result[position];
        result[position] = list[idx];
    }

    return result;
});

(async () => {
    // Utils.contract["arcade"].CreateGame().watch((error, result) => {
    //     if (error) {
    //         console.trace("[ERROR]", error);
    //     } else {
    //         callbackQueue[result.transaction]();
    //
    //         console.log("[INFO] Game created", result.transaction);
    //     }
    // });
    // Utils.contract["arcade"].Cut().watch((error, result) => {
    //     if (error) {
    //         console.trace("[ERROR]", error);
    //     } else {
    //         callbackQueue[result.transaction]();
    //
    //         console.log("[INFO] Cut taken", result.transaction);
    //     }
    // });
})();

const XEN_MINING_RATE = 1;

const BASELINE_REWARD = 25;

const LIVE_INDEX = [4, 5, 6, 7];
const DEFLATING_INDEX = [11, 12];
const STAKING_INDEX = [13];
const EMERGING_INDEX = [8, 9, 10];
const XEN_INDEX = [];
const PRACTICE_INDEX = [-1];
const TEWKEN_INDEX = [14];

// ----- Setup Rewards Manager
let priceMap = {
    "0xCBa49b070F522F3A580C02DbFB5464EFe2cC3Ea1": {
        price: 0.1,
        name: "XEN Crypto",
        symbol: "XEN",
    },
};

const rewardMap = {
    3: {
        decimals: 0,
        exchange_contract: "",
        id: "xen",
        label: "XEN Crypto",
        logo: "xen",
        symbol: "XEN",
        token: XEN_ADDRESS,
        type: 20,
        url: "",
    },
};

const getPrice = (id) => {
    return R.pathOr(0, [id, "price"], priceMap);
};

const initializePrice = () => {
    rewardLedger = [
        {
            type: 2,
            name: "XEN",
            coin: XEN_ADDRESS,
            price: getPrice(XEN_ADDRESS) * XEN_MINING_RATE,
            decimals: 18,
        },
    ];

    console.log("[INFO] Reward ledger initialized.");
};

(async () => {
    const transferFailure = (transaction) => {
        // const { txn, name } = transaction;
        // gameLobbies = produce(gameLobbies, (draft) => {
        //     const room = R.pathOr(null, [lobby, "rooms", id], draft);
        //     if (room) {
        //         draft[lobby].rooms[id].events.push({
        //             type: "txn",
        //             desc: name,
        //             result: false,
        //             id: id,
        //             txn: txn,
        //             lobby: lobby,
        //             timeCreated: new Date().getTime(),
        //         });
        //     }
        // });
    };

    const transferSuccess = (transaction) => {
        // const { txn, name } = transaction;
        // gameLobbies = produce(gameLobbies, (draft) => {
        //     const room = R.pathOr(null, [lobby, "rooms", id], draft);
        //     if (room) {
        //         draft[lobby].rooms[id].events.push({
        //             type: "txn",
        //             desc: name,
        //             result: true,
        //             id: id,
        //             txn: txn,
        //             lobby: lobby,
        //             timeCreated: new Date().getTime(),
        //         });
        //     }
        // });
    };

    await Utils.setProvider();

    rewardEmitter.on("drop", async (drop) => {
        const coin = R.find(R.propEq("coin", drop.coin))(rewardLedger);

        if (coin) {
            if (typeof drop.coin === "string") {
                const amount = BigInt(Math.trunc(drop.amount * Math.pow(10, coin.decimals)));

                rewardsHandler[drop.coin] = await new ethers.Contract(drop.coin, standardInterface, Utils.account);
                rewardsHandler[drop.coin]
                    .approve(ROOT_ADDRESS, amount)
                    .then(async (txn_approval) => {
                        const txn = await txn_approval.wait();
                        const hash = txn.transactionHash;

                        console.log("[CONTRACT] (transfer)", hash);

                        txnObservables[hash] = timer(0, 2750);
                        txnObservables[hash]
                            .pipe(
                                concatMap(() =>
                                    from(axios.post(HOST, TXN_PARAMS(hash))).pipe(map((response) => response))
                                )
                            )
                            .pipe(filter(({ data }) => data.result && typeof data.result === "object"))
                            .pipe(take(1))
                            .subscribe(({ data }) => {
                                if (data.result.status === "0x0") {
                                    transferFailure({ txn: hash, name: "transfer" });
                                } else {
                                    rewardsHandler[drop.coin]
                                        .transfer(drop.address, amount)
                                        .then(async (txn_transfer) => {
                                            const txn = await txn_transfer.wait();
                                            const hash = txn.transactionHash;

                                            console.log("[CONTRACT] (transfer)", hash);

                                            txnObservables[hash] = timer(0, 2750);

                                            txnObservables[hash]
                                                .pipe(
                                                    concatMap(() =>
                                                        from(axios.post(HOST, TXN_PARAMS(hash))).pipe(
                                                            map((response) => response)
                                                        )
                                                    )
                                                )
                                                .pipe(
                                                    filter(({ data }) => data.result && typeof data.result === "object")
                                                )
                                                .pipe(take(1))
                                                .subscribe(({ data }) => {
                                                    if (data.result.status === "0x0") {
                                                        transferFailure({ txn: hash, name: "transfer" });
                                                    } else {
                                                        transferSuccess({ txn: hash, name: "transfer" });
                                                    }
                                                });

                                            return true;
                                        })
                                        .catch((error) => {
                                            transferFailure({ txn: null, name: "transfer" });

                                            console.trace("[ERROR]", error);
                                        });
                                }
                            });

                        return true;
                    })
                    .catch((error) => {
                        transferFailure({ txn: null, name: "transfer" });

                        console.trace("[ERROR]", error);
                    });
            }
        }
    });
})();
//----- End Rewards Manager

let arcadeUsers = {};
let callbackQueue = {};
let gameLobbies = {};
let lastMutate = new Date().getTime();
let lastSync = new Date().getTime();

let rewardsHandler = {};
let rewardLedger = [];
let socketConnectionCount = 0;
let tokenBalances = [];
let txnObservables = {};

const playerSeats = [
    [-7, -7],
    [0, 7],
    [7, 0],
    [7, 7],
    [0, -7],
    [-7, 0],
    [7, -7],
    [-7, 7],
];
const regionPoll = {};
const registrationFee = {
    xen: 100e18,
    // deflating: 0,
    // staking: 0,
    // emerging: 0,
    // tewken: 100,
    // practice: 10,
    // bronze: 100,
    // silver: 500,
    // gold: 1000,
    // platinum: 5000,
    // diamond: 10000,
};

const addPowerUps = (_blocks) => {
    const blocks = _blocks;
    const count = blocks.length;
    const limit = Math.trunc((count / 3) * 0.25);
    const base = R.range(0, count);
    const shuffle = shuffler(Math.random);
    const slurry = shuffle(base).slice(0, limit);

    slurry.forEach((key, index) => {
        blocks[key].itemToGive = Math.floor(Math.random() * 3);
    });

    return { powerups: blocks, indices: slurry };
};

const addRewards = (_blocks, _powerups, _lobby, _id) => {
    const blocks = _blocks;
    const block_count = blocks.length;
    const limit = getLobbyLimit(_lobby, block_count);
    const base = R.range(0, block_count);
    const shuffle = shuffler(Math.random);

    let slurry = [];

    shuffle(base).map((index) => {
        if (
            _powerups.findIndex((number) => {
                return number === index;
            }) === -1
        ) {
            slurry.push(index);
        }
    });

    slurry = slurry.slice(0, limit);

    const reward = R.pathOr(null, [_lobby, "rooms", _id, "rewards", "reward"], gameLobbies);

    const item = reward ? reward : getItemByLobby(_lobby);

    slurry.forEach((key, index) => {
        if (item) {
            blocks[key].itemToGive = item;
        }
    });

    return {
        blocks,
        items: item > 0 ? slurry.length : 0,
        reward: item,
    };
};

const cleanUpGameLobbies = () => {
    Object.keys(gameLobbies).forEach((lobbyKey) => {
        const lobby = gameLobbies[lobbyKey];

        Object.keys(lobby.rooms).forEach((roomKey) => {
            if (lobby.rooms[roomKey].complete) {
                gameLobbies = produce(gameLobbies, (draft) => {
                    logRoom(lobby.rooms[roomKey])
                        .then(() => {
                            console.log("[INFO] cleanUpGameLobbies - room:", roomKey);
                            disconnectMatch(lobby.rooms[roomKey].players);
                        })
                        .catch((error) => {
                            console.trace("[ERROR] cleanUpGameLobbies - error:", error);
                            disconnectMatch(lobby.rooms[roomKey].players);
                        });

                    delete draft[lobbyKey].rooms[roomKey];
                });
            }
        });
    });
};

const createRoom = () => {
    const _id = +(new Date().getTime() + getRandom(new Date().getTime()));

    return {
        id: _id,
        bombId: 1,
        bombs: {},
        complete: false,
        count: 0,
        events: [],
        exchange: false,
        lobby: null,
        loops: [],
        mining: false,
        players: {},
        powerupId: 1,
        powerups: [],
        rankings: null,
        refundable: false,
        rewards: {
            amount: 0,
            items: 0,
            total: 0,
        },
        seats: shuffleSeats(playerSeats),
        started: false,
        timeCreated: new Date().getTime(),
    };
};

const disconnectMatch = (players) => {
    Object.keys(players).forEach((key, index) => {
        io.sockets.sockets[players[key].socketID].disconnect(true);
    });
};

const endMatch = (socket, room, rankings) => {
    const sortByRanking = R.sortBy(R.compose(R.prop("diePos")));
    const winner = sortByRanking(rankings)[0];

    console.log("[EMIT] endMatch - setWinner", winner.room, winner.id);

    socket.emit("matchEnded");

    return winner;
};

const getBlocks = (_blocks, _lobby, _id) => {
    const blocks = _blocks;
    const condition = R.propEq("kind", 1);
    const bricks = R.filter(condition, blocks);
    const { powerups, indices } = addPowerUps(bricks);
    const response = addRewards(powerups, indices, _lobby, _id);

    blocks.forEach((brick, index) => {
        blocks[brick.id] = brick;
    });

    return {
        blocks: response.blocks,
        items: response.items,
        reward: response.reward,
    };
};

const getGameId = (lobby) => {
    const rooms = R.pathOr(null, [lobby, "rooms"], gameLobbies);
    const keys = rooms ? Object.keys(rooms) : [];

    let existing = false;

    for (let key = 0; key < keys.length; key++) {
        const id = keys[key];
        const room = rooms[id];

        console.log("[INFO] Poll room #", id);

        if (room.count < 6 && (room.started === false || room.complete === false)) {
            existing = true;
            console.log("[INFO] gameLobbies existing:", lobby, Object.keys(gameLobbies[lobby].rooms));

            return { existing: existing, gameId: room.id };
        }
    }

    const room = createRoom();
    room.lobby = lobby;

    switch (lobby) {
        case "bronze":
            room.mining = true;
            room.refundable = false;

            break;
        case "xen":
            room.mining = true;
            room.refundable = false;

            break;
        case "tewken":
            room.exchange = true;
            room.refundable = false;

            break;
        default:
            break;
    }

    gameLobbies = produce(gameLobbies, (draft) => {
        if (rooms) {
            draft[lobby].rooms[room.id] = room;
        } else {
            draft[lobby] = { rooms: { [room.id]: room } };
        }
    });

    console.log("[INFO] gameLobbies default:", lobby, Object.keys(gameLobbies[lobby].rooms));

    return { existing: existing, gameId: room.id };
};

const getItemByLobby = (lobby) => {
    switch (lobby) {
        case "deflating":
            return DEFLATING_INDEX[randomItem(0, DEFLATING_INDEX.length - 1)];
        case "staking":
            return STAKING_INDEX[randomItem(0, STAKING_INDEX.length - 1)];
        case "emerging":
            return EMERGING_INDEX[randomItem(0, EMERGING_INDEX.length - 1)];
        case "xen":
            return XEN_INDEX[randomItem(0, XEN_INDEX.length - 1)];
        case "tewken":
            return TEWKEN_INDEX[randomItem(0, TEWKEN_INDEX.length - 1)];
        case "practice":
            return PRACTICE_INDEX[randomItem(0, PRACTICE_INDEX.length - 1)];
        case "bronze":
            return LIVE_INDEX[randomItem(0, LIVE_INDEX.length - 1)];
        case "silver":
            return LIVE_INDEX[randomItem(0, LIVE_INDEX.length - 1)];
        case "gold":
            return LIVE_INDEX[randomItem(0, LIVE_INDEX.length - 1)];
        case "platinum":
            return LIVE_INDEX[randomItem(0, LIVE_INDEX.length - 1)];
        case "diamond":
            return LIVE_INDEX[randomItem(0, LIVE_INDEX.length - 1)];
        default:
            return -1;
    }
};

const getLobbyLimit = (lobby, block_count) => {
    switch (lobby) {
        case "deflating":
            return Math.trunc(block_count * 0.045);
        case "staking":
            return Math.trunc(block_count * 0.045);
        case "emerging":
            return Math.trunc(block_count * 0.045);
        case "xen":
            return Math.trunc(block_count * 0.025);
        case "tewken":
            return Math.trunc(block_count * 0.175);
        case "practice":
            return Math.trunc(block_count * 0.045);
        case "bronze":
            return Math.trunc(block_count * 0.025);
        case "silver":
            return Math.trunc(block_count * 0.025);
        case "gold":
            return Math.trunc(block_count * 0.025);
        case "platinum":
            return Math.trunc(block_count * 0.025);
        case "diamond":
            return Math.trunc(block_count * 0.025);
        default:
            return Math.trunc(block_count * 0.075);
    }
};

const getPlayersInsideMatches = () => {
    let player_count = 0;
    let lobbies = {};

    Object.keys(gameLobbies).forEach((lobbyKey) => {
        const lobby = gameLobbies[lobbyKey];
        lobbies[lobbyKey] = {};
        lobbies[lobbyKey].player_count = 0;
        lobbies[lobbyKey].room_count = Object.keys(lobby.rooms).length;

        Object.keys(lobby.rooms).forEach((roomKey) => {
            player_count += Object.keys(lobby.rooms[roomKey].players).length;
            lobbies[lobbyKey].player_count += Object.keys(lobby.rooms[roomKey].players).length;
        });
    });

    return { count: player_count, ...lobbies };
};

const getRandom = (max) => {
    return Math.floor(Math.random() * Math.floor(max));
};

const getRewardPool = () => {
    let rewardPool = 0;

    tokenBalances.forEach((token) => {
        rewardPool += token.balance * getPrice(token.name);
    });

    return rewardPool;
};

const getRoomLimit = (timeCreated) => {
    const currentTime = new Date().getTime();
    const timeSinceCreated = (currentTime - timeCreated) / 1000 / 60;

    console.log("[INFO] timeSinceCreated", timeSinceCreated);

    let limit = 6;

    if (timeSinceCreated < 1) {
        limit = 6;
    }

    if (timeSinceCreated > 1) {
        limit = 4;
    }

    if (timeSinceCreated > 4) {
        limit = 2;
    }

    if (timeSinceCreated > 6) {
        limit = -1;
    }

    return limit;
};

const getServerMessage = async (lobby, id) => {
    const transactionFailure = (transaction) => {
        const { txn, name } = transaction;

        gameLobbies = produce(gameLobbies, (draft) => {
            const room = R.pathOr(null, [lobby, "rooms", id], draft);

            if (room) {
                draft[lobby].rooms[id].events.push({
                    type: "txn",
                    desc: name,
                    result: false,
                    id: id,
                    txn: txn,
                    lobby: lobby,
                    timeCreated: new Date().getTime(),
                });
            }
        });
    };

    const transactionSuccess = (transaction) => {
        const { txn, name } = transaction;

        gameLobbies = produce(gameLobbies, (draft) => {
            const room = R.pathOr(null, [lobby, "rooms", id], draft);

            if (room) {
                draft[lobby].rooms[id].events.push({
                    type: "txn",
                    desc: name,
                    result: true,
                    id: id,
                    txn: txn,
                    lobby: lobby,
                    timeCreated: new Date().getTime(),
                });
            }
        });
    };

    const room = R.pathOr(null, [lobby, "rooms", id], gameLobbies);
    const gsmRoomLimit = getRoomLimit(room.timeCreated);
    const playerCount = Object.keys(room.players).length;

    console.log("[INFO] gsmRoomLimit", gsmRoomLimit);

    if (gsmRoomLimit === -1) {
        console.log("[EMIT] stayConnected");

        io.sockets.in(room.id).emit("stayConnected");

        gameLobbies = produce(gameLobbies, (draft) => {
            draft[lobby].rooms[room.id].refundable = true;
            draft[lobby].rooms[room.id].timeCreated = new Date().getTime();
        });

        console.log("[INFO] roomStartTime - gsm", room.timeCreated);
    }

    if (gsmRoomLimit > playerCount && playerCount > 0) {
        console.log("[INFO] Waiting for match start.");

        const playersNeeded = gsmRoomLimit - playerCount > 2 ? gsmRoomLimit - playerCount : 2;

        io.sockets.in(room.id).emit("serverMessage", {
            message: "Looking for " + playersNeeded + " more players.",
            time: room.timeCreated,
        });
    } else if ((gsmRoomLimit !== -1 || (gsmRoomLimit === -1 && playerCount === 2)) && gsmRoomLimit <= playerCount) {
        console.log("[EMIT] Match started!");

        io.sockets.in(room.id).emit("serverMessage", {
            message: "Match Started!",
            time: room.timeCreated,
        });

        const loop = R.pathOr(null, ["loops", 0, "loop"], room);

        setTimeout(() => {
            clearInterval(loop);
        });

        gameLobbies = produce(gameLobbies, (draft) => {
            draft[lobby].rooms[room.id].started = true;
            draft[lobby].rooms[room.id].refundable = false;
            draft[lobby].rooms[room.id].events.push({
                type: "start",
                id: room.id,
                lobby: lobby,
                timeCreated: new Date().getTime(),
            });

            const total = +R.pathOr(0, [lobby, "rooms", room.id, "rewards", "total"], draft);
            const items = +R.pathOr(0, [lobby, "rooms", room.id, "rewards", "items"], draft);

            draft[lobby].rooms[room.id].rewards["amount"] = items > 0 ? total / items : 0;
        });

        console.log(room.id, R.pathOr("WRONG", [lobby, "rooms", room.id, "rewards"], gameLobbies));

        if (Utils.contract["arcade"]) {
            Utils.contract["arcade"]
                .closeGame(room.id, {
                    gasLimit: 275000,
                    gasPrice: Utils.provider.getGasPrice(),
                    value: ethers.utils.parseEther(ZERO),
                    nonce: await Utils.provider.getTransactionCount(Utils.account.address),
                })
                .then(async (txn_close_game) => {
                    const txn = await txn_close_game.wait();
                    const hash = txn.transactionHash;

                    console.log("[CONTRACT] (closeGame)", hash);

                    callbackQueue = produce(callbackQueue, (draft) => {
                        draft[hash] = transactionSuccess({ txn: hash, name: "closeGame" });
                    });

                    txnObservables[hash] = timer(0, 2750);

                    txnObservables[hash]
                        .pipe(
                            concatMap(() => from(axios.post(HOST, TXN_PARAMS(hash))).pipe(map((response) => response)))
                        )
                        .pipe(filter(({ data }) => typeof data.result === "object"))
                        .pipe(take(1))
                        .subscribe(({ data }) => {});

                    return true;
                })
                .catch((error) => {
                    transactionFailure({ txn: null, name: "closeGame" });

                    console.trace("[ERROR]", error);
                });
        } else {
            transactionFailure({ txn: null, name: "closeGame" });

            console.trace("[ERROR] RPC not found.");
        }
    } else if (playerCount === 0) {
        gameLobbies = produce(gameLobbies, (draft) => {
            draft[lobby].rooms[room.id].complete = true;
            draft[lobby].rooms[room.id].refundable = false;
            draft[lobby].rooms[room.id].events.push({
                type: "cleanup",
                id: room.id,
                lobby: lobby,
                timeCreated: new Date().getTime(),
            });

            const loop = R.pathOr(null, ["loops", 0, "loop"], room);
            clearInterval(loop);
        });

        console.log("[INFO] Closing empty room.");
    } else {
        console.log("[ERROR] Matchmaking", gsmRoomLimit, playerCount);
    }
};

const getTokenLimit = async () => {
    const tokens = [];

    rewardLedger.map(async (reward) => {
        try {
            const contract = await new ethers.Contract(reward.coin, standardInterface, Utils.account);
            const balance = await contract.balanceOf(Utils.account.address);
            const decimals = await contract.decimals();

            tokens.push({
                name: reward.coin,
                balance: balance / Math.pow(10, decimals),
            });
        } catch (exception) {
            console.trace("[ERROR]", exception);
        }
    });

    tokenBalances = produce(tokens, (draft) => {});
};

const getTokens = (lobby) => {
    switch (lobby) {
        case "deflating":
            return DEFLATING_INDEX.length;
        case "staking":
            return STAKING_INDEX.length;
        case "emerging":
            return EMERGING_INDEX.length;
        case "xen":
            return XEN_INDEX.length;
        case "tewken":
            return TEWKEN_INDEX.length;
        case "practice":
            return PRACTICE_INDEX.length;
        case "bronze":
            return LIVE_INDEX.length;
        case "silver":
            return LIVE_INDEX.length;
        case "gold":
            return LIVE_INDEX.length;
        case "platinum":
            return LIVE_INDEX.length;
        case "diamond":
            return LIVE_INDEX.length;
        default:
            return 1;
    }
};

const joinUser = (socket, room, lobby, player_id, username, points) => {
    const index = room.count - 1;
    const x = room.seats[index][0];
    const z = room.seats[index][1];

    const seatedPlayer = {
        angleY: 0,
        availableBombs: 1,
        currentBombLength: 1,
        id: player_id,
        movement_speed: 3,
        name: "<span style='color:orange'>" + points + "</span> ] " + username,
        seated: true,
        socketID: socket.id,
        spawnPoint: {
            x: x,
            z: z,
            isBusy: false,
        },
        spawnX: x,
        spawnZ: z,
        velocity: 0,
        x: x,
        z: z,
    };

    socket.join(room.id);

    if (!room.blocks) {
        const response = getBlocks(blocks, lobby, room.id);

        room.rewards.items = response.items;
        room.rewards.reward = response.reward;
        room.rewards.url = R.pathOr(null, [response.reward, "url"], rewardMap);
        room.blocks = response.blocks;

        socket.emit("getBlocks", { blocks: room.blocks });
    } else {
        socket.emit("getBlocks", { blocks: room.blocks });
    }

    const players = Object.keys(room.players).map((_key) => room.players[_key]);

    socket.emit("getOldPlayers", { oldPlayers: players });

    room.players = Object.assign({ [player_id]: seatedPlayer }, room.players);
    room.bombs[player_id] = 0;

    socket.emit("getId", { id: player_id });

    io.sockets.in(room.id).emit("spawnPlayer", { newPlayer: seatedPlayer });

    console.log("[EMIT] spawnPlayer");

    if (!room.loops.length) {
        const id = room.id;
        const loop = {
            id: player_id,
            loop: setInterval(() => {
                getServerMessage(lobby, id);
            }, 15000),
            type: "message",
        };

        room.loops.push(loop);
    }

    room.events.push({
        type: "seat",
        id: seatedPlayer.id,
        lobby: lobby,
        timeCreated: new Date().getTime(),
    });

    return room;
};

const logRoom = (room) => {
    const chiharu_games = store.collection("chiharu_games");
    const room_id = room.id + "";

    return chiharu_games
        .doc(room_id)
        .get()
        .then(async (snapshot) => {
            if (!snapshot.exists) {
                chiharu_games
                    .doc(room_id)
                    .set({
                        ...room,
                        loops: [],
                        seats: JSON.stringify(room.seats),
                    })
                    .then()
                    .catch((error) => {
                        const txn_hash = guid();

                        console.trace("[ERROR]", error, txn_hash);
                    });
            } else {
                const chiharu_room = {
                    ...snapshot.data(),
                    ...room,
                    loops: [],
                    seats: JSON.stringify(room.seats),
                };

                chiharu_games
                    .doc(room_id)
                    .set(chiharu_room)
                    .then()
                    .catch((error) => {
                        const txn_hash = guid();

                        console.trace("[ERROR]", error, txn_hash);
                    });
            }
        })
        .catch((error) => {
            const txn_hash = guid();

            console.trace("[ERROR]", error, txn_hash);
        });
};

const officiateRoom = (socket, room, ranking, rankings) => {
    const totalPlayers = ranking.totalPlayers;
    const rankings_list = Object.keys(rankings).map((key) => rankings[key]);

    if (rankings_list.length === totalPlayers - 1) {
        // @TODO Save game in firestore or contract?

        io.sockets.in(ranking.room).emit("matchEnded");

        room.events.push({
            type: "match",
            id: room.id,
            lobby: ranking.lobby,
            timeCreated: new Date().getTime(),
        });
    } else if (rankings_list.length === totalPlayers) {
        // @TODO Save game in firestore or contract?

        const winner = endMatch(socket, room, rankings_list);

        if (!room.contested && winner) {
            setWinner(winner, winner.lobby);

            room.events.push({
                type: "match",
                id: room.id,
                lobby: winner.lobby,
                timeCreated: new Date().getTime(),
                winner: winner.id,
            });
        } else {
            room.events.push({
                type: "contested_match",
                id: room.id,
                lobby: winner.lobby,
                timeCreated: new Date().getTime(),
                winner: winner.id,
            });

            room.complete = true;
        }
    } else if (rankings_list.length > totalPlayers) {
        // @TODO Flag game as contested?
        // @TODO Save game in firestore or contract?

        const winner = endMatch(socket, room, rankings_list);

        if (!room.contested && winner) {
            setWinner(winner, winner.lobby);

            room.events.push({
                type: "match",
                id: room.id,
                lobby: winner.lobby,
                timeCreated: new Date().getTime(),
                winner: winner.id,
            });
        } else {
            room.events.push({
                type: "contested_match",
                id: room.id,
                lobby: winner.lobby,
                timeCreated: new Date().getTime(),
                winner: winner.id,
            });

            room.complete = true;
        }
    } else if (totalPlayers < 2) {
        // @TODO Flag game as contested?
        // @TODO Save game in firestore or contract?

        const winner = endMatch(socket, room, rankings_list);

        if (!room.contested && winner) {
            setWinner(winner, winner.lobby);

            room.events.push({
                type: "match",
                id: room.id,
                lobby: winner.lobby,
                timeCreated: new Date().getTime(),
            });
        } else {
            room.events.push({
                type: "contested_match",
                id: room.id,
                lobby: winner.lobby,
                timeCreated: new Date().getTime(),
            });

            room.complete = true;
        }
    }

    return room;
};

const randomItem = (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);

    return Math.floor(Math.random() * (max - min + 1)) + min;
};

const setRanking = (socket, room, ranking) => {
    const sortByRanking = R.sortBy(R.compose(R.prop("curElo")));

    const totalPlayers = ranking.totalPlayers;
    const won = ranking.diePos === 1 ? 1 : 0;
    const ptDiff = (totalPlayers - ranking.diePos) * 2;
    const currentPoints = R.pathOr(0, [ranking.id], arcadeUsers); // @TODO Get from oracle or firestore?
    const rankPos = 0; // @TODO Get from oracle or firestore?

    socket.emit("getRankedMatchResult", {
        won: won,
        ptDiff: ptDiff,
        currentPoints: currentPoints + ptDiff,
        diePos: ranking.diePos,
        totalPlayers: totalPlayers,
        rnkPos: rankPos,
    });

    arcadeUsers = produce(arcadeUsers, (draft) => {
        draft[ranking.id].curElo += ptDiff;
        draft[ranking.id].seasonElo += ptDiff;

        const arcadeUserList = Object.keys(draft).map((key) => draft[key]);
        const sortedArcadeUserList = sortByRanking(arcadeUserList).map((arcadeUser, index) => {
            return {
                ...arcadeUser,
                rnkPos: index + 1,
            };
        });

        const _arcadeUsers = {};

        sortedArcadeUserList.forEach((arcadeUser) => {
            _arcadeUsers[arcadeUser.id] = arcadeUser;
        });

        draft = _arcadeUsers;
    });

    lastMutate = new Date().getTime();

    room.events.push({
        type: "ranking",
        id: ranking.id,
        diePos: ranking.diePos,
        points: ptDiff,
        lobby: room.lobby,
        timeCreated: new Date().getTime(),
    });

    return room;
};

const setWinner = async (winner, lobby) => {
    const payoutFailure = (txn) => {
        io.sockets.to(winner.socketID).emit("payoutFailure");

        gameLobbies = produce(gameLobbies, (draft) => {
            const winner_room = R.pathOr(null, [winner.lobby, "rooms", winner.room], draft);

            if (winner_room) {
                draft[winner.lobby].rooms[winner.room].complete = true;
                draft[winner.lobby].rooms[winner.room].events.push({
                    type: "payable",
                    id: winner_room.id,
                    players: winner.totalPlayers,
                    txn: txn,
                    lobby: winner.lobby,
                    timeCreated: new Date().getTime(),
                });
            }
        });
    };

    const payoutSuccess = (txn) => {
        io.sockets.to(winner.socketID).emit("payoutSuccess");

        gameLobbies = produce(gameLobbies, (draft) => {
            const winner_room = R.pathOr(null, [winner.lobby, "rooms", winner.room], draft);

            if (winner_room) {
                draft[winner.lobby].rooms[winner.room].complete = true;
                draft[winner.lobby].rooms[winner.room].events.push({
                    type: "payout",
                    id: winner_room.id,
                    players: winner.totalPlayers,
                    txn: txn,
                    lobby: winner.lobby,
                    timeCreated: new Date().getTime(),
                });
            }
        });
    };

    const miningFailure = (txn) => {
        io.sockets.to(winner.socketID).emit("miningFailure");

        gameLobbies = produce(gameLobbies, (draft) => {
            const winner_room = R.pathOr(null, [winner.lobby, "rooms", winner.room], draft);

            if (winner_room) {
                draft[winner.lobby].rooms[winner.room].complete = true;
                draft[winner.lobby].rooms[winner.room].events.push({
                    type: "mining",
                    id: winner_room.id,
                    players: winner.totalPlayers,
                    txn: txn,
                    lobby: winner.lobby,
                    timeCreated: new Date().getTime(),
                });
            }
        });
    };

    const miningSuccess = (txn) => {
        io.sockets.to(winner.socketID).emit("miningSuccess");

        gameLobbies = produce(gameLobbies, (draft) => {
            const winner_room = R.pathOr(null, [winner.lobby, "rooms", winner.room], draft);

            if (winner_room) {
                draft[winner.lobby].rooms[winner.room].complete = true;
                draft[winner.lobby].rooms[winner.room].events.push({
                    type: "mining",
                    id: winner_room.id,
                    players: winner.totalPlayers,
                    txn: txn,
                    lobby: winner.lobby,
                    timeCreated: new Date().getTime(),
                });
            }
        });
    };

    if (Utils.contract["arcade"]) {
        if (lobby === "mining") {
            Utils.contract["arcade"]
                .closeGame(winner.room, {
                    gasLimit: 275000,
                    gasPrice: Utils.provider.getGasPrice(),
                    value: ethers.utils.parseEther(ZERO),
                    nonce: await Utils.provider.getTransactionCount(Utils.account.address),
                })
                .then(async (txn_close_game) => {
                    const txn = await txn_close_game.wait();
                    const hash = txn.transactionHash;

                    console.log("[CONTRACT] (closeGame)", hash);

                    callbackQueue = produce(callbackQueue, (draft) => {
                        draft[hash] = miningSuccess({ txn: hash, name: "miningEnded" });
                    });

                    txnObservables[hash] = timer(0, 2750);

                    txnObservables[hash]
                        .pipe(
                            concatMap(() => from(axios.post(HOST, TXN_PARAMS(hash))).pipe(map((response) => response)))
                        )
                        .pipe(filter(({ data }) => typeof data.result === "object"))
                        .pipe(take(1))
                        .subscribe(({ data }) => {});

                    return true;
                })
                .catch((error) => {
                    miningFailure({ txn: null, name: "miningEnded" });

                    console.trace("[ERROR]", error);
                });
        } else {
            Utils.contract["arcade"]
                .setWinner(winner.room, winner.id, {
                    gasLimit: 275000,
                    gasPrice: Utils.provider.getGasPrice(),
                    value: ethers.utils.parseEther(ZERO),
                    nonce: await Utils.provider.getTransactionCount(Utils.account.address),
                })
                .then(async (txn_winner) => {
                    const txn = await txn_winner.wait();
                    const hash = txn.transactionHash;

                    console.log("[CONTRACT] (setWinner)", hash);

                    callbackQueue = produce(callbackQueue, (draft) => {
                        draft[hash] = payoutSuccess({ txn: hash });
                    });

                    txnObservables[hash] = timer(0, 2750);

                    txnObservables[hash]
                        .pipe(
                            concatMap(() => from(axios.post(HOST, TXN_PARAMS(hash))).pipe(map((response) => response)))
                        )
                        .pipe(filter(({ data }) => data.result && typeof data.result === "object"))
                        .pipe(take(1))
                        .subscribe(({ data }) => {
                            if (data.result.status === "0x0") {
                                payoutFailure(hash);
                            }
                        });

                    return true;
                })
                .catch((error) => {
                    payoutFailure(null);

                    console.trace("[ERROR]", error);
                });
        }
    } else {
        payoutFailure(null);

        console.trace("[ERROR] RPC not found.");
    }
};

const shuffleSeats = (array) => {
    var currentIndex = array.length;
    var temporaryValue;
    var randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
};

const synchronizeArcadeUsers = () => {
    const batch = store.batch();
    const arcadeUserList = Object.keys(arcadeUsers).map((key) => arcadeUsers[key]);

    arcadeUserList.forEach((arcadeUser) => {
        const id = R.pathOr(null, ["id"], arcadeUser);
        
        if (id) {
            const arcadeRef = store.collection("chiharu_users").doc(id);
            batch.set(arcadeRef, arcadeUser);
        }
    });

    batch.commit().then(() => {
        lastSync = new Date().getTime();
    });
};

const synchronizeRooms = () => {
    Object.keys(gameLobbies).forEach((lobbyKey) => {
        const lobby = gameLobbies[lobbyKey];

        Object.keys(lobby.rooms).forEach((roomKey) => {
            logRoom(lobby.rooms[roomKey])
                .then(() => {
                    // console.log("[INFO] synchronizeRooms - room:", roomKey);
                })
                .catch((error) => {
                    console.trace("[ERROR] synchronizeRooms - error:", error);
                });
        });
    });
};

io.on("connection", (socket) => {
    console.log("[INFO] User Connected: Socket #", socket.id, " Connections:", ++socketConnectionCount);

    socket.on("calculateRankedMatch", (_ranking) => {
        console.log("[INFO] Ranking inbound", _ranking.id, _ranking.diePos);

        let timeRanked = null;

        const lobby = _ranking.lobby;
        const room = R.pathOr(null, [lobby, "rooms", _ranking.room], gameLobbies);
        const players = R.pathOr({}, ["players"], room);

        let rankings = R.pathOr(null, ["rankings"], room);

        if (room && rankings) {
            let player = rankings[_ranking.id];

            if (player) {
                console.log("[INFO] Ranking rejected", _ranking.id, _ranking.diePos);

                socket.emit("contestedRankedMatchResult");

                gameLobbies = produce(gameLobbies, (draft) => {
                    draft[lobby].rooms[room.id].contested = true;
                    draft[lobby].rooms[room.id].events.push({
                        type: "contested_match",
                        id: room.id,
                        lobby: lobby,
                        timeCreated: new Date().getTime(),
                    });
                });
            } else {
                console.log("[INFO] Ranking accepted...", _ranking.id, _ranking.diePos);

                const isRanked = rankings[_ranking.diePos];
                const currentTime = new Date().getTime();
                const timeSinceCreated = timeRanked ? (currentTime - timeRanked) / 1000 / 60 : 0;

                if (isRanked) {
                    socket.emit("contestedRankedMatchResult");

                    gameLobbies = produce(gameLobbies, (draft) => {
                        draft[lobby].rooms[room.id].contested = true;
                        draft[lobby].rooms[room.id].events.push({
                            type: "contested_match",
                            id: room.id,
                            lobby: lobby,
                            timeCreated: new Date().getTime(),
                        });
                    });
                } else {
                    player = players[_ranking.id];

                    rankings[_ranking.diePos] = {
                        ...player,
                        ..._ranking,
                    };

                    gameLobbies = produce(gameLobbies, (draft) => {
                        draft[lobby].rooms[room.id].rankings = rankings;
                        draft[lobby].rooms[room.id] = setRanking(socket, draft[lobby].rooms[room.id], _ranking);
                        draft[lobby].rooms[room.id] = officiateRoom(
                            socket,
                            draft[lobby].rooms[room.id],
                            _ranking,
                            rankings
                        );
                    });
                }
            }
        } else {
            let player = players[_ranking.id];

            rankings = {};
            rankings[_ranking.diePos] = {
                ...player,
                ..._ranking,
            };

            if (room) {
                console.log("[INFO] Rank set created...", _ranking.room, _ranking.id, _ranking.diePos);

                gameLobbies = produce(gameLobbies, (draft) => {
                    draft[lobby].rooms[room.id].rankings = rankings;
                    draft[lobby].rooms[room.id] = setRanking(socket, draft[lobby].rooms[room.id], _ranking);
                    draft[lobby].rooms[room.id] = officiateRoom(
                        socket,
                        draft[lobby].rooms[room.id],
                        _ranking,
                        rankings
                    );
                });

                timeRanked = new Date().getTime();
            }
        }
    });

    socket.on("consumePowerup", (powerup) => {
        const getBaseFactor = (lobby, players) => {
            return (rewardValueBaseline(lobby) * Object.keys(players).length * 0.01) / getTokens(lobby);
        };

        const rewardValueBaseline = (lobby) => {
            return registrationFee[lobby] ? registrationFee[lobby] : BASELINE_REWARD;
        };

        const room = R.pathOr(null, [powerup.lobby, "rooms", powerup.room], gameLobbies);

        if (room) {
            const player = R.pathOr(null, ["players", powerup.consumerId], room);

            if (player) {
                const active_powerup = R.pathOr(null, ["powerups", powerup.id - 1], room);

                if (active_powerup) {
                    io.sockets.in(powerup.room).emit("consumePowerup", {
                        id: powerup.id,
                        consumerId: powerup.consumerId,
                    });

                    gameLobbies = produce(gameLobbies, (draft) => {
                        switch (active_powerup.item) {
                            case 0: {
                                draft[powerup.lobby].rooms[powerup.room].players[player.id].currentBombLength++;

                                break;
                            }

                            case 1: {
                                draft[powerup.lobby].rooms[powerup.room].players[player.id].movement_speed += 0.125;

                                break;
                            }

                            case 2: {
                                draft[powerup.lobby].rooms[powerup.room].players[player.id].availableBombs++;

                                break;
                            }

                            case 3: {
                                const base = getBaseFactor(powerup.lobby, room.players);
                                const factor = Number.isNaN(base) ? 1 : base;
                                const amount = Math.floor(factor / getPrice(XEN_ADDRESS));
                                const coin = R.find(R.propEq("coin", XEN_ADDRESS))(rewardLedger);

                                let reward = amount;

                                if (reward === 0 || Number.isNaN(reward)) {
                                    if (coin.decimals === 0) {
                                        reward = 1;
                                    } else {
                                        reward = Math.pow(10, -coin.decimals).toFixed(coin.decimals);
                                    }
                                }

                                console.log("XEN reward", reward);

                                draft[powerup.lobby].rooms[powerup.room].events.push({
                                    type: "pickup_coin",
                                    name: "XEN",
                                    coin: XEN_ADDRESS,
                                    id: player.id,
                                    lobby: powerup.lobby,
                                    amount: reward,
                                    timeCreated: new Date().getTime(),
                                });

                                rewardEmitter.emit("drop", {
                                    name: "XEN",
                                    coin: XEN_ADDRESS,
                                    address: player.id,
                                    lobby: powerup.lobby,
                                    amount: reward,
                                    timeCreated: new Date().getTime(),
                                });

                                break;
                            }

                            case 4: {
                                const base = getBaseFactor(powerup.lobby, room.players);
                                const factor = Number.isNaN(base) ? 1 : base;
                                const amount = Math.floor(factor / getPrice(1002000));
                                const coin = R.find(R.propEq("coin", 1002000))(rewardLedger);

                                let reward = amount;

                                if (reward === 0 || Number.isNaN(reward)) {
                                    if (coin.decimals === 0) {
                                        reward = 1;
                                    } else {
                                        reward = Math.pow(10, -coin.decimals).toFixed(coin.decimals);
                                    }
                                }

                                console.log("BTT reward", reward);

                                draft[powerup.lobby].rooms[powerup.room].events.push({
                                    type: "pickup_coin",
                                    name: "BTT",
                                    coin: 1002000,
                                    id: player.id,
                                    lobby: powerup.lobby,
                                    amount: reward,
                                    timeCreated: new Date().getTime(),
                                });

                                rewardEmitter.emit("drop", {
                                    type: "pickup_coin",
                                    name: "BTT",
                                    coin: 1002000,
                                    address: player.id,
                                    lobby: powerup.lobby,
                                    amount: reward,
                                    timeCreated: new Date().getTime(),
                                });

                                break;
                            }

                            case 5: {
                                const base = getBaseFactor(powerup.lobby, room.players);
                                const factor = Number.isNaN(base) ? 1 : base;
                                const amount = Math.floor(factor / getPrice("TVQ6jYV5yTtRsKcD8aRc1a4Kei4V45ixLn"));
                                const coin = R.find(R.propEq("coin", "TVQ6jYV5yTtRsKcD8aRc1a4Kei4V45ixLn"))(
                                    rewardLedger
                                );

                                let reward = amount;

                                if (reward === 0 || Number.isNaN(reward)) {
                                    if (coin.decimals === 0) {
                                        reward = 1;
                                    } else {
                                        reward = Math.pow(10, -coin.decimals).toFixed(coin.decimals);
                                    }
                                }

                                console.log("IGG reward", reward);

                                draft[powerup.lobby].rooms[powerup.room].events.push({
                                    type: "pickup_coin",
                                    name: "IGG",
                                    coin: "TVQ6jYV5yTtRsKcD8aRc1a4Kei4V45ixLn",
                                    id: player.id,
                                    lobby: powerup.lobby,
                                    amount: reward,
                                    timeCreated: new Date().getTime(),
                                });

                                rewardEmitter.emit("drop", {
                                    name: "IGG",
                                    coin: "TVQ6jYV5yTtRsKcD8aRc1a4Kei4V45ixLn",
                                    address: player.id,
                                    lobby: powerup.lobby,
                                    amount: reward,
                                    timeCreated: new Date().getTime(),
                                });

                                break;
                            }

                            case 6: {
                                const base = getBaseFactor(powerup.lobby, room.players);
                                const factor = Number.isNaN(base) ? 1 : base;
                                const amount = Math.floor(factor / getPrice(1001943));
                                const coin = R.find(R.propEq("coin", 1001943))(rewardLedger);

                                let reward = amount;

                                if (reward === 0 || Number.isNaN(reward)) {
                                    if (coin.decimals === 0) {
                                        reward = 1;
                                    } else {
                                        reward = Math.pow(10, -coin.decimals).toFixed(coin.decimals);
                                    }
                                }

                                console.log("POPPY reward", reward);

                                draft[powerup.lobby].rooms[powerup.room].events.push({
                                    type: "pickup_coin",
                                    name: "POPPY",
                                    coin: 1001943,
                                    id: player.id,
                                    lobby: powerup.lobby,
                                    amount: reward,
                                    timeCreated: new Date().getTime(),
                                });

                                rewardEmitter.emit("drop", {
                                    name: "POPPY",
                                    coin: 1001943,
                                    address: player.id,
                                    lobby: powerup.lobby,
                                    amount: reward,
                                    timeCreated: new Date().getTime(),
                                });

                                break;
                            }

                            case 7: {
                                const base = getBaseFactor(powerup.lobby, room.players);
                                const factor = Number.isNaN(base) ? 1 : base;
                                const amount = Math.floor(factor / getPrice("TLvDJcvKJDi3QuHgFbJC6SeTj3UacmtQU3"));
                                const coin = R.find(R.propEq("coin", "TLvDJcvKJDi3QuHgFbJC6SeTj3UacmtQU3"))(
                                    rewardLedger
                                );

                                let reward = amount;

                                if (reward === 0 || Number.isNaN(reward)) {
                                    if (coin.decimals === 0) {
                                        reward = 1;
                                    } else {
                                        reward = Math.pow(10, -coin.decimals).toFixed(coin.decimals);
                                    }
                                }

                                console.log("888 reward", reward);

                                draft[powerup.lobby].rooms[powerup.room].events.push({
                                    type: "pickup_coin",
                                    name: "888",
                                    coin: "TLvDJcvKJDi3QuHgFbJC6SeTj3UacmtQU3",
                                    id: player.id,
                                    lobby: powerup.lobby,
                                    amount: reward,
                                    timeCreated: new Date().getTime(),
                                });

                                rewardEmitter.emit("drop", {
                                    name: "888",
                                    coin: "TLvDJcvKJDi3QuHgFbJC6SeTj3UacmtQU3",
                                    address: player.id,
                                    lobby: powerup.lobby,
                                    amount: reward,
                                    timeCreated: new Date().getTime(),
                                });

                                break;
                            }

                            case 8: {
                                const base = getBaseFactor(powerup.lobby, room.players);
                                const factor = Number.isNaN(base) ? 1 : base;
                                const amount = Math.floor(factor / getPrice(1002442));
                                const coin = R.find(R.propEq("coin", 1002442))(rewardLedger);

                                let reward = amount;

                                if (reward === 0 || Number.isNaN(reward)) {
                                    if (coin.decimals === 0) {
                                        reward = 1;
                                    } else {
                                        reward = Math.pow(10, -coin.decimals).toFixed(coin.decimals);
                                    }
                                }

                                console.log("CPR reward", reward);

                                draft[powerup.lobby].rooms[powerup.room].events.push({
                                    type: "pickup_coin",
                                    name: "CPR",
                                    coin: 1002442,
                                    id: player.id,
                                    lobby: powerup.lobby,
                                    amount: reward,
                                    timeCreated: new Date().getTime(),
                                });

                                rewardEmitter.emit("drop", {
                                    name: "CPR",
                                    coin: 1002442,
                                    address: player.id,
                                    lobby: powerup.lobby,
                                    amount: reward,
                                    timeCreated: new Date().getTime(),
                                });

                                break;
                            }

                            case 9: {
                                const base = getBaseFactor(powerup.lobby, room.players);
                                const factor = Number.isNaN(base) ? 1 : base;
                                const amount = Math.floor(factor / getPrice("TXK1mxwg5yvQbLegWFoCRzBf2Din4kPLGJ"));
                                const coin = R.find(R.propEq("coin", "TXK1mxwg5yvQbLegWFoCRzBf2Din4kPLGJ"))(
                                    rewardLedger
                                );

                                let reward = amount;

                                if (reward === 0 || Number.isNaN(reward)) {
                                    if (coin.decimals === 0) {
                                        reward = 1;
                                    } else {
                                        reward = Math.pow(10, -coin.decimals).toFixed(coin.decimals);
                                    }
                                }

                                console.log("DST reward", reward);

                                draft[powerup.lobby].rooms[powerup.room].events.push({
                                    type: "pickup_coin",
                                    name: "DST",
                                    coin: "TXK1mxwg5yvQbLegWFoCRzBf2Din4kPLGJ",
                                    id: player.id,
                                    lobby: powerup.lobby,
                                    amount: reward,
                                    timeCreated: new Date().getTime(),
                                });

                                rewardEmitter.emit("drop", {
                                    name: "DST",
                                    coin: "TXK1mxwg5yvQbLegWFoCRzBf2Din4kPLGJ",
                                    address: player.id,
                                    lobby: powerup.lobby,
                                    amount: reward,
                                    timeCreated: new Date().getTime(),
                                });

                                break;
                            }

                            case 10: {
                                const base = getBaseFactor(powerup.lobby, room.players);
                                const factor = Number.isNaN(base) ? 1 : base;
                                const amount = Math.floor(factor / getPrice(1002234));
                                const coin = R.find(R.propEq("coin", 1002234))(rewardLedger);

                                let reward = amount;

                                if (reward === 0 || Number.isNaN(reward)) {
                                    if (coin.decimals === 0) {
                                        reward = 1;
                                    } else {
                                        reward = Math.pow(10, -coin.decimals).toFixed(coin.decimals);
                                    }
                                }

                                console.log("ART reward", reward);

                                draft[powerup.lobby].rooms[powerup.room].events.push({
                                    type: "pickup_coin",
                                    name: "ART",
                                    coin: 1002234,
                                    id: player.id,
                                    lobby: powerup.lobby,
                                    amount: reward,
                                    timeCreated: new Date().getTime(),
                                });

                                rewardEmitter.emit("drop", {
                                    name: "ART",
                                    coin: 1002234,
                                    address: player.id,
                                    lobby: powerup.lobby,
                                    amount: reward,
                                    timeCreated: new Date().getTime(),
                                });

                                break;
                            }

                            case 11: {
                                const base = getBaseFactor(powerup.lobby, room.players);
                                const factor = Number.isNaN(base) ? 1 : base;
                                const amount = Math.floor(factor / getPrice("TPpLkxGeKragRC7qpiQjjtNmf6shXWi8i9"));
                                const coin = R.find(R.propEq("coin", "TPpLkxGeKragRC7qpiQjjtNmf6shXWi8i9"))(
                                    rewardLedger
                                );

                                let reward = amount;

                                if (reward === 0 || Number.isNaN(reward)) {
                                    if (coin.decimals === 0) {
                                        reward = 1;
                                    } else {
                                        reward = Math.pow(10, -coin.decimals).toFixed(coin.decimals);
                                    }
                                }

                                console.log("FRAG reward", reward);

                                draft[powerup.lobby].rooms[powerup.room].events.push({
                                    type: "pickup_coin",
                                    name: "FRAG",
                                    coin: "TPpLkxGeKragRC7qpiQjjtNmf6shXWi8i9",
                                    id: player.id,
                                    lobby: powerup.lobby,
                                    amount: reward,
                                    timeCreated: new Date().getTime(),
                                });

                                rewardEmitter.emit("drop", {
                                    name: "FRAG",
                                    coin: "TPpLkxGeKragRC7qpiQjjtNmf6shXWi8i9",
                                    address: player.id,
                                    lobby: powerup.lobby,
                                    amount: reward,
                                    timeCreated: new Date().getTime(),
                                });

                                break;
                            }

                            case 12: {
                                const base = getBaseFactor(powerup.lobby, room.players);
                                const factor = Number.isNaN(base) ? 1 : base;
                                const amount = Math.floor(factor / getPrice("TJASWoyYgUw2M1jvDje7zYLooDCzWYRdkm"));
                                const coin = R.find(R.propEq("coin", "TJASWoyYgUw2M1jvDje7zYLooDCzWYRdkm"))(
                                    rewardLedger
                                );

                                let reward = amount;

                                if (reward === 0 || Number.isNaN(reward)) {
                                    if (coin.decimals === 0) {
                                        reward = 1;
                                    } else {
                                        reward = Math.pow(10, -coin.decimals).toFixed(coin.decimals);
                                    }
                                }

                                console.log("DASH reward", reward);

                                draft[powerup.lobby].rooms[powerup.room].events.push({
                                    type: "pickup_coin",
                                    name: "DASH",
                                    coin: "TJASWoyYgUw2M1jvDje7zYLooDCzWYRdkm",
                                    id: player.id,
                                    lobby: powerup.lobby,
                                    amount: reward,
                                    timeCreated: new Date().getTime(),
                                });

                                rewardEmitter.emit("drop", {
                                    name: "DASH",
                                    coin: "TJASWoyYgUw2M1jvDje7zYLooDCzWYRdkm",
                                    address: player.id,
                                    lobby: powerup.lobby,
                                    amount: reward,
                                    timeCreated: new Date().getTime(),
                                });

                                break;
                            }

                            case 13: {
                                const base = getBaseFactor(powerup.lobby, room.players);
                                const factor = Number.isNaN(base) ? 1 : base;
                                const amount = Math.floor(factor / getPrice("TNo59Khpq46FGf4sD7XSWYFNfYfbc8CqNK"));
                                const coin = R.find(R.propEq("coin", "TNo59Khpq46FGf4sD7XSWYFNfYfbc8CqNK"))(
                                    rewardLedger
                                );

                                let reward = amount;

                                if (reward === 0 || Number.isNaN(reward)) {
                                    if (coin.decimals === 0) {
                                        reward = 1;
                                    } else {
                                        reward = Math.pow(10, -coin.decimals).toFixed(coin.decimals);
                                    }
                                }

                                console.log("BNKR reward", reward);

                                draft[powerup.lobby].rooms[powerup.room].events.push({
                                    type: "pickup_coin",
                                    name: "BNKR",
                                    coin: "TNo59Khpq46FGf4sD7XSWYFNfYfbc8CqNK",
                                    id: player.id,
                                    lobby: powerup.lobby,
                                    amount: reward,
                                    timeCreated: new Date().getTime(),
                                });

                                rewardEmitter.emit("drop", {
                                    name: "BNKR",
                                    coin: "TNo59Khpq46FGf4sD7XSWYFNfYfbc8CqNK",
                                    address: player.id,
                                    lobby: powerup.lobby,
                                    amount: reward,
                                    timeCreated: new Date().getTime(),
                                });

                                break;
                            }

                            case 14: {
                                const amount = R.pathOr(
                                    0,
                                    [powerup.lobby, "rooms", powerup.room, "rewards", "amount"],
                                    gameLobbies
                                );
                                const coin = R.find(R.propEq("coin", "TBhxyECmAg3uCqqmEHQvGJbrgj9cn1yMZ1"))(
                                    rewardLedger
                                );

                                let reward = amount;

                                console.log("TEWKEN amount", amount);

                                if (reward === 0 || Number.isNaN(reward)) {
                                    if (coin.decimals === 0) {
                                        reward = 1;
                                    } else {
                                        reward = Math.pow(10, -coin.decimals).toFixed(coin.decimals);
                                    }
                                }

                                console.log("TEWKEN reward", reward);

                                draft[powerup.lobby].rooms[powerup.room].events.push({
                                    type: "pickup_coin",
                                    name: "TEWKEN",
                                    coin: "TBhxyECmAg3uCqqmEHQvGJbrgj9cn1yMZ1",
                                    id: player.id,
                                    lobby: powerup.lobby,
                                    amount: reward,
                                    timeCreated: new Date().getTime(),
                                });

                                rewardEmitter.emit("drop", {
                                    name: "TEWKEN",
                                    coin: "TBhxyECmAg3uCqqmEHQvGJbrgj9cn1yMZ1",
                                    address: player.id,
                                    lobby: powerup.lobby,
                                    amount: reward,
                                    timeCreated: new Date().getTime(),
                                });

                                break;
                            }

                            default:
                                break;
                        }
                    });
                }
            }
        }
    });

    socket.on("destroyBlock", (block) => {
        const room = R.pathOr(null, [block.lobby, "rooms", block.room], gameLobbies);
        const _block = blockArray[block.id];

        if (room && _block && typeof _block.itemToGive !== "undefined") {
            const item = _block.itemToGive;

            if (item !== null) {
                const powerup = { id: room.powerupId, x: _block.x, z: _block.z, item: item };

                io.sockets.in(block.room).emit("spawnPowerup", { powerup: powerup });

                gameLobbies = produce(gameLobbies, (draft) => {
                    draft[block.lobby].rooms[block.room].powerups.push(powerup);
                    draft[block.lobby].rooms[block.room].powerupId++;
                });
            }
        }

        console.log("[INFO] destroyBlock", block);

        io.sockets.in(block.room).emit("removeBlock", { room: block.room, id: block.id });
    });

    socket.on("initPlayer", (init) => {
        const token = R.pathOr(null, ["token"], init);

        if (token) {
            admin
                .auth()
                .createCustomToken(token)
                .then((jwt) => {
                    const arcadeUser = R.pathOr(null, [token], arcadeUsers);

                    if (arcadeUser) {
                        socket.emit("authenticationSuccess", { ...arcadeUser, jwt: jwt });
                    } else {
                        const newUser = {
                            id: token,
                            seasonElo: 0,
                            curElo: 0,
                            rnkPos: 0,
                            name: token.slice(0, 6),
                            jwt: jwt,
                        };

                        socket.emit("authenticationSuccess", newUser);

                        arcadeUsers = produce(arcadeUsers, (draft) => {
                            draft[token] = newUser;
                        });

                        lastMutate = new Date().getTime();
                    }
                })
                .catch((error) => {
                    console.log("[ERROR] Problem creating custom token:", error);
                });
        } else {
            console.log("[INFO] initPlayer", init);
            socket.emit("getToken");
        }

        console.log("[INFO] initPlayer", init);
    });

    socket.on("joinServer", (server) => {
        const id = server.id;
        const lobby = server.name;
        const rooms = R.pathOr({}, [lobby, "rooms"], gameLobbies);
        const _rooms = Object.keys(rooms);

        for (let i = 0; i < _rooms.length; i++) {
            const key = _rooms[i];
            const room = rooms[key];

            if (room.id === id && room.count < 6) {
                const playerId = server.playerId;
                const arcadeUser = R.pathOr(null, [playerId], arcadeUsers);
                const reward_id = R.pathOr(getItemByLobby(lobby), ["rewards", "reward"], room);

                if (arcadeUser) {
                    switch (lobby) {
                        default:
                            console.log(
                                "[INFO] Launching lobby competitive lobby for " + registrationFee[lobby] + " XEN."
                            );

                            gameLobbies = produce(gameLobbies, (draft) => {
                                draft[lobby].rooms[room.id].count++;
                                draft[lobby].rooms[room.id] = joinUser(
                                    socket,
                                    draft[lobby].rooms[room.id],
                                    lobby,
                                    playerId,
                                    arcadeUser.name,
                                    arcadeUser.curElo,
                                    arcadeUser.seasonElo
                                );
                            });

                            break;
                    }
                }

                break;
            }
        }
    });

    socket.on("latency", () => {
        socket.emit("latency");
    });

    socket.on("leaveRoom", (player) => {
        socket.leave(player.room);

        // @TODO Remove user from room?
    });

    socket.on("placeBomb", (bomb) => {
        const room = R.pathOr(null, [bomb.lobby, "rooms", bomb.room], gameLobbies);
        const owner = R.pathOr(null, ["players", bomb.id], room);

        if (room && owner) {
            const bombs = typeof room.bombs[bomb.id] !== "undefined" ? room.bombs[bomb.id] : null;

            if (bombs !== null && bombs < +owner.availableBombs) {
                io.sockets.in(bomb.room).emit("placeBomb", {
                    bomb: {
                        id: room.bombId,
                        x: bomb.x,
                        z: bomb.z,
                        owner: owner,
                        currentBombLength: owner.currentBombLength,
                    },
                });

                gameLobbies = produce(gameLobbies, (draft) => {
                    draft[bomb.lobby].rooms[bomb.room].bombId++;
                    draft[bomb.lobby].rooms[bomb.room].bombs[bomb.id]++;
                });
            }
        }
    });

    socket.on("playerDead", (player) => {
        const room = R.pathOr({}, [player.lobby, "rooms", player.room], gameLobbies);
        const events = R.pathOr([], ["events"], room);

        io.sockets.in(player.room).emit("playerDead", { id: player.id });

        const isDeath = R.propEq("type", "death");
        const isDeathPlayer = R.propEq("id", player.id);
        const tracked = R.find(R.both(isDeath, isDeathPlayer))(events);

        if (room && !tracked) {
            gameLobbies = produce(gameLobbies, (draft) => {
                draft[player.lobby].rooms[player.room].events.push({
                    type: "death",
                    id: player.id,
                    lobby: player.lobby,
                    timeCreated: new Date().getTime(),
                });
            });
        }
    });

    socket.on("playerUpdate", (player) => {
        const room = R.pathOr(null, [player.lobby, "rooms", player.room], gameLobbies);

        delete player.availableBombs;
        delete player.currentBombLength;
        delete player.movement_speed;

        if (room) {
            const playerExists = R.pathOr(null, ["players", player.id], room);

            if (playerExists) {
                gameLobbies = produce(gameLobbies, (draft) => {
                    draft[player.lobby].rooms[player.room].players[playerExists.id] = {
                        ...playerExists,
                        ...player,
                        angleY: player.angle,
                    };
                });

                const _room = R.pathOr(null, [player.lobby, "rooms", player.room], gameLobbies);
                const players = Object.keys(_room.players).map((key) => _room.players[key]);

                io.sockets.in(room.id).emit("playersUpdate", { players: players });
            }
        }
    });

    socket.on("refundPlayer", async (refund) => {
        const room = R.pathOr({}, [refund.lobby, "rooms", refund.room], gameLobbies);
        const abandoned = R.pathOr(false, ["abandoned"], refund);

        const abandonedFailure = (txn) => {
            socket.emit("abandonedFailure");
        };

        const abandonedSuccess = (txn) => {
            socket.emit("abandonedSuccess");

            const loop = R.pathOr(null, ["loops", 0, "loop"], room);
            const players = R.pathOr({}, ["players"], room);

            const hasRoom = R.pathOr(false, [refund.lobby, "rooms", refund.room], gameLobbies);

            if (hasRoom) {
                gameLobbies = produce(gameLobbies, (draft) => {
                    draft[refund.lobby].rooms[refund.room].refundable = false;
                    draft[refund.lobby].rooms[refund.room].events.push({
                        type: "refund",
                        abandoned: true,
                        id: refund.player,
                        lobby: refund.lobby,
                        txn: txn,
                        timeCreated: new Date().getTime(),
                    });
                });
            } else {
                const chiharu_games = store.collection("chiharu_games");
                const room_id = refund.room + "";

                chiharu_games
                    .doc(room_id)
                    .get()
                    .then(async (snapshot) => {
                        if (!snapshot.exists) {
                            chiharu_games
                                .doc(room_id)
                                .set({
                                    ...room,
                                    loops: [],
                                    seats: JSON.stringify(room.seats),
                                })
                                .then()
                                .catch((error) => {
                                    const txn_hash = guid();

                                    console.trace("[ERROR]", error, txn_hash);
                                });
                        } else {
                            const doc = snapshot.data();
                            const events = doc.events;

                            events.push({
                                type: "refund",
                                abandoned: true,
                                id: refund.player,
                                lobby: refund.lobby,
                                txn: txn,
                                timeCreated: new Date().getTime(),
                            });

                            const chiharu_room = {
                                ...doc,
                                ...room,
                                loops: [],
                                seats: JSON.stringify(room.seats),
                                events: events,
                            };

                            chiharu_games
                                .doc(room_id)
                                .set(chiharu_room)
                                .then()
                                .catch((error) => {
                                    const txn_hash = guid();

                                    console.trace("[ERROR]", error, txn_hash);
                                });
                        }
                    })
                    .catch((error) => {
                        const txn_hash = guid();

                        console.trace("[ERROR]", error, txn_hash);
                    });
            }

            setTimeout(() => {
                socket.disconnect(true);
            }, 750);
        };

        const refundFailure = (txn) => {
            socket.emit("refundFailure");

            gameLobbies = produce(gameLobbies, (draft) => {
                draft[refund.lobby].rooms[refund.room].events.push({
                    type: "reconciliation",
                    id: refund.player,
                    lobby: refund.lobby,
                    txn: txn,
                    timeCreated: new Date().getTime(),
                });
            });
        };

        const refundSuccess = (txn) => {
            socket.emit("refundSuccess");

            const loop = R.pathOr(null, ["loops", 0, "loop"], room);
            const players = R.pathOr({}, ["players"], room);

            gameLobbies = produce(gameLobbies, (draft) => {
                draft[refund.lobby].rooms[refund.room].refundable = false;
                draft[refund.lobby].rooms[refund.room].events.push({
                    type: "refund",
                    id: refund.player,
                    lobby: refund.lobby,
                    txn: txn,
                    timeCreated: new Date().getTime(),
                });
            });

            setTimeout(() => {
                socket.disconnect(true);
            }, 750);
        };

        const transferFailure = (txn) => {
            // const { txn, name } = txn;
            // gameLobbies = produce(gameLobbies, (draft) => {
            //     const room = R.pathOr(null, [lobby, "rooms", id], draft);
            //     if (room) {
            //         draft[lobby].rooms[id].events.push({
            //             type: "txn",
            //             desc: name,
            //             result: false,
            //             id: id,
            //             txn: txn,
            //             lobby: lobby,
            //             timeCreated: new Date().getTime(),
            //         });
            //     }
            // });
        };

        const transferSuccess = (txn) => {
            // const { txn, name } = txn;
            // gameLobbies = produce(gameLobbies, (draft) => {
            //     const room = R.pathOr(null, [lobby, "rooms", id], draft);
            //     if (room) {
            //         draft[lobby].rooms[id].events.push({
            //             type: "txn",
            //             desc: name,
            //             result: true,
            //             id: id,
            //             txn: txn,
            //             lobby: lobby,
            //             timeCreated: new Date().getTime(),
            //         });
            //     }
            // });
        };

        if (room.count > 0 && room.refundable && (!room.started || !room.complete)) {
            if (Utils.contract["arcade"]) {
                Utils.contract["arcade"]
                    .refund(refund.room, refund.player, {
                        gasLimit: 275000,
                        gasPrice: Utils.provider.getGasPrice(),
                        value: ethers.utils.parseEther(ZERO),
                        nonce: await Utils.provider.getTransactionCount(Utils.account.address),
                    })
                    .then(async (txn_refund) => {
                        const txn = await txn_refund.wait();
                        const hash = txn.transactionHash;

                        console.log("[CONTRACT] (refund)", hash);

                        txnObservables[hash] = timer(0, 2750);
                        txnObservables[hash]
                            .pipe(
                                concatMap(() =>
                                    from(axios.post(HOST, TXN_PARAMS(hash))).pipe(map((response) => response))
                                )
                            )
                            .pipe(filter(({ data }) => data.result && typeof data.result === "object"))
                            .pipe(take(1))
                            .subscribe(({ data }) => {
                                if (data.result.status === "0x0") {
                                    refundFailure(hash);

                                    console.trace("[ERROR] Revert");
                                } else {
                                    callbackQueue = produce(callbackQueue, (draft) => {
                                        if (abandoned === true) {
                                            draft[hash] = abandonedSuccess({ txn: hash });
                                        } else {
                                            draft[hash] = refundSuccess({ txn: hash });
                                        }
                                    });
                                }
                            });

                        return true;
                    })
                    .catch((error) => {
                        refundFailure(null);

                        console.trace("[ERROR] Send Error:", error);
                    });
            } else {
                refundFailure(null);

                console.trace("[ERROR] RPC not found.");
            }
        } else if (
            room.count > 0 &&
            room.refundable === false &&
            (room.mining === true || room.exchange === true) &&
            (!room.started || !room.complete)
        ) {
            const room_reward = R.pathOr(null, ["rewards"], room);
            const reward_id = R.pathOr(null, ["rewards", "reward"], room);
            const reward = R.pathOr(null, [reward_id], rewardMap);
            const type = R.pathOr(null, [reward_id, "type"], rewardMap);

            if (type === 20) {
                const amount = Math.trunc(drop.amount * Math.pow(10, reward.decimals));

                rewardsHandler[reward.token] = await new ethers.Contract(
                    reward.token,
                    standardInterface,
                    Utils.account
                );
                rewardsHandler[reward.token]
                    .approve(ROOT_ADDRESS, amount)
                    .then(async (txn_approval) => {
                        const txn = await txn_approval.wait();
                        const hash = txn.transactionHash;

                        console.log("[CONTRACT] (transfer)", hash);

                        txnObservables[hash] = timer(0, 2750);
                        txnObservables[hash]
                            .pipe(
                                concatMap(() =>
                                    from(axios.post(HOST, TXN_PARAMS(hash))).pipe(map((response) => response))
                                )
                            )
                            .pipe(filter(({ data }) => data.result && typeof data.result === "object"))
                            .pipe(take(1))
                            .subscribe(({ data }) => {
                                if (data.result.status === "0x0") {
                                    transferFailure({ txn: hash, name: "transfer" });
                                } else {
                                    rewardsHandler[reward.token]
                                        .transfer(refund.player, amount)
                                        .then(async (txn_refund) => {
                                            const txn = await txn_refund.wait();
                                            const hash = txn.transactionHash;

                                            console.log("[CONTRACT] (transfer)", hash);

                                            txnObservables[hash] = timer(0, 2750);

                                            txnObservables[hash]
                                                .pipe(
                                                    concatMap(() =>
                                                        from(axios.post(HOST, TXN_PARAMS(hash))).pipe(
                                                            map((response) => response)
                                                        )
                                                    )
                                                )
                                                .pipe(
                                                    filter(({ data }) => data.result && typeof data.result === "object")
                                                )
                                                .pipe(take(1))
                                                .subscribe(({ data }) => {
                                                    if (data.result.status === "0x0") {
                                                        transferFailure({ txn: hash, name: "transfer" });
                                                    } else {
                                                        transferSuccess({ txn: hash, name: "transfer" });
                                                    }
                                                });

                                            return true;
                                        })
                                        .catch((error) => {
                                            transferFailure({ txn: null, name: "transfer" });

                                            console.trace("[ERROR]", error);
                                        });
                                }
                            });

                        return true;
                    })
                    .catch((error) => {
                        transferFailure({ txn: null, name: "transfer" });

                        console.trace("[ERROR]", error);
                    });
            }
        } else if (abandoned === true) {
            Utils.contract["arcade"]
                .refund(refund.room, refund.player, {
                    gasLimit: 275000,
                    gasPrice: Utils.provider.getGasPrice(),
                    value: ethers.utils.parseEther(ZERO),
                    nonce: await Utils.provider.getTransactionCount(Utils.account.address),
                })
                .then(async (txn_refund) => {
                    const txn = await txn_refund.wait();
                    const hash = txn.transactionHash;

                    console.log("[CONTRACT] (refund)", hash);

                    txnObservables[hash] = timer(0, 2750);

                    txnObservables[hash]
                        .pipe(
                            concatMap(() => from(axios.post(HOST, TXN_PARAMS(hash))).pipe(map((response) => response)))
                        )
                        .pipe(filter(({ data }) => data.result && typeof data.result === "object"))
                        .pipe(take(1))
                        .subscribe(({ data }) => {
                            if (data.result.status === "0x0") {
                                abandonedFailure(hash);

                                console.trace("[ERROR] Revert");
                            } else {
                                (async () => {
                                    Utils.contract["arcade"]
                                        .removePlayer(refund.room, refund.player, {
                                            gasLimit: 275000,
                                            gasPrice: Utils.provider.getGasPrice(),
                                            value: ethers.utils.parseEther(ZERO),
                                            nonce: await Utils.provider.getTransactionCount(Utils.account.address),
                                        })
                                        .then(async (txn_placement) => {
                                            const txn = await txn_placement.wait();
                                            const hash = txn.transactionHash;

                                            console.log("[CONTRACT] (removePlayer)", hash);

                                            txnObservables[hash] = timer(0, 2750);

                                            txnObservables[hash]
                                                .pipe(
                                                    concatMap(() =>
                                                        from(axios.post(HOST, TXN_PARAMS(hash))).pipe(
                                                            map((response) => response)
                                                        )
                                                    )
                                                )
                                                .pipe(
                                                    filter(({ data }) => data.result && typeof data.result === "object")
                                                )
                                                .pipe(take(1))
                                                .subscribe(({ data }) => {
                                                    if (data.result.status === "0x0") {
                                                        abandonedFailure(null);

                                                        console.trace("[ERROR] Revert");
                                                    } else {
                                                        callbackQueue = produce(callbackQueue, (draft) => {
                                                            draft[hash] = abandonedSuccess({ txn: hash });
                                                        });
                                                    }
                                                });
                                        })
                                        .catch((error) => {
                                            abandonedFailure(null);

                                            console.trace("[ERROR] Send Error:", error);
                                        });
                                })();
                            }
                        });

                    return true;
                })
                .catch((error) => {
                    abandonedFailure(null);

                    console.trace("[ERROR] Send Error:", error);
                });
        }
    });

    socket.on("removeBomb", (bomb) => {
        const room = R.pathOr(null, [bomb.lobby, "rooms", bomb.room], gameLobbies);

        io.sockets.in(bomb.room).emit("removeBomb", {
            id: bomb.id,
            room: bomb.room,
        });

        if (room) {
            gameLobbies = produce(gameLobbies, (draft) => {
                draft[bomb.lobby].rooms[bomb.room].bombs[bomb.player]--;
            });
        }
    });

    socket.on("requestJoin", async (game) => {
        let gameExists = false;
        let lobbyFee = 0;
        let lobbyName = 0;

        const gameId = game.gameId;

        Object.keys(gameLobbies).forEach((lobbyKey) => {
            const lobby = gameLobbies[lobbyKey];

            gameExists = lobby.rooms[gameId];

            if (gameExists) {
                lobbyFee = registrationFee[lobbyKey];
                lobbyName = lobbyKey;
            }
        });

        socket.removeListener("handshake", () => {
            console.log("[INFO] Handshake cleared...");
        });

        if (gameExists) {
            const playerId = game.playerId;

            console.log("[INFO] requestJoin", gameId, playerId, lobbyFee);

            getTokenLimit()
                .then(() => {})
                .catch((error) => {
                    console.trace("[ERROR]", error);
                });

            Utils.contract["arcade"]
                .placePlayer(gameId, playerId, {
                    gasLimit: 275000,
                    gasPrice: Utils.provider.getGasPrice(),
                    value: ethers.utils.parseEther(ZERO),
                    nonce: await Utils.provider.getTransactionCount(Utils.account.address),
                })
                .then(async (txn_placement) => {
                    const txn = await txn_placement.wait();
                    const hash = txn.transactionHash;

                    console.log("[CONTRACT] (placePlayer)", hash);

                    txnObservables[hash] = timer(0, 2750);
                    txnObservables[hash]
                        .pipe(
                            concatMap(() => from(axios.post(HOST, TXN_PARAMS(hash))).pipe(map((response) => response)))
                        )
                        .pipe(filter(({ data }) => data.result && typeof data.result === "object"))
                        .pipe(take(1))
                        .subscribe(({ data }) => {
                            if (data.result.status === "0x0") {
                                socket.emit("getGameId", {
                                    gameId: gameId,
                                    lobby: lobbyName,
                                });

                                socket.on("handshake", () => {
                                    socket.emit("getGameServer", {
                                        serverName: gameId,
                                    });

                                    console.log("[EMIT] getGameServer", gameId);
                                });

                                /*
                                socket.emit("newLobby", {
                                    gameId: gameId,
                                    error: "Revert",
                                });

                                console.trace("[ERROR] Revert");
                                 */
                            } else {
                                socket.emit("getGameId", {
                                    gameId: gameId,
                                    lobby: lobbyName,
                                });

                                socket.on("handshake", () => {
                                    socket.emit("getGameServer", {
                                        serverName: gameId,
                                    });

                                    console.log("[EMIT] getGameServer", gameId);
                                });
                            }
                        });
                })
                .catch((error) => {
                    socket.emit("newLobby", { gameId: gameId, error: error });
                    console.trace("[ERROR] Get transaction", error);
                });
        } else {
            socket.emit("newLobby", { gameId: null, error: "Lobby does not exist." });
        }
    });

    socket.on("requestLobby", async (server) => {
        const lobby = server.lobby;
        const lobbyExists = Number.isNaN(registrationFee[lobby]) === false;

        socket.removeListener("handshake", () => {
            console.log("[INFO] Handshake cleared...");
        });

        if (lobby && lobbyExists) {
            const playerId = server.playerId;
            const gameLobby = getGameId(lobby, playerId);

            let { existing, gameId } = gameLobby;

            console.log("[INFO] requestLobby", gameId, gameLobby, playerId, registrationFee[lobby]);

            getTokenLimit()
                .then(() => {})
                .catch((error) => {
                    console.trace("[ERROR]", error);
                });

            if (existing) {
                Utils.contract["arcade"]
                    .placePlayer(gameId, playerId, {
                        gasLimit: 275000,
                        gasPrice: Utils.provider.getGasPrice(),
                        value: ethers.utils.parseEther(ZERO),
                        nonce: await Utils.provider.getTransactionCount(Utils.account.address),
                    })
                    .then(async (txn_placement) => {
                        const txn = await txn_placement.wait();
                        const hash = txn.transactionHash;

                        console.log("[CONTRACT] (placePlayer)", hash);

                        txnObservables[hash] = timer(0, 2750);

                        txnObservables[hash]
                            .pipe(
                                concatMap(() =>
                                    from(axios.post(HOST, TXN_PARAMS(hash))).pipe(map((response) => response))
                                )
                            )
                            .pipe(filter(({ data }) => data.result && typeof data.result === "object"))
                            .pipe(take(1))
                            .subscribe(({ data }) => {
                                if (data.result.status === "0x0") {
                                    socket.emit("getGameId", {
                                        gameId: gameId,
                                    });

                                    socket.on("handshake", () => {
                                        socket.emit("getGameServer", {
                                            serverName: gameId,
                                        });

                                        console.log("[EMIT] getGameServer", gameId);
                                    });

                                    /*
                                    socket.emit("newLobby", {
                                        gameId: gameId,
                                        error: "Revert",
                                    });

                                    console.trace("[ERROR] Revert");
                                    */
                                } else {
                                    socket.emit("getGameId", {
                                        gameId: gameId,
                                    });

                                    socket.on("handshake", () => {
                                        socket.emit("getGameServer", {
                                            serverName: gameId,
                                        });

                                        console.log("[EMIT] getGameServer", gameId);
                                    });
                                }
                            });
                    })
                    .catch((error) => {
                        socket.emit("newLobby", { gameId: gameId, error: error });
                        console.trace("[ERROR] Get transaction", error);
                    });
            } else {
                if (Utils.contract["arcade"]) {
                    let exchange = false;
                    let mining = false;
                    let non_refundable = true;

                    switch (lobby) {
                        case "xen":
                            mining = false;
                            non_refundable = false;

                            break;
                        default:
                            break;
                    }

                    Utils.contract["arcade"]
                        .createGame(
                            gameId,
                            BigInt(registrationFee[lobby]).toString(),
                            XEN_ADDRESS,
                            6,
                            non_refundable,
                            {
                                gasLimit: 275000,
                                gasPrice: Utils.provider.getGasPrice(),
                                value: ethers.utils.parseEther(ZERO),
                                nonce: await Utils.provider.getTransactionCount(Utils.account.address),
                            }
                        )
                        .then(async (txn_create_game) => {
                            const txn = await txn_create_game.wait();
                            const hash = txn.transactionHash;

                            console.log("[CONTRACT] (createGame)", hash);

                            txnObservables[hash] = timer(0, 2750);

                            txnObservables[hash]
                                .pipe(
                                    concatMap(() =>
                                        from(axios.post(HOST, TXN_PARAMS(hash))).pipe(map((response) => response))
                                    )
                                )
                                .pipe(filter(({ data }) => data.result && typeof data.result === "object"))
                                .pipe(take(1))
                                .subscribe(
                                    ({ data }) => {
                                        if (data.result.status === "0x0") {
                                            socket.emit("newLobby", {
                                                gameId: gameId,
                                                error: "Revert",
                                            });

                                            console.trace("[ERROR] Revert");
                                        } else {
                                            (async () => {
                                                Utils.contract["arcade"]
                                                    .placePlayer(gameId, playerId, {
                                                        gasLimit: 275000,
                                                        gasPrice: Utils.provider.getGasPrice(),
                                                        value: ethers.utils.parseEther(ZERO),
                                                        nonce: await Utils.provider.getTransactionCount(
                                                            Utils.account.address
                                                        ),
                                                    })
                                                    .then(async (txn_placement) => {
                                                        const txn = await txn_placement.wait();
                                                        const hash = txn.transactionHash;

                                                        getRewardPool();

                                                        console.log("[CONTRACT] (placePlayer)", hash);

                                                        txnObservables[hash] = timer(0, 2750);

                                                        txnObservables[hash]
                                                            .pipe(
                                                                concatMap(() =>
                                                                    from(axios.post(HOST, TXN_PARAMS(hash))).pipe(
                                                                        map((response) => response)
                                                                    )
                                                                )
                                                            )
                                                            .pipe(
                                                                filter(
                                                                    ({ data }) =>
                                                                        data.result && typeof data.result === "object"
                                                                )
                                                            )
                                                            .pipe(take(1))
                                                            .subscribe(({ data }) => {
                                                                if (data.result.status === "0x0") {
                                                                    socket.emit("getGameId", {
                                                                        gameId: gameId,
                                                                    });

                                                                    socket.on("handshake", () => {
                                                                        socket.emit("getGameServer", {
                                                                            serverName: gameId,
                                                                        });

                                                                        console.log("[EMIT] getGameServer", gameId);
                                                                    });
                                                                    /*
                                                                    socket.emit("newLobby", {
                                                                        gameId: gameId,
                                                                        error: "Revert",
                                                                    });

                                                                    console.trace("[ERROR] Revert");
                                                                    */
                                                                } else {
                                                                    socket.emit("getGameId", {
                                                                        gameId: gameId,
                                                                    });

                                                                    socket.on("handshake", () => {
                                                                        socket.emit("getGameServer", {
                                                                            serverName: gameId,
                                                                        });

                                                                        console.log("[EMIT] getGameServer", gameId);
                                                                    });
                                                                }
                                                            });
                                                    })
                                                    .catch((error) => {
                                                        socket.emit("newLobby", { gameId: gameId, error: error });
                                                        console.trace("[ERROR] Get transaction", error);
                                                    });
                                            })();
                                        }
                                    },
                                    (error) => {
                                        if (error) {
                                            console.trace("[ERROR]", error);
                                        }
                                    }
                                );

                            return true;
                        })
                        .catch((error) => {
                            socket.emit("newLobby", { gameId: gameId, error: error });
                            console.trace("[ERROR] Send Error:", error);
                        });
                } else {
                    console.trace("[ERROR] RPC not found.");
                }
            }
        } else {
            socket.emit("newLobby", { gameId: null, error: "Lobby does not exist." });
        }
    });

    socket.on("requestRegions", () => {
        const id = socket.id;

        socket.emit("getRegions", {
            regions: [
                {
                    name: "Wakanda",
                    address: "trophyking.app",
                    playersCount: 0,
                    updatedSinceLastTime: true,
                },
            ],
        });

        regionPoll[id] = setInterval(() => {
            cleanUpGameLobbies();

            const playerCount = getPlayersInsideMatches();

            socket.emit("getRegionsUpdate", {
                regions: [
                    {
                        name: "Wakanda",
                        address: "trophyking.app",
                        playersCount: playerCount,
                        updatedSinceLastTime: true,
                    },
                ],
            });

            socket.emit("getPlayersInsideMatches", playerCount);
        }, 1800);
    });

    socket.on("setUsername", (auth) => {
        const token = auth.token;
        const username = auth.username;

        if (token) {
            const arcadeUser = R.pathOr(null, [token], arcadeUsers);

            if (arcadeUser) {
                arcadeUsers = produce(arcadeUsers, (draft) => {
                    draft[token] = { ...draft[token], name: username };
                    socket.emit("getUsername", draft[token]);
                });

                lastMutate = new Date().getTime();
            } else {
                const newUser = { id: token, seasonElo: 0, curElo: 0, rnkPos: 0, name: username };

                arcadeUsers = produce(arcadeUsers, (draft) => {
                    draft[token] = newUser;
                    socket.emit("getUsername", newUser);
                });

                lastMutate = new Date().getTime();
            }
        }
    });

    socket.on("disconnect", () => {
        const roomsToNotify = [];

        Object.keys(gameLobbies).map((lobby) => {
            Object.keys(gameLobbies[lobby].rooms).map((room, _room) => {
                const matchedSocket = R.pathEq(["socketID"], socket.id);
                const players = gameLobbies[lobby].rooms[room].players;
                const player = R.filter(matchedSocket, players);

                if (Object.keys(player).length) {
                    Object.keys(player).forEach((_player, index) => {
                        gameLobbies = produce(gameLobbies, (draft) => {
                            delete draft[lobby].rooms[room].players[_player];
                            draft[lobby].rooms[room].count--;
                        });

                        roomsToNotify.push({
                            ...player[_player],
                            lobby: lobby,
                            players: gameLobbies[lobby].rooms[room].players,
                            started: gameLobbies[lobby].rooms[room].started,
                        });
                    });
                }
            });
        });

        roomsToNotify.forEach((player, index) => {
            io.sockets.in(player.room).emit("playerLeave", { id: player.id });

            const player_count = Object.keys(player.players).length;

            if (player_count < 2 && player.started) {
                io.sockets.in(player.room).emit("matchEnded");

                const notify_room = R.pathOr(null, [player.lobby, "rooms", player.room], gameLobbies);

                if (notify_room) {
                    gameLobbies = produce(gameLobbies, (draft) => {
                        // draft[player.lobby].rooms[player.room].complete = true;
                        draft[player.lobby].rooms[player.room].events.push({
                            type: "close",
                            id: notify_room.id,
                            lobby: player.lobby,
                            timeCreated: new Date().getTime(),
                        });
                    });
                }
            } else if (!player.started) {
                console.log("[INFO] Abandoned match.", player.id, player.room);

                const notify_room = R.pathOr(null, [player.lobby, "rooms", player.room], gameLobbies);

                if (notify_room) {
                    gameLobbies = produce(gameLobbies, (draft) => {
                        draft[player.lobby].rooms[player.room].events.push({
                            type: "abandoned",
                            id: notify_room.id,
                            lobby: player.lobby,
                            player: player.id,
                            status: "open",
                            timeCreated: new Date().getTime(),
                        });
                    });
                }
            }
        });

        socket.removeAllListeners();

        console.log("[INFO] User Disconnected: Socket #", socket.id);
        socketConnectionCount--;
    });
});

store
    .collection("chiharu_users")
    .get()
    .then((snapshot) => {
        arcadeUsers = produce(arcadeUsers, (draft) => {
            snapshot.forEach((doc) => {
                draft[doc.id] = doc.data();
            });
        });
    });

store
    .collection("chiharu_rewards")
    .doc("priceMap")
    .get()
    .then(async (snapshot) => {
        if (snapshot.exists) {
            const _priceMap = snapshot.data();

            priceMap = produce(priceMap, (draft) => {
                Object.keys(_priceMap).forEach((key) => {
                    draft[key] = _priceMap[key];
                });
            });

            initializePrice();
        }
    })
    .catch((error) => {
        const txn_hash = guid();

        console.trace("[ERROR]", error, txn_hash);
    });

setInterval(() => {
    synchronizeRooms();
}, 11250);

setInterval(() => {
    synchronizeArcadeUsers();
}, 11250);

https.listen(15540, () => {
    console.log("[INFO] Listening on *:15540");
});
