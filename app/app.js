'use strict';

// Declare app level module which depends on views, and components
// load up every detail
angular.module('myApp', [
    'ngRoute',
    /* need the logical import references here */
    'myApp.view1',
    'myApp.view2',
    'myApp.view3',

    /* need phys and imports */

    'myApp.version'
]).
    config(['$routeProvider', function ($routeProvider) {
        var defaultView = "/view3";
        $routeProvider.otherwise({redirectTo: defaultView});
    }]);

