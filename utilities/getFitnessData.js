import axios from "axios";

async function getGoogleFitData(access_token) {
  try {
    if(!access_token){
        throw new Error("Missing access token")
    }
    // Example: get aggregated steps data for last 7 days
    const now = Date.now();
    const oneWeekAgo = now - 30 * 24 * 60 * 60 * 1000;

    // Prepare request body for aggregation endpoint
    const requestBody = {
        aggregateBy: [
            { dataTypeName: "com.google.step_count.delta" },
            { dataTypeName: "com.google.heart_rate.bpm" },
            { dataTypeName: "com.google.weight" },
            { dataTypeName: "com.google.height" },
            { dataTypeName:"com.google.calories.expended"},
            { dataTypeName:"com.google.sleep.segment"},
            { dataTypeName: "com.google.distance.delta"},
    ],
      bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 }, // daily buckets
      startTimeMillis: oneWeekAgo,
      endTimeMillis: now
    };

    const response = await axios.post(
      'https://fitness.googleapis.com/fitness/v1/users/me/dataset:aggregate',
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        }
      }
    );
    console.log(response.data.bucket)
    const healthData=extractValues(response.data.bucket||[])
    return healthData

  } catch (error) {
    console.error('Error fetching Google Fit data:', error.response?.data || error.message);
    throw error;
  }
}

function extractValues(buckets){
    let weight,height,step_count=0,calories_expended=0,heart_rate,running_count=0,distance_traveled=0;
    console.log(buckets.length)
    for (var i=0;i<buckets.length;i++){
        if(!buckets[i].dataset){
            continue;
        }
        const ds=buckets[i].dataset
        console.log(ds.length)
        for(var j=0;j<ds.length;j++){
            const id=ds[j].dataSourceId
            const point=ds[j].point
            console.log(id)
            if(!id|| !point ||  point.length === 0){
                continue;
            }
            let firstVal
              switch (true) {
                case id.includes("step_count"):
                    firstVal =
                    point[0]?.value?.[0]?.intVal;
                    if (typeof firstVal === 'number') {
                        step_count+=firstVal
                        console.log(firstVal)
                        running_count+=1
                    }
                break;

                case id.includes("heart_rate"):
                    firstVal =
                    point[0]?.value?.[0]?.fpVal;
                    if (typeof firstVal === 'number') {
                        heart_rate=firstVal
                    }
                break;

                case id.includes("weight"):
                    firstVal =
                    point[0]?.value?.[0]?.fpVal;
                    if (typeof firstVal === 'number') {
                        weight=firstVal
                    }
                break;

                case id.includes("height"):
                    firstVal =
                    point[0]?.value?.[0]?.fpVal;
                    if (typeof firstVal === 'number') {
                        height=firstVal
                    }
                break;

                case id.includes("calories.expended"):
                    firstVal =
                    point[0]?.value?.[0]?.fpVal;
                    if (typeof firstVal === 'number') {
                        calories_expended+=firstVal
                    }
                break;

                case id.includes("distance"):
                    firstVal = 
                    point[0]?.value?.[0]?.fpVal;
                    if (typeof firstVal === 'number') {
                        distance_traveled += firstVal;
                    }
                    break;

                default:
                console.log("→ Unknown data type:", id);
            }
        }
    }
    if(running_count){
            step_count/=running_count
            calories_expended/=running_count
            distance_traveled/=running_count
    }
    console.log(heart_rate,weight,height,step_count,calories_expended,distance_traveled)
    return {heart_rate,weight,height,step_count,calories_expended,distance_traveled}
}
export default getGoogleFitData