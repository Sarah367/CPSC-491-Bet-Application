// Firebase Admin is mocked, so nothing touches the real project.
const mockUpdateUser = jest.fn();
const mockGetUser = jest.fn();
const mockGetUsers = jest.fn();
const mockDocGet = jest.fn();
const mockGetAll = jest.fn();
const mockTransactionGet = jest.fn();
const mockTransactionSet = jest.fn();

jest.mock("../src/config/firebaseAdmin", () => ({
    auth: {
        updateUser: (...args) => mockUpdateUser(...args),
        getUser: (...args) => mockGetUser(...args),
        getUsers: (...args) => mockGetUsers(...args),
    },
    db: {
        collection: (name) => ({
            doc: (id) => ({ path: `${name}/${id}`, id: id, get: () => mockDocGet(`${name}/${id}`) }),
        }),
        getAll: (...refs) => mockGetAll(...refs),
        runTransaction: async (callback) => {
            const transaction = {
                get: (ref) => mockTransactionGet(ref),
                set: (ref, data, options) => mockTransactionSet(ref, data, options),
            };
            return callback(transaction);
        },
    },
}));

const { FieldValue } = require("firebase-admin/firestore");
const {
    AUTH_LOOKUP_BATCH_SIZE,
    updateDisplayName,
    resolveDisplayNames,
    resolveDisplayName,
} = require("../src/services/userService");

// Profiles and Firebase Auth names for a test: uid -> name.
let profileNames;
let authNames;

beforeEach(() => {
    jest.clearAllMocks();
    profileNames = {};
    authNames = {};

    mockUpdateUser.mockResolvedValue({});
    mockTransactionGet.mockResolvedValue({ exists: false });

    mockGetAll.mockImplementation((...refs) => {
        const docs = [];
        for (const ref of refs) {
            if (ref.id in profileNames) {
                const name = profileNames[ref.id];
                docs.push({ id: ref.id, exists: true, data: () => ({ displayName: name }) });
            } else {
                docs.push({ id: ref.id, exists: false });
            }
        }
        return Promise.resolve(docs);
    });
    mockGetUsers.mockImplementation((identifiers) => {
        const users = [];
        for (const identifier of identifiers) {
            if (identifier.uid in authNames) {
                users.push({ uid: identifier.uid, displayName: authNames[identifier.uid] });
            }
        }
        return Promise.resolve({ users: users, notFound: [] });
    });
    mockDocGet.mockImplementation((path) => {
        const uid = path.split("/")[1];
        if (uid in profileNames) {
            const name = profileNames[uid];
            return Promise.resolve({ exists: true, data: () => ({ displayName: name }) });
        }
        return Promise.resolve({ exists: false });
    });
    mockGetUser.mockImplementation((uid) => {
        if (uid in authNames) {
            return Promise.resolve({ uid: uid, displayName: authNames[uid] });
        }
        return Promise.resolve({ uid: uid });
    });
});

describe("updateDisplayName", () => {
    it("updates Firebase Auth, then the users/{uid} profile, and returns the profile", async () => {
        const profile = await updateDisplayName("user-a", "Jordan Rivera");

        expect(profile).toEqual({ displayName: "Jordan Rivera" });
        expect(mockUpdateUser).toHaveBeenCalledWith("user-a", { displayName: "Jordan Rivera" });
        expect(mockTransactionSet).toHaveBeenCalledTimes(1);
        const [ref, data, options] = mockTransactionSet.mock.calls[0];
        expect(ref.path).toBe("users/user-a");
        expect(data.displayName).toBe("Jordan Rivera");
        expect(options).toEqual({ merge: true });
    });

    it("sets createdAt and updatedAt when the profile is new", async () => {
        await updateDisplayName("user-a", "Jordan Rivera");

        const data = mockTransactionSet.mock.calls[0][1];
        expect(data.createdAt.isEqual(FieldValue.serverTimestamp())).toBe(true);
        expect(data.updatedAt.isEqual(FieldValue.serverTimestamp())).toBe(true);
    });

    it("keeps the original createdAt when the profile already exists", async () => {
        mockTransactionGet.mockResolvedValue({ exists: true });

        await updateDisplayName("user-a", "New Name");

        const data = mockTransactionSet.mock.calls[0][1];
        expect(data).not.toHaveProperty("createdAt");
        expect(data.updatedAt.isEqual(FieldValue.serverTimestamp())).toBe(true);
    });

    it("never stores the email or the uid in the profile", async () => {
        await updateDisplayName("user-a", "Jordan Rivera");

        const data = mockTransactionSet.mock.calls[0][1];
        expect(Object.keys(data).sort()).toEqual(["createdAt", "displayName", "updatedAt"]);
    });

    it("doesn't write the profile when the Firebase Auth update fails", async () => {
        mockUpdateUser.mockRejectedValue(new Error("Auth unavailable"));

        await expect(updateDisplayName("user-a", "Jordan Rivera")).rejects.toThrow("Auth unavailable");
        expect(mockTransactionSet).not.toHaveBeenCalled();
    });

    it("fails when the profile write fails after Firebase Auth was updated", async () => {
        mockTransactionGet.mockRejectedValue(new Error("Firestore unavailable"));

        await expect(updateDisplayName("user-a", "Jordan Rivera")).rejects.toThrow("Firestore unavailable");
        expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    });
});

