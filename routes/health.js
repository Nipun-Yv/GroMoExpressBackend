
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
  const others = scores.filter(s => s !== max);

  const bonus = others.reduce((acc, val) => acc + val * (1 - max), 0);

  return Math.min(1, max + bonus * 0.5); // 0.5 controls how much bonus contributes
}

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



router.post("/health-prediction",clerkAuthMiddleware,async(req,res)=>{
  try {
    const {
      age,
      gender,
      systolicBP,
      diastolicBP,
      hypertension,
      heartDisease,
      diabetes,
      bloodPressure,
      otherDisease,
      smokingHistory,
      alcohol,
      physicalActivity,
      regularExercise,
      cholesterol,
      glucose,
      hba1c,
      bloodGlucose
    } = req.body;
    const {userId}=req.auth()
      const result = await db.query(
      `SELECT height, weight, step_count, calories_expended FROM fitness_data WHERE user_id = $1`,
      [userId]
    );
    console.log(result.rows)
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { height, weight, step_count, calories_expended } = result.rows[0];
    const bmi = height && weight ? +(weight / ((height / 100) ** 2)).toFixed(2) : null;

    const promises = [];
    // XGBOOST coupled with three more, returning the best of 4
    const cardiovascularData = {
      age_years: parseFloat(age),
      gender: gender === 'male' ? 1 : 2,
      height: parseFloat(height)*100, 
      weight: parseFloat(weight),  
      ap_hi: parseInt(systolicBP) || 120,
      ap_lo: parseInt(diastolicBP) || 80,
      cholesterol: parseInt(cholesterol),
      gluc: parseInt(glucose),
      smoke: smokingHistory === 'current' ? 1 : 0,
      alco: alcohol ? 1 : 0,
      active: parseFloat(step_count)>8500 ? 1:0
    };

    promises.push(
      fetch('http://54.68.213.252:8002/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cardiovascularData)
      }).then(res => res.json()).catch(err => ({ error: err.message }))
    );

    // 2. Diabetes Prediction (Port 8000) Random Forest
    const diabetesData = {
      gender: gender,
      age: parseInt(age),
      hypertension: hypertension ? 1 : 0,
      heart_disease: heartDisease ? 1 : 0,
      smoking_history: smokingHistory,
      bmi: 25, 
      HbA1c_level: parseFloat(hba1c) || 5.5,
      blood_glucose_level: parseInt(bloodGlucose) || 100
    };

    promises.push(
      fetch('http://54.68.213.252:8000/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(diabetesData)
      }).then(res => res.json()).catch(err => ({ error: err.message }))
    );

    // 3. Fitness Prediction (Port 8001) EBM Model
    const fitnessData = {
      age: parseInt(age),
      sex: gender,
      weight: 80, 
      bmi: 25,    
      smoker: smokingHistory === 'current' ? 1 : 0,
      bloodpressure: parseInt(systolicBP) || 120,
      regular_ex: parseFloat(calories_expended)>1500?1:0
    };

    promises.push(
      fetch('http://54.68.213.252:8001/api/v1/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fitnessData)
      }).then(res => res.json()).catch(err => ({ error: err.message }))
    );
    const updateQuery = `
      UPDATE fitness_data SET
        diabetes = $1,
        hypertension = $2,
        blood_pressure = $3,
        other_disease = $4
      WHERE user_id = $5
    `;
    await db.query(updateQuery, [
      diabetes,
      hypertension,
      bloodPressure,
      otherDisease,
      userId
    ]);
    // Execute all predictions
    const [cardiovascularResult, diabetesResult, fitnessResult] = await Promise.all(promises);

    const cardiovascular_score=cardiovascularResult.probability
    const fitness_score=fitnessResult.risk_score
    const diabetic_score=diabetesResult.probability

    const updateQuery2 = `
      UPDATE fitness_data SET
        cardiovascular_score = $1,
        fitness_score = $2,
        diabetes_score = $3,
        age=$4,
        gender=$5
      WHERE user_id = $6
    `;
    await db.query(updateQuery2, [
      cardiovascular_score,
      parseInt(fitness_score),
      diabetic_score,
      parseInt(age),
      gender,
      userId
    ]);
    // let policiesWithRiders
    // if (diabetes||hypertension||bloodPressure||otherDisease||filterScore>=0.5) {
    //     policiesWithRiders = await getPEDTier(filterScore, age, gender);
    // } else {
    //     const policies = await getPolicyDetails();
    //     policiesWithRiders = policies.map(policy => ({ ...policy, riders: [] }));
    // }

    res.json({
      success: true,
      results: {
        cardiovascular: cardiovascularResult,
        diabetes: diabetesResult,
        fitness: fitnessResult
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Health prediction error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process health prediction',
      details: error.message
    });
  }
});

export default router;
