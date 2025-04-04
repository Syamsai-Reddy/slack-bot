# 🚀 Slack Approval Bot

A Slack bot that enables users to request approvals directly within Slack using a slash command and interactive modals. Built with Node.js, Express, and Slack's Bolt framework.

---

## 📦 Features

- `/approval-test` slash command opens a request modal.
- Users can select an approver and enter request details.
- Approvers receive interactive messages with Approve ✅ or Reject ❌ buttons.
- Requesters are notified of the decision in a direct message.
- Prevents self-approval (users cannot select themselves as approver).
- Logs request details and decisions in the terminal for tracking.

---

## 🛠️ Technologies Used

- Node.js
- Express.js
- Slack Bolt SDK
- Slack API (slash commands, modals, interactivity)

---


