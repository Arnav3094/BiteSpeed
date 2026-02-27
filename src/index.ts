import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import { identifyHandler } from "./identify.js";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());

app.post("/identify", identifyHandler);

// JSON error handler — must have 4 params so Express treats it as error middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
