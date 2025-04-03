require("dotenv").config();
const express = require("express");
const { App } = require("@slack/bolt");

const app = express();

// Fix: Add URL-encoded middleware (Slack sends form-data, not JSON)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//  Initialize Slack App
const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

//  Slash Command Endpoint
app.post("/slack/commands", async (req, res) => {
  console.log("Received Slash Command:", req.body); // Debugging

  // Fix: Handle missing req.body
  if (!req.body || !req.body.command) {
    console.error("Invalid request:", req.body);
    return res.status(400).send("Invalid request");
  }

  const { command, trigger_id } = req.body;

  if (command === "/approval-test") {
    await slackApp.client.views.open({
      trigger_id,
      view: {
        type: "modal",
        callback_id: "approval_modal",
        title: { type: "plain_text", text: "Request Approval" },
        blocks: [
          {
            type: "input",
            block_id: "approver_block",
            element: {
              type: "users_select",
              action_id: "approver",
              placeholder: { type: "plain_text", text: "Select Approver" },
            },
            label: { type: "plain_text", text: "Approver" },
          },
          {
            type: "input",
            block_id: "request_block",
            element: {
              type: "plain_text_input",
              action_id: "request_text",
              multiline: true,
            },
            label: { type: "plain_text", text: "Request Details" },
          },
        ],
        submit: { type: "plain_text", text: "Submit" },
      },
    });

    res.send(""); // Acknowledge request
  } else {
    res.status(400).send("Unknown command");
  }
});

//  Handle Modal Submission
app.post("/slack/interactions", async (req, res) => {
  const payload = JSON.parse(req.body.payload);
  console.log("Received Interaction:", JSON.stringify(payload, null, 2)); // Debugging

  if (payload.type === "view_submission") {
    try {
      const approver =
        payload.view.state.values.approver_block.approver.selected_user;
      const requestText =
        payload.view.state.values.request_block.request_text.value;
      const requester = payload.user.id;

      console.log("Approver:", approver);
      console.log("Request Text:", requestText);
      console.log("Requester:", requester);

      await slackApp.client.chat.postMessage({
        channel: approver,
        text: `Approval request from <@${requester}>: "${requestText}"`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `Approval request from <@${requester}>:\n\n *"${requestText}"*`,
            },
          },
          {
            type: "actions",
            block_id: "approval_action",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "Approve ✅" },
                value: `${requester}_approved`,
                action_id: "approve",
              },
              {
                type: "button",
                text: { type: "plain_text", text: "Reject ❌" },
                value: `${requester}_rejected`,
                action_id: "reject",
              },
            ],
          },
        ],
      });

      //  Fix: Acknowledge request with a proper response
      res.send({ response_action: "clear" });
    } catch (error) {
      console.error("Error handling view_submission:", error);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.status(400).send("Invalid payload type");
  }
});

// Handle Approval/Rejection Actions
app.post("/slack/actions", async (req, res) => {
  const payload = JSON.parse(req.body.payload);
  console.log("Received Action:", JSON.stringify(payload, null, 2)); // Debugging

  const action = payload.actions[0];
  const [requester, status] = action.value.split("_");

  console.log("Requester:", requester);
  console.log("Status:", status);

  const responseText =
    status === "approved"
      ? "✅ Your request has been approved!"
      : "❌ Your request has been rejected.";

  await slackApp.client.chat.postMessage({
    channel: requester,
    text: responseText,
  });

  res.send(""); // Acknowledge request
});

//  Start the server
const PORT = process.env.APP_PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
