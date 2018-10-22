'use strict';

const offsetRegex = /^(-|--|\+|\+\+)(\d*)(\w{0,3})$/;
// Days of week
const daysofweek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const dateRegex = /^(\d\d\d\d)-(\d\d)-(\d\d)( \w\w\w)?/;
const timeRegex = /([012]?[0-9]):([0-5][0-9])/;

export enum TimestampKind {
    Date = 0,
    DateTime = 1,
    Diary = 2,
    DateRange = 3
}

export class Timestamp {
    private date: Date;
    private kind: TimestampKind;
    private date2: Date;       // For diary timestamps and ranges.
    private repeat: number;    // For repeating agenda timestamps we have a repeat interval and units.  0 means no repeat.
    private unit: string;
    constructor(str?: string) {
        this.repeat = 0;
        this.unit = '';
        if (!str) {
            return;
        }
        str = str.replace(/^\s+/, '');
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
                    return;  // No other parts allowed.
                }
            }
        }
        m = offsetRegex.exec(str);
        if (!m) {
            return;
        }
        // ++, -, and -- do not have any meaning for repeats.
        if (m[1] == '+') {
            let n = parseInt(m[2]);
            this.repeat = isNaN(n) ? 1 : n;
            this.unit = m[3];
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
    
        let dow2 = daysofweek.indexOf(u);
        if (dow2) {
            let dow1 = this.date.getDay();
            if (n > 0) {
                n = n * 7 - (dow1 + 7 - dow2) % 7;
            } else {
                n = n * 7 + (dow1 + 7 - dow2) % 7;
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
        if (this.kind != TimestampKind.Date) {
            result = result + ' ' + formatTime(this.date);
        }
        if (this.kind == TimestampKind.Diary) {
            result = result + '-' + formatTime(this.date2);
        }
        if (this.kind != TimestampKind.Diary && this.repeat > 0) {
            result = result + ' +' + this.repeat.toString() + this.unit;
        }
        return result;
    }
    public year(): number {
        return this.date ? this.date.getFullYear() : undefined;
    }
    public month(): number {
        return this.date ? this.date.getMonth() : undefined;
    }
    public day(): number {
        return this.date ? this.date.getDate() : undefined;
    }
    public dow(): number {
        return this.date ? this.date.getDay() : undefined;
    }
    public hours(): number {
        return this.date ? this.date.getHours() : undefined;
    }
    public minutes(): number {
        return this.date ? this.date.getMinutes() : undefined;
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
        if (match[1] == '-' || match[0] == '--') {
            off = -off;
        }
        src.adjust(off, match[3]);
    } 
    return src.toString();
}

