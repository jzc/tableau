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

export function parenthesize(
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

export function prettyString(f : Formula) : string {
  let parenthesizeLeft : boolean;
  let parenthesizeRight: boolean;
  switch (f.tag) {
    case "var":
      return f.name;
    case "bot":
      return "\\bot";
    case "top":
      return "\\top";
    case "not":
      switch (f.arg.tag) {
	case "var":
	case "bot":
	case "top":
	case "not":
	  return `\\neg ${prettyString(f.arg)}`;
	default:
	  return `\\neg(${prettyString(f.arg)})`;
      }
    case "implies":
      return parenthesize(
	prettyString(f.left), f.left.tag === "implies",
	"\\implies",
	prettyString(f.right), false
      );
    case "and":
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
	prettyString(f.left), parenthesizeLeft,
	"\\land",
	prettyString(f.right), parenthesizeRight,
      )
    case "or":
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
	prettyString(f.left), parenthesizeLeft,
	"\\lor",
	prettyString(f.right), parenthesizeRight,
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

export function randomFormula(n : number, d : number) : Formula {
  if (d === 0) {
    let r = Math.floor(Math.random()*(n+2));
    if (r === 0) {
      return bot();
    } else if (r === 1) {
      return top();
    } else {
      return v(`p_${r-2}`);
    }
  } else {
    let r = Math.floor(Math.random()*4);
    switch (r) {
      case 0:
	return and(randomFormula(n, d-1),
		   randomFormula(n, d-1));
      case 1:
	return or(randomFormula(n, d-1),
		  randomFormula(n, d-1));
      case 2:
	return implies(randomFormula(n, d-1),
		       randomFormula(n, d-1));
      case 3:
	return not(randomFormula(n, d-1));
      default:
	throw "err";
    }
  }
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
