import {
  Formula, reduce, isContradictionPair
} from "./Formula"

export type ArrayIndex = number;
export type TableauIndex = string;
export type FormulaIndex = [TableauIndex, ArrayIndex];

export function eqIdx(idx1: FormulaIndex, idx2: FormulaIndex): boolean {
  return idx1[0] === idx2[0] && idx1[1] === idx2[1];
}

interface FormulaDatum {
  formula: Formula
}

export class Tableau {
  readonly formulaData: readonly FormulaDatum[] = [];
  private readonly appliedFormulae: readonly FormulaIndex[] = [];
  readonly subTableaus?: {readonly left: Tableau, readonly right: Tableau};
  private readonly leafTableaus: [Tableau, TableauIndex][];
  readonly isClosed: boolean;
  
  private constructor(
    formulaData: readonly FormulaDatum[],
    appliedFormulae : readonly FormulaIndex[],
    isClosed: boolean,
    subTableaus?: {readonly left: Tableau, readonly right: Tableau}
  ) {
    this.formulaData = formulaData;
    this.appliedFormulae = appliedFormulae;
    this.subTableaus = subTableaus;
    this.isClosed = isClosed;

    if (this.subTableaus === undefined) {
      this.leafTableaus = [[this, ""]]
    } else {
      let left = this.subTableaus.left.leafTableaus.map(
	([t, idx]):[Tableau, TableauIndex] => [t, "L"+idx]
      )
      let right = this.subTableaus.right.leafTableaus.map(
	([t, idx]):[Tableau, TableauIndex] => [t, "R"+idx]
      )
      this.leafTableaus = left.concat(right);
    }
  }

  static initialTableau(f: Formula) {
    return new Tableau([{formula: f}], [], false);
  }

  tableauAt(tableauIndex: TableauIndex) : Tableau {
    if (tableauIndex === "") {
      return this;
    } else {
      if (!this.subTableaus) { throw "tableau index out of bounds"; }
      if (tableauIndex[0] === "L") {
	return this.subTableaus.left.tableauAt(tableauIndex.slice(1));
      } else if (tableauIndex[0] === "R") {
	return this.subTableaus.right.tableauAt(tableauIndex.slice(1));
      } else {
	throw "invalid tableau index"
      }
    }
  }
  
  formulaAt([tableauIndex, arrayIndex]: FormulaIndex) : FormulaDatum {
    return this.tableauAt(tableauIndex).formulaData[arrayIndex];
  }

  private updateTableau(
    tableauIndex: TableauIndex,
    updater: (tableau: Tableau) => Tableau,
  ) : Tableau {
    if (tableauIndex === "") {
      return updater(this);
    } else {
      if (!this.subTableaus) { throw "tableau index out of bounds"; }
      if (tableauIndex[0] === "L") {
	return new Tableau(
	  this.formulaData,
	  this.appliedFormulae,
	  this.isClosed,
	  {
	    left: this.subTableaus.left.updateTableau(
	      tableauIndex.slice(1), updater
	    ),
	    right: this.subTableaus.right
	  }
	);
      } else if (tableauIndex[0] === "R") {
	return new Tableau(
	  this.formulaData,
	  this.appliedFormulae,
	  this.isClosed,
	  {
	    left: this.subTableaus.left,
	    right: this.subTableaus.right.updateTableau(
	      tableauIndex.slice(1), updater
	    )
	  }
	);
      } else {
	throw "invalid tableau index";
      }
    }
  }

  reduceFormula(formulaIdx: FormulaIndex, tableauIdx: TableauIndex) : Tableau  {
    let formulaDatum = this.formulaAt(formulaIdx);
    return this.updateTableau(tableauIdx, tableau => {
      if (tableau.subTableaus) {
	throw "tableau index must refer to a leaf tableau"
      }
      if (tableau.appliedFormulae.some(
	appliedIdx => eqIdx(appliedIdx, formulaIdx))) {
	throw "formula has already been applied on the given branch"
      }
      let reductionResult = reduce(formulaDatum.formula);
      if ("conjuncts" in reductionResult) {
	// Formula we are reducing is a conjunctive formula, append
	// the conjuncts to the branch we are applying it to and add
	// the formula we reduced to the applied formulae of the
	// branch
	let newFormulaData = [
	  ...tableau.formulaData,
	  ...reductionResult.conjuncts.map(f => ({formula: f}))
	];
	let newAppliedFormulae = [
	  ...tableau.appliedFormulae,
	  formulaIdx,
	];
	return new Tableau(
	  newFormulaData,
	  newAppliedFormulae,
	  tableau.isClosed,
	  tableau.subTableaus
	);
      } else {
	// Formula we are reducing is a disjunctive formula, create
	// two new subtableaus both containing just a disjunct,
	// inheriting the applied formulae of the branch we are apply
	// the reduction to as well as the formula we reduced, and
	// having no subtableaus
	let newSubTableaus = reductionResult.disjuncts.map(
	  f => new Tableau(
	    [{formula: f}],
	    [...tableau.appliedFormulae, formulaIdx],
	    tableau.isClosed,
	  )
	);
	return new Tableau(
	  tableau.formulaData,
	  tableau.appliedFormulae,
	  tableau.isClosed,
	  {
	    left: newSubTableaus[0],
	    right: newSubTableaus[1],
	  }	  
	);
      }      
    })
  }

