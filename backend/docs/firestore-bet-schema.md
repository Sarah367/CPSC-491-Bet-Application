# Firestore Bet Schema

Describes how Bets are stored in Firestore on `main`. First defined in SCRUM-27 and refreshed in SCRUM-107. Tickets that read or write Bet data should follow this schema.

Enum values and collection names are defined in code at `backend/src/models/betModel.js`. Import them from there rather than typing raw strings. For example, use `BET_COLLECTION` instead of `"bets"`, and `BET_STATUS.DRAFT` instead of `"draft"`.

Changes that are still in open pull requests are listed separately under [Upcoming changes](#upcoming-changes-not-on-main-yet), not in the tables below.

## Overview

A Bet is stored in two places:

- **`bets/{betId}`**, the Bet document: its terms, settings, and summary counts.
- **`bets/{betId}/participants/{uid}`**, one document per person in the Bet, recording which side they picked.

The creator is always participant #1. Their participant record is written when the Bet is created.

`betId` is the Firestore-generated document ID. It is **not** stored as a field inside the document.

## Bet document: `bets/{betId}`

| Field | Type | Description |
|---|---|---|
| `title` | string | Short title of the Bet. |
| `description` | string | Terms and details of the wager. |
| `outcomeA` | string | The first possible outcome. |
| `outcomeB` | string | The second possible outcome. Can't be the same as `outcomeA`. |
| `creatorUid` | string | Firebase UID of the creator. Always taken from the verified ID token, never from client input. |
| `creatorSide` | enum | The outcome the creator picked: `"A"` \| `"B"` (`BET_SIDE`). |
| `createdAt` | Firestore Timestamp | Set by the server when the Bet is created. |
| `deadline` | Firestore Timestamp | When participation closes. Must be in the future when the Bet is created. |
| `outcomeDeadline` | Firestore Timestamp | When the result is expected. Must be after `deadline`. |
| `visibility` | enum | `"public"` \| `"private"` (`BET_VISIBILITY`). |
| `resolutionMethod` | enum | `"external"` \| `"personal"` (`BET_RESOLUTION_METHOD`). |
| `status` | enum | `"draft"` \| `"active"` \| `"locked"` \| `"resolved"` \| `"archived"` (`BET_STATUS`). Creating a Bet sets it to `"draft"`. |
| `stakeType` | enum | `"monetary"` \| `"nonMonetary"` (`BET_STAKE_TYPE`). |
| `stakeAmountCents` | number | **Monetary Bets only.** The amount in cents, as a positive whole number. |
| `currency` | string | **Monetary Bets only.** Must be an allowed currency (`BET_CURRENCY`). Currently only `"USD"`. |
| `stakeDescription` | string | **Non-monetary Bets only.** What's being wagered, such as "Loser buys dinner". |
| `participantUids` | array of strings | UIDs of everyone in the Bet. Starts as `[creatorUid]`. |
| `participantCount` | number | Number of people in the Bet. Starts at `1`. |
| `sideACount` | number | Number of people on side A. Starts at `1` if the creator picked A, otherwise `0`. |
| `sideBCount` | number | Number of people on side B. Starts at `1` if the creator picked B, otherwise `0`. |

A monetary Bet has `stakeAmountCents` and `currency` and no `stakeDescription`. A non-monetary Bet has `stakeDescription` and neither of the other two.

`participantUids`, `participantCount`, `sideACount`, and `sideBCount` are summary data kept on the Bet document. They let the backend list a user's Bets and show counts without reading the participants subcollection. The subcollection is the full per-person record.

## Participants subcollection: `bets/{betId}/participants/{uid}`

The document ID is the participant's UID (`BET_PARTICIPANTS_SUBCOLLECTION`).

| Field | Type | Description |
|---|---|---|
| `uid` | string | Firebase UID of the participant. The same value as the document ID. |
| `side` | enum | The outcome this person picked: `"A"` \| `"B"` (`BET_SIDE`). |
| `role` | enum | `"creator"` \| `"participant"` (`BET_PARTICIPANT_ROLE`). |
| `termsAcknowledged` | boolean | Always `true`. A Bet can't be created or joined without accepting its terms. |
| `joinedAt` | Firestore Timestamp | Set by the server when this record is written. |

## How Bets are written

- **Creating a Bet** writes the Bet document and the creator's participant record (`role: "creator"`, `side` equal to `creatorSide`) together in one batch, so neither can exist without the other.
- **Joining a Bet** runs in one transaction. It adds the joiner's participant record (`role: "participant"`), adds their UID to `participantUids`, and increments `participantCount` and either `sideACount` or `sideBCount`. Only public Bets in `"draft"` or `"active"` status can be joined, only before `deadline`, and not by the creator or by someone who already joined.

## Example

A monetary Bet:

```json
{
    "title": "Will the Dodgers win on Friday?",
    "description": "Friendly wager on Friday's game.",
    "outcomeA": "Dodgers win",
    "outcomeB": "Dodgers lose",
    "creatorUid": "creator-uid",
    "creatorSide": "A",
    "createdAt": "<Firestore Timestamp>",
    "deadline": "<Firestore Timestamp>",
    "outcomeDeadline": "<Firestore Timestamp>",
    "visibility": "public",
    "resolutionMethod": "external",
    "status": "draft",
    "stakeType": "monetary",
    "stakeAmountCents": 500,
    "currency": "USD",
    "participantUids": ["creator-uid"],
    "participantCount": 1,
    "sideACount": 1,
    "sideBCount": 0
}
```

The creator's participant record, at `bets/{betId}/participants/creator-uid`:

```json
{
    "uid": "creator-uid",
    "side": "A",
    "role": "creator",
    "termsAcknowledged": true,
    "joinedAt": "<Firestore Timestamp>"
}
```

A non-monetary Bet looks the same, except `stakeType` is `"nonMonetary"` and it has `stakeDescription` instead of `stakeAmountCents` and `currency`.

## API responses

Firestore documents are internal storage, not the API contract. New endpoints should return only the fields they need, and should never send fields like `participantUids` to clients.

On `main`, `serializeBetDoc` in `backend/src/services/betService.js` still returns every stored field (the Public Bets list already returns only 7 fields, through `serializeBet`). Open PRs #71 (SCRUM-98) and #77 (SCRUM-57) move Bet Details, join, and My Bets responses to explicit allowlists in `backend/src/serializers/`. That changes what the API sends, not what's stored here.

## Conventions

- camelCase field names. Enum values are lowercase strings (`"draft"`, `"public"`) or camelCase (`"nonMonetary"`), except `BET_SIDE` (`"A"` / `"B"`) and `currency` (`"USD"`).
- Firestore Timestamps, not formatted strings, for `createdAt`, `deadline`, `outcomeDeadline`, and `joinedAt`.
- Server-controlled fields (`creatorUid`, `createdAt`, `status`, the counts, and `participantUids`) are never accepted from a request body.

## Upcoming changes (not on main yet)

These are in open pull requests and become part of this schema when they merge:

- **#73 (SCRUM-36)** adds `updatedAt` (Firestore Timestamp), set when a creator edits a Bet.
- **#61 (SCRUM-55)** changes `status` from `"draft"` to `"active"` automatically when a join leaves the Bet with at least two participants and at least one on each side.

Update this doc in the same PR that merges either change, or right after.

## Deferred (not in this schema yet)

- Invitations for private Bets (for example `invitedUsers`)
- Mediator and dispute fields (`mediatorUid`, `disputeStatus`)
- Payment fields (such as `stripePaymentIntentId`)
- `updatedAt`, until #73 (SCRUM-36) merges