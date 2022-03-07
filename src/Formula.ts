export interface VariableFormula {
  tag: "var",
  name: string
}

export interface UnaryFormula {
  tag: "not",
  arg: Formula
}

export interface BinaryFormula {
  tag: "and" | "or" | "implies"
  left: Formula,
  right: Formula,
}

export interface ConstantFormula {
  tag: "bot" | "top"
}

export type Formula =
  VariableFormula | UnaryFormula
  | BinaryFormula | ConstantFormula;

export function v(name: string): VariableFormula {
  return {tag: "var", name: name}
}

export function not(arg: Formula) : UnaryFormula {
  return {tag: "not", arg: arg}
}

export function and(left: Formula, right: Formula): BinaryFormula {
  return {tag: "and", left: left, right: right}
}

export function or(left: Formula, right: Formula): BinaryFormula {
  return {tag: "or", left: left, right: right}
}

export function implies(left: Formula, right: Formula): BinaryFormula {
  return {tag: "implies", left: left, right: right}
}

export function bot(): ConstantFormula {
  return {tag: "bot"}
}

export function top(): ConstantFormula {
  return {tag: "top"}
}

function parenthesize(
  left: string, parenthesizeLeft: boolean,
  op: string,
  right: string, parenthesizeRight: boolean
) : string {
  left =
    parenthesizeLeft ?
    `(${left})` :
    left;
  right =
    parenthesizeRight ?
    `(${right})` :
    right;
  return `${left} ${op} ${right}`;
}

function colorbox(s: string, color: null|string) {
  return color === null ?
    s :
    `\\colorbox{${color}}{$${s}$}`
}

export function prettyString(
  f : Formula,
  options?: {highlightPrincipalOp?: boolean, unicode?: boolean}
) : string {
  options ??= {}
  options.highlightPrincipalOp ??= false;
  options.unicode ??= false;
  let {highlightPrincipalOp, unicode} = options;

  function withClass(s: string) {
    if (highlightPrincipalOp) {
      if (unicode) {
	return `<span class="principal">${s}</span>`;
      } else {
	return `\\mathbin{\\htmlClass{principal}{{${s}}}}`;
      }
    } else {
      return s;
    }
  }
  // let { highlightPrincipalOp=null,
  // 	unicode=false } = options ?? {};
  
  let parenthesizeLeft : boolean;
  let parenthesizeRight: boolean;
  switch (f.tag) {
    case "var":
      return f.name;
    case "bot":
      return unicode ? "⊥" : "\\bot";
    case "top":
      return unicode ? "⊤" : "\\top";
    case "not":
      let neg = unicode ? "¬" : "{\\neg}";
      let fp : Formula;
      let op : string;
      if (highlightPrincipalOp) {
	switch(f.arg.tag) {
	  case "not":
	    options = {...options, highlightPrincipalOp: false};
	    if (unicode) {
	      op = `<span class="principal">${neg} ${neg}</span>`;
	    } else {
	      op = `\\htmlClass{principal}{${neg} ${neg}}`;
	    }
	    fp = f.arg.arg;
	    break;
	  case "and":
	  case "or":
	  case "implies":
	    case "var":
	  case "bot":
	  case "top":
	    if (unicode) {
	      op = `<span class="principal">${neg}</span>`;
	    } else {
	      op = `\\htmlClass{principal}{${neg}}`;
	    }
	    fp = f.arg
	    break;
	  
	    // op = neg;
	    // fp = f.arg;	    
	    // break;
	}
      } else {
	op = neg;
	fp = f.arg;
      }
      switch (fp.tag) {
	case "not":
	case "var":
	case "bot":
	case "top":	
	  return `${op} ${prettyString(fp, options)}`;
	default:
	  return `${op}(${prettyString(fp, options)})`;
      }
    case "implies":
      options = {...options, highlightPrincipalOp: false};
      return parenthesize(
	prettyString(f.left, options), f.left.tag === "implies",
	unicode ? "⟹" : withClass("\\implies"),
	prettyString(f.right, options), false
      );
    case "and":
      options = {...options, highlightPrincipalOp: false};
      switch(f.left.tag) {
	case "or":
	case "implies":
	  parenthesizeLeft = true;
	  break;
	default:
	  parenthesizeLeft = false;
	  break;
      }
      switch(f.right.tag) {
	case "and":
	case "or":
	case "implies":
	  parenthesizeRight = true;
	  break;
	default:
	  parenthesizeRight = false;
	  break;
      }
      return parenthesize(
	prettyString(f.left, options), parenthesizeLeft,
	unicode ? "∧" : withClass("\\land"),
	prettyString(f.right, options), parenthesizeRight,
      )
    case "or":
      options = {...options, highlightPrincipalOp: false};
      switch(f.left.tag) {
	case "and":
	case "implies":
	  parenthesizeLeft = true;
	  break;
	default:
	  parenthesizeLeft = false;
	  break;
      }
      switch(f.right.tag) {
	case "and":
	case "or":
	case "implies":
	  parenthesizeRight = true;
	  break;
	default:
	  parenthesizeRight = false;
	  break;
      }
      return parenthesize(
	prettyString(f.left, options), parenthesizeLeft,
	unicode ? "∨" : withClass("\\lor"),
	prettyString(f.right, options), parenthesizeRight,
      )
  }
}

