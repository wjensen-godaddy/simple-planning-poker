const express = require("express");
const WebSocket = require("ws");
const http = require("http");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, "public")));

const clients = new Map();

function sendUserList() {
  // Send the entire list of users and their votes
  const usersList = Array.from(clients.entries()).map(([_, client]) => ({
    username: client.username,
    vote: client.vote,
  }));
  broadcast({ type: "users_list_updated", users: usersList });
}

const onUserJoined = (ws, { username }) => {
  clients.set(ws, { username });
  broadcast({ type: "user_joined", username });

  sendUserList();
};

function onUserVoted(ws, data) {
  const user = clients.get(ws);
  user.vote = data.vote;

  sendUserList();
}

const onResetVotes = () => {
  clients.forEach((client) => {
    delete client.vote;
  });

  sendUserList();
  broadcast({ type: "votes_reset" });
};

const onShowAverage = () => {
  let sum = 0;
  let count = 0;

  clients.forEach(({ vote }) => {
    if (vote && vote !== "?") {
      sum += parseInt(vote);
      count++;
    }
  });

  const average = count > 0 ? (sum / count).toFixed(2) : 0;
  broadcast({ type: "average_vote", average });
};

const broadcast = (data) => {
  clients.forEach((_, ws) => {
    ws.send(JSON.stringify(data));
  });
};

wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.on("message", (message) => {
    const data = JSON.parse(message);
    const { type } = data;

    const eventHandlers = {
      join: onUserJoined,
      vote: onUserVoted,
      reset: onResetVotes,
      show_average: onShowAverage,
    };

    if (eventHandlers[type]) {
      eventHandlers[type](ws, data);
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log("Client disconnected");
    sendUserList();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
