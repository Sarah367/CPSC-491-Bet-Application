# Firestore Bet Schema (SCRUM-27)

Defines the Sprint 2 contract for Bet documents in Firestore. Tickets building on Bet data (such as SCRUM-28, 29, 30, 31, 32, 33, 36, 37) should follow this schema. Enum values are also defined in code at `backend/src/models/betModel.js`. Please import from there rather than typing raw strings.

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
| `creatorUid`        | string              |   Yes    | Firebase UID of the creator (from verified token — never client input) |
| `createdAt`         | Firestore Timestamp |   Yes    | Server-generated creation time         |
| `deadline`          | Firestore Timestamp |   Yes    | When participation closes              |
| `visibility`        | enum                |   Yes    | `"public"` \| `"private"`              |
| `resolutionMethod`  | enum                |   Yes    | `"external"` \| `"personal"`           |
| `status`            | enum                |   Yes    | `"draft"` \| `"active"` \| `"locked"` \| `"resolved"` \| `"archived"` — new bets start at `"draft"` |
| `stakeType`         | enum                |   Yes    | `"monetary"` \| `"nonMonetary"`        |
| `stakeAmountCents`  | number               | If `stakeType` is `"monetary"` | Stake amount, in cents (avoids floating-point issues) |
| `currency`          | string               | If `stakeType` is `"monetary"` | e.g. `"USD"` |
| `stakeDescription`  | string               | If `stakeType` is `"nonMonetary"` | e.g. `"Loser buys dinner"` |

## Example

```json
{
    "title": "Will the Dodgers win on Friday?",
    "description": "Friendly wager on Friday's game.",
    "creatorUid": "firebase-user-uid",
    "createdAt": "<Firestore Timestamp>",
    "deadline": "<Firestore Timestamp>",
    "visibility": "public",
    "resolutionMethod": "external",
    "status": "draft",
    "stakeType": "monetary",
    "stakeAmountCents": 1000,
    "currency": "USD"
}
```

A non-monetary stake example:

```json
{
    "title": "Will it rain on Saturday?",
    "description": "Loser buys dinner.",
    "creatorUid": "firebase-user-uid",
    "createdAt": "<Firestore Timestamp>",
    "deadline": "<Firestore Timestamp>",
    "visibility": "private",
    "resolutionMethod": "personal",
    "status": "draft",
    "stakeType": "nonMonetary",
    "stakeDescription": "Loser buys dinner"
}
```

## Conventions
- camelCase fields, lowercase string enum values.
- Timestamps, not formatted strings, for `createdAt` / `deadline`.

## Deferred (not in this schema yet)
- Invitations/participants (`invitedUsers`, `participants`)
- Mediator/dispute fields (`mediatorUid`, `disputeStatus`)
- Actual payment processing (`stripePaymentIntentId`, payout/winnings) — the Bet document now *represents* the stake (`stakeType`, `stakeAmountCents`/`stakeDescription`), but no money is actually collected, held, or transferred yet. That requires Stripe integration, which is separate future work.
- `updatedAt` - may be added later with SCRUM-36 (Bet Editing)