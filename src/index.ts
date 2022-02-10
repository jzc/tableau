import * as ReactDOM from "react-dom";
import * as React from "react";
import { createElement as e } from "react";
import * as katex from "katex";
import "./style.css";
import "katex/dist/katex.min.css";
// import  "./Formula.ts";
import {
  Formula, v, bot, top, and, or, implies, not,
  prettyString, reduce, reducible, randomFormula,
  isContradictionPair,
} from "./Formula"

type HTMLAttributes = React.HTMLAttributes<unknown>;

interface DOMElementProps {
  classes: string[],
  attributes: HTMLAttributes,
}


interface FormulaProps extends DOMElementProps {
  formula: Formula,
  sizeObj?: {width: number, height: number},
}

function FormulaComponent(props: FormulaProps) {
  props.classes.push("formula");
  return e("p", {
    ref: (el) => {
      if (el) {
	katex.render(prettyString(props.formula), el, {
	  output: "html",
	})
	let fontSizeStr = window.getComputedStyle(el).fontSize;
	// let fontSize = Number(fontSizeStr.slice(0, -2));
	let rect = el.getBoundingClientRect();
	let wPx = rect.width;
	let hPx = rect.height;
	if (props.sizeObj !== undefined) {
	  props.sizeObj.width = wPx // /fontSize;
	  props.sizeObj.height = hPx // /fontSize;
	}
      }
    },
    className: props.classes.join(" "),
    ...props.attributes,
  });
}

type ArrayIndex = number;
type TableauIndex = string;
type FormulaIndex = [TableauIndex, ArrayIndex];

function eqIdx(idx1: FormulaIndex, idx2: FormulaIndex): boolean {
  return idx1[0] === idx2[0] && idx1[1] === idx2[1];
}

interface FormulaDatum {
  formula: Formula
}

class Tableau {
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
      if (!this.subTableaus) { throw "tableau idnex out of bounds"; }
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
    let x = [];
    for (let i = 0; i < idx.length-1; i++) {
      x.push(idx.slice(0, i));
    }
    return x;
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
    return this.closeBranch(fIdx2[0]);
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

    let x =
      Array(tableauIndex.length)
	.fill(0)
	.map((_, i) => tableauIndex.slice(0,i))
	.reverse();
    for (let idx of x) {
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

type IndexedFormulaProps =
  (tableau: Tableau,
   formula: Formula,
   idx: FormulaIndex) => DOMElementProps;

type IndexedTableauProps =
  (tableau: Tableau,
   idx: TableauIndex) => DOMElementProps;

interface BaseTableauProps {
  tableau: Tableau,
  indexedFormulaProps: IndexedFormulaProps,
  indexedTableauProps: IndexedTableauProps,
  currTableauIndex?: TableauIndex,
  sizeObj?: {width: number, height: number},
}

function BaseTableauComponent(props: BaseTableauProps) : null | React.ReactElement {
  let { tableau,
	indexedFormulaProps,
	indexedTableauProps,
	currTableauIndex, } = props;
  currTableauIndex ??= "";
  
  let formulaeSizesRef = React.useRef([] as {width: number, height: number}[]);
  let leftSizeRef = React.useRef({width: 0, height: 0});
  let rightSizeRef = React.useRef({width: 0, height: 0});
  let childrenDivRef = React.useRef<HTMLElement>(null);
  let tableauDivRef = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    let childrenSize = {
      width: 0,
      height: Math.max(leftSizeRef.current.height,
		       rightSizeRef.current.height)
    }
    if (childrenDivRef.current !== null) {
      let style = getComputedStyle(childrenDivRef.current);
      // let fontSize = Number(style.fontSize.slice(0, -2));
      // let rowGap = Number(style.rowGap.slice(0, -2));
      let rowGap = 48;
      // let m = Math.max(leftSizeRef.current.width, rightSizeRef.current.width);
      childrenSize.width =
	rowGap // rowGap + 2 * m
	+ leftSizeRef.current.width
	+ rightSizeRef.current.width;
    } 
    let tableauWidth =
      Math.max(
	childrenSize.width,
	...formulaeSizesRef.current.map(({width})=>width)
      );
    let tableauHeight =
      [childrenSize.height,
       ...formulaeSizesRef.current.map(({height})=>height)]
	.reduce((x,y)=>x+y);

    // Propogate the size of the tableau we rendered up
    if (props.sizeObj !== undefined) {
      props.sizeObj.width = tableauWidth;
      props.sizeObj.height = tableauHeight;
    }

    // Set the styles
    if (tableauDivRef.current !== null) {
      let el = tableauDivRef.current;
      el.style.width = `${tableauWidth}px`;
      el.style.height = `${tableauHeight}px`;
    }
    if (childrenDivRef.current !== null) {
      childrenDivRef.current.classList.remove("hidden");
    }
  });
  
  
  
