import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import express, {Request, Response} from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { StreamChat } from 'stream-chat';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: false}));


//initialise stream client
const chatClient = StreamChat.getInstance(
    process.env.STREAM_API_ACCESS_KEY!,
    process.env.STREAM_API_SECRET_KEY!,
    {
        timeout: 10000 // 10 seconds timeout
    }
)

// initialise open client

const endpoint = "https://models.github.ai/inference";
const model = "openai/gpt-4.1";

//Register User with Stream Chat

app.post('/register-user', async(req: Request,res: Response): Promise<any> => {

    const{userName, email} = req.body;

    if(!userName || !email){
        return res.status(400).json({error: 'All fields required'});
    }
    
    try{
        const userId = email.replace(/[^a-zA-z0-9_-]/g,'_'); // unique user id to register user with stream chat

        console.log(userId);
    
        // now we will check if user is already present in the stream chat or not
        const userResponse = await chatClient.queryUsers({id: { $eq : userId } });

        // if user not present than add user to stream chat
        if(!userResponse.users.length){
            //add new user to stream
            await chatClient.upsertUser({
                id : userId,
                name : userName,
                email,
                role : 'user'
            }as any)
        }
    
        return res.status(201).json({userId, userName, email});
    }catch{
        return res.status(500).json({error: 'Internal server error'});
    }


});

// Configuring Azure Open AI modal to generate response

const askGithubGPT = async(promptText : string) => {
  const token = process.env.GITHUB_TOKEN;
  
  // if token missing than throw the error
  if (!token) {
    throw new Error("Missing GitHub token. Please set GITHUB_TOKEN in your .env file.");
  }

  const client = ModelClient(endpoint, new AzureKeyCredential(token));

  const response = await client.path("/chat/completions").post({
    body: {
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: promptText },
      ],
      temperature: 0.7,
      top_p: 1,
      model,
    },
  });

  if (isUnexpected(response)) {
    throw new Error(`Error from API: ${JSON.stringify(response.body.error)}`);
  }

  return response.body.choices[0].message.content;
}


// Send message to openAI

app.post('/chat', async(req: Request, res: Response): Promise<any> => {

    // send message and user id
    // const {message, userId} = req.body;

    const message = req.body?.message;
    const userId = req.body?.userId;


    console.log(req.body)

    if(!message || !userId){
        return res.status(400).json({error: 'Message and UserId are required fields'});
    }

        

    try{
        // verify if the user exists
        const userResponse = await chatClient.queryUsers({id: { $eq : userId } });

        if(!userResponse.users.length){
            return res.status(404).json({error:'user not found, please regsister first!'})
        }

        //send message to Azure open AI modal

        const response = await askGithubGPT(message);

        console.log(response);

        return res.json({
            message,
            response
        })
        
    }catch (error) {
        return res.status(500).json({error: error})
    }
})

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`server is running on PORT:${PORT}`));

