'use strict';

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

// Day of week and month abbreviations have value when parsing date/offset input.
// Day of week is also used in formatting of timestamp.  However, it is insignificant there because formatted 
// day of week does not need to be parsed back.
let daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; 
let months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

// In JS \w matches only ASCII letters.  The regex below takes care to also exclude other symbols in the unit 
// part to achieve proper matching. 
let offsetRx = /^(-|\+|--|\+\+|)([0-9]*)([^-\+\s0-9]*)$/;
// Alternative dynamic RegExp.
//let offsetRx = new RegExp("^(-|\\+|--|\\+\\+)([0-9]+)?([hdwmy]|(" + daysOfWeek.join('|') + "))?$", 'i');
const repeatRx = /^(\+{0,2})([0-9]+)?([hdwmyHDWMY])/;
const delayRx = /^(-{1,2})([0-9]+)?([hdwmyHDWMY])/;
// Localities may have day of week abbreviations of varying length.  We don't parse it.  Day of week is 
// a function of date. Could not use \w to match letters as it on;y works for ASCII. 
const dateRx = /^(\d\d\d\d)-(\d\d)-(\d\d)( [^-\+\s\d>\]]+)?/;  
const timeRx = /^([012]?[0-9]):([0-5][0-9])/;
const monDayYearRx = /^([^-\+\s\d\.]+)( (\d{1,2}))?( (\d{1,4}))?(\s|$)/;
const isoWeekRx = /^(?:([0-9]+)-)?[wW]([0-9]{1,2})(?:-([0-6]))?(\s|$)/;
const isoDateRx = /^(([0-9]+)-)?([0-1]?[0-9])-([0-3]?[0-9])([^-0-9]|$)/;
const euDateRx = /^(3[01]|0?[1-9]|[12][0-9])\. ?(0?[1-9]|1[012])\.( ?[1-9][0-9]{3})?/;
const usDateRx = /^(0?[1-9]|1[012])\/(0?[1-9]|[12][0-9]|3[01])(\/([0-9]+))?([^\/0-9]|$)/; 
const dayRx = /^([0-3]?[0-9])(\s|$)/;
const ampmRx = /^([012]?[0-9])(:([0-5][0-9]))?(am|AM|pm|PM)?(?=[-\+\s]|$)/;

let trace = false;

export enum TimestampKind {
    Date = 0,
    DateTime = 1,
    Diary = 2,
    DateRange = 3,
    DateTimeRange = 4
}

export class TimeOffset {
    value: number = 0;
    unit: string = '';
    public isSet(): boolean {
        return this.value != 0;
    }
    public isDelay(): boolean {
        return this.value < 0;
    }
    public toString(): string {
        if (this.value == 0)
            return '';
        return ' ' + this.value.toString() + this.unit;
    }
}

