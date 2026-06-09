// var input_price = context.getVariable('verifyapikey.VA-VerifyAPIKey.apiproduct.test_input_price_per_100M');
//var ops_input_price = context.getVariable('apiproduct.operation.attributes.input_price_per_100M');
//var ops_output_price = context.getVariable('apiproduct.operation.attributes.output_price_per_100M');

//context.setVariable('input_price', input_price);
//context.setVariable('ops_input_price', ops_input_price);
//context.setVariable('ops_output_price', ops_output_price);


// 1. Get JSON string data and target model name
var jsonString = context.getVariable("verifyapikey.VA-VerifyAPIKey.__apigee_reserved_llm_operation_configs_attribute"); 
var targetModel = context.getVariable("target_model");
try {
    // Convert JSON string to JavaScript object array
    var dataArray = JSON.parse(jsonString);
    var targetAttributes = null;
    // 2. Iterate through the array to find matching model
    for (var i = 0; i < dataArray.length; i++) {
        var item = dataArray[i];
        var operations = item.llmOperations;
        var isModelFound = false;
        
        // Iterate through llmOperations array to match model
        if (operations && operations.length > 0) {
            for (var j = 0; j < operations.length; j++) {
                if (operations[j].model === targetModel) {
                    isModelFound = true;
                    break; // Exit inner loop
                }
            }
        }
        // If matching model is found, save its attributes and exit outer loop
        if (isModelFound) {
            targetAttributes = item.attributes;
            break; 
        }
    }
    var inputPrice = 0;
    var outputPrice = 0;
    // 3. Extract required values from matching attributes array and set Apigee variables
    if (targetAttributes) {
        for (var k = 0; k < targetAttributes.length; k++) {
            var attrName = targetAttributes[k].name;
            var attrValue = targetAttributes[k].value;
            
            // Extract input_price_per_100M and output_price_per_100M and save to local variables
            if (attrName === 'input_price_per_100M') {
                inputPrice = parseFloat(attrValue);
                context.setVariable("model_attr." + attrName, attrValue);
            }
            if (attrName === 'output_price_per_100M') {
                outputPrice = parseFloat(attrValue);
                context.setVariable("model_attr." + attrName, attrValue);
            }
        }
        
        // Success flag
        context.setVariable("model_attr.found", "true");
        
    } else {
        // Handle case when no matching model is found
        context.setVariable("model_attr.found", "false");
    }
    // 4. Get usageMetadata and calculate price
    var promptTokens = Number(context.getVariable("prompt_token_count")) || 0;
    var candidatesTokens = Number(context.getVariable("candidates_token_count")) || 0;
    var thoughtsTokens = Number(context.getVariable("thoughts_token_count")) || 0;

    // Price calculation (as requested, simply multiply and sum)
    var totalPrice = (promptTokens * inputPrice) + ((candidatesTokens + thoughtsTokens) * outputPrice);
    context.setVariable("token_price_per_100M", String(totalPrice));

} catch (e) {
    // JSON parsing error
    context.setVariable("model_attr.error", e.message);
}