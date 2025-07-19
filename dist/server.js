"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const stream_chat_1 = require("stream-chat");
const openai_1 = __importDefault(require("openai"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: false }));
//initialise stream client
const chatClient = stream_chat_1.StreamChat.getInstance(process.env.STREAM_API_ACCESS_KEY, process.env.STREAM_API_SECRET_KEY, {
    timeout: 10000 // 10 seconds timeout
});
// initialise open client
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY
});
//Register User with Stream Chat
app.post('/register-user', async (req, res) => {
    const { userName, email } = req.body;
    if (!userName || !email) {
        return res.status(400).json({ error: 'All fields required' });
    }
    try {
        const userId = email.replace(/[^a-zA-z0-9_-]/g, '_'); // unique user id to register user with stream chat
        console.log(userId);
        // now we will check if user is already present in the stream chat or not
        const userResponse = await chatClient.queryUsers({ id: { $eq: userId } });
        // if user not present than add user to stream chat
        if (!userResponse.users.length) {
            //add new user to stream
            await chatClient.upsertUser({
                id: userId,
                name: userName,
                email,
                role: 'user'
            });
        }
        return res.status(201).json({ userId, userName, email });
    }
    catch {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Send message to openAI
app.post('/chat', async (req, res) => {
    // send message and user id
    // const {message, userId} = req.body;
    const message = req.body?.message;
    const userId = req.body?.userId;
    console.log(req.body);
    if (!message || !userId) {
        return res.status(400).json({ error: 'Message and UserId are required fields' });
    }
    try {
        // verify if the user exists
        const userResponse = await chatClient.queryUsers({ id: { $eq: userId } });
        console.log(userResponse);
        if (!userResponse.users.length) {
            console.log(userResponse);
            return res.status(404).json({ error: 'user not found, please regsister first!' });
        }
        // res.send(userResponse);
        return res.send('chat route is working expected');
    }
    catch (error) {
        console.error('error is', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`server is running on PORT:${PORT}`));
