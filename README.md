## Initial setup, build tools and dependencies

### 1. Clone this repo

Clone or download this repo .


### 2. Create a Firebase project and configure the quickstart

Create a Firebase Project on the [Firebase Console](https://console.firebase.google.com).

Create a Firestore under the database tab on the [Firebase Console](https://console.firebase.google.com). 

Set Datastore to Native mode (has to be empty)


### 3. Install the Firebase CLI and enable Functions on your Firebase CLI

You need to have installed the Firebase CLI. If you haven't run:

```bash
npm install -g firebase-tools
```

> Doesn't work? You may need to [change npm permissions](https://docs.npmjs.com/getting-started/fixing-npm-permissions).

You will have to login to your firebase account
```bash
firebase login
```

Set up your Firebase project by running `firebase use --add`, select your Project ID and follow the instructions.

## Deploy the app to prod

First you need to install the `npm` dependencies of the functions:

```bash
cd functions && npm install; cd ..
```

This installs locally:
 - The Firebase SDK and the Firebase Functions SDK.

Deploy to Firebase using the following command:

```bash
firebase deploy
```

This deploys and activates the date Function.

> The first time you call `firebase deploy` on a new project with Functions will take longer than usual.

## Next add code in the investec banking side

`main.js`:

```
// This function runs before a transaction.
const beforeTransaction = async (authorization) => {
    console.log(authorization);
    return true;
};
// This function runs after a transaction was successful.
const afterTransaction = async (transaction) => {
    // Log transaction
    console.log(transaction);

    let token = await authenticate();

    if (token) await postTransaction(transaction, token);
};

// Retrieve token from fire auth api
async function authenticate() {
    try {
        let tokenResponse = await fetch(`${process.env.fireBaseLoginApi}?key=${process.env.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json'},
            body: JSON.stringify({email: process.env.email, password: process.env.password, returnSecureToken: true})
        });

        const tokenResult = await tokenResponse.json();
        return tokenResult.idToken;
    } catch(error) {
        console.log(error)
    }
}

// Post transaction to firestore
async function postTransaction(transaction, token) {
    try {
        let response = await fetch(process.env.transactionsApi, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
            body: JSON.stringify({transaction})
        });

        const result = await response.json();
        console.log(result);
    } catch(error) {
        console.log(error)
    }
}
```

`env.json`:

```
{
    "transactionsApi": "https://<project-id>.firebaseapp.com/api/v1/transactions",
    "fireBaseLoginApi": "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword",
    "apiKey": "<firebase web api>",
    "email": "<firebase user email>",
    "password": "<firebase user password> - Will get this in the next step"
}
```

## Authentication

1) In your firebase console in the Authentication Menu enable email/password sign-in methods
2) Add new user in the Authentication tab
3) Remember password and use it along side the email in the above enviromental variable
4) In database menu add the following to the rules:

    ```
    rules_version = '2';
    service cloud.firestore {
        match /databases/{database}/documents {
            match/{document=**} {
                allow read: if request.auth.uid != null;
            }
            
            match /logs/{document=**} {
                allow write, update: if request.auth.uid != null;
            }
        }
    }
    ```

## Final step

1) Simulate transaction
2) In your firestore you should see the transactions