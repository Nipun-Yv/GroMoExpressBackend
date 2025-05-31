import { getPolicyDetails,getPolicyRiders,getAddOnsByPolicyAndTier } from "../utilities/queries.js";

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

const addAddOnsToPolicies = async (policiesWithRiders, fitness_score) => {
    let tier;
    if (fitness_score <= 33) {
        tier = 3;
    } else if (fitness_score < 66) {
        tier = 2;
    } else {
        tier = 1;
    }

    const policiesWithAddOns = await Promise.all(
        policiesWithRiders.map(async (policy) => {
            const addOns = await getAddOnsByPolicyAndTier(policy.id, tier);
            return {
                ...policy,
                add_ons: addOns
            };
        })
    );

    return policiesWithAddOns;
};

export {getPEDTier,addAddOnsToPolicies}