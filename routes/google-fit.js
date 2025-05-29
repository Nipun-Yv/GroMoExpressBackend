// import express from "express"
// import qs from "qs"
// import axios from "axios"
// import getGoogleFitData from "../utilities/getFitnessData.js"
// import FitnessData from "../models/fitdata.model.js"
// const router=express.Router()

// router.get("/oauth2callback",async(req,res)=>{
//     try {
//         const {code,state} = req.query;
//         const tokenRes = await axios.post('https://oauth2.googleapis.com/token', qs.stringify({
//         code,
//         client_id: process.env.CLIENT_ID,
//         client_secret: process.env.CLIENT_SECRET,
//         redirect_uri: process.env.REDIRECT_URI,
//         grant_type: 'authorization_code',
//         }), {
//         headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
//         });

//         const { access_token} = tokenRes.data;
//         const result=await getGoogleFitData(access_token)
//         const existingUser=await FitnessData.findOne({userId:state})
//         if(existingUser){
//             await FitnessData.updateOne({userId:state},
//                 {
//                     userId:state,
//                     stepCount:result.step_count ,
//                     caloriesExpended: result.calories_expended,
//                     heartRate: result.heart_rate,
//                     height:result.height,
//                     weight:result.weight,
//                     distanceTraveled:result.distance_traveled
//                 }
//             )
//         }
//         else{
//             await FitnessData.create({
//                     userId:state,
//                     stepCount:result.step_count ,
//                     caloriesExpended: result.calories_expended,
//                     heartRate: result.heart_rate,
//                     height:result.height,
//                     weight:result.weight,
//                     distanceTraveled:result.distance_traveled
//             })
//         }
//         res.redirect("http://localhost:3000/fitness-index")
//   } catch (err) {
//         console.error('Error exchanging code for token:', err.response?.data || err.message);
//         res.status(500).send('OAuth Authentication Credentials Expired');
//   }
// })
// router.get("/s",async(req,res)=>{
//     res.send(`CLIENT_ID: ${process.env.CLIENT_ID}`);
// })

// router.get("/fitness-data/:id",async(req,res)=>{
//     try{
//         console.log("Hello")
//         const {id}=req.params
//         console.log(id)
//         const result=await FitnessData.findOne({userId:id});
//         if(!result){
//             return res.status(404).json({
//                 success:false,
//                 message:"Unable to prefetch fitness details"
//             })
//         }
//         return res.status(200).json({
//             success:true,
//             fitness_data:{
//                 heart_rate:result.heartRate,
//                 weight:result.weight,
//                 height:result.height,
//                 step_count:result.stepCount,
//                 calories_expended:result.caloriesExpended,
//                 distance_traveled:result.distanceTraveled
//             }
//         })
//     }
//     catch(err){
//         console.log("An error occurred while fetching user fitness data")
//         return res.status(500).json({
//             success:false,
//             message:"Internal server error, unable to populate form"
//         })
//     }
// })
// export default router
import { clerkMiddleware } from "@clerk/express";
import express from "express"
import qs from "qs"
import axios from "axios"
import getGoogleFitData from "../utilities/getFitnessData.js"
import {db} from "../config/db.js" // Assuming you have a db.js exporting your PostgreSQL pool

const clerkAuthMiddleware = clerkMiddleware();
const router = express.Router()

router.get("/oauth2callback",async (req, res) => {
  try {
    const { code, state } = req.query;

    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', qs.stringify({
      code,
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      redirect_uri: process.env.REDIRECT_URI,
      grant_type: 'authorization_code',
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const { access_token } = tokenRes.data;
    const result = await getGoogleFitData(access_token);

    const existingUser = await db.query('SELECT * FROM fitness_data WHERE user_id = $1', [state]);

    if (existingUser.rows.length > 0) {
      await db.query(
        `UPDATE fitness_data 
         SET step_count = $1,
             calories_expended = $2,
             heart_rate = $3,
             height = $4,
             weight = $5,
             distance_traveled = $6
         WHERE user_id = $7`,
        [
          Math.floor(result.step_count),
          result.calories_expended,
          Math.floor(result.heart_rate),
          result.height,
          result.weight,
          result.distance_traveled,
          state
        ]
      );
    } else {
      // Insert new record
      await db.query(
        `INSERT INTO fitness_data 
         (user_id, step_count, calories_expended, heart_rate, height, weight, distance_traveled) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          state,
          Math.floor(result.step_count),
          result.calories_expended,
          Math.floor(result.heart_rate),
          result.height,
          result.weight,
          result.distance_traveled
        ]
      );
    }

    res.redirect("http://localhost:3000/fitness-index");

  } catch (err) {
    console.error('Error exchanging code for token:', err.response?.data || err.message);
    res.status(500).send('OAuth Authentication Credentials Expired');
  }
});

router.get("/s", async (req, res) => {
  res.send(`CLIENT_ID: ${process.env.CLIENT_ID}`);
});

router.get("/fitness-data",clerkAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.auth();
    console.log(userId)
    const result = await db.query('SELECT * FROM fitness_data WHERE user_id = $1', [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Unable to prefetch fitness details"
      });
    }

    const data = result.rows[0];

    return res.status(200).json({
      success: true,
      fitness_data: {
        heart_rate: data.heart_rate,
        weight: Number(data.weight),
        height: Number(data.height),
        step_count: Number(data.step_count),
        calories_expended: Number(data.calories_expended),
        distance_traveled: Number(data.distance_traveled)
      }
    });

  } catch (err) {
    console.error("An error occurred while fetching user fitness data", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error, unable to populate form"
    });
  }
});

router.post("/submit-form",clerkAuthMiddleware,async(req,res)=>{
  try{
    const {userId}=req.auth()
    const {step_count,calories_expended,heart_rate,height,weight,distance_traveled}=req.body
    console.log(req.body)
    const existingUser = await db.query('SELECT * FROM fitness_data WHERE user_id = $1', [userId]);
    if (existingUser.rows.length > 0) {
      await db.query(
        `UPDATE fitness_data 
         SET step_count = $1,
             calories_expended = $2,
             heart_rate = $3,
             height = $4,
             weight = $5,
             distance_traveled = $6
         WHERE user_id = $7`,
        [
          Math.floor(step_count),
          Number(calories_expended),
          Math.floor(heart_rate),
          Number(height),
          Number(weight),
          Number(distance_traveled),
          userId
        ]
      );
    } else {
      await db.query(
        `INSERT INTO fitness_data 
         (user_id, step_count, calories_expended, heart_rate, height, weight, distance_traveled) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          Math.floor(step_count),
          Number(calories_expended),
          Math.floor(heart_rate),
          Number(height),
          Number(weight),
          Number(distance_traveled)
        ]
      );
    }
    return res.status(200).json({
      message:"Submitted successfully",
      success:true
    })
  }
  catch(err){
    console.log("An error occurred while submiting user fitness form:",err.message)
    return res.status(500).json({
      message:"Internal server error",
      success:false
    })
  }
})
export default router;
