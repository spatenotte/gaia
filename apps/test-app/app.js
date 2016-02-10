'use strict';

console.log("Opened app");
navigator.mozSetMessageHandler('privacy-request-notification', message => {
	dump('Received message: ' + JSON.stringify(message));
});

window.addEventListener("load", function() {
  //writeToIndexedDB("Test", "contacts", "dhdolg");
  //writeToIndexedDB("Test2", "geolocation", "dhdolg");
  //writeToIndexedDB("Test3", "contacts", "dhdolg");
  //writeToIndexedDB("Test4", "sms", "dhdolg");
  //readFromIndexedDB();
  //console.log("Setting up handler");
});

function getContact() {
  console.log('Clicked getContacts');
  var allContacts = navigator.mozContacts
    .getAll({
      sortBy: 'familyName',
      sortOrder: 'descending'
    });
  //console.log(allContacts);

  //   allContacts.onsuccess = function(event) {
  //     var cursor = event.target;
  //     if (cursor.result) {
  //       console.log('Found: ' + cursor.result.givenName[0] + ' '
  //                             + cursor.result.familyName[0]);
  //       cursor.continue();
  //     } else {
  //       console.log('No more contacts');
  //     }
  //   };

  //   allContacts.onerror = function() {
  //     console.warn('Something went terribly wrong! :(');
  //   }
}

function getGeoloc() {
  var options = {
    enableHighAccuracy: true,
    timeout: 5000,
    maximumAge: 0
  };
  console.log('testing for loop request access');
  try {
    navigator.geolocation.getCurrentPosition(success, error, options);
  }
  catch(err) {
      console.log('Error: ' + err);
  }
}

function success(pos) {
  var crd = pos.coords;

  console.log('Your current position is:');
  console.log('Latitude : ' + crd.latitude);
  console.log('Longitude: ' + crd.longitude);
  console.log('More or less ' + crd.accuracy + ' meters.');
}

function error(err) {
  console.warn('ERROR(' + err.code + '): ' + err.message);
}



function getAudio() {
  console.log('Clicked getAudio');
  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false
  });
}

// function getCamera() {
//   console.log('Clicked getCamera');
//   navigator.mozCamera.getCamera();
// }

function getMusic() {
  console.log('Clicked getMusic');
  navigator.getDeviceStorage('music').freeSpace();
}

function getPictures() {
  console.log('Clicked getPictures');
  navigator.getDeviceStorage('pictures').freeSpace();
}

function getSdcard() {
  console.log('Clicked getSdcard');
  navigator.getDeviceStorage('sdcard').freeSpace();
}

function getVideos() {
  console.log('Clicked getVideos');
  navigator.getDeviceStorage('videos').freeSpace();
}

function getVideoCap() {
  console.log('Clicked getVideoCap');
  navigator.mediaDevices.getUserMedia({
    audio: false,
    video: true
  });
}

function getMobileID() {
  console.log('Clicked getMobileID');
  navigator.getMobileIdAssertion();
}

// requesting some services after a set interval - to see
// if the app does it in the app ground.

function loopGeoRequest() {
  // console.log('Button clicked to request access to different
  // services continously, to see if the app logs the'
  // + 'data to indexedDB - so we know if the app runs
  // in background');
  setInterval(getGeoloc, 10000);
}


function loopContactRequest() {
  // console.log('Button clicked to request access
  // to different services continously, to see if the app logs the'
  // +'data to indexedDB - so we know if the app runs in background');
  setInterval(getContact, 15000);
}

// to access indexedDB
function showIndexedDB() {
  var db = navigator.privacyMonitor.readIndexedDB();
  var data = db.transaction(['entries'], 'readwrite')
    .objectStore('entries').getAll();
  data.onsuccess = function(event) {
    console.log(data);
  };
}

function writeToIndexedDB(name, permission, date) {
  console.log("Entered indexedDB");
  let request = indexedDB.open("permissionLog", 1);
  var db;

  request.onerror = function(event) {
    console.log("error opening DB ");
  };

  request.onsuccess = function(event) {
    db = event.target.result;
    console.log("success opening DB");
    var write = db.transaction(["entries"], "readwrite")
      .objectStore("entries")
      .add({
        name: name,
        permission: permission,
        date: date
      });

    write.onerror = function(event) {
      console.log("error writing to DB");
    };

    write.onsuccess = function(event) {
      console.log("success writing to DB");
    };

    db.close();
  };

  request.onupgradeneeded = function(event) {
    db = event.target.result;
    var objectStore = db.createObjectStore("entries", {
      autoIncrement: true
    });
    objectStore.createIndex("name", "name", {
      unique: false
    });
    objectStore.createIndex("permission", "permission", {
      unique: false
    });
    objectStore.createIndex("date", "date", {
      unique: false
    });
  }
}

function readFromIndexedDB() {

  console.log("Entered indexedDB");
  let request = indexedDB.open("permissionLog", 1);
  var db;

  request.onerror = function(event) {
    console.log("error opening DB ");
  };

  request.onsuccess = function(event) {
    db = event.target.result;
    console.log("success opening DB");
    var write = db.transaction(["entries"], "readwrite")
      .objectStore("entries");

    // open a cursor to retrieve all items from the 'notes' store
    write.openCursor().onsuccess = function(e) {
      var cursor = e.target.result;
      if (cursor) {
        var value = cursor.value;

        console.log(value.name + " accessing " + value.permission);

        // move to the next item in the cursor
        cursor.continue();
      }
      db.close();
    };
  };
}

document.getElementById('contactsButton')
  .addEventListener('click', getContact);
document.getElementById('geolocButton')
  .addEventListener('click', getGeoloc);
document.getElementById('audioCapButton')
  .addEventListener('click', getAudio);
//document.getElementById('cameraButton')
//  .addEventListener('click', getCamera);
document.getElementById('musicButton')
  .addEventListener('click', getMusic);
document.getElementById('picturesButton')
  .addEventListener('click', getPictures);
document.getElementById('sdcardButton')
  .addEventListener('click', getSdcard);
document.getElementById('videosButton')
  .addEventListener('click', getVideos);
document.getElementById('videoCapButton')
  .addEventListener('click', getVideoCap);
document.getElementById('mobileIDButton')
  .addEventListener('click', getMobileID);
document.getElementById('indexedDBButton')
  .addEventListener('click', showIndexedDB);
document.getElementById('loopGeolocButton')
  .addEventListener('click', loopGeoRequest);
document.getElementById('loopContactButton')
  .addEventListener('click', loopContactRequest);
