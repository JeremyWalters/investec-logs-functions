# Investec company ledger

Monorepo for a shared company transaction ledger. The frontend lives in `apps/frontend`, and the
Firebase backend lives in `apps/backend`. The backend uses Cloud Functions 2nd gen on Node.js 22,
Cloud Firestore Standard edition, Firebase Authentication, and strict Firestore Security Rules.
Functions are configured for `africa-south1`.

No Firebase project is committed to this repository. Provisioning, deploying, and creating the
initial users/access profiles are separate, explicitly approved operations.

## Access model

Authentication alone does not grant ledger access. Each user must have a server-managed
`accessProfiles/{uid}` document:

```json
{
  "active": true,
  "role": "member",
  "transactionScope": {
    "mode": "all",
    "accountNumbers": [],
    "cardIds": []
  }
}
```

- `member`: reads the shared ledger, categories, and tags; may update only transaction tags and
  manage tag definitions.
- `ingestor`: may call the transaction ingestion endpoint, but cannot read ledger data directly.
- `restricted`: reserved for future account/card-scoped access and currently fails closed.

Clients cannot create or modify access profiles. Use a trusted server or Firebase Admin workflow
when onboarding users.

## Transaction ingestion

Send an authenticated request to `POST /api/v1/transactions`:

```http
Authorization: Bearer <Firebase ID token>
Content-Type: application/json
```

```json
{
  "transaction": {
    "accountNumber": "10000000001",
    "dateTime": "2026-07-22T10:15:30.000Z",
    "centsAmount": 12345,
    "currencyCode": "zar",
    "type": "card",
    "reference": "purchase-123",
    "card": { "id": "card-1", "display": "Business card" },
    "merchant": {
      "name": "Example Merchant",
      "city": "Cape Town",
      "country": { "code": "ZA", "alpha3": "ZAR", "name": "South Africa" },
      "category": { "code": "5812", "key": "restaurants", "name": "Restaurants" }
    }
  }
}
```

The backend validates the full payload and derives a deterministic document ID. Retrying the same
transaction is safe: the first request returns `201`, and an exact retry returns `200` without a
duplicate write.

## Local development

Requirements: Node.js 22, pnpm 11, Java for the Firestore emulator, and no live Firebase credentials
or project selection.

```powershell
pnpm install
pnpm lint
pnpm build
pnpm test
pnpm serve
```

The emulator command uses the isolated project ID `demo-investec-logs`; demo project IDs prevent
fallback to non-emulated Firebase services. In a second terminal, run:

```powershell
pnpm test:emulator
```

Local ports are defined in `firebase.json`. Emulator test files run serially because they share and
reset the same isolated Firestore instance.

## Firebase setup boundary

When setup is approved, create a fresh Firebase project, enable Authentication, create the default
Firestore database as Standard edition in `africa-south1`, review the prototype Security Rules,
and only then deploy the required Functions, Hosting rewrite, indexes, and rules. Do not use client
SDKs or the Firebase Console to grant roles casually; access profiles are authorization records.
