define(function(require) {
  'use strict';

  var SettingsService = require('modules/settings_service');
  var SettingsPanel = require('modules/settings_panel');
  var Root = require('panels/root/root');

  var AirplaneModeItem = require('panels/root/airplane_mode_item');
  var ThemesItem = require('panels/root/themes_item');
  var AddonsItem = require('panels/root/addons_item');
  var STKItem = require('panels/root/stk_item');

  var queryRootForLowPriorityItems = function(panel) {
    // This is a map from the module name to the object taken by the constructor
    // of the module.
    return {
      'BluetoothItem': panel.querySelector('.bluetooth-desc'),
      'NFCItem': {
        nfcMenuItem: panel.querySelector('.nfc-settings'),
        nfcCheckBox: panel.querySelector('#nfc-input')
      },
      'LanguageItem': panel.querySelector('.language-desc'),
      'BatteryItem': panel.querySelector('.battery-desc'),
      'FindMyDeviceItem': panel.querySelector('.findmydevice-desc'),
      'StorageUSBItem': {
        mediaStorageDesc: panel.querySelector('.media-storage-desc'),
        usbStorage: panel.querySelector('#menuItem-enableStorage'),
        usbEnabledInfoBlock: panel.querySelector('.usb-desc'),
        mediaStorageSection: panel.querySelector('.media-storage-section')
      },
      'StorageAppItem': panel.querySelector('.application-storage-desc'),
      'WifiItem': panel.querySelector('#wifi-desc'),
      'ScreenLockItem': panel.querySelector('.screenLock-desc'),
      'SimSecurityItem': panel.querySelector('.simCardLock-desc')
    };
  };

  return function ctor_root_panel() {
    var root;
    var airplaneModeItem;
    var themesItem;
    var addonsItem;
    var stkItem;

    var activityDoneButton;

    var lowPriorityRoots = null;
    var initLowPriorityItemsPromise = null;
    var initLowPriorityItems = function(rootElements) {
      if (!initLowPriorityItemsPromise) {
        initLowPriorityItemsPromise = new Promise(function(resolve) {
          require(['panels/root/low_priority_items'], resolve);
        }).then(function(itemCtors) {
          var result = {};
          Object.keys(rootElements).forEach(function(name) {
            var itemCtor = itemCtors[name];
            if (itemCtor) {
              result[name] = itemCtor(rootElements[name]);
            }
          });
          return result;
        });
      }
      return initLowPriorityItemsPromise;
    };

    return SettingsPanel({
      onInit: function rp_onInit(panel) {
        root = Root();
        root.init(panel);

        airplaneModeItem =
          AirplaneModeItem(panel.querySelector('.airplaneMode-input'));
        themesItem =
          ThemesItem(panel.querySelector('.themes-section'));
        addonsItem =
          AddonsItem(panel.querySelector('#addons-section'));
        stkItem = STKItem({
          iccMainHeader: panel.querySelector('#icc-mainheader'),
          iccEntries: panel.querySelector('#icc-entries')
        });

        activityDoneButton = panel.querySelector('#activityDoneButton');
        activityDoneButton.addEventListener('click', function() {
          SettingsService.back();
        });

        // If the device supports dsds, callSettings must be changed 'href'
        // for navigating call-iccs panel first to let users choose simcard
        var mozMobileConnections = navigator.mozMobileConnections;
        if (mozMobileConnections && mozMobileConnections.length > 1) {
          var callItem = document.getElementById('menuItem-callSettings');
          callItem.setAttribute('href', '#call-iccs');
        }

        var idleObserver = {
          time: 3,
          onidle: function() {
            navigator.removeIdleObserver(idleObserver);
            lowPriorityRoots = queryRootForLowPriorityItems(panel);
            initLowPriorityItems(lowPriorityRoots).then(function(items) {
              Object.keys(items).forEach((key) => items[key].enabled = true);
            });
          }
        };
        navigator.addIdleObserver(idleObserver);
      },
      onShow: function rp_onShow(panel) {
        airplaneModeItem.enabled = true;
        themesItem.enabled = true;
        addonsItem.enabled = true;

        if (initLowPriorityItemsPromise) {
          initLowPriorityItemsPromise.then(function(items) {
            Object.keys(items).forEach((key) => items[key].enabled = true);
          });
        }
      },
      onHide: function rp_onHide() {
        themesItem.enabled = false;
        addonsItem.enabled = false;

        if (initLowPriorityItemsPromise) {
          initLowPriorityItemsPromise.then(function(items) {
            Object.keys(items).forEach((key) => items[key].enabled = false);
          });
        }
      },
      onUninit: function rp_onUninit() {
        airplaneModeItem.enabled = false;
      }
    });
  };
});
