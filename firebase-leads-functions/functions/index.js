// Fires on every new document in the `leads` collection (i.e. every time
// someone submits the "no partner here yet" form on SG Money). Rather than
// emailing just the one new lead, it pulls the FULL current list of every
// lead ever submitted and sends that as one table — so Melvin always has
// an up-to-date, ready-to-forward list for whichever advertiser he's
// talking to, without piecing together individual emails himself.
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
    const snapshot = await db.collection("leads").orderBy("createdAt", "desc").get();
    const leads = snapshot.docs.map((doc) => doc.data());

    const rows = leads
      .map(
        (lead) => `
        <tr>
          <td>${escapeHtml(formatDate(lead.createdAt))}</td>
          <td>${escapeHtml(lead.calculator)}</td>
          <td>${escapeHtml(lead.category)}</td>
          <td>${escapeHtml(lead.name)}</td>
          <td>${escapeHtml(lead.phone)}</td>
          <td>${escapeHtml(lead.email)}</td>
          <td>${escapeHtml(lead.projectInterest)}</td>
          <td>${escapeHtml(lead.note)}</td>
        </tr>`
      )
      .join("");

    const html = `
      <p>${leads.length} lead${leads.length === 1 ? "" : "s"} total on SG Money to date.</p>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:13px;">
        <thead>
          <tr style="background:#f2f0eb;text-align:left;">
            <th>Date</th><th>Calculator</th><th>Category</th><th>Name</th><th>Phone</th><th>Email</th><th>Project interest</th><th>Note</th>
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
      subject: `SG Money: new lead — ${leads.length} total`,
      html,
    });
  }
);
