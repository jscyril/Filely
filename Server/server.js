/* eslint-disable @typescript-eslint/no-require-imports */
//import express from 'express';
//import http from 'http';
// import { Server } from 'socket.io';
// import cors from 'cors';

const express = require('express');
const http = require('http');
const app = express();
const cors = require('cors');
const {Server} = require('socket.io');

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Enable CORS for the Express app
app.use(cors({
  origin: "http://localhost:3000", // Allow only localhost:3000
  methods: ["GET", "POST"],
}));

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
    socket.to(roomId).emit("user-joined", socket.id);
  });

  socket.on("offer", ({ target, offer }) => {
    socket.to(target).emit("offer", { sender: socket.id, offer });
  });

  socket.on("answer", ({ target, answer }) => {
    socket.to(target).emit("answer", { sender: socket.id, answer });
  });

  socket.on("ice-candidate", ({ target, candidate }) => {
    socket.to(target).emit("ice-candidate", { sender: socket.id, candidate });
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

server.listen(5000, () => {
  console.log("Server is running on port 5000");
});






// /* eslint-disable @typescript-eslint/no-require-imports */
// const express = require("express");
// const http = require("http");
// const app = express();
// const server = http.createServer(app);
// const socket = require("socket.io");
// const cors = require("cors"); // Import cors package

// // Enable CORS
// app.use(cors({
//     origin: "http://localhost:3000", // Allow requests from your frontend
//     methods: ["GET", "POST"], // Allow specific methods
//     allowedHeaders: ["Content-Type"], // Allow specific headers
// }));

// const io = socket(server, {
//     cors: {
//         origin: "http://localhost:3000", // Allow frontend connection
//         methods: ["GET", "POST"], // Allow specific methods
//         allowedHeaders: ["Content-Type"], // Allow specific headers
//     }
// });
// const users = {};
// const socketToRoom = {};

// // Handle WebSocket connection
// io.on("connection", socket => {
//     console.log("New user connected: " + socket.id);

//     // Send the socket ID to the client
//     socket.emit("your id", socket.id);

//     //Join the room
//     socket.on("join room", roomID => {
//         if (users[roomID]) {
//             const length = users[roomID].length;
//             if (length === 2) {
//                 socket.emit("room full");
//                 return;
//             }
//             users[roomID].push(socket.id);
//         } else {
//             users[roomID] = [socket.id];
//         }
//         socketToRoom[socket.id] = roomID;
//         const usersInThisRoom = users[roomID].filter(id => id !== socket.id);

//         socket.emit("all users", usersInThisRoom);
//     });

//     // Listen for incoming offers
//     socket.on("offer", (data) => {
//         console.log("Received Offer from " + socket.id, data);
//         socket.to(data.to).emit("offer", data);
//     });

//     // Listen for incoming answers
//     socket.on('answer', (data) => {
//         console.log("Received Answer from " + socket.id, data);
//         socket.to(data.to).emit('answer', data.answer);
//     });

//     // Listen for ICE candidates
//     socket.on('icecandidate', (data) => {
//         console.log("Received ICE Candidate from " + socket.id, data);
//         socket.to(data.to).emit('icecandidate', data);
//     });

//     socket.on("sending signal", payload => {
//         io.to(payload.userToSignal).emit('user joined', { signal: payload.signal, callerID: payload.callerID });
//     });

//     socket.on("returning signal", payload => {
//         io.to(payload.callerID).emit('receiving returned signal', { signal: payload.signal, id: socket.id });
//     });

//     socket.on('disconnect', () => {
//         const roomID = socketToRoom[socket.id];
//         let room = users[roomID];
//         if (room) {
//             room = room.filter(id => id !== socket.id);
//             users[roomID] = room;
//             socket.broadcast.emit('user left', socket.id);
//         }
//     });
// });

// server.listen(5000, () => console.log(`Signaling server is running on port 5000`));
