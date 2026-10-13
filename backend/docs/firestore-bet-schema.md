# Firestore Bet Schema (SCRUM-27, updated in SCRUM-53)

Defines the contract for Bet documents in Firestore. Tickets building on Bet data (such as SCRUM-28, 29, 30, 31, 32, 33, 36, 37) should follow this schema. Enum values are also defined in code at `backend/src/models/betModel.js`. Please import from there rather than typing raw strings.

For example, please use BET_COLLECTION instead of the raw string "bets" for the Firestore collection.

## Collection
bets/{betId}

`betId` is the Firestore-generated document ID. It is **not** duplicated as a field inside the document. When returning a Bet object from the API, please combine the ID with the document data:

```js
{ id: doc.id, ...doc.data() }
```

## Fields

| Field              | Type                 | Required | Description                          |
|---------------------|---------------------|:--------:|----------------------------------------|
| `title`             | string              |   Yes    | Short title of the bet                 |
| `description`       | string              |   Yes    | Terms/details of the wager             |
| `outcomeA`          | string              |   Yes    | Label for side A, e.g. `"Dodgers win"` (trimmed) |
| `outcomeB`          | string              |   Yes    | Label for side B, e.g. `"Dodgers lose"` (trimmed; must differ from `outcomeA`, ignoring case) |
| `creatorUid`        | string              |   Yes    | Firebase UID of the creator (from verified token — never client input) |
| `creatorSide`       | enum                |   Yes    | `"A"` \| `"B"` — the side the creator is taking |
| `createdAt`         | Firestore Timestamp |   Yes    | Server-generated creation time         |
| `deadline`          | Firestore Timestamp |   Yes    | Wager/participation deadline: when participation closes (Active → Locked) |
| `outcomeDeadline`   | Firestore Timestamp |   Yes    | When the outcome is expected to be determined. Must be strictly after `deadline` |
| `visibility`        | enum                |   Yes    | `"public"` \| `"private"`              |
| `resolutionMethod`  | enum                |   Yes    | `"external"` \| `"personal"`           |
| `status`            | enum                |   Yes    | `"draft"` \| `"active"` \| `"locked"` \| `"resolved"` \| `"archived"` — new bets start at `"draft"` |
| `stakeType`         | enum                |   Yes    | `"monetary"` \| `"nonMonetary"`        |
| `stakeAmountCents`  | number               | If `stakeType` is `"monetary"` | Stake amount, in cents (avoids floating-point issues) |
| `currency`          | string               | If `stakeType` is `"monetary"` | e.g. `"USD"` |
| `stakeDescription`  | string               | If `stakeType` is `"nonMonetary"` | e.g. `"Loser buys dinner"` |
| `participantUids`   | string[]             |   Yes    | UIDs of everyone in the Bet. Starts as `[creatorUid]` (server-derived) |
| `participantCount`  | number               |   Yes    | Number of participants. Starts at `1` (server-derived) |
| `sideACount`        | number               |   Yes    | Participants on side A. `1` if the creator chose A, else `0` (server-derived) |
| `sideBCount`        | number               |   Yes    | Participants on side B. `1` if the creator chose B, else `0` (server-derived) |

### Rules enforced at creation (`POST /api/bets`)
- `now < deadline < outcomeDeadline`. Equal deadlines are rejected so a Bet never locks and becomes due for resolution at the same moment.
- `outcomeA` and `outcomeB` must be non-blank and different after trimming and ignoring case (`"Yes"` and `" yes "` are the same).
- The request must include `termsAcknowledged: true` (the boolean, not the string `"true"`). It is stored on the creator's participant record, not on the Bet.
- `participantUids`, `participantCount`, `sideACount`, `sideBCount`, `creatorUid`, `createdAt`, and `status` are always set by the backend. Any values sent by the client are ignored.

## Participants subcollection

```
bets/{betId}/participants/{uid}
```

The document ID is the participant's Firebase UID, so a user can appear in a Bet at most once. The creator's record is written in the same atomic batch as the Bet, so a Bet never exists without its creator as participant #1.

| Field               | Type                | Description |
|---------------------|---------------------|-------------|
| `uid`               | string              | Participant's Firebase UID (same as the document ID) |
| `side`              | enum                | `"A"` \| `"B"` — stores the side ID, never the outcome label |
| `role`              | enum                | `"creator"` \| `"participant"` |
| `termsAcknowledged` | boolean             | Always `true`; a user cannot join or create without acknowledging the terms |
| `joinedAt`          | Firestore Timestamp | Server-generated |

Enum values are defined in `betModel.js` as `BET_SIDE`, `BET_PARTICIPANT_ROLE`, and `BET_PARTICIPANTS_SUBCOLLECTION`.

## Example

```json
{
    "title": "Will the Dodgers win on Friday?",
    "description": "Friendly wager on Friday's game.",
    "outcomeA": "Dodgers win",
    "outcomeB": "Dodgers lose",
    "creatorUid": "firebase-user-uid",
    "creatorSide": "A",
    "createdAt": "<Firestore Timestamp>",
    "deadline": "<Firestore Timestamp>",
    "outcomeDeadline": "<Firestore Timestamp>",
    "visibility": "public",
    "resolutionMethod": "external",
    "status": "draft",
    "stakeType": "monetary",
    "stakeAmountCents": 1000,
    "currency": "USD",
    "participantUids": ["firebase-user-uid"],
    "participantCount": 1,
    "sideACount": 1,
    "sideBCount": 0
}
```

A non-monetary stake example:

```json
{
    "title": "Will it rain on Saturday?",
    "description": "Loser buys dinner.",
    "outcomeA": "It rains",
    "outcomeB": "It stays dry",
    "creatorUid": "firebase-user-uid",
    "creatorSide": "B",
    "createdAt": "<Firestore Timestamp>",
    "deadline": "<Firestore Timestamp>",
    "outcomeDeadline": "<Firestore Timestamp>",
    "visibility": "private",
    "resolutionMethod": "personal",
    "status": "draft",
    "stakeType": "nonMonetary",
    "stakeDescription": "Loser buys dinner",
    "participantUids": ["firebase-user-uid"],
    "participantCount": 1,
    "sideACount": 0,
    "sideBCount": 1
}
```

The creator's participant record for the example above, at `bets/{betId}/participants/firebase-user-uid`:

```json
{
    "uid": "firebase-user-uid",
    "side": "B",
    "role": "creator",
    "termsAcknowledged": true,
    "joinedAt": "<Firestore Timestamp>"
}
```

## Conventions
- camelCase fields, lowercase string enum values.
- Timestamps, not formatted strings, for `createdAt` / `deadline` / `outcomeDeadline` / `joinedAt`.

## Bets created before SCRUM-53
Development Bets created before SCRUM-53 do not have outcomes, `outcomeDeadline`, `creatorSide`, participant summary fields, or a creator participant record. They do not satisfy this schema and should be deleted or recreated rather than handled with fallbacks in new code.

## Deferred (not in this schema yet)
- Joining a Bet (SCRUM-54) and auto-activation once both sides have a bettor (SCRUM-55). The participant fields above exist so those tickets can update them, but nothing besides Bet creation writes them yet.
- Private-Bet invitations (`invitedUsers`)
- Mediator/dispute fields (`mediatorUid`, `disputeStatus`)
- Actual payment processing (`stripePaymentIntentId`, payout/winnings) — the Bet document now *represents* the stake (`stakeType`, `stakeAmountCents`/`stakeDescription`), but no money is actually collected, held, or transferred yet. That requires Stripe integration, which is separate future work.
- `updatedAt` - may be added later with SCRUM-36 (Bet Editing)