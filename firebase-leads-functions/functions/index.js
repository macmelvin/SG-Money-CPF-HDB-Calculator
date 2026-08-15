// Fires on every new document in the `leads` collection (i.e. every time
// someone submits the "no partner here yet" form on SG Money). Each lead
// starts life with notified: false (set client-side in src/lib/leads.ts);
// this function queries only the leads still marked notified: false,
// emails just those as a table, then flips them to notified: true - so
// each email shows what's new since the last one, not the entire history
// repeated every time.
//
// Note: leads submitted BEFORE this change don't have a `notified` field
// at all, and Firestore's `== false` query doesn't match missing fields -
// so old leads won't suddenly reappear in a future email. They were
// already sent in the old cumulative-list emails.
//
// Requires the Blaze (pay-as-you-go) plan on this Firebase project —
// Cloud Functions triggers aren't available on Spark. Realistically this
// stays well within Google's free-tier included quota (2M invocations/mo,
// 400K GB-seconds compute) at any volume of leads a new site like this
// will see for a long time — expect $0/month in practice.
//
// Deploy from the firebase-leads-functions/ directory (see README.md in
// this folder for the full one-time setup: secrets, Blaze plan, deploy).

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

// Set via: firebase functions:secrets:set GMAIL_USER / GMAIL_APP_PASSWORD / NOTIFY_EMAIL
const GMAIL_USER = defineSecret("GMAIL_USER");
const GMAIL_APP_PASSWORD = defineSecret("GMAIL_APP_PASSWORD");
const NOTIFY_EMAIL = defineSecret("NOTIFY_EMAIL");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== "function") return "";
  return timestamp.toDate().toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

exports.emailOnNewLead = onDocumentCreated(
  {
    document: "leads/{leadId}",
    region: "asia-southeast1",
    secrets: [GMAIL_USER, GMAIL_APP_PASSWORD, NOTIFY_EMAIL],
  },
  async () => {
    const snapshot = await db.collection("leads").where("notified", "==", false).get();

    // Nothing unsent — likely a duplicate trigger delivery for a lead
    // another invocation already handled. Nothing to do.
    if (snapshot.empty) return;

    // Sorted here in code rather than via Firestore's orderBy, so this
    // stays a simple single-field equality query — combining a where()
    // with orderBy() on a different field would need a composite index
    // set up manually in the Firestore console first.
    const leads = snapshot.docs
      .map((doc) => doc.data())
      .sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0));

    const rows = leads
      .map(
        (lead) => `
        <tr>
          <td>${escapeHtml(formatDate(lead.createdAt))}</td>
          <td>${escapeHtml(lead.calculator)}</td>
          <td>${escapeHtml(lead.name)}</td>
          <td>${escapeHtml(lead.phone)}</td>
          <td>${escapeHtml(lead.email)}</td>
          <td>${escapeHtml(lead.projectInterest)}</td>
          <td>${escapeHtml(lead.note)}</td>
        </tr>`
      )
      .join("");

    const html = `
      <p>${leads.length} new lead${leads.length === 1 ? "" : "s"} since the last email.</p>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:13px;">
        <thead>
          <tr style="background:#f2f0eb;text-align:left;">
            <th>Date</th><th>Calculator</th><th>Name</th><th>Phone</th><th>Email</th><th>Project interest</th><th>Note</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: GMAIL_USER.value(),
        pass: GMAIL_APP_PASSWORD.value(),
      },
    });

    await transporter.sendMail({
      from: GMAIL_USER.value(),
      to: NOTIFY_EMAIL.value(),
      subject: `SG Money: ${leads.length} new lead${leads.length === 1 ? "" : "s"}`,
      html,
    });

    // Only mark as notified after the email actually sent successfully —
    // if sendMail throws above, these stay notified: false and get picked
    // up (and re-sent) by the next trigger instead of silently vanishing.
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.update(doc.ref, { notified: true }));
    await batch.commit();
  }
);