  if (!tableau) {
    return null;
  } else {
    // construct the formula components
    formulaeSizesRef.current = [];
    leftSizeRef.current = {width: 0, height: 0};
    rightSizeRef.current = {width: 0, height: 0};
    
    let children = tableau.formulaData.map(
      (datum, arrayIdx) => {
	// currTableauIndex shouldn't be undefined as we checked
	// earlier and updated its value accordingly, but the type
	// checker seems to be weird when we capture currTableauIndex
	// inside an arrow function, so we need the type assertion
	// (the other uses of currTableauIndex later in the function
	// type check fine because they are not within an arrow function...)
	// https://github.com/microsoft/TypeScript/issues/33319
	let sizeObj = {width: 0, height: 0}
	formulaeSizesRef.current.push(sizeObj);
	let idx: FormulaIndex = [(currTableauIndex as TableauIndex), arrayIdx];
	return e(FormulaComponent, {
	  formula: datum.formula,
	  ...indexedFormulaProps(tableau, datum.formula, idx),
	  sizeObj: sizeObj,
	  key: arrayIdx
	});
      }
    );

    // construct subtableau components
    let last = null;
    if (tableau.subTableaus) {
      last =
	// e("div", {className: "childrenBox"},
	e("div", {
	  className: "children hidden",
	  ref: childrenDivRef,
	},
	  e(BaseTableauComponent, {
	    tableau: tableau.subTableaus.left,
	    indexedFormulaProps: indexedFormulaProps,
	    indexedTableauProps: indexedTableauProps,
	    currTableauIndex:  currTableauIndex + "L",
	    sizeObj: leftSizeRef.current,
	  }),
	  e(BaseTableauComponent, {
	    tableau: tableau.subTableaus.right,
	    indexedFormulaProps: indexedFormulaProps,
	    indexedTableauProps: indexedTableauProps,
	    currTableauIndex: currTableauIndex + "R",
	    sizeObj: rightSizeRef.current,
	  }));
    } else if (tableau.isClosed) {
      last = e("p", {}, "X");
    }

    // construct the actual tableau    
    let props = indexedTableauProps(tableau, currTableauIndex);
    props.classes.push("tableau");
    return e("div", {
      className: props.classes.join(" "), ...props.attributes,
      ref: tableauDivRef,
    }, children, last);
  }
}

let nTransitivity = not(implies(implies(v("p"), v("q")),
				implies(implies(v("q"), v("r")),
					implies(v("p"), v("r")))));

let neg = not(not(not(not(v("p_1")))));
let p = v("p");
// let test = nTransitivity;
let test = randomFormula(0, 4);
// let test = or(bot(), bot());

// let test = or(p, p);
// test = or(test, test);
// test = and(test, test);
// test = or(test, test);

interface AppProps {
  initialFormula: Formula,
}

interface AppState {
  tableau: Tableau,
  swapTableau: Tableau,
  isNegated: boolean,
  state:  {tag: "default"} |
    {tag: "selectReduce" | "selectClose", selectedIdx: FormulaIndex}
}

class App extends React.Component<AppProps, AppState> {
  constructor(props: AppProps) {
    super(props);
    this.state = {
      tableau: Tableau.initialTableau(props.initialFormula),
      swapTableau: Tableau.initialTableau(not(props.initialFormula)),
      isNegated: false,
      state: {tag: "default"}
    };
  }

  reduceFormula = (formulaIdx: FormulaIndex, tableauIdx: TableauIndex) => {
    this.setState((state, _) => {
      return {
	tableau: state.tableau.reduceFormula(formulaIdx, tableauIdx),
	state: {tag: "default"},
      }
    }) 
  }

  closeBranchWithBot = (idx: FormulaIndex) => {
    this.setState((state, _) => {
      return {
	tableau: state.tableau.closeBranchWithBot(idx),
	state: {tag: "default"},
      }
    })
  }