  getApplicableBranches(idx: FormulaIndex) : [Tableau, TableauIndex][] {
    return this.leafTableaus.filter(
      ([tableau, tableauIdx]) =>
	!tableau.isClosed &&
	tableauIdx.startsWith(idx[0]) && 
	!tableau.appliedFormulae.some(idxp => eqIdx(idx, idxp))
    );
  }

  isFormulaFullyApplied(idx: FormulaIndex) : boolean {
    return this.getApplicableBranches(idx).length === 0;
  }

  getDescendants(idx: TableauIndex) : TableauIndex[] {
    function recurse(t: Tableau, currIdx : TableauIndex) : TableauIndex[] {
      let x = [];
      if (t.subTableaus !== undefined) {
	let idxL = currIdx + "L";
	let idxR = currIdx + "R";
	x.push(idxL, ...recurse(t.subTableaus.left, idxL));
	x.push(idxR, ...recurse(t.subTableaus.right, idxR));
      }
      return x;
    }
    return recurse(this.tableauAt(idx), idx);
  }

  getAncestors(idx: TableauIndex) : TableauIndex[] {
    // let x = [];
    // for (let i = 0; i < idx.length-1; i++) {
    //   x.push(idx.slice(0, i));
    // }
    // return x;
    return Array(idx.length)
      .fill(0)
      .map((_, i) => idx.slice(0,i))
      .reverse()
  }

  isLeaf() : boolean {
    return this.subTableaus === undefined;
  }

  closeBranchWithBot(formulaIdx: FormulaIndex) : Tableau {
    let f = this.formulaAt(formulaIdx).formula;
    if (f.tag !== "bot") { throw "formula not bot"; }
    return this.closeBranch(formulaIdx[0]);
  }

  closeBranchWithContradiction(fIdx1: FormulaIndex, fIdx2: FormulaIndex) : Tableau {
    if (fIdx2[0].startsWith(fIdx1[0])) {
      // swap so fIdx2 so fIdx1[0].startsWith(fIdx2[0]) is true
      // after the if-then-else
      let temp = fIdx1;
      fIdx1 = fIdx2;
      fIdx2 = temp;
    } else if (!fIdx1[0].startsWith(fIdx2[0])) {
      throw "indicies are not within same branch";
    }
    let f1 = this.formulaAt(fIdx1).formula;
    let f2 = this.formulaAt(fIdx2).formula;
    if (!isContradictionPair(f1, f2)) { throw "not a contradiction"; }
    return this.closeBranch(fIdx1[0]);
  }

  private closeBranch(tableauIndex: TableauIndex) : Tableau {
    // let t = this.tableauAt(tableauIndex);
    // if (t.isLeaf()) {
    let thisp = this.updateTableau(tableauIndex, tableau => {
      if (tableau.subTableaus === undefined) {
	return new Tableau(tableau.formulaData,
			   tableau.appliedFormulae,
			   true);
      } else {
	let left = tableau.subTableaus.left;
	if (!left.isClosed) {
	  left = left.closeBranch("");
	}
	let right = tableau.subTableaus.right;
	if (!right.isClosed) {
	  right = right.closeBranch("");
	}
	return new Tableau(tableau.formulaData,
			   tableau.appliedFormulae,
			   true,
			   {left: left, right: right});
      }
    });

    for (let idx of thisp.getAncestors(tableauIndex)) {
      let t = thisp.tableauAt(idx);
      let left = (t.subTableaus as any).left as Tableau;
      let right = (t.subTableaus as any).right as Tableau;
      if (!(left.isClosed && right.isClosed)) {
	break;
      } else {
	thisp = thisp.updateTableau(
	  idx,
	  _ => new Tableau(
	    t.formulaData,
	    t.appliedFormulae,
	    true,
	    {left: left, right: right})
	);
      }
    }
    return thisp;
  }  
}
