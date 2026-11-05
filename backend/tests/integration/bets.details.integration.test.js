/**
 * HTTP-level tests for GET /api/bets/:id.
 *
 * Firebase Admin is mocked so requests never reach a real Firebase project.
 */
const { Timestamp } = require("firebase-admin/firestore");

const mockBetGet = jest.fn();
const mockParticipantGet = jest.fn();
const mockGetUser = jest.fn();
const mockDoc = jest.fn(() => ({
    get: (...args) => mockBetGet(...args),
    collection: () => ({
        doc: () => ({
            get: (...args) => mockParticipantGet(...args),
        }),
    }),
}));
const mockCollection = jest.fn(() => ({ doc: mockDoc }));

jest.mock("../../src/config/firebaseAdmin", () => ({
    auth: {
        verifyIdToken: jest.fn(),
        getUser: (...args) => mockGetUser(...args),
    },
    db: {
        collection: (...args) => mockCollection(...args),
    },
}));

const request = require("supertest");
const app = require("../../src/app");
const { auth } = require("../../src/config/firebaseAdmin");

const TOKEN_UID = "viewer-uid";
const CREATOR_UID = "creator-uid";

function betDoc(overrides = {}) {
    return {
        id: "bet-1",
        exists: true,
        data: () => ({
            title: "Will it rain?",
            description: "A friendly weather bet.",
            creatorUid: CREATOR_UID,
            visibility: "public",
            resolutionMethod: "external",
            status: "active",
            participantUids: [CREATOR_UID, TOKEN_UID],
            participantCount: 2,
            sideACount: 1,
            sideBCount: 1,
            deadline: Timestamp.fromDate(new Date("2026-12-31T00:00:00.000Z")),
            createdAt: Timestamp.fromDate(new Date("2026-01-01T00:00:00.000Z")),
            ...overrides,
        }),
    };
}

function getAsUser(id = "bet-1") {
    return request(app)
        .get(`/api/bets/${id}`)
        .set("Authorization", "Bearer test-token");
}

beforeEach(() => {
    jest.clearAllMocks();
    auth.verifyIdToken.mockResolvedValue({ uid: TOKEN_UID, email_verified: true });
    mockGetUser.mockResolvedValue({ displayName: "Jordan Rivera" });
    mockParticipantGet.mockResolvedValue({ exists: false });
});

describe("GET /api/bets/:id", () => {
    it("returns only Bet Details fields and omits participant identifiers", async () => {
        mockBetGet.mockResolvedValue(betDoc());

        const res = await getAsUser();

        expect(res.status).toBe(200);
        expect(Object.keys(res.body.bet).sort()).toEqual([
            "creatorDisplayName",
            "deadline",
            "description",
            "id",
            "resolutionMethod",
            "status",
            "title",
            "visibility",
        ]);
        expect(res.body.bet).toEqual({
            id: "bet-1",
            title: "Will it rain?",
            description: "A friendly weather bet.",
            deadline: "2026-12-31T00:00:00.000Z",
            visibility: "public",
            resolutionMethod: "external",
            status: "active",
            creatorDisplayName: "Jordan Rivera",
        });
        expect(res.body.bet).not.toHaveProperty("participantUids");
    });

    it("returns the same 404 response for private and missing Bets", async () => {
        mockBetGet
            .mockResolvedValueOnce(betDoc({ visibility: "private" }))
            .mockResolvedValueOnce({
                id: "missing-id",
                exists: false,
                data: () => undefined,
            });

        const privateBetResponse = await getAsUser();
        const missingBetResponse = await getAsUser("missing-id");

        expect(privateBetResponse.status).toBe(404);
        expect(missingBetResponse.status).toBe(404);
        expect(privateBetResponse.body).toEqual({
            error: "not_found",
            message: "Bet not found.",
        });
        expect(privateBetResponse.body).toEqual(missingBetResponse.body);
        expect(mockParticipantGet).not.toHaveBeenCalled();
    });

    it("returns a generic JSON error when the Bet read fails", async () => {
        mockBetGet.mockRejectedValue(new Error("Firestore unavailable"));
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        const res = await getAsUser();

        expect(res.status).toBe(500);
        expect(res.body).toEqual({
            error: "server_error",
            message: "Unable to load bet.",
        });
        expect(JSON.stringify(res.body)).not.toMatch(/Firestore unavailable/);

        consoleSpy.mockRestore();
    });
});
