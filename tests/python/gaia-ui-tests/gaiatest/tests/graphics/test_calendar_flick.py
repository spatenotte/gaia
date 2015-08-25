# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import datetime
import time

from gaiatest.apps.calendar.app import Calendar
from gaiatest.gaia_graphics_test import GaiaImageCompareTestCase


class TestCalendar(GaiaImageCompareTestCase):

    _seconds_since_epoch = 1357043430

    def setUp(self):
        GaiaImageCompareTestCase.setUp(self)
        self.data_layer.set_time(self._seconds_since_epoch * 1000)
        self.data_layer.set_setting('time.timezone', 'Atlantic/Reykjavik')

        self.today = datetime.datetime.utcfromtimestamp(self._seconds_since_epoch)
        # Determine the name and the year of the next month
        self.next_month_year = self.today.replace(day=1) + datetime.timedelta(days=32)

    def test_calendar_flick(self):
        """https://bugzilla.mozilla.org/show_bug.cgi?id=937085"""

        calendar = Calendar(self.marionette)
        calendar.launch()

        calendar.flick_to_next_month()
        self.take_screenshot()

        calendar.flick_to_previous_month()
        self.take_screenshot()

        calendar.flick_to_previous_month()
        self.take_screenshot()

        calendar.tap_week_display_button()
        time.sleep(3)  # auto-scrolls when week view is entered, wait until scroll bar disappears
        self.take_screenshot()
        GaiaImageCompareTestCase.scroll(self.marionette, 'down',
                                        300, locator=calendar._week_view_locator)
        time.sleep(1)  # wait until scroll bar disappears

        self.take_screenshot()
        GaiaImageCompareTestCase.scroll(self.marionette, 'up',
                                        300, locator=calendar._week_view_locator)
        time.sleep(1)  # wait until scroll bar disappears
        self.take_screenshot()
        GaiaImageCompareTestCase.scroll(self.marionette, 'right',
                                        100, locator=calendar._week_view_locator)
        time.sleep(1)  # wait until scroll bar disappears
        self.take_screenshot()
        GaiaImageCompareTestCase.scroll(self.marionette, 'left',
                                        100, locator=calendar._week_view_locator)
        time.sleep(1)  # wait until scroll bar disappears
        self.take_screenshot()

        calendar.tap_day_display_button()
        time.sleep(1)  # wait until scroll bar disappears
        self.take_screenshot()
        GaiaImageCompareTestCase.scroll(self.marionette, 'down',
                                        300, locator=calendar._day_view_locator)
        time.sleep(1)  # wait until scroll bar disappears
        self.take_screenshot()
        GaiaImageCompareTestCase.scroll(self.marionette, 'up',
                                        300, locator=calendar._day_view_locator)
        time.sleep(1)  # wait until scroll bar disappears
        self.take_screenshot()
        GaiaImageCompareTestCase.scroll(self.marionette, 'right',
                                        100, locator=calendar._day_view_locator)
        time.sleep(1)  # wait until scroll bar disappears
        self.take_screenshot()
        GaiaImageCompareTestCase.scroll(self.marionette, 'left',
                                        100, locator=calendar._day_view_locator)
        GaiaImageCompareTestCase.scroll(self.marionette, 'left',
                                        100, locator=calendar._day_view_locator)
        time.sleep(1)  # wait until scroll bar disappears
        self.take_screenshot()
