const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// The 9 accounts we disabled earlier that actually had signed in -- re-enabling
// them now that Google wants 14 more days of active closed testing.
const testerEmails = [
  "Kookica2@gmail.com",
  "Veryevilmom@gmail.com",
  "ccddyong@gmail.com",
  "dkhy00@gmail.com",
  "iamlarrytan@gmail.com",
  "jaime.goh@gmail.com",
  "jennifer.lio@gmail.com",
  "simplyahmoi@gmail.com",
  "yapzl.b@gmail.com",
];

async function main() {
  const results = { reenabled: [], alreadyEnabled: [], notFound: [], errors: [] };
  for (const email of testerEmails) {
    try {
      const user = await admin.auth().getUserByEmail(email);
      if (!user.disabled) {
        results.alreadyEnabled.push(email);
        continue;
      }
      await admin.auth().updateUser(user.uid, { disabled: false });
      results.reenabled.push(email);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        results.notFound.push(email);
      } else {
        results.errors.push(`${email}: ${err.message}`);
      }
    }
  }
  console.log("\n=== Re-enabled just now ===");
  results.reenabled.forEach((e) => console.log(" -", e));
  console.log("\n=== Already enabled (no change needed) ===");
  results.alreadyEnabled.forEach((e) => console.log(" -", e));
  console.log("\n=== No account found ===");
  results.notFound.forEach((e) => console.log(" -", e));
  if (results.errors.length) {
    console.log("\n=== Errors ===");
    results.errors.forEach((e) => console.log(" -", e));
  }
  console.log(`\nTotal processed: ${testerEmails.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
