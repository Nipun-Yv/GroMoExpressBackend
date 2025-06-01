import express from "express"
import fitnessApi from "./routes/google-fit.js"
import healthApi from "./routes/health.js"
import policyApi from "./routes/policy.js"
import couponApi from "./routes/coupon.js"
import dotenv from "dotenv"
import cors from "cors"
import {connectDB,db} from "./config/db.js"


dotenv.configDotenv()

const port=process.env.PORT||4000
const app=express()

app.use(cors())
app.use(express.json())
app.use("/google-fit",fitnessApi)
app.use("/health",healthApi)
app.use("/policy",policyApi)
app.use("/coupons",couponApi)

app.get("/health",async(req,res)=>{
    const result=await db.query("Select * FROM add_ons")
    console.log(result.rows[0]);
    res.send("Okay")
})
connectDB()
.then(()=>{
    app.listen(port,'0.0.0.0',()=>{
    console.log(`Server running successfully and receiving requests from port ${port}`)
    })
})
.catch((err)=>{
    console.log("An error occurred in server initialisation",err.message)
})

