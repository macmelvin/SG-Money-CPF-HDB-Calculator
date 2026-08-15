# SG Money leads → email notification

A single Cloud Function (`emailOnNewLead`) that watches the `leads`
collection in the `sg-money-leads` Firebase project. Every time someone
submits the "no partner here yet" form on SG Money, it emails you a fresh
table of **every** lead collected so far — not just the new one — so you
always have a current, ready-to-forward list for whichever advertiser
you're talking to.

This is a separate deploy target from the SG Money web app itself (which
deploys via Railway on `git push`). This one deploys via the Firebase CLI,
by hand, whenever you change it.

## One-time setup

**1. Upgrade `sg-money-leads` to the Blaze plan.**
Cloud Functions triggers require Blaze (pay-as-you-go). In practice this
stays at $0/month — Google's free tier includes 2M function invocations
and 400K GB-seconds of compute per month, far more than lead-form volume
on a new site will use for a long time. Go to Firebase Console → Project
settings → Usage and billing → Modify plan.

**2. Get a Gmail App Password** for whichever Gmail account you want to
send *from* (can be the same account you receive the notification at).
Requires 2-Step Verification to already be turned on for that account.
- Go to https://myaccount.google.com/apppasswords
- Create a new app password (name it something like "SG Money leads")
- Copy the 16-character password — you'll paste it in step 4

**3. Install dependencies:**
```bash
cd firebase-leads-functions/functions
npm install
```

**4. Set the three secrets** (run from `firebase-leads-functions/`, each
command will prompt you to paste the value):
```bash
cd firebase-leads-functions
firebase functions:secrets:set GMAIL_USER
# paste the Gmail address you're sending FROM, e.g. macmelvin.tan@gmail.com

firebase functions:secrets:set GMAIL_APP_PASSWORD
# paste the 16-character app password from step 2

firebase functions:secrets:set NOTIFY_EMAIL
# paste the address you want notifications sent TO — can be the same address
```

**5. Deploy:**
```bash
firebase deploy --only functions
```

That's it — from here on, every new Firestore document in `leads` (i.e.
every form submission on the live site) triggers this function
automatically. No further action needed unless you want to change the
email format, in which case edit `functions/index.js` and re-run step 5.

## Updating later

If you ever change the lead form's fields (add/remove something), update
the table columns in `functions/index.js` to match, then redeploy with
`firebase deploy --only functions` from this directory.
