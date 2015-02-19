/**
 *
 * Demo Developer
 * Matt Anderson
 * matander@cisco.com
 */
'use strict';

angular.module('myApp.view2', ['ngRoute', 'ssueDelegate', 'firebase'])

    .config(['$routeProvider', '$locationProvider', function ($routeProvider, $locationProvider) {

        //$routeProvider.when({"/backend/:type/:id"
        $routeProvider.when('/:userId/view2', {
            templateUrl: 'view2/view2.html',
            controller: 'View2Ctrl'
        });

    }])

    // for the form field - autodetect enter
    .directive('ngEnter', function () {
        return function (scope, element, attrs) {
            //element.bind("keydown keypress", function (event) {
            element.bind("keypress", function (event) {
                if ( event.which === 13 ) {
                    event.preventDefault();
                    scope.$eval(attrs.ngEnter, {'event': event});
                }
            });
        };
    })

    // set up translator tasks
    .controller('View2Ctrl', ["$scope", "$q", "$timeout", "$routeParams", "$firebase", "$http", "$sce", "ssueDelegateFactory", function ($scope, $q, $timeout, $routeParams, $firebase, $http, $sce, ssueDelegateFactory) {

        // model

        // everybody else's actionable logs
        $scope.debugChannel = document.getElementById('debug-channel');
        $scope.groupChannel = document.getElementById('group-channel');
        $scope.myChannel = document.getElementById('my-channel');
        $scope.typedInput = document.getElementById('typedInput');
        $scope.isTypedEntryFocused = false;
        // value of input
        $scope.typedEntry = null;

        // Matt's code, get your own
        $scope.APIKey = 'AIzaSyDeHF_82O76ah96tbYKL-MIPszQn0cxWZ4';
        // universal
        $scope.commonLanguage = "en-US";

        // build up token state along the way ( maintains most state )
        $scope.translationToken = null;


        // state of the record mic
        $scope.isRecordingFlag = false;


        var translator;

        // private model
        // sample information for the user
        var configUrl = ["data/profiles", [$routeParams.userId, "json"].join(".")].join("/");


        // methods, services, promises, events

        $http.get(configUrl).
            success(function (data, status, headers, config) {
                // from LDAP /
                $scope.profile = data;

                // add SCE support for unicode fields
                $scope.profileName = $sce.trustAsHtml($scope.profile.name);

                // START ~~~~~~~~~~~~
                //$scope.startSpeakingSession();
                //$timeout($scope.startSpeakingSession, 500);
            }).
            error(function (data, status, headers, config) {
                console.log('could not load', configUrl);
                // log error
            });


        // 1. activity trigger point
        $scope.startSpeakingSession = function () {

            if ( translator != null ) {
                translator.destroy();
            }

            // reset each time
            //$scope.translationToken = {};

            translator = new Translator();

            var promise = $scope.convertSpeechPromise();

            // the API will yield a token
            promise.then(function (tokenState) {

                // reset each time
                //$scope.translationToken = {};
                $scope.translationToken = tokenState;
                $scope.log('xlate', $scope.translationToken);
                // metrics gathering add data
                $scope.notifySpeechEventPersistence();


            }, function (tokenState) {

            });


        };


        // manual off
        $scope.stopSpeakingSession = function () {
            if ( translator != null ) {
                translator.destroy();
            }
        };


        // decide what text to send, either translated or manually corrected by user
        $scope.notifySpeechEventPersistence = function () {

            // determine if user was in typing mode
            if ( $scope.isTypedEntryFocused ) {
                //$scope.typedEntry =  $scope.typedInput.value;
                $scope.typedInput.value = $scope.translationToken.text

                vxUpdateElementClasses($scope.typedInput, ["updated"]);

            }

            // do not auto-submit by voice if the text input was active
            else {

                $scope.sendTranslationTokenToFirebase();
            }

            // re-entrance
            $timeout($scope.startSpeakingSession, 1);
        };


        // when the text field is submitted client side
        $scope.onTypedEntrySubmitEvent = function () {
            // constraints

            // must be something
            if ( $scope.typedInput.value.length == 0 ) {
                return;
            }

            $scope.typedEntry = $scope.typedInput.value;

            // bound check. sometimes user just TYPES no vox commands
            if ( !$scope.translationToken ) {
                $scope.translationToken = {};
            }


            // interesting to capture deltas in the processed, versus actually corrected text
            else if ( $scope.translationToken.text != $scope.typedInput.value ) {
                $scope.translationToken.originalText = $scope.translationToken.text;
            }

            $scope.translationToken.text = $scope.typedInput.value;
            $scope.sendTranslationTokenToFirebase();

            // effect
            vxUpdateElementClasses($scope.typedInput, ["sending"]);
            $scope.typedInput.value = "";
        };


        // action - persist
        $scope.sendTranslationTokenToFirebase = function () {
            // convert
            var encapsulatedToken = $scope.encapsulateFirebaseToken();
            // console.log('Fire token', encapsulatedToken);
            firebaseStream.push(encapsulatedToken);
            // long term
            firebaseStorage.push(encapsulatedToken);
            // console.log( 'f', firebaseStorage);
        };


        // wrap each firebase data structure with entitlement credentials
        $scope.encapsulateFirebaseToken = function () {

            var t = angular.copy($scope.translationToken);
            t.userId = $scope.profile.userId;
            t.language = $scope.profile.language;
            t.date = new Date().getTime();

            return t;
        };


        // transaction steps
        $scope.convertSpeechPromise = function () {

            // promise transaction
            return $q(function (resolve, reject) {

                translator.voiceToText(
                    // callback
                    function (translatedText, confidence) {

                        var token = {text: translatedText, confidence: confidence};

                        // need additional translation?
                        if ( $scope.profile.language != $scope.commonLanguage ) {


                            // ~~~~~~~~~~~~~~~ 2. convert foreign language
                            var translateTextTo = function (originalText, originalLanguage, conversionLanguage) {

                                // $scope.log('converting into: '+conversionLanguage);

                                translator.translateLanguage(originalText, {
                                    from: originalLanguage,
                                    to: conversionLanguage,
                                    api_key: $scope.APIKey,

                                    callback: function (translatedText, confidence) {
                                        token.translatedText = translatedText;
                                        token.confidence = confidence != undefined ? confidence : null;

                                        resolve(token);
                                        /*
                                         log('Using Google Translate API to speak text.'+translatedText);
                                         translator.speakTextUsingGoogleSpeaker({
                                         textToSpeak: translatedText,
                                         targetLanguage: $scope.profile.language,
                                         api_key: $scope.APIKey
                                         });
                                         */
                                    }

                                });

                            };
                            // ~~~~~~~~~~~~~~~ /convert foreign language

                            translateTextTo(translatedText, $scope.profile.language, $scope.commonLanguage);
                            //  it is all done
                        } else {
                            // resolve here.
                            resolve(token);
                        }

                    },

                    // translate to this language
                    $scope.profile.language);

                // /promise transaction
            });


        };


        $scope.$on('$destroy', function () {
            translator.destroy();
            delete window.onbeforeunload;
        });


        // unique but shared for all participants. This is a nexus point
        var firebaseSessionPath = "session";
        var firebaseStreamPath = "stream";
        var firebaseStoragePath = "metrics";

        var firebaseSession = FirebaseLocationFactory(firebaseSessionPath);
        var firebaseStream = FirebaseLocationFactory(firebaseStreamPath);
        var firebaseStorage = FirebaseLocationFactory(firebaseStoragePath);

        // $scope.log('connecting to'+firebaseURL);

        // when data is maintained in the DB
        firebaseStream.on('child_added', function (snap) {

            var data = snap.val();

            //$scope.log('original language: '+data.language);
            if ( data.userId != $scope.profile.userId ) {
                // activities of others
                $scope.logGroupEvent(data, snap);

            } else {
                // activities that current user has performed
                $scope.logMyEvent(data, snap);
                $scope.processMyCommand(data, snap);
            }


            var onComplete = function (error) {
                if ( error ) {
                    console.log('Synchronization failed');
                } else {
                    console.log('Synchronization succeeded');
                }
            };
            // clean up soon-ish
            snap.ref().remove();
        });

        // purge transient
        firebaseStream.onDisconnect().remove();
        firebaseSession.onDisconnect().remove();

        // create an AngularFire reference to the data
        /*
         var sync = $firebase(firebase);
         // download the data into a local object
         $scope.data = sync.$asObject();
         */

        // logging

        /* directive right ? */
        $scope.log = function log () {
            var li = document.createElement('DIV');
            li.innerHTML = JSON.stringify(arguments);
            $scope.debugChannel.appendChild(li);
            li.tabIndex = 0;
            //li.focus();
        };


        // 4matter
        var formatMessageBody = function (s) {
            // heuristic patterns
            // U.R.L.
            var pattern1 = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;
            s = s.replace(pattern1, "<A HREF='$1' target='newpage'>$1</A>");

            // dont spell out numbers
            var patternNum = /\bone\b/g;
            s = s.replace(patternNum, "1");

            var patternNum = /\btwo\b/g;
            s = s.replace(patternNum, "2");

            var patternNum = /\bthree\b/g;
            s = s.replace(patternNum, "3");

            var patternNum = /\bfour\b/g;
            s = s.replace(patternNum, "4");

            var patternNum = /\bfive\b/g;
            s = s.replace(patternNum, "5");

            var patternNum = /\bsix\b/g;
            s = s.replace(patternNum, "6");

            var patternNum = /\bseven\b/g;
            s = s.replace(patternNum, "7");

            var patternNum = /\beight\b/g;
            s = s.replace(patternNum, "8");

            var patternNum = /\bnine\b/g;
            s = s.replace(patternNum, "9");


            var patternNum = /\bten\b/g;
            s = s.replace(patternNum, "10");

            // vulgars
            var pattern2 = /\bbullshit\b/g;
            s = s.replace(pattern2, " ");

            // 4-6 letter vulgars -- BUSTED c0d3
            var pattern3 = /\b[a-z][\\*]{3,5}\b/g;
            s = s.replace(pattern3, " ");

            return s;
        };


        var formatDate = function (d) {
            var d = new Date(d);
            return [d.getHours() != 12 ? d.getHours() % 12 : d.getHours(), (d.getMinutes() < 10 ? "0" : "")+d.getMinutes()].join(":");
        };

        // render log records by other people
        // rendering view ( i know make directive..)
        $scope.logGroupEvent = function (data, snap) {
            var key = snap.key();
            var formattedMessageText = formatMessageBody(data.text);

            // ignore if the result is a space ( due to vulgar )
            if ( formattedMessageText == " " ) {
                return;
            }

            // DOM view
            var li = document.createElement('DIV');
            li.classList.add("messageItem");

            // mark the body as foreign language
            var isForeignLanguage = ( $scope.profile.language != data.language );


            var userImageURL = ["assets/images/profiles", [data.userId, "jpg"].join(".")].join("/");

            li.innerHTML = "<span class='dateStamp'>"+formatDate(data.date)+"</span>";
            li.innerHTML += "<span class='senderUserImage'><img src='"+(userImageURL)+"' /></span>";
            li.innerHTML += "<span class='senderUserId'>"+(data.userId)+"</span>";

            // ============ put message from sender..
            // flag if foreign
            var bodyClassStr = ["messageBody", ( isForeignLanguage ? "foreignLanguage" : "")].join(" ");
            li.innerHTML += "<span class='"+bodyClassStr+"'>"+formattedMessageText+"</span>";

            // the current user does not speak common language, English, therefore must adjust to HIS/HER own local language
            //var itemTransactionId = new Date().getTime();
            var senderXlateBodyKey = ["xlateSenderMessage", key].join("_");
            var senderXlateLocaleKey = ["xlateSenderLocale", key].join("_");


            // note, don't show translations if just something simple like numbers...!!
            //if ( data.translatedText && ( data.translatedText.toLowerCase() != data.text.toLowerCase() ) ) {
            if ( data.translatedText && ( data.translatedText.toLowerCase() != data.text.toLowerCase() ) ) {
                li.innerHTML += getTranslationHTML($scope.profile.language, data.translatedText, data.confidence);
            }

            // (route2 -async) gather the translated message of a sender if person is a "foreign" gaijin
            if ( isForeignLanguage && !data.translatedText && ( $scope.profile.language != $scope.commonLanguage ) ) {
                var translateTextTo = function (originalText, originalLanguage, conversionLanguage) {
                    translator.translateLanguage(originalText, {
                        from: originalLanguage, to: conversionLanguage, api_key: $scope.APIKey,
                        callback: function (translatedText, confidence) {
                            li.innerHTML += getTranslationHTML($scope.profile.language, translatedText, confidence);
                        }
                    });
                };
                // ~~~~~~~~~~~~~~~ /convert foreign language

                translateTextTo(data.text, data.language, $scope.profile.language);
            }


            // handles showing the final translated text if applicable
            function getTranslationHTML (toLanguageCode, toTranslationText, confidence) {
                return [
                    "<span id='"+senderXlateLocaleKey+"' class='translatedCommonLanguage'>"+toLanguageCode+"</span>",
                    "<span id='"+senderXlateBodyKey+"' class='translatedMessageBody'>"+formatMessageBody(toTranslationText)+"</span>"
                ].join("");
            }


            $scope.groupChannel.appendChild(li);
            renderMessageItem(li, "receiving");
        };


        // render log my records
        // rendering view ( i know make directive..)
        $scope.logMyEvent = function (data) {

            var formattedMessageText = formatMessageBody(data.text);

            // ignore if the result is a space ( due to vulgar )
            if ( formattedMessageText == " " ) {
                return;
            }


            var li = document.createElement('DIV');
            li.classList.add("messageItem");

            li.innerHTML = "<span class='dateStamp'>"+formatDate(data.date)+"</span>";
            li.innerHTML += "<span class='messageBody'>"+formattedMessageText+"</span>";

            if ( data.confidence ) {
                // li.innerHTML += "confidence: " + data.confidence;
            }

            $scope.myChannel.appendChild(li);
            renderMessageItem(li, "sending");
        };


        // this is the future .. everything begins HERE - perfect integration
        // ideally this
        $scope.processMyCommand = function (data, snap) {
            // alway prefix Amadeus requests with .....
            var SERVER_COMMAND = "server";

            var delegate = ssueDelegateFactory.getDelegate();
            //  must be under the observation of Amadeus!!
            if ( !delegate ) {
                return;
            }

            var rawCommand = formatMessageBody(data.text);
            rawCommand = rawCommand.replace("?", "");
            var commands = rawCommand.split(" ");

            // rule: only take server requests here
            if ( commands.shift() != SERVER_COMMAND ) {
                return;
            }

            var foreignScope = delegate.scope();

            // ------------- these examples go into a separate task..

            // toastr
            if ( commands[0] == "show" && commands[1] == "toast" ) {
                foreignScope.$apply(function () {
                    commands.shift();
                    commands.shift();


                    var toastObject = foreignScope.getToast();
                    var fnx = {
                        "success": toastObject.success,
                        "warning": toastObject.warning,
                        "error": toastObject.error,
                        "info": toastObject.info
                    };

                    var toastMessage;
                    var toastType;
                    if ( commands.length && commands[0] ) {
                        var toastType = commands.shift(); // get the type
                        toastMessage = commands.join(" ") || "...";

                        // default toast
                    } else {
                        toastType = "info";
                        toastMessage = "...";
                    }


                    fnx[toastType].apply(null, [$scope.profile.name, toastMessage]);

                });
            }

            // toastr
            if ( commands[0] == "load" && commands[1] == "library" ) {
                // discarding
                commands.shift();
                commands.shift();

                var deliverableOriginalName = commands.join(" ");
                // clone it
                var deliverableName = deliverableOriginalName.toLowerCase();

                var delegateDocument = parent.document;
                var libraryContainerNode = delegateDocument.querySelector("[tree-model='deliverables.library']");
                var possibleEntryNodeList = delegateDocument.querySelectorAll("SPAN[ssue-title]", libraryContainerNode);

                var match = null;
                for (var i = 0; i < possibleEntryNodeList.length; ++i) {
                    var item = possibleEntryNodeList.item(i);
                    var contentTitle = item.getAttribute("ssue-title").toLowerCase();

                    // strip out ' " spaces and symbolic crap
                    var patternA = /[^A-Za-z0-9]/ig;
                    contentTitle = contentTitle.replace(patternA, "");
                    deliverableName = deliverableName.replace(patternA, "");

                    // wow, if artificial intelligence were this easy :) -- so Smart
                    if ( contentTitle == deliverableName ) {
                        match = item;
                        break;
                    }

                    // / AI -- checking
                }


                    // check results
                    if ( match ) {
                        match.click();
                    }



            }

        };


        // event
        // when the record icon is started up
        $scope.onToggleRecordingEvent = function () {

            $scope.isRecordingFlag = !$scope.isRecordingFlag;


            if ( $scope.isRecordingFlag == true ) {
                $scope.startSpeakingSession();
            }
            // terminate
            else {
                $scope.stopSpeakingSession();
            }

        };


        function renderMessageItem (item, direction) {

            item.scrollIntoView();

            // viz effect
            vxUpdateElementClasses(item, ["rendered", direction]);
        }


        function FirebaseLocationFactory (path) {

            // 20150215 - Matt's firebase nexus
            var fbSecret = "zPxpp2uKJlmhmhAZCtfDT7opr4xctfTF9eHhVbI3";
            var firebaseHost = "burning-inferno-5673.firebaseio.com";
            var f = new Firebase('//'+[firebaseHost, path].join("/"));

            f.authWithCustomToken(fbSecret, function (error, authData) {
                if ( error ) {
                    console.error("trouble Login Failed!", error);
                } else {
                    // console.log("Authenticated successfully with payload:", authData);
                }
            });

            return f;
        };


        // ~~~~~~~~~~~~~ view

        // VIEW : neat way of updating view
        function vxUpdateElementClasses (dom, list, handler) {
            var delay = 300;

            // viz effect
            list.forEach(function (o) {
                dom.classList.add(o);
            });

            $timeout(function () {
                list.forEach(function (o) {
                    dom.classList.remove(o);
                });
            }, delay);

        }


    }
    ])
;


// ------------------------------------------



