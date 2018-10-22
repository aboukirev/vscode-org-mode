'use strict';

import * as assert from 'assert';
import * as timestamps from '../src/timestamps';

// <2003-09-16 Tue> or <2003-09-16 Tue 09:39> or <2003-09-16 Tue 12:00-12:30>
// <2007-05-16 Wed 12:30 +1w>
// 
// For example, let’s assume that today is June 13, 2006. Here is how various inputs will be interpreted, 
// the items filled in by Org mode are in bold.
// 3-2-5         ⇒ 2003-02-05
// 2/5/3         ⇒ 2003-02-05
// 14            ⇒ 2006-06-14
// 12            ⇒ 2006-07-12
// 2/5           ⇒ 2007-02-05
// Fri           ⇒ nearest Friday after the default date
// sep 15        ⇒ 2006-09-15
// feb 15        ⇒ 2007-02-15
// sep 12 9      ⇒ 2009-09-12
// 12:45         ⇒ 2006-06-13 12:45
// 22 sept 0:34  ⇒ 2006-09-22 00:34
// w4            ⇒ ISO week four of the current year 2006
// 2012 w4 fri   ⇒ Friday of ISO week 4 in 2012
// 2012-w04-5    ⇒ Same as above
// 
// Furthermore you can specify a relative date by giving, as the first thing in the input: a plus/minus sign, 
// a number and a letter ([hdwmy]) to indicate change in hours, days, weeks, months, or years. With a single 
// plus or minus, the date is always relative to today. With a double plus or minus, it is relative to the default 
// date. If instead of a single letter, you use the abbreviation of day name, the date will be the Nth such day, e.g.:
// +0            ⇒ today
// .             ⇒ today
// +4d           ⇒ four days from today
// +4            ⇒ same as above
// +2w           ⇒ two weeks from today
// ++5           ⇒ five days from default date
// +2tue         ⇒ second Tuesday from now
// -wed          ⇒ last Wednesday
//
// The function understands English month and weekday abbreviations. If you want to use unabbreviated names 
// and/or other languages, configure the variables parse-time-months and parse-time-weekdays.
//
// Not all dates can be represented in a given Emacs implementation. By default Org mode forces dates into 
// the compatibility range 1970–2037 which works on all Emacs implementations. If you want to use dates outside 
// of this range, read the docstring of the variable org-read-date-force-compatible-dates.
//
// You can specify a time range by giving start and end times or by giving a start time and a duration 
// (in HH:MM format). Use one or two dash(es) as the separator in the former case and use ’+’ as the separator 
// in the latter case, e.g.:
// 11am-1:15pm    ⇒ 11:00-13:15
// 11am--1:15pm   ⇒ same as above
// 11am+2:15      ⇒ same as above

suite('Timestamps', () => {
    test('Recognizes today', done => {
        let expected = (new timestamps.Timestamp()).toString();
        assert.equal(timestamps.orgParseDateTimeInput('.'), expected);
        done();
    });
    test('Recognizes zero offset from today', done => {
        let expected = (new timestamps.Timestamp()).toString();
        assert.equal(timestamps.orgParseDateTimeInput('+0'), expected);
        assert.equal(timestamps.orgParseDateTimeInput('+0d'), expected);
        assert.equal(timestamps.orgParseDateTimeInput('+0w'), expected);
        done();
    });
    test('Recognizes positive offset in days from today', done => {
        let source = new timestamps.Timestamp();
        source.adjust(4, 'd');
        let expected = source.toString();
        assert.equal(timestamps.orgParseDateTimeInput('+4d'), expected);
        assert.equal(timestamps.orgParseDateTimeInput('+4'), expected);
        done();
    });
    test('Recognizes positive offset in days from a given date', done => {
        let source = '2018-10-21 Sun 19:10';
        let expected = '2018-10-25 Thu 19:10';
        assert.equal(timestamps.orgParseDateTimeInput('++4d', source), expected);
        assert.equal(timestamps.orgParseDateTimeInput('++4', source), expected);
        done();
    });
});