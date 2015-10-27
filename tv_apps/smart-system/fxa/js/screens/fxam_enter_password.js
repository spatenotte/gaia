/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* global FxaModuleUI, FxaModule, FxaModuleNavigation,
   FxModuleServerRequest, FxaModuleOverlay, FxaModuleManager, KeyEvent,
   FxaModuleKeyNavigation */
/* exported FxaModuleEnterPassword */

'use strict';

/**
 * This module checks the validity of password given email address, and if
 * valid, determine which screen to go next.
 */

var FxaModuleEnterPassword = (function() {

  var _ = null;

  function _isPasswordValid(passwordEl) {
    var passwordValue = passwordEl.value;
    return passwordValue && passwordEl.validity.valid;
  }

  function _enableNext(passwordEl) {
    if (_isPasswordValid(passwordEl)) {
      FxaModuleUI.enableNextButton();
    } else {
      FxaModuleUI.disableNextButton();
    }
  }

  function _cleanForm(passwordEl, passwordCheck) {
    passwordEl.value = '';
    passwordCheck.checked = false;
    passwordEl.setAttribute('type', 'password');
  }

  function _togglePasswordVisibility() {
    /*jshint validthis:true*/
    var passwordFieldType = !!this.fxaShowPw.checked ? 'text' : 'password';
    this.fxaPwInput.setAttribute('type', passwordFieldType);
  }

  function _forgotPassword() {
    /*jshint validthis:true*/
    var self = this;
    if (this.isFTU) {
      return this.showErrorResponse({
        error: 'RESET_PASSWORD_ERROR'
      });
    }
    // Note: we don't need to pass a success callback, but we do need an errback
    FxModuleServerRequest.requestPasswordReset(
      this.email,
      null,
      function on_reset_error() {
        self.showErrorResponse({
          error: 'UNKNOWN_ERROR'
        });
      }
    );
  }

  var Module = Object.create(FxaModule);
  Module.init = function init(options) {

    if (!this.initialized) {
      _ = navigator.mozL10n.get;
      // Cache DOM elements
      this.importElements(
        'fxa-hello-known-user',
        'fxa-pw-input',
        'fxa-show-pw',
        'fxa-forgot-password'
      );
      // Add listeners
      this.fxaPwInput.addEventListener(
        'input',
        function onInput(event) {
          _enableNext(event.target);
        }
      );
      // Ensure that pressing 'ENTER' (keycode 13) we send the form
      // as expected
      this.fxaPwInput.addEventListener(
        'keypress',
        function onKeypress(event) {
          if (_isPasswordValid(this.fxaPwInput) && event.keyCode === 13) {
            document.activeElement.blur();
            FxaModuleNavigation.next();
          }
        }.bind(this)
      );

      this.fxaPwInput.addEventListener('focus', () => {
        setTimeout(this.fxaPwInput.select.bind(this.fxaPwInput));
      });

      this.fxaShowPw.addEventListener('keypress', e => {
        if (e.keyCode && e.keyCode === KeyEvent.DOM_VK_RETURN) {
          this.fxaShowPw.checked = !this.fxaShowPw.checked;
          _togglePasswordVisibility.bind(this)();
        }
      });

      this.fxaShowPw.addEventListener(
        'change',
        _togglePasswordVisibility.bind(this),
        false
      );

      this.fxaForgotPassword.addEventListener(
        'click',
        _forgotPassword.bind(this),
        false
      );
      // Avoid repeated initialization
      this.initialized = true;
    }

    if (!options || !options.email) {
      console.error('Options are not sent properly. Email not available');
      return;
    }

    this.isFTU = !!(options && options.isftu);
    this.email = options.email;

    var helloUserText = _('fxa-hello-user');
    helloUserText = helloUserText.replace(
      /{{\s*email\s*}}/,
      '<a id="fxa-known-user-email">' + this.email + '</a>'
    );
    this.fxaHelloKnownUser.innerHTML = helloUserText;

    _cleanForm(
      this.fxaPwInput,
      this.fxaShowPw
    );

    _enableNext(this.fxaPwInput);

    // There are 3 reasons why using setTimeout at this place:
    // 1. Focus() only works in the setTimeout callback here
    // 2. The input will be focused first and the keyboard will be brought
    //    up. We need to do this after the slide up animation of the parent
    //    fxa_dialog. But the fxa iframe has no way to know when the slide up
    //    animation is finished.
    // 3. Put the FxaModuleKeyNavigation.add in the onanimate callback in
    //    fxam_navigation.js doesn't work, since there is no animation for the
    //    first page in the flow.
    setTimeout(() => {
      FxaModuleKeyNavigation.add([
        '#fxa-pw-input', '#fxa-forgot-password',
        '#fxa-show-pw', '#fxa-module-next']);
    }, 500);
  };

  Module.onBack = function onBack() {
    FxaModuleKeyNavigation.remove([
      '#fxa-pw-input', '#fxa-forgot-password',
      '#fxa-show-pw', '#fxa-module-next']);
  };

  Module.onDone = function onDone(done) {
    FxaModuleOverlay.show('fxa-connecting');

    FxaModuleManager.setParam('success', true);
    FxModuleServerRequest.signIn(
      this.email,
      this.fxaPwInput.value,
      function onServerResponse(response) {
        FxaModuleOverlay.hide();
        FxaModuleKeyNavigation.remove([
          '#fxa-pw-input', '#fxa-forgot-password',
          '#fxa-show-pw', '#fxa-module-next']);

        if (!response.authenticated) {
          // XXX Show inactive sync account. Bug1215463
          return;
        }
        done();
      }.bind(this),
      function onError(response) {
        FxaModuleKeyNavigation.disable();
        _cleanForm(
          this.fxaPwInput,
          this.fxaShowPw
        );
        this.showErrorResponse(response);
      }.bind(this)
    );
  };

  return Module;

}());

