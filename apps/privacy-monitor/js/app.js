// for side nav (drawer)
var sidebarBox = document.querySelector('#box');
var sidebarBtn = document.querySelector('#btn');
var pageWrapper = document.querySelector('#main');

sidebarBtn.addEventListener('click', function(event) {

  if (this.classList.contains('active')) {
      this.classList.remove('active');
      sidebarBox.classList.remove('active');
  } else {
      this.classList.add('active');
      sidebarBox.classList.add('active');
  }
});

pageWrapper.addEventListener('click', function(event) {

  if (sidebarBox.classList.contains('active')) {
      sidebarBtn.classList.remove('active');
      sidebarBox.classList.remove('active');
  }
});

window.addEventListener('keydown', function(event) {

  if (sidebarBox.classList.contains('active') && event.keyCode === 27) {
      sidebarBtn.classList.remove('active');
      sidebarBox.classList.remove('active');
  }
});


// -------------------------------------------------------------


// to make sure Angular JS works in Firefox OS 
var privacyApp = angular.module( 'privacyApp', ['ngRoute','ngdexie', 'ngdexie.ui', 'angular-chartist'] ).config(['$compileProvider', function($compileProvider) {
        $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|app):/);
        $compileProvider.imgSrcSanitizationWhitelist(/^\s*(https?|ftp|mailto|app):/);
    }
]);


privacyApp.factory("appsList", function(){

  var appsListJSON = {};

  var promise = new Promise(function(resolve, reject) {
        var mozApps = window.navigator.mozApps;
        var mozAppsMgmt = mozApps && mozApps.mgmt;
        var req = mozAppsMgmt.getAll();

        req.onsuccess = function success(evt) {
            resolve(evt.target.result);
        };
        
        req.onerror = function error(evt) {
            console.log('Failed to get the list of installed apps');
            reject(req.error);
        };
  });

  var updateAppsList = function(newList){
    appsListJSON = newList;
  }

  return {appsPromise:promise, appsListJSON:appsListJSON, updateAppsList:updateAppsList};

});



// -------------- ROUTES -------------- // 

    // configure the routes here
    privacyApp.config(function($routeProvider, ngDexieProvider) {
        

      // Setup the database 
      ngDexieProvider.setOptions({name: 'fxos', debug: false});

      ngDexieProvider.setConfiguration(function (db) {
            db.version(1.8).stores({
                perms: "++id,appname,permission,timestamp",
                defaults: "++id, appname,permission,limiter,timestamp,[appname+permission]"
            });
            
            db.on('error', function (err) {
                // to catch all uncatched DB-related errors and exceptions
                console.error("db error err=" + err);
            });

      });
      

// Setup all routes     

        $routeProvider

            // route for the home page
            .when('/', {
                templateUrl : 'pages/home.html',
                controller  : 'mainController'
            })

            // route for the installed apps page
            .when('/apps', {
                templateUrl : 'pages/apps.html',
                controller  : 'appsController'
            })

            // route for the app permissions page
            .when('/app-detail/:appname', {
                templateUrl : 'pages/permissions.html',
                controller  : 'permController'
            })

            // route for the app permissions page
            .when('/access-info/:appid?', {
                templateUrl : 'pages/access-info.html',
                controller  : 'accessController'
            })
            
            // route for the app access frequncy page
            .when('/frequency/:app_id/:service_id', {
                templateUrl : 'pages/frequency.html',
                controller  : 'frequencyController'
            })
            
            // route for the app access frequncy page
            .when('/chart/:app_id/:service_id', {
                templateUrl : 'pages/chart.html',
                controller  : 'frequencyController'
            })
        

            // routes for all static side nav setting pages using one controller         
            .when('/how-it-works', { templateUrl : 'static/how.html', controller  : 'staticController' })
            .when('/defaults', { templateUrl : 'static/defaults.html', controller  : 'staticController' })
            .when('/faq', { templateUrl : 'static/faq.html', controller  : 'staticController' })
            .when('/terms-of-use', { templateUrl : 'static/terms-of-use.html', controller  : 'staticController' })
            .when('/policy', { templateUrl : 'static/privacy-policy.html', controller  : 'staticController' })
            .when('/contact-us', { templateUrl : 'static/contact.html', controller  : 'staticController' })
            .when('/about', { templateUrl : 'static/about.html', controller  : 'staticController' })
               
    });

