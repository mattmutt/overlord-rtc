'use strict';

document.domain = document.domain.substring(document.domain.indexOf(".")+1);

// Declare app level module which depends on views, and components
angular.module('ssueDelegate', [])

    /* service */
    .factory('ssueDelegateFactory', [function () {

        var amadeus = undefined;
        return {

			/**
			 * resolves Amadeus
			 */
            getDelegate: function () {
                // cache me
                if ( !(amadeus === undefined) ) {
                    return amadeus;
                }
                var _p = parent;
                amadeus = (_p != window) ? _p.angular.element(_p.document.querySelector("[ng-app='smartConnectionApp']")) : null;
                return amadeus;
            }

        }
    }]);
