// var input_price = context.getVariable('verifyapikey.VA-VerifyAPIKey.apiproduct.test_input_price_per_100M');
//var ops_input_price = context.getVariable('apiproduct.operation.attributes.input_price_per_100M');
//var ops_output_price = context.getVariable('apiproduct.operation.attributes.output_price_per_100M');

//context.setVariable('input_price', input_price);
//context.setVariable('ops_input_price', ops_input_price);
//context.setVariable('ops_output_price', ops_output_price);


// 1. JSON 문자열 데이터와 찾고자 하는 대상 모델명 가져오기
var jsonString = context.getVariable("verifyapikey.VA-VerifyAPIKey.__apigee_reserved_llm_operation_configs_attribute"); 
var targetModel = context.getVariable("target_model");
try {
    // JSON 문자열을 자바스크립트 객체 배열로 변환
    var dataArray = JSON.parse(jsonString);
    var targetAttributes = null;
    // 2. 전체 배열을 순회하며 조건에 맞는 모델 찾기
    for (var i = 0; i < dataArray.length; i++) {
        var item = dataArray[i];
        var operations = item.llmOperations;
        var isModelFound = false;
        
        // llmOperations 배열 내부를 순회하며 model 값 비교
        if (operations && operations.length > 0) {
            for (var j = 0; j < operations.length; j++) {
                if (operations[j].model === targetModel) {
                    isModelFound = true;
                    break; // 내부 루프 탈출
                }
            }
        }
        // 원하는 모델을 찾았다면 해당 item의 attributes를 저장하고 외부 루프 탈출
        if (isModelFound) {
            targetAttributes = item.attributes;
            break; 
        }
    }
    var inputPrice = 0;
    var outputPrice = 0;
    // 3. 찾은 attributes 배열을 읽어서 필요한 값만 Apigee 변수로 세팅하기
    if (targetAttributes) {
        for (var k = 0; k < targetAttributes.length; k++) {
            var attrName = targetAttributes[k].name;
            var attrValue = targetAttributes[k].value;
            
            // input_price_per_100M 과 output_price_per_100M 만 추출 및 로컬 변수 저장
            if (attrName === 'input_price_per_100M') {
                inputPrice = parseFloat(attrValue);
                context.setVariable("model_attr." + attrName, attrValue);
            }
            if (attrName === 'output_price_per_100M') {
                outputPrice = parseFloat(attrValue);
                context.setVariable("model_attr." + attrName, attrValue);
            }
        }
        
        // 성공 여부 플래그
        context.setVariable("model_attr.found", "true");
        
    } else {
        // 일치하는 모델이 없을 경우의 처리
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
    // JSON 파싱 에러
    context.setVariable("model_attr.error", e.message);
}