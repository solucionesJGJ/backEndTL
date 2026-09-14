import bodyParser from "body-parser";
import cors from "cors";
import express, { Request, Response } from "express";
import apiRoutes from "./routes/index.js";

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());
app.use(cors());
app.use("/api", apiRoutes);
app.use(bodyParser.urlencoded({ extended: true }));
app.get("/", (req: Request, res: Response) => {
  res.send('Bienvenido a la api de "TERMINAL LOGISTICO"');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
