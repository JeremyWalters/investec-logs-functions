import type { TransactionInput } from "../src/models";

export function makeTransaction(overrides: Partial<TransactionInput> = {}): TransactionInput {
  return {
    accountNumber: "10000000001",
    dateTime: "2026-07-22T10:15:30.000Z",
    centsAmount: 12_345,
    currencyCode: "zar",
    type: "card",
    reference: "purchase-123",
    card: {
      id: "card-1",
      display: "Business card",
    },
    merchant: {
      name: "Example Merchant",
      city: "Cape Town",
      country: {
        code: "ZA",
        alpha3: "ZAR",
        name: "South Africa",
      },
      category: {
        code: "5812",
        key: "restaurants",
        name: "Restaurants",
      },
    },
    ...overrides,
  };
}
