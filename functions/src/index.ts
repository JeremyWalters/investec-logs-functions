import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as express from "express";
import * as bodyParser from "body-parser";
import { operators } from "./utils";
import { format, isValid } from "date-fns";

admin.initializeApp(functions.config().firebase);

const db = admin.firestore();

const app = express();
const main = express();

const transactionsCollection = "transactions";
const categoriesCollection = "categories";
const tagsCollection = "tags";

main.use("/api/v1", app);
main.use(bodyParser.json());
main.use(bodyParser.urlencoded({ extended: false }));

// webApi is the main webserver function
export const webApi = functions.https.onRequest(main);
/**
 * Get spending by month
 * Data structure: {[month]: spending}
 */
export const getSpendingByMonth = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      // Throwing an HttpsError so that the client gets the error details.
      throw new functions.https.HttpsError("failed-precondition", "The function must be called while authenticated.");
    }

    const snapshot = await db
      .collection(transactionsCollection)
      .select("dateTime", "centsAmount")
      .orderBy("dateTime", "asc")
      .get();

    const result = {} as { [key: string]: number };

    for (let i = 0; i < snapshot.size; i++) {
      const item = snapshot.docs[i].data() as { dateTime: string; centsAmount: number };
      if (!isValid(new Date(item.dateTime))) continue;

      const monthYear = format(new Date(item.dateTime), "MMM yyyy");
      result[monthYear] = result[monthYear] ? result[monthYear] + item.centsAmount : item.centsAmount;
    }

    return result;
  } catch (error) {
    console.error({ error: `Failed at getSpendingByMonth: ${error}` });
    throw new functions.https.HttpsError("unknown", error.message, error);
  }
});
export const getSpendingByCategory = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      // Throwing an HttpsError so that the client gets the error details.
      throw new functions.https.HttpsError("failed-precondition", "The function must be called while authenticated.");
    }

    const snapshot = await db.collection(transactionsCollection).select("merchant.category.name", "centsAmount").get();
    const result = {} as { [key: string]: number };

    snapshot.docs.forEach((doc) => {
      const item = doc.data() as { merchant: Merchant; centsAmount: number };
      console.info("spendingByCategory: " + item);
      const cat = item.merchant.category.name;
      result[cat] = result[cat] ? result[cat] + item.centsAmount : item.centsAmount;
    });
    return result;
  } catch (error) {
    console.error({ error: `Failed at spendingByCategory: ${error}` });
    throw new functions.https.HttpsError("unknown", error.message, error);
  }
});

// onNewTransaction function will be triggered when new transactions is created
export const onNewTransaction = functions.firestore
  .document(`${transactionsCollection}/{transactionId}`)
  .onCreate(async (querySnapshot) => {
    await updateMerchantCategories(querySnapshot);
  });

// Used to validate the rest api
const validateFirebaseIdToken = async (req: any, res: any, next: any) => {
  console.log("Check if request is authorized with Firebase ID token");

  if (
    (!req.headers.authorization || !req.headers.authorization.startsWith("Bearer ")) &&
    !(req.cookies && req.cookies.__session)
  ) {
    console.error(
      "No Firebase ID token was passed as a Bearer token in the Authorization header.",
      "Make sure you authorize your request by providing the following HTTP header:",
      "Authorization: Bearer <Firebase ID Token>",
      'or by passing a "__session" cookie.'
    );
    res.status(403).send({ error: "Unauthorized" });
    return;
  }

  let idToken;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    console.log('Found "Authorization" header');
    // Read the ID Token from the Authorization header.
    idToken = req.headers.authorization.split("Bearer ")[1];
  } else if (req.cookies) {
    console.log('Found "__session" cookie');
    // Read the ID Token from cookie.
    idToken = req.cookies.__session;
  } else {
    // No cookie
    res.status(403).send("Unauthorized");
    return;
  }

  try {
    const decodedIdToken = await admin.auth().verifyIdToken(idToken);
    console.log("ID Token correctly decoded", decodedIdToken);
    req.user = decodedIdToken;
    next();
  } catch (error) {
    console.error("Error while verifying Firebase ID token:", error);
    res.status(403).send({ error: "Unauthorized" });
    return;
  }
};

app.use(validateFirebaseIdToken);

/**
 * TODO: Will node split this function as it grows
 */
// Add new transaction
app.post("/transactions", async (req, res) => {
  try {
    const transaction: Transaction = req.body.transaction;
    transaction.tags = [];

    // Apply tags to transaction if needed
    const tagsResponse = await db.collection(tagsCollection).get();
    const tags = tagsResponse.docs.map((doc) => doc.data()) as Tag[];

    for (let tag of tags) {
      if (!tag.applyFuture) continue;

      if (tag.centsAmount != null && tag.centsAmount != undefined && tag.amountOperator) {
        if (operators[tag.amountOperator](transaction.centsAmount, tag.centsAmount)) {
          transaction.tags.push(tag.name);
        }
      } else if (tag.merchantName && transaction.merchant.name == tag.merchantName) {
        transaction.tags.push(tag.name);
      }
    }

    const response = await db.collection(transactionsCollection).add(transaction);
    res.status(201).send({ success: `Created a new transaction: ${response}` });
  } catch (error) {
    res.status(400).send({ error: `Failed to create document: ${error}` });
  }
});

/**
 * Update the categories collection with new categories
 * This collection is mainly to be used as a lookup for any front-ends
 */
async function updateMerchantCategories(doc: functions.firestore.DocumentSnapshot) {
  const transaction = doc.data() as Transaction;
  const category = transaction.merchant.category;
  try {
    await db
      .collection(categoriesCollection)
      .doc(category.key)
      .set({ ...category }, { merge: true });
  } catch (error) {
    console.error("Failed to update category collection: ", error);
  }
}

type CurrencyCode = "zar";
type TransactionType = "card";

interface Country {
  code: "ZA";
  alpha3: "ZAR";
  name: "South Africa";
}

interface Card {
  id: string;
  display: string;
}

interface Merchant {
  name: string;
  city: string;
  country: Country;
  category: Category;
}

interface Category {
  code: string;
  key: string;
  name: string;
}

interface Transaction {
  accountNumber: string;
  dateTime: string;
  centsAmount: number;
  currencyCode: CurrencyCode;
  type: TransactionType;
  reference: string;
  card: Card;
  merchant: Merchant;
  tags: string[];
}

interface Tag {
  name: string;
  merchantName: string;
  centsAmount: number;
  amountOperator: "<" | "<=" | "==" | ">" | ">=";
  applyFuture: boolean; // Apply tag to new incoming transactions
}

export { app };
