const Immer = require("immer");
const produce = Immer.produce;
const R = require("ramda");
const { store } = require("./config");

const batch = store.batch();

let arcadeMatches = {};
let arcadeRankings = [];
let playerMap = {};
let totalGames = 0;

const sortByRanking = R.sortBy(R.compose(R.prop("curElo")));

store
    .collection("xeniverse_games")
    .get()
    .then((snapshot) => {
        arcadeMatches = produce(arcadeMatches, (draft) => {
            snapshot.forEach((doc) => {
                draft[doc.id] = doc.data();
            });
        });
    })
    .then(() => {
        const arcadeMatchList = Object.keys(arcadeMatches).map((key) => arcadeMatches[key]);

        arcadeMatchList.forEach((match) => {
            const rankings  = match.rankings ? match.rankings : [];
            const timestamp = match.timeCreated ? +match.timeCreated : 0;
            const totalPlayers = Object.keys(rankings).length;
            const rankingList = Object.keys(rankings).map((key) => rankings[key]);

            if (timestamp > 1567962000000 && timestamp < 1568739600000) {
                rankingList.forEach((ranking) => {
                    const id = ranking.id;
                    const diePos = +R.pathOr(-1, ["diePos"], ranking);
                    const name = R.pathOr("", ["name"], ranking).split("]")[1];

                    if (id) {
                        playerMap = produce(playerMap, (draft) => {
                            if (draft[id]) {
                                const points = diePos > 0 ? (totalPlayers - diePos) * 2 : 0;

                                draft[id].name = name;
                                draft[id].curElo += points > 0 ? points : 0;
                            }
                            else {
                                const points = diePos > 0 ? (totalPlayers - diePos) * 2 : 0;

                                draft[id] = {};
                                draft[id].id = id;
                                draft[id].name = name;
                                draft[id].curElo = points > 0 ? points : 0;
                                draft[id].seasonElo = 0;
                            }
                        });
                    }
                });

                totalGames++;
            }
        });

        const arcadeUserList = Object.keys(playerMap).map((key) => playerMap[key]);
        const sortedArcadeUserList = sortByRanking(arcadeUserList);

        console.log("Total Games:", totalGames);
        console.log(JSON.stringify(sortedArcadeUserList.reverse()));
    });
