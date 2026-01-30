import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { connectDB } from './config/db.js'
import propertyRoutes from './routes/propertyRoutes.js'
import paymentRoutes from './routes/paymentRoutes.js'
import webhookRoutes from './routes/webhookRoutes.js'

import cors from 'cors'

dotenv.config();


import express from 'express'

const PORT = process.env.PORT || 8000;

const app = express();


app.use("/api/webhooks", webhookRoutes)

app.use(cors({
origin: ["http://localhost:5173" , `${process.env.CLIENT_URL}`],
    credentials: true,
}));

app.use(express.json())



app.use("/api/property", propertyRoutes);
app.use("/api/payment", paymentRoutes);


connectDB();


// app.listen(PORT, () => {
//     console.log('Server is running on port ' + PORT);
// });

export default app;