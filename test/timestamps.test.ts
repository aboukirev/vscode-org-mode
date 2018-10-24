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
});