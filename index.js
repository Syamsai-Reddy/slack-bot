require("dotenv").config();
const express = require("express");
const { App } = require("@slack/bolt");

const app = express();

app.use(express.urlencoded({ extended: true }));

const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

app.post("/slack/commands", async (req, res) => {
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
    res.send("");
  } else {
    res.status(400).send("Unknown command");
  }
});

app.post("/slack/interactions", async (req, res) => {
  console.log(" /slack/interactions hit");

  let payload;
  try {
    payload = JSON.parse(req.body.payload);
  } catch (err) {
    console.error(" Error parsing payload:", err);
    return res.status(400).send("Invalid payload");
  }

  if (payload.type === "view_submission") {
    const approver =
      payload.view.state.values.approver_block.approver.selected_user;
    const requestText =
      payload.view.state.values.request_block.request_text.value;
    const requester = payload.user.id;

    if (approver === requester) {
      return res.send({
        response_action: "errors",
        errors: {
          approver_block: "You cannot select yourself as the approver.",
        },
      });
    }

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
              text: { type: "plain_text", text: "Approve " },
              value: JSON.stringify({
                requester,
                status: "approved",
                requestText,
              }),
              action_id: "approve",
            },
            {
              type: "button",
              text: { type: "plain_text", text: "Reject " },
              value: JSON.stringify({
                requester,
                status: "rejected",
                requestText,
              }),
              action_id: "reject",
            },
          ],
        },
      ],
    });

    console.log("Modal submitted with message:", requestText);
    res.send({ response_action: "clear" });
  } else if (payload.type === "block_actions") {
    const action = payload.actions[0];

    let valueData;
    try {
      valueData = JSON.parse(action.value);
    } catch (err) {
      console.error(" Error parsing button value:", err);
      return res.status(400).send("Invalid button data");
    }

    const { requester, status, requestText } = valueData;

    console.log("------ Approval Action ------");
    console.log(` Requester: ${requester}`);
    console.log(` Request: ${requestText}`);
    console.log(` Decision: ${status.toUpperCase()}`);
    console.log("-----------------------------");

    const responseText =
      status === "approved"
        ? ` Your request has been *approved*.\n\n> ${requestText}`
        : ` Your request has been *rejected*.\n\n> ${requestText}`;

    try {
      const im = await slackApp.client.conversations.open({ users: requester });
      await slackApp.client.chat.postMessage({
        channel: im.channel.id,
        text: responseText,
      });
      console.log(" Notified requester successfully");
    } catch (error) {
      console.error(" Error notifying requester:", error);
    }

    res.send("");
  } else {
    res.status(400).send("Unhandled payload type");
  }
});

const PORT = process.env.APP_PORT || 3000;
app.listen(PORT, () => console.log(` Server running on port ${PORT}`));
