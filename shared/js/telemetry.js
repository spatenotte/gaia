'use strict';

// Utilities for sending data to the FxOS Telemetry Server
/* global asyncStorage, crypto, TextEncoder */

(function(exports) {
  const DEFAULT_URL = 'https://fxos.telemetry.mozilla.org/submit/telemetry';
  const DEFAULT_APPNAME = 'FirefoxOS';
  const UNKNOWN = 'unknown';
  const DOGFOOD_KEY = 'debug.performance_data.dogfooding';

  const TR = TelemetryRequest;

  // Set to true to enable debugging
  TR.DEBUG = false;

  // Create an XHR for the FxOS Telemetry Server.
  // Arguments:
  //   args: Telemetry arguments
  //     - reason: 'reason' URL field (i.e 'ftu' or 'appusage'. required)
  //     - deviceID: unique ID tied to the device or request (required)
  //     - url: base URL for the telemetry server
  //            (default: https://fxos.telemetry.mozilla.org/submit/telemetry)
  //     - ver: Payload version (default: 1)
  //     - appName: appName URL field (default: FirefoxOS)
  //     - appUpdateChannel: update channel URL field (default: 'unknown')
  //     - appBuildID: buildID URL field (default 'unknown')
  //     - appVersion: app version URL field (default 'unknown')
  //   info: Arbitrary JSON serializable data that will be recorded by Telemetry
  function TelemetryRequest(args, info) {
    if (!args) {
      throw new Error('No arguments');
    }

    if (!args.reason) {
      throw new Error('No reason given');
    }

    if (!args.deviceID) {
      throw new Error('No deviceID given');
    }

    // clone so we don't put data into the object that was given to us
    this.info = info ? JSON.parse(JSON.stringify(info)) : {};
    this.packet = {
      ver: args.ver || 1,
      info: this.info
    };

    this.info.reason = args.reason;
    this.info.appName = args.appName || DEFAULT_APPNAME;
    this.info.appUpdateChannel = args.appUpdateChannel || UNKNOWN;
    this.info.appBuildID = args.appBuildID || UNKNOWN;
    this.info.appVersion = args.appVersion || UNKNOWN;

    var uriParts = [
      args.url || DEFAULT_URL,
      encodeURIComponent(args.deviceID),
      encodeURIComponent(this.info.reason),
      encodeURIComponent(this.info.appName),
      encodeURIComponent(this.info.appVersion),
      encodeURIComponent(this.info.appUpdateChannel),
      encodeURIComponent(this.info.appBuildID)
    ];

    this.url = uriParts.join('/');
  }

  function debug(...args) {
    if (TR.DEBUG) {
      args.unshift('[Telemetry]');
      console.log.apply(console, args);
    }
  }

  // Open and send the underlying XMLHttpRequest
  // xhrAttrs: attributes to set on the XHR
  //   - timeout: The timeout for the request
  //   - onload / onerror / onabort / ontimeout: callbacks
  TelemetryRequest.prototype.send = function(xhrAttrs) {
    var xhr = new XMLHttpRequest({ mozSystem: true, mozAnon: true });

    xhr.open('POST', this.url);
    debug(this.url);

    if (xhrAttrs && xhrAttrs.timeout) {
      xhr.timeout = xhrAttrs.timeout;
    }

    xhr.setRequestHeader('Content-type', 'application/json');
    xhr.responseType = 'text';

    var data = JSON.stringify(this.packet);
    xhr.send(data);
    debug(data);

    if (xhrAttrs) {
      xhr.onload = xhrAttrs.onload;
      xhr.onerror = xhrAttrs.onerror;
      xhr.onabort = xhrAttrs.onabort;
      xhr.ontimeout = xhrAttrs.ontimeout;
    }

    return xhr;
  };

  TelemetryRequest.getDeviceID = function(key) {
    return new Promise(function(resolve, reject) {
      if (!navigator.mozSettings) {
        reject('Invalid mozSettings');
        return;
      }

      var dogFood = navigator.mozSettings.createLock().get(DOGFOOD_KEY);
      if (!dogFood) {
        reject('Couldn\'t query ' + DOGFOOD_KEY);
        return;
      }
      dogFood.onsuccess = function onSuccess() {
        var isDogfooder = dogFood.result[DOGFOOD_KEY];
        if (!isDogfooder && typeof key !== 'undefined') {
          //return the stored uuid from the passed in key here
          asyncStorage.getItem(key, function(value) {
            if (value) {
              resolve(value);
            } else {
              reject('No deviceID found');
            }
          });
        } else {
          var dialPromise = navigator.mozTelephony.dial('*#06#', 0);
          dialPromise.then(function(call) {
            return call.result;
          }).then(function(result) {
            // Check to make sure our telephony stack is initialized and
            // has returned an imei.
            if (result && result.success && (result.serviceCode === 'scImei')) {
              return result.statusMessage;
            } else {
              reject('Unable to get IMEI');
            }
          }).then(function (imei) {
            if (isDogfooder) {
              resolve(imei);
            } else {
              return TelemetryRequest.createHash(imei);
            }
          }).then(function (hashed) {
            resolve(hashed);
          }).catch(reject);
        }
      };
    });
  };

    TelemetryRequest.createHash = function createHash(id) {
      return new Promise(function (resolve, reject) {
        var salt = new Uint8Array([44, 27, 51, 17, 55, 64, 183, 55, 37, 31, 246,
          196, 130, 73, 14, 95, 122, 241, 143, 18, 40, 109,
          238, 59, 168, 82, 28, 199, 177, 37, 135, 98]);
        var hexDigits = '0123456789ABCDEF';
        var ftuID = '';
        var macString = navigator.mozWifiManager.macAddress.replace(/:/g, '');
        var bytes = new TextEncoder('utf-8').encode(id + macString);
        crypto.subtle.importKey('raw', bytes, {name:'PBKDF2'},
                                false, ['deriveBits']).then(function (key) {
          return crypto.subtle.deriveBits({
            name: 'PBKDF2',
            iterations: 1000,
            salt: salt,
            hash: 'SHA-1'
          }, key, 160);
        }).then(function (digest) {
          var digestArray = new Uint8Array(digest).slice(0, 4);
          digestArray.forEach(function(value) {
            ftuID += (hexDigits[value >> 4] + hexDigits[value & 15]);
          });
          resolve(ftuID);
        });
      });
    };
  /*
   * A utility function shared between telemetry modules that is used to get
   * values for all of the specified settings. settingKeysAndDefaults is an
   * object that maps settings keys to default values. We query the value of
   * each of those settings and then create an object that maps keys to values
   * (or to the default values) and pass that object to the callback function.
   */
  TelemetryRequest.getSettings = function getSettings(settingKeysAndDefaults,
                                                      callback) {
    var pendingQueries = 0;
    var results = {};
    var lock = window.navigator.mozSettings.createLock();
    for (var key in settingKeysAndDefaults) {
      var defaultValue = settingKeysAndDefaults[key];
      query(key, defaultValue);
      pendingQueries++;
    }

    function query(key, defaultValue) {
      var request = lock.get(key);
      request.onsuccess = function() {
        var value = request.result[key];
        if (value === undefined || value === null) {
          value = defaultValue;
        }
        results[key] = value;
        pendingQueries--;
        if (pendingQueries === 0) {
          callback(results);
        }
      };
    }
  };

  exports.TelemetryRequest = TelemetryRequest;
}(window));
