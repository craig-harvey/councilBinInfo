/*
 * Copyright 2018-2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */


// sets up dependencies
const Alexa = require('ask-sdk-core');
const i18n = require('i18next');
const https = require('https');


// declaring picture URLs for each planet
const planetURLs= 
[
    'https://public-eu-west-1.s3.eu-west-1.amazonaws.com/pictures/planets/mercury.jpg',
    'https://public-eu-west-1.s3.eu-west-1.amazonaws.com/pictures/planets/venus.jpg',
    'https://public-eu-west-1.s3.eu-west-1.amazonaws.com/pictures/planets/mars.jpg',
    'https://public-eu-west-1.s3.eu-west-1.amazonaws.com/pictures/planets/jupiter.jpg',
    'https://public-eu-west-1.s3.eu-west-1.amazonaws.com/pictures/planets/sun.jpg',
];

var today = new Date();
var nextBin = '';

function selectNext(data) { 
  // Recursively loop through the elements of the array to find first event in the future.
  // Note: Currently no validation on the input data.
  // Inputs: data - JSON array containing objects with elements: start, event_type 

  var current = data[0];
  var currentDate = new Date(current.start);

    if (currentDate > today) {
        return current.event_type.toString();
    } else {
      data.shift();
      return selectNext(data);
    }
} 

function addDays(date, days) {
  // Add the specified nunber of days to the given date

  var result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Get the next bin type (organic | recycle)
function getNextBinType() {
  let startDate = new Date().toISOString().replace(/T.+/, '');
  let endDate = addDays(startDate, 14).toISOString().replace(/T.+/, '');
  let path = '/api/v1/properties/697646.json?start=' + startDate + '&end=' + endDate;

  const connOptions = {
    hostname: 'brisbane.waste-info.com.au',
    port: 443,
    path: path,
    method: 'GET',
    headers: {
      'Connection': 'keep-alive',
      'Host': 'brisbane.waste-info.com.au',
      'Accept': 'application/json, text/plain, */*',
      'Content-Type' : 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36'
      }
  };
  
  return new Promise(function (resolve, reject) {

    const req = https.request(connOptions, res => {
    
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error('statusCode=' + res.statusCode));
      }

      let body = [];
      res.on('data', function(data) {
        body.push(data);
      });
      
      res.on('end', function() {
        body = JSON.parse(Buffer.concat(body).toString());
        nextBin = selectNext(body);
        resolve(nextBin);
      });
    });

    req.on('error', error => {
      reject(error);
    });

    req.end();
  });
}

// helper functions for supported interfaces
function supportsInterface(handlerInput, interfaceName){
  const interfaces = ((((
      handlerInput.requestEnvelope.context || {})
      .System || {})
      .device || {})
      .supportedInterfaces || {});
  return interfaces[interfaceName] !== null && interfaces[interfaceName] !== undefined;
}
function supportsAPL(handlerInput) {
  return supportsInterface(handlerInput, 'Alexa.Presentation.APL');
}

// core functionality for fact skill
const GetNewFactHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    // checks request type
    return request.type === 'LaunchRequest'
      || (request.type === 'IntentRequest'
        && request.intent.name === 'GetNewFactIntent');
  },
  async handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const randomObj = requestAttributes.t('FACTS');
    const randomFact = randomObj.fact;
    const factImage = randomObj.url;
    console.log('Fact: ' + randomFact);

    // Set up the audio response
    const speakOutput = "The next bin is " + await getNextBinType();

    if (supportsAPL(handlerInput))
    {
      return handlerInput.responseBuilder
      .speak(speakOutput)
      .addDirective({
        "type": "Alexa.Presentation.APL.RenderDocument",
        "token": "documentToken",
        "document": require('./aplDocument.json'),
        "datasources": {
          "data": {
              "properties": {
                  "factImage": factImage,
                  "factString": randomFact
              }
          }
      },
        "sources":{}
      })
      .withSimpleCard(requestAttributes.t('SKILL_NAME'), randomFact)
      .getResponse();
    }

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .withSimpleCard(requestAttributes.t('SKILL_NAME'), randomFact)
      .getResponse();
  },
};

const HelpHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    return handlerInput.responseBuilder
      .speak(requestAttributes.t('HELP_MESSAGE'))
      .reprompt(requestAttributes.t('HELP_REPROMPT'))
      .getResponse();
  },
};

const FallbackHandler = {
  // The FallbackIntent can only be sent in those locales which support it,
  // so this handler will always be skipped in locales where it is not supported.
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && request.intent.name === 'AMAZON.FallbackIntent';
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    return handlerInput.responseBuilder
      .speak(requestAttributes.t('FALLBACK_MESSAGE'))
      .reprompt(requestAttributes.t('FALLBACK_REPROMPT'))
      .getResponse();
  },
};

const ExitHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && (request.intent.name === 'AMAZON.CancelIntent'
        || request.intent.name === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    return handlerInput.responseBuilder
      .speak(requestAttributes.t('STOP_MESSAGE'))
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);
    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`);
    console.log(`Error stack: ${error.stack}`);
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    return handlerInput.responseBuilder
      .speak(requestAttributes.t('ERROR_MESSAGE'))
      .reprompt(requestAttributes.t('ERROR_MESSAGE'))
      .getResponse();
  },
};

const LocalizationInterceptor = {
  
  process(handlerInput) {
    // Gets the locale from the request and initializes i18next.
    const localizationClient = i18n.init({
      lng: handlerInput.requestEnvelope.request.locale,
      resources: languageStrings,
      returnObjects: true
    });
    
    // Creates a localize function to support arguments.
    localizationClient.localize = function localize() {
      // gets arguments through and passes them to
      // i18next using sprintf to replace string placeholders
      // with arguments.
      const args = arguments;
      const value = i18n.t(...args);
        
      if (Array.isArray(value)) {
        return getNextBinType()
              .then(function(binType) {
                var binIndex = (binType == 'organic') ? 1 : 0;  
                console.log("value [" + binIndex + "]");
                console.log("Type: " + binType);         
                console.log("ans: " + value[binIndex].toString());
                // selectedVocal = {
                //   "fact": 'Hello', //value[binIndex].toString(),
                //   "url" : planetURLs[0]
                // };
                return 'Hello';
        })
        .catch(function(error) {console.log("ERROR:" + error)});
      }
      
      return 'Can not determine bin type';
    };
      
    // this gets the request attributes and save the localize function inside
    // it to be used in a handler by calling requestAttributes.t(STRING_ID, [args...])
    const attributes = handlerInput.attributesManager.getRequestAttributes();
    attributes.t = function translate(...args) {
      var myObj = localizationClient.localize(...args);
      console.log('AAA: ' + myObj);
      return myObj;
    };
  }
};

const skillBuilder = Alexa.SkillBuilders.custom();

exports.handler = skillBuilder
  .addRequestHandlers(
    GetNewFactHandler,
    HelpHandler,
    ExitHandler,
    FallbackHandler,
    SessionEndedRequestHandler,
  )
  .addRequestInterceptors(LocalizationInterceptor)
  .addErrorHandlers(ErrorHandler)
  .withCustomUserAgent('sample/basic-fact/v2')
  .lambda();


const deData = {
  translation: {
    SKILL_NAME: 'Weltraumwissen',
    GET_FACT_MESSAGE: 'Hier sind deine Fakten: ',
    HELP_MESSAGE: 'Du kannst sagen, „Nenne mir einen Fakt über den Weltraum“, oder du kannst „Beenden“ sagen... Wie kann ich dir helfen?',
    HELP_REPROMPT: 'Wie kann ich dir helfen?',
    FALLBACK_MESSAGE: 'Die Weltraumfakten Skill kann dir dabei nicht helfen. Sie kann dir Fakten über den Raum erzählen, wenn du dannach fragst.',
    FALLBACK_REPROMPT: 'Wie kann ich dir helfen?',
    ERROR_MESSAGE: 'Es ist ein Fehler aufgetreten.',
    STOP_MESSAGE: 'Auf Wiedersehen!',
    FACTS:
      [
         '<audio src=\"https://alexagarbagebinassets.s3-ap-southeast-2.amazonaws.com/1cba66cb-bf24-4c60-9ebc-8e9ddb9ac2e6.mp3\" />',
         '<audio src=\"https://alexagarbagebinassets.s3-ap-southeast-2.amazonaws.com/d4537e93-2e21-42bc-b7c3-4a3ed48d6a16.mp3\" />',
      ],
  },
};

const dedeData = {
  translation: {
    SKILL_NAME: 'Weltraumwissen auf Deutsch',
  },
};

const enData = {
  translation: {
    SKILL_NAME: 'Space Facts',
    GET_FACT_MESSAGE: '',
    HELP_MESSAGE: 'You can say tell me a space fact, or, you can say exit... What can I help you with?',
    HELP_REPROMPT: 'What can I help you with?',
    FALLBACK_MESSAGE: 'The Space Facts skill can\'t help you with that.  It can help you discover facts about space if you say tell me a space fact. What can I help you with?',
    FALLBACK_REPROMPT: 'What can I help you with?',
    ERROR_MESSAGE: 'Sorry, an error occurred.',
    STOP_MESSAGE: 'Goodbye!',
    FACTS:
      [
        'The next bin is recycle',
        'The next bin is garden',
        '<audio src=\"https://alexagarbagebinassets.s3-ap-southeast-2.amazonaws.com/Ollie_Garden.mp3\" />',
        '<audio src=\"https://alexagarbagebinassets.s3-ap-southeast-2.amazonaws.com/Ollie_Recycle.mp3\" />',
      ],
  },
};

const enauData = {
  translation: {
    SKILL_NAME: 'Australian Space Facts',
  },
};

const encaData = {
  translation: {
    SKILL_NAME: 'Canadian Space Facts',
  },
};

const engbData = {
  translation: {
    SKILL_NAME: 'British Space Facts',
  },
};

const eninData = {
  translation: {
    SKILL_NAME: 'Indian Space Facts',
  },
};

const enusData = {
  translation: {
    SKILL_NAME: 'American Space Facts',
  },
};

const esData = {
  translation: {
    SKILL_NAME: 'Curiosidades del Espacio',
    GET_FACT_MESSAGE: 'Aquí está tu curiosidad: ',
    HELP_MESSAGE: 'Puedes decir dime una curiosidad del espacio o puedes decir salir... Cómo te puedo ayudar?',
    HELP_REPROMPT: 'Como te puedo ayudar?',
    FALLBACK_MESSAGE: 'La skill Curiosidades del Espacio no te puede ayudar con eso.  Te puede ayudar a descubrir curiosidades sobre el espacio si dices dime una curiosidad del espacio. Como te puedo ayudar?',
    FALLBACK_REPROMPT: 'Como te puedo ayudar?',
    ERROR_MESSAGE: 'Lo sentimos, se ha producido un error.',
    STOP_MESSAGE: 'Adiós!',
    FACTS:
        [
        '<audio src=\"https://alexagarbagebinassets.s3-ap-southeast-2.amazonaws.com/Ollie_Recycle.mp3\" />',
        '<audio src=\"https://alexagarbagebinassets.s3-ap-southeast-2.amazonaws.com/Ollie_Garden.mp3\" />',
        ],
  },
};

const esesData = {
  translation: {
    SKILL_NAME: 'Curiosidades del Espacio para España',
  },
};

const esmxData = {
  translation: {
    SKILL_NAME: 'Curiosidades del Espacio para México',
  },
};

const esusData = {
  translation: {
    SKILL_NAME: 'Curiosidades del Espacio para Estados Unidos',
  },
};

const frData = {
  translation: {
    SKILL_NAME: 'Anecdotes de l\'Espace',
    GET_FACT_MESSAGE: 'Voici votre anecdote : ',
    HELP_MESSAGE: 'Vous pouvez dire donne-moi une anecdote, ou, vous pouvez dire stop... Comment puis-je vous aider?',
    HELP_REPROMPT: 'Comment puis-je vous aider?',
    FALLBACK_MESSAGE: 'La skill des anecdotes de l\'espace ne peux vous aider avec cela. Je peux vous aider à découvrir des anecdotes sur l\'espace si vous dites par exemple, donne-moi une anecdote. Comment puis-je vous aider?',
    FALLBACK_REPROMPT: 'Comment puis-je vous aider?',
    ERROR_MESSAGE: 'Désolé, une erreur est survenue.',
    STOP_MESSAGE: 'Au revoir!',
    FACTS:
        [
        '<audio src=\"https://alexagarbagebinassets.s3-ap-southeast-2.amazonaws.com/Ollie_Recycle.mp3\" />',
        '<audio src=\"https://alexagarbagebinassets.s3-ap-southeast-2.amazonaws.com/Ollie_Garden.mp3\" />',
        ],
  },
};

const frfrData = {
  translation: {
    SKILL_NAME: 'Anecdotes françaises de l\'espace',
  },
};

const frcaData = {
  translation: {
    SKILL_NAME: 'Anecdotes canadiennes de l\'espace',
  },
};

const hiData = {
  translation: {
    SKILL_NAME: 'अंतरिक्ष facts',
    GET_FACT_MESSAGE: 'ये लीजिए आपका fact: ',
    HELP_MESSAGE: 'आप मुझे नया fact सुनाओ बोल सकते हैं या फिर exit भी बोल सकते हैं... आप क्या करना चाहेंगे?',
    HELP_REPROMPT: 'मैं आपकी किस प्रकार से सहायता कर सकती हूँ?',
    ERROR_MESSAGE: 'सॉरी, मैं वो समज नहीं पायी. क्या आप repeat कर सकते हैं?',
    STOP_MESSAGE: 'अच्छा bye, फिर मिलते हैं',
    FACTS:
      [
        'बुध गृह में एक साल में केवल अठासी दिन होते हैं',
        'सूरज से दूर होने के बावजूद, Venus का तापमान Mercury से ज़्यादा होता हैं',
        'Earth के तुलना से Mars में सूरज का size तक़रीबन आधा हैं',
        'सारे ग्रहों में Jupiter का दिन सबसे कम हैं',
        'सूरज का shape एकदम गेंद आकार में हैं'
      ],
  },
};

const hiinData = {
  translation: {
    SKILL_NAME: 'अंतरिक्ष फ़ैक्ट्स',
  },
}

const itData = {
  translation: {
    SKILL_NAME: 'Aneddoti dallo spazio',
    GET_FACT_MESSAGE: 'Ecco il tuo aneddoto: ',
    HELP_MESSAGE: 'Puoi chiedermi un aneddoto dallo spazio o puoi chiudermi dicendo "esci"... Come posso aiutarti?',
    HELP_REPROMPT: 'Come posso aiutarti?',
    FALLBACK_MESSAGE: 'Non posso aiutarti con questo. Posso aiutarti a scoprire fatti e aneddoti sullo spazio, basta che mi chiedi di dirti un aneddoto. Come posso aiutarti?',
    FALLBACK_REPROMPT: 'Come posso aiutarti?',
    ERROR_MESSAGE: 'Spiacenti, si è verificato un errore.',
    STOP_MESSAGE: 'A presto!',
    FACTS:
      [
        'Sul pianeta Mercurio, un anno dura solamente 88 giorni.',
        'Pur essendo più lontana dal Sole, Venere ha temperature più alte di Mercurio.',
        'Su Marte il sole appare grande la metà che su la terra. ',
        'Tra tutti i pianeti del sistema solare, la giornata più corta è su Giove.',
        'Il Sole è quasi una sfera perfetta.',
      ],
  },
};

const ititData = {
  translation: {
    SKILL_NAME: 'Aneddoti dallo spazio',
  },
};

const jpData = {
  translation: {
    SKILL_NAME: '日本語版豆知識',
    GET_FACT_MESSAGE: '知ってましたか？',
    HELP_MESSAGE: '豆知識を聞きたい時は「豆知識」と、終わりたい時は「おしまい」と言ってください。どうしますか？',
    HELP_REPROMPT: 'どうしますか？',
    ERROR_MESSAGE: '申し訳ありませんが、エラーが発生しました',
    STOP_MESSAGE: 'さようなら',
    FACTS:
      [
        '水星の一年はたった88日です。',
        '金星は水星と比べて太陽より遠くにありますが、気温は水星よりも高いです。',
        '金星は反時計回りに自転しています。過去に起こった隕石の衝突が原因と言われています。',
        '火星上から見ると、太陽の大きさは地球から見た場合の約半分に見えます。',
        '木星の<sub alias="いちにち">1日</sub>は全惑星の中で一番短いです。',
        '天の川銀河は約50億年後にアンドロメダ星雲と衝突します。',
      ],
  },
};

const jpjpData = {
  translation: {
    SKILL_NAME: '日本語版豆知識',
  },
};

const ptbrData = {
  translation: {
    SKILL_NAME: 'Fatos Espaciais',
  },
};

const ptData = {
  translation: {
    SKILL_NAME: 'Fatos Espaciais',
    GET_FACT_MESSAGE: 'Aqui vai: ',
    HELP_MESSAGE: 'Você pode me perguntar por um fato interessante sobre o espaço, ou, fexar a skill. Como posso ajudar?',
    HELP_REPROMPT: 'O que vai ser?',
    FALLBACK_MESSAGE: 'A skill fatos espaciais não tem uma resposta para isso. Ela pode contar informações interessantes sobre o espaço, é só perguntar. Como posso ajudar?',
    FALLBACK_REPROMPT: 'Eu posso contar fatos sobre o espaço. Como posso ajudar?',
    ERROR_MESSAGE: 'Desculpa, algo deu errado.',
    STOP_MESSAGE: 'Tchau!',
    FACTS:
      [
        'Um ano em Mercúrio só dura 88 dias.',
        'Apesar de ser mais distante do sol, Venus é mais quente que Mercúrio.',
        'Visto de marte, o sol parece ser metade to tamanho que nós vemos da terra.',
        'Júpiter tem os dias mais curtos entre os planetas no nosso sistema solar.',
        'O sol é quase uma esfera perfeita.',
      ],
  },
};

const arsaData = {
  translation: {
   SKILL_NAME: 'حقائق عن الفضاء',
  },
};

const arData = {
  translation: {
    SKILL_NAME: 'حقائق عن الفضاء',
    GET_FACT_MESSAGE: 'المعلومة اليوم هي: ',
    HELP_MESSAGE: 'تقدر تقول أحكي لي معلومة عن الفضاء أو تقدر تقول خلاص للخروج من اللعبة. كيف ممكن أساعدك؟',
    HELP_REPROMPT: 'كيف أقدر أساعدك؟',
    FALLBACK_MESSAGE: 'لا يمكن لهذه المهارة المساعدة الآن. سوف تعطيك حقائق عن الفضاء معلومات مذهلة عن الفضاء إذا قلت أعطيني معلومة عن الفضاء. كيف أقدر أساعدك؟',
		FALLBACK_REPROMPT: 'كيف أقدر أساعدك؟',
    ERROR_MESSAGE: 'أعتذر، حدث خطأ.',
    STOP_MESSAGE: 'مع السلامة',
    FACTS:
      [
        'عدد أيام السنة على عطارد هو 88 يوم فقط.',
        'على الرغم من كون كوكب الزهرة بعيد عن الشمس، إلا أنه يعاني من درجات حرارة أعلى من تلك على عطارد.',
        'على سطح المريخ، تظهر الشمس حوالي نصف الحجم الذي نراه من سطح الأرض.',
        'كوكب المشتري لديه أقصر يوم بين جميع الكواكب.',
        'يكاد يكون شكل الشمس كرة مثالية.',
      ],
  },
};

// constructs i18n and l10n data structure
const languageStrings = {
  'de': deData,
  'de-DE': dedeData,
  'en': enData,
  'en-AU': enauData,
  'en-CA': encaData,
  'en-GB': engbData,
  'en-IN': eninData,
  'en-US': enusData,
  'es': esData,
  'es-ES': esesData,
  'es-MX': esmxData,
  'es-US': esusData,
  'fr': frData,
  'fr-FR': frfrData,
  'fr-CA': frcaData,
  'hi': hiData,
  'hi-IN': hiinData,
  'it': itData,
  'it-IT': ititData,
  'ja': jpData,
  'ja-JP': jpjpData,
  'pt': ptData,
  'pt-BR': ptbrData,
  'ar': arData,
  'ar-SA': arsaData,
};
