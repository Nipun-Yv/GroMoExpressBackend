import { getPolicyDetails,getPolicyRiders } from "../utilities/queries.js";

const getPEDTier=async(filterScore,age,gender)=>{
    //fetching the policies
    const policies=await getPolicyDetails()

    // yahan PED wale riders
    let categories = [];
    if (filterScore > 0.8) {
        categories = ['super reduction', 'reduction'];
    } else if (filterScore > 0.6) {
        categories = ['reduction'];
    } else if (filterScore > 0.4) {
        categories = ['semi reduction'];
    }
    if(age!=undefined && age>=40 && gender=="female" || age>=35 && gender=="male"){
        categories.push("check up")
    }
    const policiesWithRiders = await Promise.all(
        policies.map(async (policy) => {
            const riders = await getPolicyRiders(policy.id, categories);
            return { ...policy, riders };
        })
    );
    return policiesWithRiders
}

export {getPEDTier}