describe("resolveDisplayNames", () => {
    it("uses the profile name first, then the Firebase Auth name, then null", async () => {
        profileNames["with-profile"] = "Jordan Rivera";
        authNames["with-profile"] = "Old Auth Name";
        authNames["older-account"] = "Sam Lee";

        const names = await resolveDisplayNames(["with-profile", "older-account", "no-name"]);

        expect(names).toEqual({
            "with-profile": "Jordan Rivera",
            "older-account": "Sam Lee",
            "no-name": null,
        });
    });

    it("reads each uid's profile once, even when it appears many times", async () => {
        await resolveDisplayNames(["user-a", "user-b", "user-a", "user-a"]);

        expect(mockGetAll).toHaveBeenCalledTimes(1);
        const ids = [];
        for (const ref of mockGetAll.mock.calls[0]) {
            ids.push(ref.id);
        }
        expect(ids).toEqual(["user-a", "user-b"]);
    });

    it("only asks Firebase Auth about users without a profile name", async () => {
        profileNames["user-a"] = "Jordan Rivera";
        profileNames["blank-name"] = "   ";

        await resolveDisplayNames(["user-a", "blank-name", "user-c"]);

        expect(mockGetUsers).toHaveBeenCalledTimes(1);
        expect(mockGetUsers).toHaveBeenCalledWith([{ uid: "blank-name" }, { uid: "user-c" }]);
    });

    it("doesn't call Firebase Auth when every user has a profile name", async () => {
        profileNames["user-a"] = "Jordan Rivera";

        await resolveDisplayNames(["user-a"]);

        expect(mockGetUsers).not.toHaveBeenCalled();
    });

    it("splits the Firebase Auth lookup into groups of 100", async () => {
        const uids = [];
        for (let i = 0; i < AUTH_LOOKUP_BATCH_SIZE + 5; i++) {
            uids.push(`user-${i}`);
        }

        await resolveDisplayNames(uids);

        expect(mockGetUsers).toHaveBeenCalledTimes(2);
        expect(mockGetUsers.mock.calls[0][0]).toHaveLength(100);
        expect(mockGetUsers.mock.calls[1][0]).toHaveLength(5);
    });

    it("skips both lookups when there are no uids", async () => {
        const names = await resolveDisplayNames([]);

        expect(names).toEqual({});
        expect(mockGetAll).not.toHaveBeenCalled();
        expect(mockGetUsers).not.toHaveBeenCalled();
    });

    it("falls back to Firebase Auth for everyone when the profile read fails", async () => {
        mockGetAll.mockRejectedValue(new Error("Firestore unavailable"));
        authNames["user-a"] = "Sam Lee";
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        const names = await resolveDisplayNames(["user-a", "user-b"]);

        expect(names).toEqual({ "user-a": "Sam Lee", "user-b": null });
        consoleSpy.mockRestore();
    });

    it("returns null names instead of failing when Firebase Auth fails", async () => {
        mockGetUsers.mockRejectedValue(new Error("Auth unavailable"));
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        const names = await resolveDisplayNames(["user-a"]);

        expect(names).toEqual({ "user-a": null });
        consoleSpy.mockRestore();
    });
});

describe("resolveDisplayName", () => {
    it("uses the profile name without asking Firebase Auth", async () => {
        profileNames["user-a"] = "Jordan Rivera";

        await expect(resolveDisplayName("user-a")).resolves.toBe("Jordan Rivera");
        expect(mockGetUser).not.toHaveBeenCalled();
    });

    it("falls back to the Firebase Auth name when there's no profile", async () => {
        authNames["user-a"] = "Sam Lee";

        await expect(resolveDisplayName("user-a")).resolves.toBe("Sam Lee");
    });

    it("returns null when neither has a name", async () => {
        await expect(resolveDisplayName("user-a")).resolves.toBeNull();
    });

    it("returns null when both lookups fail", async () => {
        mockDocGet.mockRejectedValue(new Error("Firestore unavailable"));
        mockGetUser.mockRejectedValue(new Error("Auth unavailable"));
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        await expect(resolveDisplayName("user-a")).resolves.toBeNull();
        consoleSpy.mockRestore();
    });

    it("returns null for a missing uid without looking anything up", async () => {
        await expect(resolveDisplayName(undefined)).resolves.toBeNull();
        expect(mockDocGet).not.toHaveBeenCalled();
        expect(mockGetUser).not.toHaveBeenCalled();
    });
});
