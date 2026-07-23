import { z } from "zod";

const shortString = z.string().trim().min(1).max(128);
const accountNumber = z.string().trim().min(1).max(34);

const logicalIsoDateTime = z
  .string()
  .max(64)
  .refine((value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})T/.exec(value);
    if (!match || Number.isNaN(Date.parse(value))) return false;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1) return false;

    return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
  }, "Invalid ISO 8601 date-time");

export const categorySchema = z.object({
  code: z.string().trim().min(1).max(32),
  key: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(128),
});

const countrySchema = z.object({
  code: z.literal("ZA"),
  alpha3: z.literal("ZAR"),
  name: z.literal("South Africa"),
});

export const transactionInputSchema = z.object({
  accountNumber,
  dateTime: logicalIsoDateTime,
  centsAmount: z.number().int().min(-1_000_000_000).max(1_000_000_000),
  currencyCode: z.literal("zar"),
  type: z.literal("card"),
  reference: z.string().trim().min(1).max(256),
  card: z.object({
    id: shortString,
    display: shortString,
  }),
  merchant: z.object({
    name: shortString,
    city: z.string().trim().max(128),
    country: countrySchema,
    category: categorySchema,
  }),
});

export const transactionRequestSchema = z.object({
  transaction: transactionInputSchema,
});

const amountOperatorSchema = z.enum(["<", "<=", "==", ">", ">="]);
const tagBaseSchema = z.object({
  name: z.string().trim().min(1).max(64),
  applyFuture: z.boolean(),
});

export const tagDefinitionSchema = z.union([
  tagBaseSchema.extend({
    merchantName: shortString,
  }),
  tagBaseSchema.extend({
    centsAmount: z.number().int().min(-1_000_000_000).max(1_000_000_000),
    amountOperator: amountOperatorSchema,
  }),
]);

const uniqueStrings = (maximum: number, length: number) =>
  z
    .array(z.string().trim().min(1).max(length))
    .max(maximum)
    .refine((items) => new Set(items).size === items.length, "Values must be unique");

const transactionScopeSchema = z
  .object({
    mode: z.enum(["all", "restricted"]),
    accountNumbers: uniqueStrings(50, 34),
    cardIds: uniqueStrings(50, 128),
  })
  .strict()
  .refine(
    (scope) =>
      scope.mode === "all" || scope.accountNumbers.length > 0 || scope.cardIds.length > 0,
    "Restricted access requires at least one account or card assignment",
  );

export const accessProfileSchema = z
  .object({
    active: z.boolean(),
    role: z.enum(["member", "ingestor"]),
    transactionScope: transactionScopeSchema,
  })
  .strict();

export type AccessProfile = z.infer<typeof accessProfileSchema>;
export type Category = z.infer<typeof categorySchema>;
export type TagDefinition = z.infer<typeof tagDefinitionSchema>;
export type TransactionInput = z.infer<typeof transactionInputSchema>;