  transitionToSelectReduce = (selectedIdx: FormulaIndex) => {
    this.setState({state: {tag: "selectReduce", selectedIdx: selectedIdx}});
  }

  transitionToSelectClose = (selectedIdx: FormulaIndex) => {
    this.setState({state: {tag: "selectClose", selectedIdx: selectedIdx}});
  }

  transitionToDefault = () => {
    this.setState({state: {tag: "default"}});
  }

  renderTableauDefault = () => e(BaseTableauComponent, {
    tableau: this.state.tableau,
    indexedFormulaProps: (currTableau, formula, formulaIdx) => {
      let props: DOMElementProps = {classes: [], attributes: {}};
      props.classes.push("hoverable");
      props.attributes.onContextMenu = () => {
	if (formula.tag === "bot") {
	  this.closeBranchWithBot(formulaIdx);
	} else {
	  this.transitionToSelectClose(formulaIdx);
	}
      }

      let fullyApplied = this.state.tableau.isFormulaFullyApplied(formulaIdx);
      
      if (!currTableau.isClosed) {
	props.attributes.onClick = () => {
	  if (!fullyApplied && reducible(formula)) {
	    if (currTableau.isLeaf()) {
	      this.reduceFormula(formulaIdx, formulaIdx[0]);
	    } else {
	    this.transitionToSelectReduce(formulaIdx);
	    }
	  }
	}
      }
      
      if (fullyApplied) {
	props.classes.push("fully-applied");
      }
      
      return props;
    },
    indexedTableauProps: (currTableau, _) => {
      let props: DOMElementProps = {classes: [], attributes: {}};
      if (currTableau.isClosed) {
	props.classes.push("closed");
      } 
      return props;
    }
  })

  renderTableauSelectReduce = (selectedIdx: FormulaIndex) =>
    e(BaseTableauComponent, {
      tableau: this.state.tableau,
      indexedFormulaProps: (currTableau, formula, formulaIdx) => {
	let props: DOMElementProps = {classes: [], attributes: {}};
	if (eqIdx(selectedIdx, formulaIdx)) {
	  props.classes.push("selected");
	}
	if (this.state.tableau.isFormulaFullyApplied(formulaIdx)) {
	  props.classes.push("fully-applied");
	}
	return props;
      },
      indexedTableauProps: (currTableau, tableauIdx) => {
	let props: DOMElementProps = {classes: [], attributes: {}}; 
	if (this.state.tableau.getApplicableBranches(selectedIdx)
	  .some(([_, idxp]) => tableauIdx === idxp)) {
	  props.classes.push("selectable");
	  props.attributes.onClick = e => {
	    this.reduceFormula(selectedIdx, tableauIdx);
	    e.stopPropagation();
	  }
	}
	return props;
      }
    });

  renderTableauSelectClose = (selectedIdx: FormulaIndex) =>
    e(BaseTableauComponent, {
      tableau: this.state.tableau,
      indexedFormulaProps: (currTableau, formula, formulaIdx) => {
	let props: DOMElementProps = {classes: [], attributes: {}}; 
	if (eqIdx(formulaIdx, selectedIdx)) {
	  props.classes.push("selected");
	}
	return props;
      },
      indexedTableauProps: () => {
	let props: DOMElementProps = {classes: [], attributes: {}};
	return props;
      }
    });

  renderTableau() {
    switch (this.state.state.tag) {
      case "default":
	return this.renderTableauDefault();
      case "selectReduce":
	return this.renderTableauSelectReduce(this.state.state.selectedIdx);
      case "selectClose":
	return this.renderTableauSelectClose(this.state.state.selectedIdx);
    }
  }
  
  render() {
    let props: HTMLAttributes = {};
    props.onContextMenu = e => e.preventDefault();
    props.onKeyDown = e => {
      console.log("hi");
      if (e.code === "Space") {
	this.setState((state, _) => {
	  return {
	    tableau: state.swapTableau,
	    swapTableau: state.tableau,
	  }
	});
      }
    }
    if (this.state.state.tag === "selectReduce" ||
      this.state.state.tag === "selectClose") {
      props.onClick = () => this.transitionToDefault();
    }
    return e("main", {...props, tabIndex: -1}, this.renderTableau());
  }
}

const reactRoot = document.createElement("div");
reactRoot.id = "react-root";
document.body.appendChild(reactRoot);

ReactDOM.render(
  e(App, {initialFormula: test}),
  reactRoot,
)