export function reducible(f : Formula) : boolean {
  switch (f.tag) {
    case "var":
    case "bot":
    case "top":
      return false;
    case "not":
      return f.arg.tag !== "var"
    default:
      return true;
  }
}

export function reduce(f: Formula) : {conjuncts: Formula[]} | {disjuncts: Formula[]} {
  switch (f.tag) {
    case "var":
    case "bot":
    case "top":
      throw "formula is not reducible";
    case "and":
      return {conjuncts: [f.left, f.right]}
    case "or":
      return {disjuncts: [f.left, f.right]}
    case "implies":
      return {disjuncts: [not(f.left), f.right]}
    case "not":
      switch (f.arg.tag) {
	case "var":
	  throw "formula is not reducible";
	case "not":
	  return {conjuncts: [f.arg.arg]};
	case "and":
	  return {disjuncts: [not(f.arg.left), not(f.arg.right)]};
	case "or":
	  return {conjuncts: [not(f.arg.left), not(f.arg.right)]};
	case "implies":
	  return {conjuncts: [f.arg.left, not(f.arg.right)]};
	case "bot":
	  return {conjuncts: [top()]};
	case "top":
	  return {conjuncts: [bot()]};	
      }
  }
}

function _randomFormula(
  n : number, d : number, noConstants: boolean
): { generatedVars: number[],
     formulaThunk: (transformer: (i:number) => string) => Formula}
{
  if (d === 0) {
    if (noConstants && n === 0) {
      throw "invalid arguments";
    }

    if (noConstants) {
      let r = Math.floor(Math.random()*n);      
      return {
	generatedVars: [r],
	formulaThunk: (transformer) => v(transformer(r))
      };
    } else {
      let r = Math.floor(Math.random()*(n+2));
      if (r === 0) {
	return {generatedVars: [], formulaThunk: () => bot()};
      } else if (r === 1) {
	return {generatedVars: [], formulaThunk: () => top()};
      } else {
	return {
	  generatedVars: [r-2],
	  formulaThunk: (transformer) => v(transformer(r-2)),
	}
      }
    }
  } else {
    let r = Math.floor(Math.random()*4);
    switch (r) {
      case 0:
	{
	  let { generatedVars: gv1, formulaThunk: th1 } =
	    _randomFormula(n, d-1, noConstants);
	  let { generatedVars: gv2, formulaThunk: th2 } =
	    _randomFormula(n, d-1, noConstants);
	  return {
	    generatedVars: gv1.concat(gv2),
	    formulaThunk: (transformer) => and(th1(transformer), th2(transformer)),
	  }
	}
      case 1:
	{
	  let { generatedVars: gv1, formulaThunk: th1 } =
	    _randomFormula(n, d-1, noConstants);
	  let { generatedVars: gv2, formulaThunk: th2 } =
	    _randomFormula(n, d-1, noConstants);
	  return {
	    generatedVars: gv1.concat(gv2),
	    formulaThunk: (transformer) => or(th1(transformer), th2(transformer)),
	  }
	}
      case 2:
	{
	  let { generatedVars: gv1, formulaThunk: th1 } =
	    _randomFormula(n, d-1, noConstants);
	  let { generatedVars: gv2, formulaThunk: th2 } =
	    _randomFormula(n, d-1, noConstants);
	  return {
	    generatedVars: gv1.concat(gv2),
	    formulaThunk: (transformer) => implies(th1(transformer), th2(transformer)),
	  }
	}
      case 3:
	{
	  let { generatedVars: gv1, formulaThunk: th1 } =
	    _randomFormula(n, d-1, noConstants);
	  return {
	    generatedVars: gv1,
	    formulaThunk: (transformer) => not(th1(transformer)),
	  }
	}
      default:
	throw "err";
    }
  }
}


function* iota(x: number, y: number) {
  let c = x;
  while (c < y) {
    yield c++;
  }
}

let alpha = [...iota("a".charCodeAt(0), "z".charCodeAt(0))]
	      .map(x=>String.fromCharCode(x));
let pidx = alpha.indexOf("p");
let vars = alpha.slice(pidx).concat(alpha.slice(0, pidx));

export function randomFormula(n : number, d : number, noConstants: boolean) {
  let {generatedVars, formulaThunk} = _randomFormula(n, d, noConstants);
  let min = Math.min(...generatedVars);
  return formulaThunk(x => {    
    let y = x - min;
    return vars[y % vars.length] + "'".repeat(Math.floor(y/vars.length));
  });
}

export function eqFormula(f1: Formula, f2: Formula) : boolean {
  if (f1.tag === f2.tag) {
    switch (f1.tag) {
      case "var":
	return f1.name === (f2 as VariableFormula).name;
      case "not":
	return eqFormula(f1.arg, (f2 as UnaryFormula).arg);
      case "and":
      case "or":
      case "implies":
	return eqFormula(f1.left, (f2 as BinaryFormula).left)
	  && eqFormula(f1.right, (f2 as BinaryFormula).right);
      case "bot":
      case "top":
	return true;	
    }
  } else {
    return false;
  }
}

function isXorNX(f1: Formula, f2: Formula) : boolean {
  if (f2.tag !== "not") {
    return false;
  }
  return eqFormula(f1, f2.arg);
}

export function isContradictionPair(f1: Formula, f2: Formula) : boolean {
  return isXorNX(f1, f2) || isXorNX(f2, f1);
}
