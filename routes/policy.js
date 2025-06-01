import { clerkMiddleware } from "@clerk/express";
import express from "express"
import axios from "axios"
import {db} from "../config/db.js" 
import { getPolicyDetails, getUserDiseases,getPolicyRiders } from "../utilities/queries.js";
import { getPEDTier,addAddOnsToPolicies} from "../utilities/getPEDTier.js";

const clerkAuthMiddleware = clerkMiddleware();
const router = express.Router()

const boostedScore=(scores)=> {
  const max = Math.max(...scores);
  console.error(max,"max score")
  const others = scores.filter(s => s !== max);

  const bonus = others.reduce((acc, val) => acc + val * (1 - max), 0);

  return Math.min(1, max + bonus * 0.5); // 0.5 controls how much bonus contributes
}

router.get("/p",async(req,res)=>{
    const diabetic_score=0.9
    const hypertension_score=0.7
    const thyroid_score=0.5
    const fitness_score=67
    const filterScore=0.9
    const age=40
    const gender="female"

    const userId="user_2xH9K8iExc91rh0aWoK5Dnc2dPz"

    //yahan user dieases fetch ho rahi hain
    const result = await getUserDiseases(userId)
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User data not found" });
    }
    const diseaseRow = result.rows[0];
    const hasAnyDisease = Object.values(diseaseRow).some(value => value === true);

    let policiesWithRiders = [];
    if (hasAnyDisease) {
        policiesWithRiders = await getPEDTier(filterScore, 35, "male", diseaseRow);
    } else {
        const policies = await getPolicyDetails();
        policiesWithRiders = policies.map(policy => ({ ...policy, riders: [] }));
    }

    res.json({message:"Hello there",policiesWithRiders})
})

router.get("/custom-policies",clerkAuthMiddleware,async(req,res)=>{
    try{
        const {userId}=req.auth()
        const fetchScoresQuery = `
            SELECT 
                diabetes_score, 
                cardiovascular_score, 
                fitness_score, 
                age, 
                gender
            FROM fitness_data
            WHERE user_id = $1
            `;
        
        const { rows } = await db.query(fetchScoresQuery, [userId]);

        if (!rows.length) {
        return res.status(404).json({ success: false, error: "User fitness data not found" });
        }

        const {
        diabetes_score,
        cardiovascular_score,
        fitness_score,
        age,
        gender
        } = rows[0];

        // Example: Calculate filterScore
        const filterScore = boostedScore([
        diabetes_score,
        cardiovascular_score
        ]);
        console.log(diabetes_score,cardiovascular_score)

        console.log("the filter score",filterScore)
        const result = await getUserDiseases(userId)
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User data not found" });
        }
        const diseaseRow = result.rows[0];
        const hasAnyDisease = Object.values(diseaseRow).some(value => value === true);
        let policiesWithRiders = [];
        if (hasAnyDisease||filterScore>=0.5) {
            policiesWithRiders = await getPEDTier(filterScore, age, gender);
        } else {
            const policies = await getPolicyDetails();
            policiesWithRiders = policies.map(policy => ({ ...policy, riders: [] }));
        }
        const policiesWithAddOns = await addAddOnsToPolicies(policiesWithRiders, fitness_score);

        return res.status(200).json({success:true,policiesWithAddOns,diabetes_score,cardiovascular_score,age,gender})
    }
    catch(err){
        console.log("Internal server error",err.message)
        return res.status(500).json({
            message:"Internal Server Error",
            success:false
        })
    }
})
export default router