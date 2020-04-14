import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as express from "express";
import * as bodyParser from "body-parser";

admin.initializeApp(functions.config().firebase);

const db = admin.firestore();

const app = express();
const main = express();

const transactionsCollection = "transactions";
const categoriesCollection = "categories";

main.use("/api/v1", app);
main.use(bodyParser.json());
main.use(bodyParser.urlencoded({ extended: false }));

// webApi is the main webserver function
export const webApi = functions.https.onRequest(main);

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

// Add new transaction
app.post("/transactions", async (req, res) => {
  try {
    const transaction: Transaction = req.body.transaction;
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
}

export { app };