// ----------- CONTROLLERS with their Functionality here ------------ //

    //   -------  static pages controllers   
    privacyApp.controller("staticController", function(){

      sidebarBtn.classList.remove('active');
      sidebarBox.classList.remove('active');

    });


    // -------- main controller for the landing page of the app
    privacyApp.controller("mainController", function($scope, ngDexie, appsList){

                  $scope.perms = [];
                  
                // code to insert sample data with accurate information 
                //    for(samp of samples){ // loop through sample data
                      
                //      ngDexie.put('perms', samp).then(function(){
                //           console.log(samp);
                //      });  
                       
                //    }
                     
                // skipping certified apps & building list of apps 
                var appJSON = {};
                appsList.appsPromise.then(function(data){
                    var items = "";
                    for(var i=0;i<data.length;i++){
                    
                    if(data[i].manifest.type !== "certified"){
                        appJSON[data[i].manifest.name] = data[i].manifest;
                    }
                    }

                    appsList.appsListJSON = appJSON;
                });

                  // to add more boxes onto the home screen
                  var home_permissions = [

                                          "Contacts", 
                                          "Geolocation", 
                                          "MobileID",
                                          "Device-Storage:Pictures",
                                          "Device-Storage:Videos",
                                          "Device-Storage:SDCard",
                                          "Audio-Capture", 
                                          "Video-Capture",

                  ];

                  // to display info in home screen boxes
                  $scope.getPermCounts = function(p){

                    ngDexie.getDb()
                           .perms.where("permission")
                           .equalsIgnoreCase(p)
                           .count(function(count) {

                               $scope.$apply(function(){
                                  $scope.perms.push({name:p, counter:count});
                               }); 

                    });
                  }

                  // couting the number of times the permission was accessed (by all the apps)
                  for(p of home_permissions){
                    $scope.getPermCounts(p);     
                  }
                  
        
        
        
        
                  // setup permission access listener 
                  
                    function logMessage(message){
                         
                        
                        // display message  
//                         console.log("Message Received:");
//                         console.log(message);
                        
                        // insert this message object into database
                        ngDexie.put("perms",{
                                appname:message.appname,
                                permission:message.permission,
                                timestamp: Math.floor(message.timestamp/1000)
                        }).then(function(){
                            // verify if stored 
                            console.log("Permission Request Logged");
                        });
                        
                        
                        // get limit for this permision and app (notification purpose)
                        ngDexie.getDb().defaults
                            .where("[appname+permission]")
                            .equals([message.appname, message.permission])
                            .toArray(function(record){
                            
                            console.log(record);
                            
                            if(record.length > 0){
                                
                                var limitObj = record[0];
                                console.log(limitObj.limiter);
                                
                                // count the records for notification 
                                ngDexie.getDb().perms
                                .where("appname")
                                .equalsIgnoreCase(message.appname)
                                .toArray(function(records){
                                    
                                    var matched_records = [];
                                    
                                    console.log("Records Response");
                                    console.log(records);
                                    
                                    if(records.length > 0){
                                        
                                        var hour_limit = Math.floor(Date.now() / 1000) - 60*60; 
                                        
                                        for(rec of records){
                                            if((parseInt(rec.timestamp) > hour_limit)&&(rec.permission == message.permission))
                                                matched_records.push(rec);
                                        }
                                        
                                        console.log(matched_records);
                                        
                                        if(matched_records.length > limitObj.limiter){
                                            
                                            // send notification 
                                            var notification = new Notification("Permission:"+message.permission+" exceeded # calls for "+message.appname);
                                            
                                        }
                                        
                                    }
                                    
                                }); 
                                
                            }
                                
                        });
                        
                    }
                    
                    // listener for the app
                    navigator.mozSetMessageHandler("privacy-request-notification", logMessage);
                  
//                     logMessage({
//                         appname:"LINE",
//                         permission:"contacts",
//                         timestamp:1455211638 
//                     });
                  
    });





    
    // -------- controller for the installed apps list page
    privacyApp.controller("appsController", function($scope, appsList){

          $scope.apps = appsList.appsListJSON; 
          console.log(appsList.appsListJSON);
          
          sidebarBtn.classList.remove('active');
          sidebarBox.classList.remove('active');

    });
   


    // ---------- controller for displaying the list of services that an app have access to
    privacyApp.controller('accessController',  function($scope,$routeParams, appsList, ngDexie) {
        
        // populate the apps list for drop down
        $scope.apps = appsList.appsListJSON;
        console.log($scope.apps);
        
        $scope.selectedApp = "";
        $scope.appServices = [];
        $scope.appid = $routeParams.appid;

        // create a function to query data for specific app
        $scope.getServices = function(appname){

          // update current appName and prepare emply array
          $scope.selectedApp = appname.name;  
          $scope.appServices = [];          

          ngDexie.getDb().perms.where("appname").equalsIgnoreCase(appname.name).each(function(data){

              // check for duplicates for services and remove them
              if($scope.appServices.indexOf(data.permission) == -1){  
                
                $scope.$apply(function(){
                  $scope.appServices.push(data.permission);
                });

                console.log(data.permission);
              }
          });
        }
        
       // $scope.getServices({name: $scope.appid || $scope.apps[0].name});

    });
    
    
    


    // -------  controller to show app-to-service access frequency & graph view
    privacyApp.controller('frequencyController',  function($scope, $filter, $routeParams, ngDexie) {
        

        // collect route parameters from URL 
        $scope.appid        = $routeParams.app_id;
        $scope.serviceId    = $routeParams.service_id;
        $scope.services     = {};
        $scope.weekLimit    = (new Date() / 1000) - 7*24*60*60; 
        $scope.weekData     = {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                series: [[0,0,0,0,0,0,0]]
        };
        
        $scope.respOptions = [
            ['screen and (min-width: 641px) and (max-width: 1024px)', {
                showPoint: false,
                axisX: {
                labelInterpolationFnc: function(value) {
                    // Will return Mon, Tue, Wed etc. on medium screens
                    return value.slice(0, 3);
                }
                }
            }],
            ['screen and (max-width: 640px)', {
                showLine: false,
                axisX: {
                labelInterpolationFnc: function(value) {
                    // Will return M, T, W etc. on small screens
                    return value[0];
                }
                }
            }]
        ];
        
        $scope.weekOptions = {
        fullWidth: true,
        chartPadding: {
            right: 40
        }};
        
        
       // a function to query data for specific app
        $scope.getAccesses = function(){
           
          ngDexie.getDb().perms.where("appname").equalsIgnoreCase($scope.appid).each(function(data){
              
               // check for duplicates for services and remove them
               if(data.permission === $scope.serviceId && data.timestamp > $scope.weekLimit){  
                
                // for date & day string     
                var dateStr = $filter('date')(data.timestamp * 1000, "EEEE");
                var dayStr  = $filter('date')(data.timestamp * 1000, "EEE");
                
                // update the count for corresponding day
                var dayIndex = $scope.weekData.labels.indexOf(dayStr);
                
                
                if(!$scope.services[dateStr])                
                    $scope.services[dateStr] = [];
                
                $scope.$apply(function(){
                       $scope.services[dateStr].push(data);
                       $scope.weekData.series[0][dayIndex] += 1;    
                });    
              
                console.log($scope.services);
              }
          });
        }
        
        $scope.getAccesses();

    });
    
    




    // -------- controller to manage db (like upodating the range scroller to change app defaults permissions )
    privacyApp.controller('permController', ['$scope', '$routeParams','appsList','ngDexie', function($scope, $routeParams, appsList, ngDexie) {
        
        $scope.appname = $routeParams.appname;
        
        $scope.perms = [];
        
        var permsList = appsList.appsListJSON[$scope.appname].permissions || {};    
            
        console.log(permsList);
        
        
        $scope.updateLimits = function(l){
            // if current app and current permission has a record, if yes - pull/get it. 
            ngDexie.getDb().defaults
            .where("[appname+permission]")
            .equals([$scope.appname, l])
            .toArray(function(record){
                 
                console.log(record);
                
                console.log("Processing Permission: "+ l);
                console.log(record);
                
                
                // find default limit for this permission 
                var defaultLimit =  defaultPermCount[l] || 50;
                var upsertObject = {
                        appname:$scope.appname,
                        permission:l,
                        limiter:defaultLimit,
                        timestamp: Math.floor(Date.now() / 1000)                 
                }; 
                
                
                if(record.length == 0){
                    console.log("record not found, inserting");
                    // insert a new record with default values 
                    console.log(upsertObject);
                   
                    ngDexie.getDb().defaults.add(upsertObject);
                }

                else{
                    console.log("record found :" + record);
                    
                    defaultLimit = record[0].limiter;
                    //ngDexie.getDb().defaults.put(upsertObject, record.id);
                }
                
                
                // update the record on view
                $scope.$apply(function(){
                    $scope.perms.push({permission:l, limiter:defaultLimit}); 
                });
            });
            
        }
        
        // check and insert records for each permission 
        for(a in permsList){
            
           $scope.updateLimits(a);
            
        }
        
        console.log("Defaults Table Data");
        ngDexie.getDb().defaults.toArray(function(arr){
          console.log(arr);  
        });
        
        // function to call when the value is updated from range scroller
        $scope.changeLimit = function(newLimit){
            console.log(newLimit);
            
            // to find the record 
            ngDexie.getDb().defaults
            .where("[appname+permission]")
            .equals([$scope.appname, newLimit.permission])
            .toArray(function(permArr){
                
                console.log(permArr);
                
                // to update the record with new limit 
                ngDexie.getDb().defaults.update(permArr[0].id, {limiter: newLimit.limiter}).then(function(updated){
                    if(updated)
                    console.log("Updated Record");
                });
                
                
            });
            
            
        }
        
            
    }]);
    
    