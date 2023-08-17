const Immer = require("immer");
const produce = Immer.produce;
const { store } = require("./config");

const batch = store.batch();

let arcadeUsers = {};

store
    .collection("xeniverse_users")
    .get()
    .then((snapshot) => {
        arcadeUsers = produce(arcadeUsers, (draft) => {
            snapshot.forEach((doc) => {
                draft[doc.id] = doc.data();
                draft[doc.id].seasonElo = draft[doc.id].curElo;
            });
        });
    })
    .then(() => {
        const arcadeUserList = Object.keys(arcadeUsers).map((key) => arcadeUsers[key]);

        arcadeUserList.forEach((arcadeUser) => {
            console.log(arcadeUser);
            const arcadeRef = store.collection("xeniverse_users").doc(arcadeUser.id);
            batch.set(arcadeRef, arcadeUser);
        });

        batch
            .commit()
            .then((data) => {
                console.log("[INFO] - Tourney Setup", data);
            })
            .catch((error) => {
                console.error("[ERROR] - Tourney Setup", error);
            });
    });
