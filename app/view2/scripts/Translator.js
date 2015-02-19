/**
 * encapsulates speech to text APIs to google supercomputers
 * @constructor
 */
function Translator () {
    this.voiceToText = function (callback, language) {
        initTranscript(callback, language);
    };

    this.speakTextUsingRobot = function (text, args) {
        args = args || {};

        if ( !args.amplitude ) args.amplitude = 100;
        if ( !args.wordgap ) args.wordgap = 0;
        if ( !args.pitch ) args.pitch = 50;
        if ( !args.speed ) args.speed = 175;

        // args.workerPath
        // args.callback

        Speaker.Speak(text, args);
    };

    this.speakTextUsingGoogleSpeaker = function (args) {
        var textToSpeak = args.textToSpeak;
        var targetLanguage = args.targetLanguage;

        textToSpeak = textToSpeak.replace(/%20| /g, '+');
        if ( textToSpeak.substr(0, 1) == ' ' || textToSpeak.substr(0, 1) == '+' ) {
            textToSpeak = textToSpeak.substr(1, textToSpeak.length-1);
        }

        var audio_url = '//translate.google.com/translate_tts?ie=UTF-8&total=1&idx=0&textlen='+textToSpeak.length+'&tl='+targetLanguage+'&q='+textToSpeak;

        if ( args.callback ) {
            args.callback(audio_url);
            //console.log("processed CB", audio_url);
        } else {
            var audio = document.createElement('audio');
            audio.src = audio_url;
            audio.autoplay = true;
            audio.play();
        }
    };

    this.translateLanguage = function (text, config) {
        config = config || {};
        var api_key = config.api_key;
        // please use your own API key; if possible
        if ( !api_key ) {
            console.error("no API key");
            return;
        }

        var newScript = document.createElement('script');
        newScript.type = 'text/javascript';

        var privateCallbackName = 'method'+(Math.random() * new Date().getTime()).toString(36).replace(/\./g, '');
        // WebService deferred handler
        window[privateCallbackName] = function (response) {
            if ( response.data && response.data.translations[0] && config.callback ) {
                config.callback(response.data.translations[0].translatedText);
            }
            if ( response.error && response.error.message == 'Daily Limit Exceeded' ) {
                config.callback('Google says, "Daily Limit Exceeded". Please try this experiment a few hours later.');
            }


            //dealloc
            delete window[privateCallbackName];
        };


        // only secure
        var source = 'https://www.googleapis.com/language/translate/v2'+'?'+
            ('key='+api_key+'&source='+(this.getGoogleLanguageRef(config.from))+'&target='+(this.getGoogleLanguageRef(config.to))+'&callback=window.'+privateCallbackName+'&q='+encodeURIComponent(text));

        newScript.src = source;
        // inject - low level
        document.getElementsByTagName('head')[0].appendChild(newScript);
    };


    this.destroy = function () {
        //console.log('terminating');
        if ( recognition ) {
            recognition.terminated = true;
            recognition.stop();
        }
        else {
            console.log('wow. no speech api obj');

        }

    };


    // simplify for a google API call
    this.getGoogleLanguageRef = function (fullISOLanguageCode) {
        var pieces = fullISOLanguageCode.split("-");
        return pieces.length && pieces.length == 2 ? pieces[0].toLowerCase() : fullISOLanguageCode;
    };


    // glob
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    var recognition;

    // W3C webspeech API
    function initTranscript (callback, language) {

        if ( recognition ) {
            // console.log('will stop...');
            recognition.stop();
        }

        recognition = new SpeechRecognition();
        recognition.lang = language || 'en';
        recognition.terminated = false;

        recognition.interimResults = false;
        recognition.continuous = true;
        //recognition.continuous = false;

        console.log('SpeechRecognition engine constructed', recognition.lang);

        recognition.onresult = function (event) {
            for (var i = event.resultIndex; i < event.results.length; ++i) {

                if ( event.results[i].isFinal == true ) {
                    var result = event.results[i].item(0);
                    // let the UI continue
                    callback(result.transcript, result.confidence);
                }
            }
        };

        recognition.onend = function () {
            // ensure object lifecycle
            if ( recognition && !recognition.terminated ) {
                // console.log("on end .. then re-init", this);
                //push to event queue
                delete recognition;
                // otherwise odd endless loops
                setTimeout(function() {  initTranscript(callback, language);},10 );
                //initTranscript(callback, language);
                // its been destroyed
            } else {
                // console.log('recog has been reaped already');
            }
        };

        recognition.onerror = function (e) {
            if ( e.type === "error" && e.error === "no-speech" ) {
                // console.error("silenced", this);
                recognition.stop();
            }
        };

        recognition.start();
    }

    // delegate to thread
    var self = this;
    self.processInWebWorker = function (args) {
        if ( !self.speakWorker && args.onWorkerFileDownloadStart ) args.onWorkerFileDownloadStart();

        var blob = URL.createObjectURL(new Blob(['importScripts("'+(args.workerPath || '//www.webrtc-experiment.com/Robot-Speaker.js')+'");this.onmessage =  function (event) {postMessage(generateSpeech(event.data.text, event.data.args));}; postMessage("worker-file-downloaded");'], {
            type: 'application/javascript'
        }));

        var worker = new Worker(blob);
        // dealloc on this webview's memory heap
        URL.revokeObjectURL(blob);
        return worker;
    };

    var Speaker = {
        Speak: function (text, args) {
            var callback = args.callback;
            var onSpeakingEnd = args.onSpeakingEnd;

            if ( !speakWorker ) {
                self.speakWorker = self.processInWebWorker(args);
            }

            var speakWorker = self.speakWorker;

            speakWorker.onmessage = function (event) {

                if ( event.data == 'worker-file-downloaded' ) {
                    console.log('Worker file is download ended!');
                    if ( args.onWorkerFileDownloadEnd ) args.onWorkerFileDownloadEnd();
                    return;
                }

                function encode64 (data) {
                    var BASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
                    var PAD = '=';
                    var ret = '';
                    var leftchar = 0;
                    var leftbits = 0;
                    for (var i = 0; i < data.length; i++) {
                        leftchar = (leftchar << 8) | data[i];
                        leftbits += 8;
                        while (leftbits >= 6) {
                            var curr = (leftchar >> (leftbits-6)) & 0x3f;
                            leftbits -= 6;
                            ret += BASE[curr];
                        }
                    }
                    if ( leftbits == 2 ) {
                        ret += BASE[(leftchar & 3) << 4];
                        ret += PAD+PAD;
                    } else if ( leftbits == 4 ) {
                        ret += BASE[(leftchar & 0xf) << 2];
                        ret += PAD;
                    }
                    return ret;
                }

                var audio_url = 'data:audio/x-wav;base64,'+encode64(event.data);

                if ( callback ) {
                    callback(audio_url);
                } else {
                    var audio = document.createElement('audio');
                    audio.onended = function () {
                        if ( onSpeakingEnd ) onSpeakingEnd();
                    };
                    audio.src = audio_url;
                    audio.play();
                }
            };

            var _args = args;
            if ( _args.onSpeakingEnd ) delete _args.onSpeakingEnd;
            if ( _args.callback ) delete _args.callback;
            if ( _args.onWorkerFileDownloadEnd ) delete _args.onWorkerFileDownloadEnd;
            if ( _args.onWorkerFileDownloadStart ) delete _args.onWorkerFileDownloadStart;

            speakWorker.postMessage({text: text, args: _args});
        }
    };

}
