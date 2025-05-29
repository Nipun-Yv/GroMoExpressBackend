
import { clerkMiddleware } from "@clerk/express";
import express from "express"
import axios from "axios"
import {db} from "../config/db.js" 

const clerkAuthMiddleware = clerkMiddleware();
const router = express.Router()

router.post("/existing-diseases",clerkAuthMiddleware,async(req,res)=>{
  try{
    const {userId}=req.auth();
    const{diseaseList}=req.body
     const diseaseMap = {
      diabetes: "Diabetes",
      hypertension: "Hypertension",
      thyroid: "Thyroid",
      blood_pressure: "Blood Pressure",
      any_surgery: "Any Surgery",
      asthma: "Asthma",
      other_disease: "Other disease",
    };

    const values = {};
    for (const [key, label] of Object.entries(diseaseMap)) {
      values[key] = diseaseList.includes(label);
    }

    const {
      diabetes,
      hypertension,
      thyroid,
      blood_pressure,
      any_surgery,
      asthma,
      other_disease,
    } = values;
    console.log(userId)
    const updateQuery = `
      UPDATE fitness_data SET
        diabetes = $1,
        hypertension = $2,
        thyroid = $3,
        blood_pressure = $4,
        any_surgery = $5,
        asthma = $6,
        other_disease = $7
      WHERE user_id = $8
    `;

    await db.query(updateQuery, [
      diabetes,
      hypertension,
      thyroid,
      blood_pressure,
      any_surgery,
      asthma,
      other_disease,
      userId,
    ]);

    res.status(200).json({ success: true });
  }
  catch(err){
    console.log(err.message)
    return res.status(500).json({
      success:true,
      message:"Unable to update details, internal server error"
    })
  }
})
export default router;
