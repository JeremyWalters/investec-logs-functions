import express, { type NextFunction, type Request, type Response } from "express";
import { logger } from "firebase-functions";
import { HttpsError } from "firebase-functions/v2/https";
import { assertActiveRole, loadAccessProfile } from "./access";
import { authentication } from "./firebase";
import { transactionRequestSchema } from "./models";
import { createTransaction } from "./repository";

interface AuthenticatedRequest extends Request {
  authenticatedUid?: string;
}

async function authenticateIngestor(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
): Promise<void> {
  const authorization = request.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    response.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const token = authorization.slice("Bearer ".length).trim();
    if (!token) throw new Error("Missing bearer token");

    const decodedToken = await authentication.verifyIdToken(token);
    const profile = await loadAccessProfile(decodedToken.uid);
    assertActiveRole(profile, "ingestor");
    request.authenticatedUid = decodedToken.uid;
    next();
  } catch (error: unknown) {
    const status = error instanceof HttpsError && error.code === "permission-denied" ? 403 : 401;
    logger.warn("Transaction ingestion authorization failed", { status });
    response.status(status).json({ error: status === 401 ? "Unauthorized" : "Forbidden" });
  }
}

export const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));
app.post(
  "/api/v1/transactions",
  (request, response, next) => {
    void authenticateIngestor(request, response, next);
  },
  (request: AuthenticatedRequest, response: Response) => {
    void (async () => {
      const parsed = transactionRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({ error: "Invalid transaction payload" });
        return;
      }

      try {
        const result = await createTransaction(parsed.data.transaction);
        response.status(result.created ? 201 : 200).json({
          success: result.created
            ? `Created transaction ${result.id}`
            : `Transaction ${result.id} already exists`,
        });
      } catch (error: unknown) {
        logger.error("Transaction ingestion failed", {
          uid: request.authenticatedUid,
          error: error instanceof Error ? error.name : "UnknownError",
        });
        response.status(500).json({ error: "Failed to create transaction" });
      }
    })();
  },
);
