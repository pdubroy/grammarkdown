/*!
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
import { Dict } from "./core";
import { LineMap } from "./diagnostics";
import { SyntaxKind } from "./tokens";
import { SymbolTable } from "./symbols";

let nextNodeId = 0;

export interface TextContent {
    text: string;
}

export interface Optional {
    optionalToken: Node;
}

export interface TextRange {
    pos: number;
    end: number;
}

export class Node implements TextRange {
    public kind: SyntaxKind;
    public id: number = ++nextNodeId;
    public pos: number;
    public end: number;

    constructor(kind: SyntaxKind) {
        this.kind = kind;
    }
}

export class StringLiteral extends Node implements TextContent {
    public text: string;
    
    constructor(text: string) {
        super(SyntaxKind.StringLiteral);
        
        this.text = text;
    }
}

export class Identifier extends Node implements TextContent {
    public text: string;
    
    constructor(text: string) {
        super(SyntaxKind.Identifier);
        
        this.text = text;
    }
}

export class LexicalSymbol extends Node {
}

export class PrimarySymbol extends LexicalSymbol {
}

export class OptionalSymbol extends PrimarySymbol {
    public questionToken: Node;
    
    constructor(kind: SyntaxKind, questionToken: Node) {
        super(kind);
        
        this.questionToken = questionToken;
    }
}

export class UnicodeCharacterLiteral extends OptionalSymbol implements TextContent {
    public text: string;
    
    constructor(text: string, questionToken: Node) {
        super(SyntaxKind.UnicodeCharacterLiteral, questionToken);
        
        this.text = text;
    }
}


export class BinarySymbol extends LexicalSymbol {
    public left: LexicalSymbol;
    public operatorToken: Node;
    public right: LexicalSymbol;
    
    constructor(left: LexicalSymbol, operatorToken: Node, right: LexicalSymbol) {
        super(SyntaxKind.BinarySymbol);
        
        this.left = left;
        this.operatorToken = operatorToken;
        this.right = right;
    }
}

export class Terminal extends OptionalSymbol implements TextContent {
    public text: string;
    
    constructor(text: string, questionToken: Node) {
        super(SyntaxKind.Terminal, questionToken);
        
        this.text = text;
    }
}

export class TerminalList extends Node {
    public terminals: Terminal[];
    
    constructor(terminals: Terminal[] = []) {
        super(SyntaxKind.TerminalList);
        
        this.terminals = terminals;
    }
}

export class SymbolSet extends Node {
    public openBraceToken: Node;
    public elements: SymbolSpan[];
    public closeBraceToken: Node;
    
    constructor(openBraceToken: Node, elements: SymbolSpan[], closeBraceToken: Node) {
        super(SyntaxKind.SymbolSet);
        
        this.openBraceToken = openBraceToken;
        this.elements = elements;
        this.closeBraceToken = closeBraceToken;
    }
}

export class Assertion extends LexicalSymbol {
    public openBracketToken: Node;
    public closeBracketToken: Node;
    
    constructor(kind: SyntaxKind, openBracketToken: Node, closeBracketToken: Node) {
        super(kind);
        
        this.openBracketToken = openBracketToken;
        this.closeBracketToken = closeBracketToken;
    }
}

export class EmptyAssertion extends Assertion {
    public emptyKeyword: Node;
    
    constructor(openBracketToken: Node, emptyKeyword: Node, closeBracketToken: Node) {
        super(SyntaxKind.EmptyAssertion, openBracketToken, closeBracketToken);
        
        this.emptyKeyword = emptyKeyword;
    }
}

export class LookaheadAssertion extends Assertion {
    public lookaheadKeyword: Node;
    public operatorToken: Node;
    public lookahead: SymbolSpan | SymbolSet;
    
    constructor(openBracketToken: Node, lookaheadKeyword: Node, operatorToken: Node, lookahead: SymbolSpan | SymbolSet, closeBracketToken: Node) {
        super(SyntaxKind.LookaheadAssertion, openBracketToken, closeBracketToken);
        
        this.lookaheadKeyword = lookaheadKeyword;
        this.operatorToken = operatorToken;
        this.lookahead = lookahead;
    }
}

export class LexicalGoalAssertion extends Assertion {
    public lexicalKeyword: Node;
    public goalKeyword: Node;
    public symbol: Identifier;
    
    constructor(openBracketToken: Node, lexicalKeyword: Node, goalKeyword: Node, symbol: Identifier, closeBracketToken: Node) {
        super(SyntaxKind.LexicalGoalAssertion, openBracketToken, closeBracketToken);
        
        this.lexicalKeyword = lexicalKeyword;
        this.goalKeyword = goalKeyword;
        this.symbol = symbol;
    }
}

export class NoSymbolHereAssertion extends Assertion {
    public noKeyword: Node;
    public symbols: PrimarySymbol[];
    public hereKeyword: Node;
    
    constructor(openBracketToken: Node, noKeyword: Node, symbols: PrimarySymbol[], hereKeyword: Node, closeBracketToken: Node) {
        super(SyntaxKind.NoSymbolHereAssertion, openBracketToken, closeBracketToken);
        
        this.noKeyword = noKeyword;
        this.symbols = symbols;
        this.hereKeyword = hereKeyword;
    }
}

export class ParameterValueAssertion extends Assertion {
    public operatorToken: Node;
    public name: Identifier;
    
    constructor(openBracketToken: Node, operatorToken: Node, name: Identifier, closeBracketToken: Node) {
        super(SyntaxKind.ParameterValueAssertion, openBracketToken, closeBracketToken);
        
        this.operatorToken = operatorToken;
        this.name = name;
    }
}

export class Argument extends Node {
    public questionToken: Node;
    public name: Identifier;
    
    constructor(questionToken: Node, name: Identifier) {
        super(SyntaxKind.Argument);
        
        this.questionToken = questionToken;
        this.name = name;
    }
}

export class ArgumentList extends Node {
    public openParenToken: Node;
    public elements: Argument[];
    public closeParenToken: Node;
    
    constructor(openParenToken: Node, elements: Argument[], closeParenToken: Node) {
        super(SyntaxKind.ArgumentList);
        
        this.openParenToken = openParenToken;
        this.elements = elements;
        this.closeParenToken = closeParenToken;
    }
}

export class Nonterminal extends OptionalSymbol {
    public name: Identifier;
    public argumentList: ArgumentList;
    
    constructor(name: Identifier, argumentList: ArgumentList, questionToken: Node) {
        super(SyntaxKind.Nonterminal, questionToken);
        
        this.name = name;
        this.argumentList = argumentList;
    }
}

export class Prose extends LexicalSymbol implements TextContent {
    public text: string;
    
    constructor(text: string) {
        super(SyntaxKind.Prose);
        
        this.text = text;
    }
}

export class ButNotOperator extends Node {
    public butKeyword: Node;
    public notKeyword: Node;
    
    constructor(butKeyword: Node, notKeyword: Node) {
        super(SyntaxKind.ButNotOperator);
        
        this.butKeyword = butKeyword;
        this.notKeyword = notKeyword;
    }
}

export class OneOfSymbol extends LexicalSymbol {
    public oneKeyword: Node;
    public ofKeyword: Node;
    public symbols: LexicalSymbol[];
    
    constructor(oneKeyword: Node, ofKeyword: Node, symbols: LexicalSymbol[]) {
        super(SyntaxKind.OneOfSymbol);
        
        this.oneKeyword = oneKeyword;
        this.ofKeyword = ofKeyword;
        this.symbols = symbols;
    }
}

export class SymbolSpan extends Node {
    public symbol: LexicalSymbol;
    public next: SymbolSpan;
    
    constructor(symbol: LexicalSymbol, next: SymbolSpan) {
        super(SyntaxKind.SymbolSpan);
        
        this.symbol = symbol;
        this.next = next;
    }
}

export class LinkReference extends Node {
    public text: string;
    
    constructor(text: string) {
        super(SyntaxKind.LinkReference);
        
        this.text = text;
    }
}

export class RightHandSide extends Node {
    public head: SymbolSpan;
    public reference: LinkReference;
    
    constructor(head: SymbolSpan, reference: LinkReference) {
        super(SyntaxKind.RightHandSide);
        
        this.head = head;
        this.reference = reference;
    }
}

export class RightHandSideList extends Node {
    public openIndentToken: Node;
    public elements: RightHandSide[];
    public closeIndentToken: Node;
    
    constructor(openIndentToken: Node, elements: RightHandSide[], closeIndentToken: Node) {
        super(SyntaxKind.RightHandSideList);
        
        this.openIndentToken = openIndentToken;
        this.elements = elements;
        this.closeIndentToken = closeIndentToken;
    }
}

export class OneOfList extends Node {
    public openIndentToken: Node;
    public oneKeyword: Node;
    public ofKeyword: Node;
    public terminals: Terminal[];
    public closeIndentToken: Node;
    
    constructor(oneKeyword: Node, ofKeyword: Node, openIndentToken: Node, terminals: Terminal[], closeIndentToken: Node) {
        super(SyntaxKind.OneOfList);
        
        this.oneKeyword = oneKeyword;
        this.ofKeyword = ofKeyword;
        this.openIndentToken = openIndentToken;
        this.terminals = terminals;
        this.closeIndentToken = closeIndentToken;
    }
}

export class Parameter extends Node {
    public name: Identifier;
    
    constructor(name: Identifier) {
        super(SyntaxKind.Parameter);
        
        this.name = name;
    }
}

export class ParameterList extends Node {
    public openParenToken: Node;
    public elements: Parameter[];
    public closeParenToken: Node;
    
    constructor(openParenToken: Node, elements: Parameter[], closeParenToken: Node) {
        super(SyntaxKind.ParameterList);
        
        this.openParenToken = openParenToken;
        this.elements = elements;
        this.closeParenToken = closeParenToken;
    }
}

export class SourceElement extends Node {
}

export class Production extends SourceElement {
    public name: Identifier;
    public colonToken: Node;
    public parameterList: ParameterList;
    public body: OneOfList | RightHandSide | RightHandSideList;
    
    constructor(name: Identifier, parameters: ParameterList, colonToken: Node, body: OneOfList | RightHandSide | RightHandSideList) {
        super(SyntaxKind.Production);
        
        this.name = name;
        this.parameterList = parameters;
        this.colonToken = colonToken;
        this.body = body;
    }
}

export class Import extends SourceElement {
    public atToken: Node;
    public importKeyword: Node;
    public path: StringLiteral;
    
    constructor(atToken: Node, importKeyword: Node, path: StringLiteral) {
        super(SyntaxKind.Import);
        this.atToken = atToken;
        this.importKeyword = importKeyword;
        this.path = path;
    }
}

export class SourceFile extends Node {
    public filename: string;
    public text: string;
    public elements: SourceElement[];
    public lineMap: LineMap;
    public imports: string[];
    
    constructor(filename: string, text: string) {
        super(SyntaxKind.SourceFile);
        
        this.filename = filename;
        this.text = text;
        this.lineMap = new LineMap(text);
        this.pos = 0;
        this.end = this.text.length;
    }
}

function visitNode<T>(node: Node, cbNode: (node: Node) => T): T {
    if (node) {
        return cbNode(node);
    }
    
    return undefined;
}

function visitNodes<T>(nodes: Node[], cbNode: (Node: Node) => T): T {
    if (nodes) {
        let result: T;
        for (let i = 0; i < nodes.length; i++) {
            result = visitNode(nodes[i], cbNode);
            if (result) {
                return result;
            }
        }
    }
    
    return undefined;
}    

export function forEachChild<T>(node: Node, cbNode: (node: Node) => T): T {
    if (node) {
        switch (node.kind) {
            case SyntaxKind.TerminalList:
                return visitNodes((<TerminalList>node).terminals, cbNode);
                
            case SyntaxKind.SymbolSet:
                return visitNode((<SymbolSet>node).openBraceToken, cbNode)
                    || visitNodes((<SymbolSet>node).elements, cbNode)
                    || visitNode((<SymbolSet>node).closeBraceToken, cbNode);
                    
            case SyntaxKind.EmptyAssertion:
                return visitNode((<EmptyAssertion>node).openBracketToken, cbNode)
                    || visitNode((<EmptyAssertion>node).emptyKeyword, cbNode)
                    || visitNode((<EmptyAssertion>node).closeBracketToken, cbNode);
                    
            case SyntaxKind.LookaheadAssertion:
                return visitNode((<LookaheadAssertion>node).openBracketToken, cbNode)
                    || visitNode((<LookaheadAssertion>node).lookaheadKeyword, cbNode)
                    || visitNode((<LookaheadAssertion>node).operatorToken, cbNode)
                    || visitNode((<LookaheadAssertion>node).lookahead, cbNode)
                    || visitNode((<LookaheadAssertion>node).closeBracketToken, cbNode);
                    
            case SyntaxKind.LexicalGoalAssertion:
                return visitNode((<LexicalGoalAssertion>node).openBracketToken, cbNode)
                    || visitNode((<LexicalGoalAssertion>node).lexicalKeyword, cbNode)
                    || visitNode((<LexicalGoalAssertion>node).goalKeyword, cbNode)
                    || visitNode((<LexicalGoalAssertion>node).symbol, cbNode)
                    || visitNode((<LexicalGoalAssertion>node).closeBracketToken, cbNode);
                    
            case SyntaxKind.NoSymbolHereAssertion:
                return visitNode((<NoSymbolHereAssertion>node).openBracketToken, cbNode)
                    || visitNode((<NoSymbolHereAssertion>node).noKeyword, cbNode)
                    || visitNodes((<NoSymbolHereAssertion>node).symbols, cbNode)
                    || visitNode((<NoSymbolHereAssertion>node).hereKeyword, cbNode)
                    || visitNode((<NoSymbolHereAssertion>node).closeBracketToken, cbNode);
                    
            case SyntaxKind.ParameterValueAssertion:
                return visitNode((<ParameterValueAssertion>node).openBracketToken, cbNode)
                    || visitNode((<ParameterValueAssertion>node).operatorToken, cbNode)
                    || visitNode((<ParameterValueAssertion>node).name, cbNode)
                    || visitNode((<ParameterValueAssertion>node).closeBracketToken, cbNode);
                    
            case SyntaxKind.InvalidAssertion:
                return visitNode((<Assertion>node).openBracketToken, cbNode)
                    || visitNode((<Assertion>node).closeBracketToken, cbNode);
                    
            case SyntaxKind.Terminal:
            case SyntaxKind.UnicodeCharacterLiteral:
                return visitNode((<OptionalSymbol>node).questionToken, cbNode);
                
            case SyntaxKind.Nonterminal:
                return visitNode((<Nonterminal>node).name, cbNode)
                    || visitNode((<Nonterminal>node).argumentList, cbNode)
                    || visitNode((<Nonterminal>node).questionToken, cbNode);
                    
            case SyntaxKind.OneOfSymbol:
                return visitNodes((<OneOfSymbol>node).symbols, cbNode);
                
            case SyntaxKind.BinarySymbol:
                return visitNode((<BinarySymbol>node).left, cbNode)
                    || visitNode((<BinarySymbol>node).operatorToken, cbNode)
                    || visitNode((<BinarySymbol>node).right, cbNode);
                    
            case SyntaxKind.SymbolSpan:
                return visitNode((<SymbolSpan>node).symbol, cbNode)
                    || visitNode((<SymbolSpan>node).next, cbNode);
                    
            case SyntaxKind.RightHandSide:
                return visitNode((<RightHandSide>node).head, cbNode)
                    || visitNode((<RightHandSide>node).reference, cbNode);
                
            case SyntaxKind.RightHandSideList:
                return visitNode((<RightHandSideList>node).openIndentToken, cbNode)
                    || visitNodes((<RightHandSideList>node).elements, cbNode)
                    || visitNode((<RightHandSideList>node).closeIndentToken, cbNode);
                    
            case SyntaxKind.OneOfList:
                return visitNode((<OneOfList>node).oneKeyword, cbNode)
                    || visitNode((<OneOfList>node).ofKeyword, cbNode)
                    || visitNode((<OneOfList>node).openIndentToken, cbNode)
                    || visitNodes((<OneOfList>node).terminals, cbNode)
                    || visitNode((<OneOfList>node).closeIndentToken, cbNode);
                    
            case SyntaxKind.Parameter:
                return visitNode((<Parameter>node).name, cbNode);
                
            case SyntaxKind.ParameterList:
                return visitNode((<ParameterList>node).openParenToken, cbNode)
                    || visitNodes((<ParameterList>node).elements, cbNode)
                    || visitNode((<ParameterList>node).closeParenToken, cbNode);
                    
            case SyntaxKind.Argument:
                return visitNode((<Argument>node).questionToken, cbNode)
                    || visitNode((<Argument>node).name, cbNode);
                    
            case SyntaxKind.ArgumentList:
                return visitNode((<ArgumentList>node).openParenToken, cbNode)
                    || visitNodes((<ArgumentList>node).elements, cbNode)
                    || visitNode((<ArgumentList>node).closeParenToken, cbNode)
                    
            case SyntaxKind.Production:
                return visitNode((<Production>node).name, cbNode)
                    || visitNode((<Production>node).parameterList, cbNode)
                    || visitNode((<Production>node).body, cbNode);
                    
            case SyntaxKind.Import:
                return visitNode((<Import>node).atToken, cbNode)
                    || visitNode((<Import>node).importKeyword, cbNode)
                    || visitNode((<Import>node).path, cbNode);
                    
            case SyntaxKind.SourceFile:
                return visitNodes((<SourceFile>node).elements, cbNode);
        }
    }

    return undefined;
}