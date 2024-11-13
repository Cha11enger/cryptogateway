import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import connectToDatabase from './config/db';
import routes from './routes/routes';

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Connect to the database
connectToDatabase();

// Middleware to parse JSON requests
app.use(express.json());

// Define a basic route
app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!');
});

app.use('/api', routes);

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
