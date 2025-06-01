import express from "express"
import {db} from "../config/db.js"


const router=express.Router()

router.post("/claim",async(req,res)=>{
    try{
        const {couponId,discountCode}=req.body
        console.log(couponId,discountCode)
        await db.query("INSERT INTO coupons values($1,$2)",[couponId,discountCode])
        return res.status(200).json({
            success:true,
            message:"Successfully added"
        })
    }
    catch(err){
        console.log("An error occurred while adding code to the db",err.message)
    }
})


router.post("/redeem",async(req,res)=>{
    try{
        const {discountCode}=req.body
        console.log(discountCode)
        const result=await db.query("SELECT * FROM coupons where discountcode=$1",[discountCode])
        console.log(result.rows)
        if(result.rowCount>0){
            return res.status(200).json({
                success:true,
                couponId:result.rows[0].couponid
            })
        }
        else{
            return res.status(404).json({
                success:false
            })
        }
    }
    catch(err){
        console.log("An error occurred while adding code to the db",err.message)
    }
})

router.get("/reduce-score/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(userId,"I was hit")
        const updateQuery = `
            UPDATE fitness_data
            SET diabetes_score = GREATEST(diabetes_score - 0.25, 0),
                cardiovascular_score = GREATEST(cardiovascular_score - 0.25, 0),
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
            RETURNING *;
        `;

        const result = await db.query(updateQuery, [userId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }

        res.json({ 
            success: true,
            message: 'Scores reduced successfully (minimum 0)', 
            updatedData: result.rows[0]
        });

    } catch (err) {
        console.error('Error reducing scores:', err);
        res.status(500).json({ 
            success: false,
            message: 'Internal server error',
            error: err.message 
        });
    }
});

export default router;