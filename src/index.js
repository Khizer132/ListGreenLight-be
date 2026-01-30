import dotenv from 'dotenv'
dotenv.config();

import mongoose from 'mongoose'
import { connectDB } from './config/db.js'

import cors from 'cors'

import express from 'express'

const PORT = process.env.PORT || 8000;

const app = express();


import webhookRoutes from './routes/webhookRoutes.js'

app.use("/api/webhooks", webhookRoutes)

app.use(cors({
    origin: ["http://localhost:5173"
    ],
    credentials: true,
}));

app.use(express.json())

import propertyRoutes from './routes/propertyRoutes.js'
import paymentRoutes from './routes/paymentRoutes.js'

app.use("/api/property", propertyRoutes);
app.use("/api/payment", paymentRoutes);



connectDB();


// app.listen(PORT, () => {
//     console.log('Server is running on port ' + PORT);
// });

module.exports = app;