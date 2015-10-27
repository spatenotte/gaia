/* global module */
/* exported StatusBar */

'use strict';

(function(module) {

  var StatusBar = function(client) {
    this.client = client;
    this.init();
  };

  StatusBar.Selector = Object.freeze({
    'operator': '.sb-icon-operator',
    'sms': '.sb-icon-sms',
    'alarm': '.sb-icon-alarm',
    'playing': '.sb-icon-playing',
    'headphone': '.sb-icon-headphone',
    'bluetooth-headphone': '.sb-icon-bluetooth-headphone',
    'call-forwardings': '.sb-icon-call-forwarding',
    'geolocation': '.sb-icon-geolocation',
    'recording': '.sb-icon-recording',
    'mute': '.sb-icon-mute',
    'usb': '.sb-icon-usb',
    'download': '.sb-icon-download',
    'emergency-callback': '.sb-icon-emergency-callback',
    'nfc': '.sb-icon-nfc',
    'bluetooth-transfer': '.sb-icon-bluetooth-transfer',
    'bluetooth': '.sb-icon-bluetooth',
    'tethering': '.sb-icon-tethering',
    'network-activity': '.sb-icon-network-activity',
    'mobile-connection': '.sb-icon-mobile-connection',
    'wifi': '.sb-icon-wifi',
    'airplane-mode': '.sb-icon-airplane-mode',
    'battery': '.sb-icon-battery',
    'time': '.sb-icon-time',
    'debugging': '.sb-icon-debugging',

    statusbar: '#statusbar',
    statusbarIcons: '#statusbar-icons'
  });

  StatusBar.prototype = {
    kActiveIndicatorTimeout: null,
    client: null,

    get Icons() {
      return this.client.executeScript(function() {
        return window.wrappedJSObject.Statusbar.PRIORITIES;
      });
    },

    get maximizedStatusbar() {
      var statusbar = StatusBar.Selector.statusbarIcons;
      return this.client.findElement(statusbar);
    },

    showAllRunningIcons: function() {
      this.Icons.forEach(function(iconName) {
        if (this[iconName].icon) {
          this[iconName].icon.scriptWith(function(icon) {
            icon.hidden = false;
          });
        }
      }.bind(this));
    },

    isVisible: function() {
      var el = this.client.findElement(StatusBar.Selector.statusbar);
      return el.displayed() && el.location().y === 0;
    },

    waitForAppear: function() {
      this.client.waitFor(function() {
        return this.isVisible();
      }.bind(this));
    },

    waitForDisappear: function() {
      this.client.waitFor(function() {
        return !this.isVisible();
      }.bind(this));
    },

    /**
     * Change the delay value in StatusBar.
     * @param {number=} delay The new value for delay in milliseconds.
     */
    changeDelayValue: function(iconName, delay) {
      var self = this;
      delay = parseInt(delay, 10);
      delay = !isNaN(delay) ? delay : 100;
      this.client.executeScript(function(iconName, delay) {
        self.kActiveIndicatorTimeout =
          window.wrappedJSObject[iconName].protoype.kActiveIndicatorTimeout;
        window.wrappedJSObject[iconName].prototype.kActiveIndicatorTimeout =
          delay;
      }, [iconName, delay]);
    },

    /**
     * Restore the delay in StatusBar to its original value.
     */
    restoreDelayValue: function() {
      if (this.kActiveIndicatorTimeout === null) {
        return;
      }

      var self = this;
      this.client.executeScript(function() {
        window.wrappedJSObject.Statusbar.kActiveIndicatorTimeout =
          self.kActiveIndicatorTimeout;
        self.kActiveIndicatorTimeout = null;
      });
    },

    /**
     * Dispatch an event of type `eventType` from window.
     * @param {string} eventType
     */
    dispatchEvent: function(eventType) {
      this.client.executeScript(function(eventType) {
        var evt = new CustomEvent(eventType);
        window.wrappedJSObject.dispatchEvent(evt);
      }, [eventType]);
    },

    /**
     * Dispatch a `mozChromeEvent` of type `eventType` with the detail object
     * `detail` from window.
     * @param {string} eventType
     * @param {Object} detail
     */
    dispatchMozChromeEvent: function(eventType, detail) {
      detail = (detail !== undefined) ? detail : {};
      detail.type = eventType;

      this.client.executeScript(function(detail) {
        window.wrappedJSObject.Service.debug('will dispatch moz chrome event.');
        var evt = new CustomEvent('mozChromeEvent', {
          detail: detail
        });
        window.wrappedJSObject.dispatchEvent(evt);
        window.wrappedJSObject.Service.debug(' moz chrome event dispatched');
      }, [detail]);
    },

    /**
     * Initialize the helpers.
     */
    init: function() {
      var self = this;

      // Status bar icons have the following set of helpers:
      // * statusBar.alarm.icon
      //     return the DOM element
      // * statusBar.alarm.show()
      //     show the icon
      // * statusBar.alarm.hide()
      //     hide it
      // * statusBar.alarm.waitForIconToAppear()
      //     wait until the element appears
      // * statusBar.alarm.waitForIconToDisappear()
      //     wait until it disappears

      // Maximised status bar
      this.minimised = {};
      this.Icons.forEach(function(iconName) {
        this[iconName] = {
          get icon() {
            try {
              var client = self.client.scope({ searchTimeout: 100 });
              return client.findElement('#statusbar-icons ' +
              StatusBar.Selector[iconName]);
            } catch (e) {
              return null;
            }
          },
          show: showIconGenerator.call(this),
          hide: hideIconGenerator.call(this),
          waitForIconToAppear: waitForIconToAppearGenerator.call(this),
          waitForIconToDisappear: waitForIconToDisappearGenerator.call(this)
        };
      }.bind(this));

      // Functions generating helper functions.
      function showIconGenerator() {
        return function() {
          var icon = this.icon;
          self.client.executeScript(function(icon) {
            icon.hidden = false;
          }, [icon]);
        };
      }

      function hideIconGenerator() {
        return function() {
          var icon = this.icon;
          self.client.executeScript(function(icon) {
            icon.hidden = true;
          }, [icon]);
        };
      }

      function waitForIconToAppearGenerator() {
        return function() {
          var icon = this.icon;
          self.client.waitFor(function() {
            var display = icon.scriptWith(function(element) {
              return window.getComputedStyle(element).display;
            });
            return display !== 'none';
          });
          return icon;
        };
      }

      function waitForIconToDisappearGenerator() {
        return function() {
          var icon = this.icon;
          self.client.waitFor(function() {
            var display = icon.scriptWith(function(element) {
              return window.getComputedStyle(element).display;
            });
            return display === 'none';
          });
          return icon;
        };
      }
    }
  };

  module.exports = StatusBar;

})(module);
