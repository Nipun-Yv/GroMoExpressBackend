import express from "express"
import axios from "axios"
import {db} from "../config/db.js" 

const getUserFitnessDetails=async(userId)=>{
  try{
      const { userId } = req.auth();
      const result = await db.query(
            `SELECT 
                diabetic_score, 
                cardiovascular_score, 
                cancer_score, 
                fitness_score, 
                age, 
                gender 
            FROM fitness_data 
            WHERE user_id = $1`,
            [userId]
        );
      return result
  }catch(err){
      console.log("An error occurred while fetching fitness data to calculate custom policies")
        throw err
  }
}
const getUserDiseases=async(userId)=>{
    try{
    const result = await db.query(
        `SELECT diabetes, hypertension,  blood_pressure, other_disease
        FROM fitness_data WHERE user_id = $1`,
      [userId]
        );
        return result
    }
    catch(err){
        console.log("An error occurred while fetching diseases associated with a user")
        throw err
    }
}

const getPolicyDetails = async () => {
  try {
    const result = await db.query(`
      SELECT 
        ip.id,
        ip.name,
        ip.description,
        ip.waiting_period,
        ip.policy_document_url,
        ip.policy_brochure_url,
        ip.insurance_provider_id,
        p.image_url,
        COALESCE(json_agg(
          json_build_object(
            'cover_amount', ca.cover_amount,
            'one_year', ca.one_year,
            'two_year', ca.two_year,
            'three_year', ca.three_year
          )
        ) FILTER (WHERE ca.cover_amount IS NOT NULL), '[]') AS cover_options
      FROM insurance_policies ip
      LEFT JOIN cover_amounts ca ON ip.id = ca.policy_id
      LEFT JOIN insurance_providers p ON ip.insurance_provider_id = p.id
      GROUP BY ip.id, p.image_url;
    `);
    return result.rows;
  } catch (err) {
    console.log("An error occurred while fetching insurance policies");
    throw err;
  }
};

const getPolicyRiders = async (policyId, categories) => {
  if (!categories.length) return [];
  const result = await db.query(
    `SELECT id, name, category, cost, description FROM riders WHERE policy_id = $1 AND category = ANY($2)`,
    [policyId, categories]
  );
  return result.rows;
};

const getAddOnsByPolicyAndTier = async (policyId, tier) => {
    const query = `
        SELECT a.*
        FROM add_ons a
        INNER JOIN policy_add_on pa ON a.id = pa.add_on_id
        WHERE pa.policy_id = $1 AND a.tier = $2
    `;
    const { rows } = await db.query(query, [policyId, tier]);
    return rows;
};

export {getUserDiseases,getPolicyDetails,getPolicyRiders,getUserFitnessDetails,getAddOnsByPolicyAndTier}
// [
//   {
//     "id": 1,
//     "name": "Basic Plan",
//     "description": "Covers essential treatments",
//     "waiting_period": 30,
//     "policy_document_url": "...",
//     "policy_brochure_url": "...",
//     "insurance_provider_id": 2,
//     "cover_options": [
//       {
//         "cover_amount": 100000,
//         "one_year": 2000,
//         "two_year": 3800,
//         "three_year": 5500
//       },
//       {
//         "cover_amount": 200000,
//         "one_year": 3800,
//         "two_year": 7200,
//         "three_year": 10500
//       }
//     ]
//   },