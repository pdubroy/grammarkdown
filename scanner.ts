﻿/*!
 *  Copyright 2015 Ron Buckton (rbuckton@chronicles.org)
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
 
import { CharacterCodes, SyntaxKind } from "./core";
import { stringToToken } from "./tokens";
import { Diagnostics, DiagnosticMessages, NullDiagnosticMessages } from "./diagnostics";

export class Scanner {
    private pos: number = 0;
    private len: number = 0;
    private startPos: number = 0;
    private tokenPos: number = 0;
    private token: SyntaxKind = SyntaxKind.Unknown;
    private tokenValue: string;
    private text: string;
    private tokenIsUnterminated: boolean;
    private indents: number[] = [];
    private queue: SyntaxKind[];
    private copyQueueOnWrite: boolean;
    private copyIndentsOnWrite: boolean;
    private filename: string;
    private diagnostics: DiagnosticMessages;

    constructor(filename: string, text: string, diagnostics: DiagnosticMessages) {
        this.filename = filename;
        this.text = text;
        this.len = text.length;    
    }

    public getPos(): number {
        return this.pos;
    }

    public getLen(): number {
        return this.len;
    }

    public getStartPos(): number {
        return this.startPos;
    }

    public getTokenPos(): number {
        return this.tokenPos;
    }

    public getToken(): SyntaxKind {
        return this.token;
    }

    public getTokenValue(): string {
        return this.tokenValue;
    }        

    public getDiagnostics(): DiagnosticMessages {
        return this.diagnostics;
    }

    public scan(): SyntaxKind {
        if (this.isQueued()) {
            return this.token = this.dequeueToken();
        }

        var token = this.scanToken();
        if (this.isQueued()) {
            if (token !== -1) {
                this.enqueueToken(token);
            }

            return this.token = this.dequeueToken();
        }

        return this.token = token;
    }

    public speculate<T>(callback: () => T, isLookahead: boolean): T {
        var savePos = this.pos;
        var saveStartPos = this.startPos;
        var saveTokenPos = this.tokenPos;
        var saveToken = this.token;
        var saveTokenValue = this.tokenValue;
        var saveCopyQueueOnWrite = this.copyQueueOnWrite;
        var saveCopyIndentsOnWrite = this.copyIndentsOnWrite;
        var saveQueue = this.queue;
        var saveIndents = this.indents;
        var saveDiagnostics = this.diagnostics;
        this.diagnostics = NullDiagnosticMessages.instance;
        this.copyQueueOnWrite = true;
        this.copyIndentsOnWrite = true;
        var result = callback();
        this.diagnostics = saveDiagnostics;
        if (!result || isLookahead) {
            this.pos = savePos;
            this.startPos = saveStartPos;
            this.tokenPos = saveTokenPos;
            this.token = saveToken;
            this.tokenValue = saveTokenValue;
            this.queue = saveQueue;
            this.indents = saveIndents;
            this.copyQueueOnWrite = saveCopyQueueOnWrite;
            this.copyIndentsOnWrite = saveCopyIndentsOnWrite;
        }
        return result;
    }

    private scanToken(): SyntaxKind {
        this.startPos = this.pos;
        this.tokenIsUnterminated = false;
        this.tokenValue = "";
        while (true) {
            this.tokenPos = this.pos;
            if (this.pos >= this.len) {
                return this.token = SyntaxKind.EndOfFileToken;
            }

            var ch = this.text.charCodeAt(this.pos);
            switch (ch) {
                case CharacterCodes.LineFeed:
                case CharacterCodes.CarriageReturn:
                    if (ch === CharacterCodes.CarriageReturn && this.text.charCodeAt(this.pos + 1) === CharacterCodes.LineFeed) {
                        this.pos += 2;
                    }
                    else {
                        this.pos++;
                    }
                    
                    this.enqueueToken(SyntaxKind.LineTerminatorToken);
                    this.scanIndent();
                    return -1;

                case CharacterCodes.Space:
                    if (this.pos === 0) {
                        this.scanIndent();
                        continue;
                    }

                case CharacterCodes.Tab:
                case CharacterCodes.VerticalTab:
                case CharacterCodes.FormFeed:
                    this.pos++;
                    continue;

                case CharacterCodes.DoubleQuote:
                    return this.tokenValue = this.scanString(ch), this.token = SyntaxKind.StringLiteral;
                case CharacterCodes.Backtick:
                    return this.tokenValue = this.scanString(ch), this.token = SyntaxKind.Terminal;
                case CharacterCodes.LessThan:
                    if (this.text.charCodeAt(this.pos + 1) === CharacterCodes.Exclamation) {
                        return this.pos += 2, this.token = SyntaxKind.LessThanExclamationToken;
                    }
                    else if (this.text.charCodeAt(this.pos + 1) === CharacterCodes.Minus) {
                        return this.pos += 2, this.token = SyntaxKind.LessThanMinusToken;
                    }
                    else {
                        return this.tokenValue = this.scanString(CharacterCodes.GreaterThan), this.token = SyntaxKind.Prose;
                    }
                case CharacterCodes.Slash:
                    if (this.pos + 1 < this.len) {
                        switch (this.text.charCodeAt(this.pos + 1)) {
                            case CharacterCodes.Slash:
                                this.pos += 2;

                                while (this.pos < this.len) {
                                    if (this.isLineTerminator(this.text.charCodeAt(this.pos))) {
                                        break;
                                    }
                                    this.pos++;
                                }
                                continue;
                            case CharacterCodes.Asterisk:
                                this.pos += 2;

                                var commentClosed = false;
                                while (this.pos < this.len) {
                                    var ch = this.text.charCodeAt(this.pos);
                                    if (ch === CharacterCodes.Asterisk && this.text.charCodeAt(this.pos + 1) === CharacterCodes.Slash) {
                                        this.pos += 2;
                                        commentClosed = true;
                                        break;
                                    }
                                    this.pos++;
                                }

                                if (!commentClosed) {
                                    this.getDiagnostics().report(this.pos, Diagnostics._0_expected, "*/");
                                }
                                continue;
                            case CharacterCodes.CarriageReturn:
                                if (this.pos + 2 < this.len && this.text.charCodeAt(this.pos + 2) === CharacterCodes.LineFeed) {
                                    this.pos++;
                                }
                                // fall through
                            case CharacterCodes.LineFeed:
                            case CharacterCodes.LineSeparator:
                            case CharacterCodes.ParagraphSeparator:
                                this.pos += 2;
                                continue;
                        }
                    }
                    return this.pos++, this.token = SyntaxKind.Unknown;
                case CharacterCodes.OpenParen:
                    return this.pos++, this.token = SyntaxKind.OpenParenToken;
                case CharacterCodes.CloseParen:
                    return this.pos++, this.token = SyntaxKind.CloseParenToken;
                case CharacterCodes.OpenBracket:
                    return this.pos++, this.token = SyntaxKind.OpenBracketToken;
                case CharacterCodes.CloseBracket:
                    return this.pos++, this.token = SyntaxKind.CloseBracketToken;
                case CharacterCodes.OpenBrace:
                    return this.pos++, this.token = SyntaxKind.OpenBraceToken;
                case CharacterCodes.CloseBrace:
                    return this.pos++, this.token = SyntaxKind.CloseBraceToken;
                case CharacterCodes.Plus:
                    return this.pos++, this.token = SyntaxKind.PlusToken;
                case CharacterCodes.Tilde:
                    return this.pos++, this.token = SyntaxKind.TildeToken;
                case CharacterCodes.Comma:
                    return this.pos++, this.token = SyntaxKind.CommaToken;
                case CharacterCodes.Colon:
                    return this.pos++, this.token = SyntaxKind.ColonToken;
                case CharacterCodes.Question:
                    return this.pos++, this.token = SyntaxKind.QuestionToken;
                case CharacterCodes.NumberSign:
                    if (this.pos + 7 < this.text.length) {
                        ch = this.text.charCodeAt(this.pos + 1);
                        if (ch === CharacterCodes.UpperD || ch === CharacterCodes.LowerD) {
                            ch = this.text.charCodeAt(this.pos + 2);
                            if (ch === CharacterCodes.UpperE || ch === CharacterCodes.LowerE) {
                                ch = this.text.charCodeAt(this.pos + 3);
                                if (ch === CharacterCodes.UpperF || ch === CharacterCodes.LowerF) {
                                    ch = this.text.charCodeAt(this.pos + 4);
                                    if (ch === CharacterCodes.UpperI || ch === CharacterCodes.LowerI) {
                                        ch = this.text.charCodeAt(this.pos + 5);
                                        if (ch === CharacterCodes.UpperN || ch === CharacterCodes.LowerN) {
                                            ch = this.text.charCodeAt(this.pos + 6);
                                            if (ch === CharacterCodes.UpperE || ch === CharacterCodes.LowerE) {
                                                ch = this.text.charCodeAt(this.pos + 7);
                                                if (!this.isIdentifierPart(ch)) {
                                                    return this.pos += 7, this.token = SyntaxKind.DefineKeyword;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        else if (ch === CharacterCodes.UpperI || ch === CharacterCodes.LowerI) {
                            ch = this.text.charCodeAt(this.pos + 2);
                            if (ch === CharacterCodes.UpperM || ch === CharacterCodes.LowerM) {
                                ch = this.text.charCodeAt(this.pos + 3);
                                if (ch === CharacterCodes.UpperP || ch === CharacterCodes.LowerP) {
                                    ch = this.text.charCodeAt(this.pos + 4);
                                    if (ch === CharacterCodes.UpperO || ch === CharacterCodes.LowerO) {
                                        ch = this.text.charCodeAt(this.pos + 5);
                                        if (ch === CharacterCodes.UpperR || ch === CharacterCodes.LowerR) {
                                            ch = this.text.charCodeAt(this.pos + 6);
                                            if (ch === CharacterCodes.UpperT || ch === CharacterCodes.LowerT) {
                                                ch = this.text.charCodeAt(this.pos + 7);
                                                if (!this.isIdentifierPart(ch)) {
                                                    return this.pos += 7, this.token = SyntaxKind.ImportKeyword;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    return this.pos++, this.token = SyntaxKind.Unknown;
                case CharacterCodes.At:
                    return this.pos++, this.token = SyntaxKind.AtToken;
                case CharacterCodes.Equals:
                    if (this.text.charCodeAt(this.pos + 1) === CharacterCodes.Equals) {
                        return this.pos += 2, this.token = SyntaxKind.EqualsEqualsToken;
                    }
                    return this.pos++, this.token = SyntaxKind.EqualsToken;
                case CharacterCodes.Exclamation:
                    if (this.text.charCodeAt(this.pos + 1) === CharacterCodes.Equals) {
                        return this.pos += 2, this.token = SyntaxKind.ExclamationEqualsToken;
                    }
                    return this.pos++, this.token = SyntaxKind.Unknown;

                default:
                    if (this.isIdentifierStart(ch)) {
                        this.pos++;
                        while (this.pos < this.len && this.isIdentifierPart(ch = this.text.charCodeAt(this.pos))) this.pos++;
                        this.tokenValue = this.text.substring(this.tokenPos, this.pos);
                        return this.token = this.getIdentifierToken();
                    }
                    this.getDiagnostics().report(this.pos, Diagnostics.Invalid_character);
                    return this.pos++, this.token = SyntaxKind.Unknown;
            }
        }
    }

    private scanIndent(): void {
        this.tokenPos = this.pos;
        if (this.pos >= this.len) {
            while (this.indents.length) {
                this.indents.pop();
                this.enqueueToken(SyntaxKind.DedentToken);
            }
            return;
        }

        var ch = this.text.charCodeAt(this.pos);
        while (ch === CharacterCodes.Space || ch === CharacterCodes.Tab) {
            this.pos++;
            ch = this.text.charCodeAt(this.pos);
        }

        var tokenLen = this.pos - this.tokenPos;
        var dedentCount = 0;
        for (var i = 0; i < this.indents.length; i++) {
            tokenLen -= this.indents[i];
            if (tokenLen < 0) {
                dedentCount++;
            }
        }

        if (tokenLen > 0) {
            if (this.copyIndentsOnWrite) {
                this.indents = this.indents.slice(0);
                this.copyIndentsOnWrite = false;
            }
            this.indents.push(tokenLen);
            this.enqueueToken(SyntaxKind.IndentToken);
        }
        else {
            for (var i = 0; i < dedentCount; i++) {
                if (this.copyIndentsOnWrite) {
                    this.indents = this.indents.slice(0);
                    this.copyIndentsOnWrite = false;
                }
                this.indents.pop();
                this.enqueueToken(SyntaxKind.DedentToken);
            }
        }
    }

    private scanString(quote: number): string {
        this.pos++;
        var result = "";
        var start = this.pos;
        while (true) {
            if (this.pos >= this.len) {
                result += this.text.substring(start, this.pos);
                this.tokenIsUnterminated = true;
                this.getDiagnostics().report(this.pos, Diagnostics.Unterminated_string_literal);
                break;
            }
            var ch = this.text.charCodeAt(this.pos);
            if (ch === quote) {
                result += this.text.substring(start, this.pos);
                this.pos++;
                break;
            }
            if (ch === CharacterCodes.Backslash) {
                result += this.text.substring(start, this.pos);
                result += this.scanEscapeSequence();
                start = this.pos;
                continue;
            }
            if (this.isLineTerminator(ch)) {
                result += this.text.substring(start, this.pos);
                this.tokenIsUnterminated = true;
                this.getDiagnostics().report(this.pos, Diagnostics.Unterminated_string_literal);
                break;
            }
            this.pos++;
        }
        return result;
    }

    private scanEscapeSequence(): string {
        var start = this.pos;
        this.pos++;
        if (this.pos >= this.len) {
            this.getDiagnostics().report(start, Diagnostics.Invalid_escape_sequence);
            return "";
        }

        var ch = this.text.charCodeAt(this.pos++);
        switch (ch) {
            case CharacterCodes.Number0:
                return "\0";
            case CharacterCodes.LowerB:
                return "\b";
            case CharacterCodes.LowerT:
                return "\t";
            case CharacterCodes.LowerN:
                return "\n";
            case CharacterCodes.LowerV:
                return "\v";
            case CharacterCodes.LowerF:
                return "\f";
            case CharacterCodes.LowerR:
                return "\r";
            case CharacterCodes.SingleQuote:
                return "\'";
            case CharacterCodes.DoubleQuote:
                return "\"";
            case CharacterCodes.LowerX:
            case CharacterCodes.LowerU:
                var ch = this.scanHexDigits(ch === CharacterCodes.LowerX ? 2 : 4, /*mustMatchCount*/ true);
                if (ch >= 0) {
                    return String.fromCharCode(ch);
                }
                else {
                    this.getDiagnostics().report(start, Diagnostics.Invalid_escape_sequence);
                    return "";
                }

            // when encountering a LineContinuation (i.e. a backslash and a line terminator sequence),
            // the line terminator is interpreted to be "the empty code unit sequence".
            case CharacterCodes.CarriageReturn:
                if (this.pos < this.len && this.text.charCodeAt(this.pos) === CharacterCodes.LineFeed) {
                    this.pos++;
                }
                // fall through
            case CharacterCodes.LineFeed:
            case CharacterCodes.LineSeparator:
            case CharacterCodes.ParagraphSeparator:
                return ""
            default:
                return String.fromCharCode(ch);
        }
    }

    private scanHexDigits(count: number, mustMatchCount?: boolean): number {
        var digits = 0;
        var value = 0;
        while (digits < count || !mustMatchCount) {
            var ch = this.text.charCodeAt(this.pos);
            if (ch >= CharacterCodes.Number0 && ch <= CharacterCodes.Number9) {
                value = value * 16 + ch - CharacterCodes.Number0;
            }
            else if (ch >= CharacterCodes.UpperA && ch <= CharacterCodes.UpperF) {
                value = value * 16 + ch - CharacterCodes.UpperA + 10;
            }
            else if (ch >= CharacterCodes.LowerA && ch <= CharacterCodes.LowerF) {
                value = value * 16 + ch - CharacterCodes.LowerA + 10;
            }
            else {
                break;
            }
            this.pos++;
            digits++;
        }
        if (digits < count) {
            value = -1;
        }
        return value;
    }

    private scanNumber(): number {
        var start = this.pos;
        while (this.isDigit(this.text.charCodeAt(this.pos))) this.pos++;
        if (this.text.charCodeAt(this.pos) === CharacterCodes.Dot) {
            this.pos++;
            while (this.isDigit(this.text.charCodeAt(this.pos))) this.pos++;
        }
        var end = this.pos;
        if (this.text.charCodeAt(this.pos) === CharacterCodes.UpperE || this.text.charCodeAt(this.pos) === CharacterCodes.LowerE) {
            this.pos++;
            if (this.text.charCodeAt(this.pos) === CharacterCodes.Plus || this.text.charCodeAt(this.pos) === CharacterCodes.Minus) this.pos++;
            if (this.isDigit(this.text.charCodeAt(this.pos))) {
                this.pos++;
                while (this.isDigit(this.text.charCodeAt(this.pos))) this.pos++;
                end = this.pos;
            }
            else {
                this.getDiagnostics().report(start, Diagnostics.Digit_expected);
            }
        }
        return +(this.text.substring(start, end));
    }

    private isIdentifierStart(ch: number): boolean {
        return ch >= CharacterCodes.UpperA && ch <= CharacterCodes.UpperZ
            || ch >= CharacterCodes.LowerA && ch <= CharacterCodes.LowerZ
            || ch === CharacterCodes.Underscore;
    }

    private isIdentifierPart(ch: number): boolean {
        return ch >= CharacterCodes.UpperA && ch <= CharacterCodes.UpperZ
            || ch >= CharacterCodes.LowerA && ch <= CharacterCodes.LowerZ
            || ch >= CharacterCodes.Number0 && ch <= CharacterCodes.Number9
            || ch === CharacterCodes.Underscore;
    }

    private isLineTerminator(ch: number): boolean {
        return ch === CharacterCodes.CarriageReturn || ch === CharacterCodes.LineFeed;
    }

    private isDigit(ch: number): boolean {
        return ch >= CharacterCodes.Number0 && ch <= CharacterCodes.Number9;
    }

    private getIdentifierToken(): SyntaxKind {
        var len = this.tokenValue.length;
        if (len >= 2 && len <= 9) {
            var ch = this.tokenValue.charCodeAt(0);
            if (ch >= CharacterCodes.LowerA && ch <= CharacterCodes.LowerT) {
                let token = stringToToken(this.tokenValue);
                if (token !== undefined) {
                    return this.token = token;
                }
            }
        }
        return this.token = SyntaxKind.Identifier;
    }

    private isQueued(): boolean {
        return this.queue && this.queue.length > 0;
    }

    private enqueueToken(token: SyntaxKind): void {
        if (!this.queue) {
            this.queue = [];
        }
        else if (this.copyQueueOnWrite) {
            this.queue = this.queue.slice(0);
            this.copyQueueOnWrite = false;
        }
        this.queue.push(token);
    }

    private dequeueToken(): SyntaxKind {
        if (this.queue && this.queue.length) {
            if (this.copyQueueOnWrite) {
                this.queue = this.queue.slice(0);
                this.copyQueueOnWrite = false;
            }
            return this.queue.shift();
        }
    }

    private reportError(message: string): void {
        console.log(message);
    }
}