export class Timestamp {
    private date: Date;
    private kind: TimestampKind;
    private active?: boolean;     // 3-state: undefined, active, inactive.
    private date2: Date;          // For diary timestamps and ranges.
    private repeat: TimeOffset;   // For repeating agenda timestamps.  0 value means no repeat.
    private delay: TimeOffset;    // Warning delay.  0 value menas no delay.
    constructor(str?: string) {
        this.fromTimestamp(str);
    }
    public fromTimestamp(str?: string) {
        this.repeat = new TimeOffset();
        this.delay = new TimeOffset();
        if (!str) {
            this.fromToday();
            return;
        }
        str = str.trim();
        let startCh = str.charAt(0);
        let endCh = '';
        if (startCh == '<') {
            this.active = true;
            endCh = '>';
            str = str.substr(1);
        } else if (startCh == '[') {
            this.active = false;
            endCh = ']';
            str = str.substr(1);
        } else {
            startCh = '';
        }
        let m = dateRx.exec(str);
        if (!m) {
            return;
        }
        this.date = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
        this.kind = TimestampKind.Date;
        str = str.substr(m[0].length).trim();
        m = timeRx.exec(str);
        if (m) {
            this.date.setHours(parseInt(m[1]));
            this.date.setMinutes(parseInt(m[2]));
            this.kind = TimestampKind.DateTime;
            str = str.substr(m[0].length).trim();
            if (str.length > 0 && str.charAt(0) == '-') {
                m = timeRx.exec(str.substr(1));
                if (m) {
                    this.date2 = new Date(this.date.getTime());
                    this.date2.setHours(parseInt(m[1]));
                    this.date2.setMinutes(parseInt(m[2]));
                    this.kind = TimestampKind.Diary;
                    // TODO: Verify and skip the closing bracket if any.
                    return;  // No other parts allowed.
                }
            }
        }
        // Repeater and delay follow in a specific order.
        m = repeatRx.exec(str);
        if (m) {
            let off = parseInt(m[2]);
            this.repeat.value = isNaN(off) ? 1 : off;
            this.repeat.unit = m[3];
            str = str.substr(m[0].length).trim();
        }
        m = delayRx.exec(str);
        if (m) {
            let off = parseInt(m[2]);
            this.delay.value = isNaN(off) ? -1 : -off;
            this.delay.unit = m[3];
            str = str.substr(m[0].length).trim();
        }
        if (startCh != '') {
            let i = str.indexOf(endCh);
            if (i >= 0) {
                str = str.substr(i + 1).trim();
            }
            if (str.length > 4 && str.substr(0, 3) == ('--' + startCh)) {
                str = str.substr(3);
                let m = dateRx.exec(str);
                if (!m) {
                    return;
                }
                this.date2 = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
                this.kind = this.kind == TimestampKind.Date ? TimestampKind.DateRange : TimestampKind.DateTimeRange;
                str = str.substr(m[0].length).trim();
                m = timeRx.exec(str);
                if (m) {
                    this.date2.setHours(parseInt(m[1]));
                    this.date2.setMinutes(parseInt(m[2]));
                } else {
                    this.date2.setHours(this.date.getHours());
                    this.date2.setMinutes(this.date.getMinutes());
                }
                // TODO: Verify and skip the closing bracket if any.
            }
        }
    }
    public adjust(n: number, u?: string) {
        u = (u && u.length > 0) ? u.toLowerCase() : 'd';
        
        switch (u) {
            case 'd': 
                this.date.setDate(this.date.getDate() + n); 
                if (this.date2)
                    this.date2.setDate(this.date2.getDate() + n); 
                return;
            case 'h': 
                // TODO: Change timestamp kind to DateTime, get current time, and then add hours?
                this.date.setHours(this.date.getHours() + n); 
                if (this.date2)
                    this.date2.setHours(this.date2.getHours() + n); 
                return;
            case 'm': 
                this.date.setMonth(this.date.getMonth() + n); 
                if (this.date2)
                    this.date2.setMonth(this.date2.getMonth() + n); 
                return;
            case 'w': 
                this.date.setDate(this.date.getDate() + n * 7); 
                if (this.date2)
                    this.date2.setDate(this.date2.getDate() + n * 7); 
                return;
            case 'y': 
                this.date.setFullYear(this.date.getFullYear() + n); 
                if (this.date2)
                    this.date2.setFullYear(this.date2.getFullYear() + n); 
                return;
        }
    
        let dow2 = daysOfWeek.findIndex(elt => elt.toLowerCase() == u);
        if (dow2) {
            let dow1 = this.date.getDay();
            let diff = dow1 - dow2;
            if (n > 0) {
                diff = diff < 0 ? diff + 7 : diff;
                n = n * 7 - diff % 7;
            } else {
                diff = diff > 0 ? 7 - diff : -diff;
                n = n * 7 + diff % 7;
            }
            this.date.setDate(this.date.getDate() + n);
            if (this.date2)
                this.date2.setDate(this.date2.getDate() + n);
        }
    }
    public fromToday() {
        let now = new Date();
        this.date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        this.kind = TimestampKind.Date;
    }
    private fromDateParts(yy: number, mm: number, dd: number) {
        let now = new Date();
        if (!isNaN(yy) && !isNaN(mm)) {
            // We have all 3 parts but the year could be partial.
            if (yy < 38) {
                yy = yy + 2000;
            } else if (yy < 100) {
                yy = yy + 1900;
            }
        } else {
            yy = now.getFullYear();
            // Always create a future date.
            if (isNaN(mm)) {
                // Actually we don't have month either.  Assume current.
                mm = now.getMonth() + 1;
                if (dd < now.getDate()) {
                    mm++;
                }
            } else if (dd < now.getDate() || mm <= now.getMonth()) {
                yy++;
            }
        } 
        this.date = new Date(yy, mm - 1, dd);
        this.kind = TimestampKind.Date;
    }
    private fromAbsoluteInput(ans: string): boolean {
        // Replicate Emacs regular expressions, order, and logic.
        let yy, mm, dd: number;
        let dow, week: number; 

        // Match ISO week date.  
        let match = isoWeekRx.exec(ans);
        if (match) {
            if (trace) console.log('week');
            yy = parseInt(match[1]);
            dow = parseInt(match[3]);
            week = parseInt(match[2]);
            this.fromDateParts(yy, 1, 1);
            dow = dow ? dow : 1;
            let diff = dow - this.date.getDay() + (week - 1) * 7;
            this.fromDateParts(yy, 1, diff);
            ans = ans.substr(match[0].length);
            this.fromHours(ans);
            return true;
        }
        // Match ISO dates with single digit month or day, like 2006-8-11.
        match = isoDateRx.exec(ans);
        if (match) {
            if (trace) console.log('ISO');
            yy = parseInt(match[2]);
            mm = parseInt(match[3]);
            dd = parseInt(match[4]);
            this.fromDateParts(yy, mm, dd);
            ans = ans.substr(match[0].length);
            this.fromHours(ans);
            return true;
        }
        // Match dotted european dates.
        match = euDateRx.exec(ans);
        if (match) {
            if (trace) console.log('EU');
            yy = parseInt(match[3]);
            dd = parseInt(match[1]);
            mm = parseInt(match[2]);
            this.fromDateParts(yy, mm, dd);
            ans = ans.substr(match[0].length);
            this.fromHours(ans);
            return true;
        }
        // Match american dates, like 5/30 or 5/30/7.
        match = usDateRx.exec(ans);
        if (match) {
            if (trace) console.log('US');
            yy = parseInt(match[4]);
            mm = parseInt(match[1]);
            dd = parseInt(match[2]);
            this.fromDateParts(yy, mm, dd);
            ans = ans.substr(match[0].length);
            this.fromHours(ans);
            return true;
        }
        // Match month day year or plain day of week free form inputs.
        match = monDayYearRx.exec(ans);
        if (match) {
            if (trace) console.log('mondayyear');
            yy = parseInt(match[5]);
            mm = months.findIndex(elt => elt.toLowerCase() == match[1].toLowerCase()) + 1;
            dd = parseInt(match[3]);
            if (isNaN(yy) && isNaN(dd)) {
                // Must be a day of week.
                this.adjust(0, match[1]);
            } else {
                if (mm <= 0) {
                    mm = NaN;
                }
                this.fromDateParts(yy, mm, dd);
            }
            ans = ans.substr(match[0].length);
            this.fromHours(ans);
            return true;
        }
        // Just day.
        match = dayRx.exec(ans);
        if (match) {
            if (trace) console.log('day');
            yy = NaN;
            mm = NaN;
            dd = parseInt(match[1]);
            this.fromDateParts(yy, mm, dd);
            ans = ans.substr(match[0].length);
            this.fromHours(ans);
            return true;
        }

        return this.fromHours(ans);
    }
    private fromHours(ans: string): boolean {
        let matched = false;
        let hh, nn: number;
        // Match military or am/pm times.  
        let match = ampmRx.exec(ans);
        if (match) {
            hh = parseInt(match[1]);
            nn = match[5] ? parseInt(match[5]) : 0;
            let pm = match[4].toLowerCase() == 'pm';
            if (!pm && hh == 12) {
                hh = 0;
            } else if (pm && hh < 12) {
                hh = hh + 12;
            }
            this.date.setHours(hh);
            this.date.setMinutes(nn);
            ans = ans.substr(match[0].length);
            matched = true;
        }
        // A second time may appear as end of range or duration.
        // Try it only if start time has matched.  Otherwise simple offset like +4 may be wrongly processed here.
        if (matched && (ans.startsWith('-') || ans.startsWith('+'))) {
            match = ampmRx.exec(ans.substr(1));
            if (match) {
                this.date2 = new Date(this.date.getTime());
                let h2 = parseInt(match[1]);
                let n2 = match[5] ? parseInt(match[5]) : 0;
                if (ans.charAt(0) == '+') {
                    h2 = h2 + hh;
                    n2 = n2 + nn;
                    if (n2 >= 60) {
                        h2++;
                        n2 = n2 - 60;
                    }
                }
                this.date2.setHours(h2);
                this.date2.setMinutes(n2);
                matched = true;
            }
        }
        return matched;
    }
    private fromRelativeInput(ans: string, defdate?: string): boolean {
        this.fromToday();
        if (ans == '.') {
            if (trace) console.log('today');
            return true;
        }
        let match = offsetRx.exec(ans);
        if (match) {
            if (trace) console.log('offset');
            let off = parseInt(match[2]);
            off = isNaN(off) ? 1 : off;
            if (off == 0) {
                if (trace) console.log('today');
                return true;
            }
            if (match[1] == '--' || match[1] == '++') {
                this.fromTimestamp(defdate);
            }
            if (match[1] == '-' || match[1] == '--') {
                off = -off;
            }
            if (match[1] == '') {
                off = 0;
            }
            this.adjust(off, match[3]);
            return true;
        }
        if (trace) console.log('no match: [' + ans + ']');
        return false;
    }
    public fromInput(ans: string, defdate?: string) {
        if (this.fromAbsoluteInput(ans)) {
            return;
        }
        this.fromRelativeInput(ans, defdate);
    }
    public toString(): string {
        let zeroPpad = function (val: number, len: number): string {
            let str = String(val);
			while (str.length < len) str = '0' + str;
			return str;
        };
        let formatDate = function (dat: Date): string {
            return zeroPpad(dat.getFullYear(), 4) + '-' + zeroPpad(dat.getMonth() + 1, 2) + '-' + zeroPpad(dat.getDate(), 2) + ' ' + daysOfWeek[dat.getDay()];
        };
        let formatTime = function (dat: Date): string {
            return zeroPpad(dat.getHours(), 2) + ':' + zeroPpad(dat.getMinutes(), 2);
        };
        if (!this.date) {
            return '';
        }
        let result = formatDate(this.date);
        if (this.kind != TimestampKind.Date && this.kind != TimestampKind.DateRange) {
            result = result + ' ' + formatTime(this.date);
        }
        if (this.kind == TimestampKind.Diary) {
            result = result + '-' + formatTime(this.date2);
        } else {
            result = result + this.repeat.toString() + this.delay.toString();
        }
        if (this.active == true)
            result = '<' + result + '>';
        else if (this.active == false)
            result = '[' + result + ']';
        if (this.kind == TimestampKind.DateRange || this.kind == TimestampKind.DateTimeRange) {
            let result2 = formatDate(this.date2);
            if (this.kind == TimestampKind.DateTimeRange) {
                result2 = result2 + ' ' + formatTime(this.date2);
            }
            if (this.active == true)
                result2 = '<' + result2 + '>';
            else if (this.active == false)
                result2 = '[' + result2 + ']';
            result = result + '--' + result2;
        }
        return result;
    }
    public getStart(): Date {
        return this.date;
    }
    public getEnd(): Date {
        return this.date2;
    }
    public getRepeater(): TimeOffset {
        return this.repeat;
    }
    public getDelay(): TimeOffset {
        return this.delay;
    }
    public isActive(): boolean {
        return this.active == true;
    }
    public isInactive(): boolean {
        return this.active == false;
    }
    public getKind(): TimestampKind {
        return this.kind;
    }
}

export function orgParseDateTimeInput(input: string, defdate?: string): string {
    let src = new Timestamp();
    src.fromInput(input.trim(), defdate);
    return src.toString();
}

export function orgSetDayOfWeekAbbr(abbr: string[]) {
    if (abbr && abbr.length == 7) {
        daysOfWeek = abbr;
    } else {
        daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; 
    }
}

export function orgSetMonthAbbr(abbr: string[]) {
    if (abbr && abbr.length == 12) {
        months = abbr;
    } else {
        months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    }
}

export function orgSetTrace(value: boolean) {
    trace = value;
}