'use strict';

import * as assert from 'assert';
import * as timestamps from '../src/timestamps';

suite('Timestamps', () => {
    test('Recognizes today', done => {
        let expected = (new timestamps.Timestamp()).toString();
        assert.equal(timestamps.orgParseDateTimeInput('.'), expected);
        done();
    });
    test('Parses and formats delay part', done => {
        let source = '2018-10-21 Sun 19:10 -2d';
        let expected = source;
        assert.equal(new timestamps.Timestamp(source).toString(), expected);
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
    test('Recognizes positive offset in week days from the same week day', done => {
        let source = '2018-10-17 Wed 19:10';
        let expected = '2018-10-24 Wed 19:10';
        assert.equal(timestamps.orgParseDateTimeInput('++wed', source), expected);
        done();
    });
    test('Recognizes negative offset in week days from today', done => {
        let source = new timestamps.Timestamp();
        source.adjust(-1, 'wed');
        let expected = source.toString();
        assert.equal(timestamps.orgParseDateTimeInput('-wed'), expected);
        done();
    });
    test('Recognizes negative offset in week days from a given date', done => {
        let source = '2018-10-21 Sun 19:10';
        let expected = '2018-10-17 Wed 19:10';
        assert.equal(timestamps.orgParseDateTimeInput('--wed', source), expected);
        done();
    });
    test('Recognizes negative offset in week days from the same week day', done => {
        let source = '2018-10-24 Wed 19:10';
        let expected = '2018-10-17 Wed 19:10';
        assert.equal(timestamps.orgParseDateTimeInput('--wed', source), expected);
        done();
    });
    test('Recognizes plain timestamp', done => {
        let source = '2018-10-21 Sun 19:10 -2d';
        let expected = source;
        let ts = new timestamps.Timestamp(source);
        assert.equal(ts.isActive(), false);
        assert.equal(ts.isInactive(), false);
        assert.equal(ts.toString(), expected);
        done();
    });
    test('Recognizes active timestamp', done => {
        let source = '<2018-10-21 Sun 19:10 -2d>';
        let expected = source;
        let ts = new timestamps.Timestamp(source);
        assert.equal(ts.isActive(), true);
        assert.equal(ts.toString(), expected);
        done();
    });
    test('Recognizes inactive timestamp', done => {
        let source = '[2018-10-21 Sun 19:10 -2d]';
        let expected = source;
        let ts = new timestamps.Timestamp(source);
        assert.equal(ts.isInactive(), true);
        assert.equal(ts.toString(), expected);
        done();
    });
    test('Recognizes date range', done => {
        let source = '[2018-10-21 Sun]--[2018-10-24 Wed]';
        let expected = source;
        let ts = new timestamps.Timestamp(source);
        assert.equal(ts.isInactive(), true);
        assert.equal(ts.getKind(), timestamps.TimestampKind.DateRange);
        assert.equal(ts.toString(), expected);
        done();
    });
    test('Recognizes date/time range', done => {
        let source = '<2018-10-21 Sun 19:10 -2d>--<2018-10-24 Wed 21:10>';
        let expected = source;
        let ts = new timestamps.Timestamp(source);
        assert.equal(ts.isActive(), true);
        assert.equal(ts.getKind(), timestamps.TimestampKind.DateTimeRange);
        assert.equal(ts.toString(), expected);
        done();
    });
    test('Parses variations of ISO date', done => {
        assert.equal(timestamps.orgParseDateTimeInput('2018-9-5'), '2018-09-05 Wed');
        assert.equal(timestamps.orgParseDateTimeInput('18-9-5'), '2018-09-05 Wed');
        assert.equal(timestamps.orgParseDateTimeInput('9-5'), '2019-09-05 Thu');
        assert.equal(timestamps.orgParseDateTimeInput('14'), '2018-11-14 Wed');
        assert.equal(timestamps.orgParseDateTimeInput('29'), '2018-10-29 Mon');
        done();
    });
    test('Parses variations of US date', done => {
        assert.equal(timestamps.orgParseDateTimeInput('9/5/2018'), '2018-09-05 Wed');
        assert.equal(timestamps.orgParseDateTimeInput('9/5/18'), '2018-09-05 Wed');
        assert.equal(timestamps.orgParseDateTimeInput('9/5'), '2019-09-05 Thu');
        done();
    });
    test('Can redefine days of week abbreviations', done => {
        let source = '<2018-10-21 Sun 19:10 -2d>';
        let expected = '<2018-10-21 Вс 19:10 -2d>';
        timestamps.orgSetDayOfWeekAbbr(['Вс', 'Пн', 'Бт', 'Ср', 'Чт', 'Пт', 'Сб']);
        let ts = new timestamps.Timestamp(source);
        assert.equal(ts.isActive(), true);
        assert.equal(ts.toString(), expected);
        done();
    });
    test('Can parse custom days of week abbreviations', done => {
        let source = '2018-10-17 Wed 19:10';
        let expected = '2018-10-24 Ср 19:10';
        timestamps.orgSetDayOfWeekAbbr(['Вс', 'Пн', 'Бт', 'Ср', 'Чт', 'Пт', 'Сб']);
        assert.equal(timestamps.orgParseDateTimeInput('++ср', source), expected);
        done();
    });
});