import { randomUUID } from "crypto";
import { config } from "../src/config";
import { getCollections } from "../src/db";

const samples: Array<{ label: string; text: string }> = [
  { label: "otp", text: "Your OTP is 934201. Do not share it with anyone. If you did not request, verify now." },
  { label: "upi", text: "UPI payment pending. Approve request to receive refund within 10 minutes." },
  { label: "courier", text: "Courier on hold due to address issue. Update address to avoid return." },
  { label: "kyc", text: "KYC expired. Update immediately to avoid account suspension." },
  { label: "lottery", text: "Congratulations! You won the lottery. Claim by paying the processing fee." },
  { label: "internship", text: "Paid internship offer. Pay onboarding fee to confirm slot." },
  { label: "bank", text: "Bank alert: unusual activity detected. Verify account within 30 minutes." },
  { label: "gift", text: "You received a gift card. Click here to redeem now." },
  { label: "delivery", text: "Delivery failed. Pay small fee to reschedule your parcel." },
  { label: "tax", text: "Tax refund approved. Provide details to receive funds." },
  { label: "otp", text: "OTP for transaction is 112233. If not you, cancel now." },
  { label: "upi", text: "UPI collect request from unknown merchant. Approve to receive cashback." },
  { label: "support", text: "Support team needs verification. Submit your details to avoid lock." },
  { label: "job", text: "Remote job opportunity. Pay verification fee to start." },
  { label: "loan", text: "Loan approved. Pay processing charges to release funds." },
  { label: "shipping", text: "Customs charge pending for your shipment. Pay now." },
  { label: "authority", text: "Government notice. Immediate action required to avoid penalty." },
  { label: "invoice", text: "Invoice overdue. Pay to avoid service suspension." },
  { label: "refund", text: "Refund ready. Provide bank details to receive it." },
  { label: "security", text: "Security alert. Confirm login to secure your account." },
  { label: "bank", text: "Account will be frozen if you do not verify today." },
  { label: "lottery", text: "You have been selected for a prize. Pay tax to claim." },
  { label: "travel", text: "Ticket confirmation pending. Complete payment to avoid cancellation." },
  { label: "email", text: "Your mailbox storage is full. Upgrade now to avoid losing emails." },
  { label: "otp", text: "Use OTP 556677 to complete KYC update." },
  { label: "upi", text: "Collect request: Rs. 4,999 from unknown user. Approve?" },
  { label: "courier", text: "Package held. Update address via link to release." },
  { label: "bank", text: "Debit card blocked. Reactivate by verifying in 5 minutes." },
  { label: "social", text: "Your account will be deleted. Verify immediately." },
  { label: "invest", text: "Guaranteed returns. Send small deposit to activate account." },
  { label: "sms", text: "Urgent: click here to secure your wallet." },
  { label: "lottery", text: "Prize winner! Submit PAN and processing fee." },
  { label: "bill", text: "Electric bill unpaid. Pay now to avoid disconnection." },
  { label: "tax", text: "Income tax notice. Resolve today using this link." },
  { label: "bank", text: "Verify UPI PIN to stop pending charge." },
  { label: "support", text: "Support needs verification to unlock your account." },
  { label: "kyc", text: "KYC update required for wallet. Complete now." },
  { label: "internship", text: "Training fee needed to confirm placement." },
  { label: "otp", text: "OTP 998877 for login. If not you, click to secure." },
  { label: "phish", text: "Your PayPal account is limited. Confirm identity now." },
  { label: "phish", text: "Office365 password expired. Reset via this secure link." },
  { label: "phish", text: "Apple ID locked. Verify within 24 hours." },
  { label: "phish", text: "Your Netflix payment failed. Update billing details." },
  { label: "phish", text: "Dropbox file shared. Sign in to view." },
  { label: "phish", text: "Invoice from vendor attached. Review immediately." },
  { label: "phish", text: "Wire transfer request approved. Confirm now." },
  { label: "phish", text: "Your account was accessed. Reset password." },
  { label: "phish", text: "Action required: secure your account before it's closed." },
  { label: "phish", text: "Security alert: unrecognized login. Verify to keep access." }
];

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const { reports } = await getCollections();
  const existing = await reports.countDocuments();
  if (existing > 0) {
    console.log("Reports already seeded. Skipping.");
    return;
  }

  for (const item of samples) {
    const res = await fetch(`${config.AI_SERVICE_URL}/v1/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AI-TOKEN": config.AI_SERVICE_TOKEN
      },
      body: JSON.stringify({
        text: item.text,
        inputType: "message",
        urls: [],
        locale: "en",
        requestId: randomUUID()
      })
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("AI error", text);
      continue;
    }

    const data = await res.json();
    await reports.insertOne({
      label: item.label,
      text: item.text,
      embedding: data.embedding || [],
      createdAt: new Date()
    });

    await sleep(200);
  }

  console.log("Seeded reports.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
