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

// TODO: Accept time ranges in the input to adjust function as described above.
// TODO: Note that minutes are optional.
// TODO: Make configuration variables for month and day of week abbreviations.
// TODO: Provide methods to set month and day of week abbreviations.  Can be called on extension activation.
// TODO: Load configuration once when plugin loads.

// Day of week and month abbreviations have value when parsing date/offset input.
// Day of week is also used in formatting of timestamp.  However, it is irrelevant because formatted day of week does not need to be parsed.
const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; 
// ['Вс', 'Пн', 'Бт', 'Ср', 'Чт', 'Пт', 'Сб'];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

const offsetRegex = /^(-|--|\+|\+\+)(\d*)(\w{0,3})$/;
const repeatRegex = /^(\+|\+\+)(\d*)([hdwmy])/;
const delayRegex = /^(-|--)(\d*)([hdwmy])/;
// Localities may have day of week abbreviations of varying length.  We don't parse it.  Day of week is a function of date.
const dateRegex = /^(\d\d\d\d)-(\d\d)-(\d\d)( \w+)?/;  
const timeRegex = /^([012]?[0-9]):([0-5][0-9])/;

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
        this.repeat = new TimeOffset();
        this.delay = new TimeOffset();
        if (!str) {
            return;
        }
        str = str.replace(/^\s+/, '');
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
        let m = dateRegex.exec(str);
        if (!m) {
            return;
        }
        this.date = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
        this.kind = TimestampKind.Date;
        str = str.substr(m[0].length).replace(/^\s+/, '');
        m = timeRegex.exec(str);
        if (m) {
            this.date.setHours(parseInt(m[1]));
            this.date.setMinutes(parseInt(m[2]));
            this.kind = TimestampKind.DateTime;
            str = str.substr(m[0].length).replace(/^\s+/, '');
            if (str.length > 0 && str.charAt(0) == '-') {
                m = timeRegex.exec(str.substr(1));
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
        m = repeatRegex.exec(str);
        if (m) {
            let off = parseInt(m[2]);
            this.repeat.value = isNaN(off) ? 1 : off;
            this.repeat.unit = m[3];
            str = str.substr(m[0].length).replace(/^\s+/, '');
        }
        m = delayRegex.exec(str);
        if (m) {
            let off = parseInt(m[2]);
            this.delay.value = isNaN(off) ? -1 : -off;
            this.delay.unit = m[3];
            str = str.substr(m[0].length).replace(/^\s+/, '');
        }
        if (startCh != '') {
            let i = str.indexOf(endCh);
            if (i >= 0) {
                str = str.substr(i + 1).replace(/^\s+/, '');
            }
            if (str.length > 4 && str.substr(0, 3) == ('--' + startCh)) {
                str = str.substr(3);
                let m = dateRegex.exec(str);
                if (!m) {
                    return;
                }
                this.date2 = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
                this.kind = this.kind == TimestampKind.Date ? TimestampKind.DateRange : TimestampKind.DateTimeRange;
                str = str.substr(m[0].length).replace(/^\s+/, '');
                m = timeRegex.exec(str);
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
    public adjust(n: number, u: string) {
        if (!this.date) {
            let now = new Date();
            this.date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }
        n = n ? n : 1;
        u = u ? u.toLowerCase() : 'd';
        
        if (u.length == 1) {
            switch (u) {
                case 'd': 
                    this.date.setDate(this.date.getDate() + n); 
                    if (this.date2)
                        this.date2.setDate(this.date2.getDate() + n); 
                    break;
                case 'w': 
                    this.date.setDate(this.date.getDate() + n * 7); 
                    if (this.date2)
                        this.date2.setDate(this.date2.getDate() + n * 7); 
                    break;
                case 'm': 
                    this.date.setMonth(this.date.getMonth() + n); 
                    if (this.date2)
                        this.date2.setMonth(this.date2.getMonth() + n); 
                    break;
                case 'y': 
                    this.date.setFullYear(this.date.getFullYear() + n); 
                    if (this.date2)
                        this.date2.setFullYear(this.date2.getFullYear() + n); 
                    break;
            }
            return;
        }
    
        let dow2 = daysOfWeek.findIndex(elt => elt.toLowerCase() == u);
        if (dow2) {
            let dow1 = this.date.getDay();
            if (n > 0) {
                n = n * 7 - (dow1 - dow2) % 7;  // n = n * 7 - (dow1 + 7 - dow2) % 7;
            } else {
                n = n * 7 + (dow2 - dow1) % 7;  // n = n * 7 + (dow2 + 7 - dow1) % 7;
            }
            this.date.setDate(this.date.getDate() + n);
            if (this.date2)
                this.date2.setDate(this.date2.getDate() + n);
        }
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
        }
        if (this.kind != TimestampKind.Diary) {
            if (this.repeat.isSet()) {
                result = result + this.repeat.toString();
            }
            if (this.delay.isSet()) {
                result = result + this.delay.toString();
            }
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
    let src: Timestamp = new Timestamp();
    if (input == '.') {
        return src.toString();
    }
    let match = offsetRegex.exec(input);
    if (match) {
        let off = parseInt(match[2]);
        off = isNaN(off) ? 1 : off;
        if (off == 0) {
            return src.toString();
        }
        if (match[1].length == 2) {
            src = new Timestamp(defdate);
        }
        if (match[1] == '-' || match[1] == '--') {
            off = -off;
        }
        src.adjust(off, match[3]);
    }
    // TODO: Parse an actual date instead of an offset.
    return src.toString();
}

