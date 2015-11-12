/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global SimpleKeyNavigation, KeyEvent */
/* exports FTEWizard */

'use strict';

(function(exports) {
  const MAX_TRANSITIONEND_LATENCY = 4000;

  function FTEWizard(name) {
    this._name = name;
    this._running = false;

    this._launched = !!localStorage.getItem(name + '.fteskip');
  }

  Object.defineProperty(FTEWizard.prototype, 'running', {
    get: function() {
      return this._running;
    }
  });

  Object.defineProperty(FTEWizard.prototype, 'launched', {
    get: function() {
      return this._launched;
    }
  });

  FTEWizard.prototype.init = function fw_init(options) {
    if (this._launched) {
      if (options.container) {
        options.container.style.display = 'none';
      }
      options.onfinish && options.onfinish();
      return;
    }

    this._container = options.container;
    this._buttonsClass = options.buttonsClass || 'fte-button';
    this._finishButtonClass = options.finishButtonClass || 'fte-finish';
    this._pageClass = options.pageClass || 'fte-page';
    this.propagateKeyEvent = options.propagateKeyEvent || false;
    this._simpleKeyNavigation = new SimpleKeyNavigation();
    this._onfinish = options.onfinish;

    this._pages =
            Array.from(this._container.getElementsByClassName(this._pageClass));
    this._nextButton =
               this._container.getElementsByClassName(this._nextButtonClass)[0];
    this._prevButton =
               this._container.getElementsByClassName(this._prevButtonClass)[0];
    this._finishButton =
             this._container.getElementsByClassName(this._finishButtonClass)[0];
    this._currentPage = 0;


    this._container.addEventListener('keydown', this);
    this._container.addEventListener('keyup', this);

    // The element list will be updated in this._updateNavigation.
    this._simpleKeyNavigation.start([],
                                     SimpleKeyNavigation.DIRECTION.HORIZONTAL);
    this._pages.forEach((page, idx) => this._hide(idx));
    this._show(this._currentPage);
    this._updateNavigation();

    this._running = true;
  };

  FTEWizard.prototype.uninit = function fw_uninit() {
    if (this._launched) {
      return;
    }
    this._container.removeEventListener('keydown', this);
    this._container.removeEventListener('keyup', this);
    this._simpleKeyNavigation.stop();
    this._simpleKeyNavigation = null;

    this._running = false;
  };

  FTEWizard.prototype.goNext = function fw_next() {
    if (this._currentPage >= this._pages.length - 1) {
      // If the page number exceeds available pages, we just end the wizard.
      this.finish();
      return;
    }

    this._hide(this._currentPage);
    this._currentPage++;
    this._show(this._currentPage);
    this._updateNavigation();
  };

  FTEWizard.prototype.goPrev = function fw_prev() {
    if (this._currentPage <= 0) {
      return;
    }

    this._hide(this._currentPage);
    this._currentPage--;
    this._show(this._currentPage);
    this._updateNavigation();
  };

  FTEWizard.prototype.finish = function fw_finish() {
    this._container.classList.add('finish');

    attachTransitionEnd(this._container, () => {

      this._hide(this._currentPage);
      this._container.style.display = 'none';
      this.uninit();
      this._launched = true;

      localStorage.setItem(this._name + '.fteskip', true);
      this._onfinish && this._onfinish();
    });
  };

  FTEWizard.prototype.focus = function fw_focus() {
    this._simpleKeyNavigation.focus();
  };

  FTEWizard.prototype._updateNavigation = function fw_updateNavigation() {
    var list = Array.from(this._pages[this._currentPage].
                                    getElementsByClassName(this._buttonsClass));

    this._simpleKeyNavigation.updateList(list);
  };

  FTEWizard.prototype._hide = function fw_hide(pageIdx) {
    this._pages[pageIdx].style.display = 'none';
  };

  FTEWizard.prototype._show = function fw_hide(pageIdx) {
    this._pages[pageIdx].style.display = '';
  };

  FTEWizard.prototype.handleEvent = function fw_handleEvent(evt) {
    switch(evt.type) {

      case 'keyup':
        if (evt.keyCode === KeyEvent.DOM_VK_RETURN) {
          switch (evt.target.dataset.behavior) {

            case 'next':
              this.goNext();
              break;

            case 'prev':
              this.goPrev();
              break;

            case 'finish':
              this.finish();
              break;
          }
        }
        // By default we stop propagating keyevent such that the main logic of
        // app is not triggered while FTE is working.
        !this.propagateKeyEvent && evt.stopPropagation();
        break;
      case 'keydown':
      case 'keypress':
        // also stop propagating keydown and keypress since arrow keys are
        // triggered by keydown in smart-screen apps.
        !this.propagateKeyEvent && evt.stopPropagation();
        break;
    }
  };

  function attachTransitionEnd(elem, cb, options) {
    var latency = (options && options.maxLatency) ||
                  MAX_TRANSITIONEND_LATENCY;

    elem.addEventListener('transitionend', destruct);
    var timer = setTimeout(destruct, latency);

    function destruct(evt) {
      if(evt && evt.target != elem) {
        return;
      }

      elem.removeEventListener('transitionend', destruct);
      clearTimeout(timer);

      cb(evt);
    }
  }


  exports.FTEWizard = FTEWizard;
}(window));
