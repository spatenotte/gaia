'use strict';

/* global TelemetryRequest, MockasyncStorage, MockNavigatorMozTelephony,
          MockNavigatorSettings, MockNavigatorMozWifiManager */

require('/shared/js/telemetry.js');
requireApp('system/test/unit/mock_asyncStorage.js');
requireApp('system/shared/test/unit/mocks/mock_navigator_moz_settings.js');
require('/shared/test/unit/mocks/mock_navigator_moz_telephony.js');
require('/shared/test/unit/mocks/mock_navigator_moz_wifi_manager.js');

const DOGFOOD_KEY = 'debug.performance_data.dogfooding';
const FAKE_STORAGE_KEY = 'my.asynch.fake';


function stubDial(self, retVal) {
  self.sinon.stub(navigator.mozTelephony, 'dial', function() {
    return Promise.resolve({
      result: Promise.resolve({
        success: true,
        serviceCode: 'scImei',
        statusMessage: retVal
      })
    });
  });
}

suite('Telemetry:', function() {
  var xhr, XHR;
  var realMozSettings, realMozTelephony, realMozWifiManager;

  suiteSetup(function () {
    realMozSettings = navigator.mozSettings;
    realMozTelephony = navigator.mozTelephony;
    realMozWifiManager = navigator.mozWifiManager;

    window.asyncStorage = MockasyncStorage;
    navigator.mozSettings = MockNavigatorSettings;
    navigator.mozTelephony = MockNavigatorMozTelephony;
    navigator.mozWifiManager = MockNavigatorMozWifiManager;

    XHR = sinon.useFakeXMLHttpRequest();
    XHR.onCreate = function (instance) {
      xhr = instance;
    };
  });

  suiteTeardown(function () {
    navigator.mozSettings = realMozSettings;
    navigator.mozTelephony = realMozTelephony;
    navigator.mozWifiManager = realMozWifiManager;
    delete window.asyncStorage;

    XHR.restore();
  });

  test('ctor required args', function() {
    var x;
    assert.throws(function() { x = new TelemetryRequest(); });
    assert.throws(function() { x = new TelemetryRequest({ deviceID: 'x' }); });
    assert.throws(function() { x = new TelemetryRequest({ reason: 'x' }); });

    assert.doesNotThrow(function() {
      x = new TelemetryRequest({ reason: 'x', deviceID: 'x' });
    });
  });

  suite('request args', function() {
    var req;
    setup(function() {
      req = new TelemetryRequest({
        deviceID: 1,
        reason: 'a reason',
        ver: 3,
        appName: '+name',
        appUpdateChannel: 'channel',
        appBuildID: 'buildID',
        appVersion: 'version',
        url: 'http://foobar'
      });
    });

    test('sets packet version', function() {
      assert.equal(req.packet.ver, 3);
    });

    test('fills info', function() {
      assert.ok(req.info);
      assert.equal(req.info.reason, 'a reason');
      assert.equal(req.info.appName, '+name');
      assert.equal(req.info.appUpdateChannel, 'channel');
      assert.equal(req.info.appVersion, 'version');
      assert.equal(req.info.appBuildID, 'buildID');
    });

    test('builds proper URL', function() {
      assert.equal(req.url,
        'http://foobar/1/a%20reason/%2Bname/version/channel/buildID');
    });
  });

  test('copies info', function() {
    var req = new TelemetryRequest({
      deviceID: 1,
      reason: 'reason'
    }, { x: '1', y: '2' });

    assert.deepEqual(req.info, req.packet.info);
    assert.equal(req.info.x, '1');
    assert.equal(req.info.y, '2');
  });

  suite('send', function() {
    var req, clock;
    setup(function() {
      req = new TelemetryRequest({
        deviceID: 1,
        reason: 'reason',
        url: 'http://foobar'
      }, { x: '1', y: '2' });

      clock = this.sinon.useFakeTimers();
    });

    test('sends proper JSON request', function() {
      req.send();

      assert.ok(xhr);
      assert.equal(xhr.method, 'POST');

      var url = new URL(xhr.url);
      assert.equal(url.protocol, 'http:');
      assert.equal(url.hostname, 'foobar');
      assert.ok(url.pathname.indexOf('/1/reason') === 0);

      var payload = JSON.parse(xhr.requestBody);
      assert.ok(payload);
      assert.deepEqual(payload, req.packet);
    });

    test('calls onload', function() {
      var loaded = sinon.spy();
      req.send({
        onload: loaded
      });

      xhr.respond(200, 'OK');
      assert.ok(loaded.called);
    });

    test('sets error callbacks', function() {
      var xhr = req.send({
        ontimeout: function(){},
        onerror: function(){},
        onabort: function(){}
      });

      assert.ok(xhr.ontimeout);
      assert.ok(xhr.onerror);
      assert.ok(xhr.onabort);
    });
  });

  suite('getDeviceID', function () {

    setup(function() {
      MockNavigatorSettings.mSetup();
    });

    teardown(function() {
      MockNavigatorSettings.mTeardown();
      MockasyncStorage.mTeardown();
    });

    test('Should reject if non-dogfooder and no stored key',
    function (done) {
      MockNavigatorSettings.mSettings[DOGFOOD_KEY] = false;

      stubDial(this, 'fake');
      TelemetryRequest.getDeviceID(FAKE_STORAGE_KEY).then(function(value) {
        assert(0); // Failure Case here.
        done();
      }).catch(function(value) {
        done();
      });
    });

    test('Should resolve if non-dogfooder and stored deviceID',
    function (done) {
      MockNavigatorSettings.mSettings[DOGFOOD_KEY] = false;
      MockasyncStorage.mItems[FAKE_STORAGE_KEY] = '123434';
      MockNavigatorSettings.mSettings['deviceinfo.mac'] = '00:0a:f5:cb:63:dc';

      stubDial(this, 'fake');
      TelemetryRequest.getDeviceID(FAKE_STORAGE_KEY).then(function(value) {
        assert.equal(value, '123434');
        done();
      }).catch(function(value) {
        assert(0); // Failure Case here.
        done();
      });
    });

    test('Should resolve to IMEI if a dogfooder and dial succeeds',
    function (done) {
      MockNavigatorSettings.mSettings[DOGFOOD_KEY] = true;
      MockasyncStorage.mItems[FAKE_STORAGE_KEY] = '123434';
      MockNavigatorSettings.mSettings['deviceinfo.mac' ] = '00:0a:f5:cb:63:dc';

      stubDial(this, 'fake');
      TelemetryRequest.getDeviceID(FAKE_STORAGE_KEY).then(function(value) {
        assert.equal(value, 'fake');
        done();
      }).catch(function(value) {
        assert(0); // Failure Case here.
        done();
      });
    });

    test('Should reject if a dogfooder and dial data fails',
    function (done) {
      this.sinon.stub(navigator.mozTelephony, 'dial', function() {
        return Promise.resolve({
          result: Promise.reject({
            success: false,
            statusMessage: 'error'
          })
        });
      });

      MockasyncStorage.mItems[FAKE_STORAGE_KEY] = '123434';
      MockNavigatorSettings.mSettings[DOGFOOD_KEY] = true;
      MockNavigatorSettings.mSettings['deviceinfo.mac'] = '00:0a:f5:cb:63:dc';

      TelemetryRequest.getDeviceID(FAKE_STORAGE_KEY).then(function(value) {
      }).catch(function(value) {
        assert.equal(value.statusMessage, 'error');
        done();
      });
    });

    test('Should hash imei with wifi mac for non dogfooder', function() {
      MockNavigatorSettings.mSettings[DOGFOOD_KEY] = false;
      MockNavigatorMozWifiManager.setMacAddress('00:0a:f5:cb:63:dc');
      // Simulate a 15 digit IMEI
      stubDial(this, '012345678901234');
      TelemetryRequest.getDeviceID().then(function(value) {
        assert.equal(value, '5E375E21');
      }).catch(function(value) {
        assert(0);
      });
    });
  });

  /*
   * Test that the getSettings() utility function works as expected.
   * This is required for proper configuration of the module and for
   * gathering the settings that are sent along with usage data.
   */
  suite('getSettings():', function() {
    suiteSetup(function() {
      TelemetryRequest.DEBUG = false; // Shut up console output in test logs
      TelemetryRequest.getSettings;

      var mockSettings = MockNavigatorSettings.mSettings;
      mockSettings.x = '1';
      mockSettings.y = '2';
    });

    test('getSettings()', function(done) {
      TelemetryRequest.getSettings({x: '3', y: '4', z: '5'}, function(result) {
        done(assert.deepEqual(result, {x: '1', y: '2', z: '5'}));
      });
    });
  });
});
