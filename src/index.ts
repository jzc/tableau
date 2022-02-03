import * as ReactDOM from "react-dom";
import * as React from "react";
import { createElement as e } from "react";
import * as katex from "katex";
import "./style.css";
import "katex/dist/katex.min.css";

interface VariableFormula {
  tag: "var",
  name: string
}

interface UnaryFormula {
  tag: "not",
  arg: Formula
}

interface BinaryFormula {
  tag: "and" | "or" | "implies"
  left: Formula,
  right: Formula,
}

interface ConstantFormula {
  tag: "bot" | "top"
}

type Formula =
  VariableFormula | UnaryFormula
  | BinaryFormula | ConstantFormula;

function v(name: string): VariableFormula {
  return {tag: "var", name: name}
}

function not(arg: Formula) : UnaryFormula {
  return {tag: "not", arg: arg}
}

function and(left: Formula, right: Formula): BinaryFormula {
  return {tag: "and", left: left, right: right}
}

function or(left: Formula, right: Formula): BinaryFormula {
  return {tag: "or", left: left, right: right}
}

function implies(left: Formula, right: Formula): BinaryFormula {
  return {tag: "implies", left: left, right: right}
}

function bot(): ConstantFormula {
  return {tag: "bot"}
}

function top(): ConstantFormula {
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

function prettyString(f : Formula) : string {
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

function reducible(f : Formula) : boolean {
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

function reduce(f: Formula) : {conjuncts: Formula[]} | {disjuncts: Formula[]} {
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

type HTMLAttributes = React.HTMLAttributes<unknown>;

interface DOMElementProps {
  classes: string[],
  attributes: HTMLAttributes,
}

interface FormulaProps extends DOMElementProps {
  formula: Formula,
}

function FormulaComponent(props: FormulaProps) {
  props.classes.push("formula");
  return e("p", {
    ref: (el) => {
      if (el) {
	katex.render(prettyString(props.formula), el, {
	  output: "html",
	})
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
  return idx1[0] == idx2[0] && idx1[1] == idx2[1];
}

interface FormulaDatum {
  formula: Formula
}

class Tableau {
  readonly formulaData: readonly FormulaDatum[] = [];
  readonly appliedFormulae: readonly FormulaIndex[] = [];
  readonly subTableaus?: {readonly left: Tableau, readonly right: Tableau};
  readonly leafTableaus: [Tableau, TableauIndex][];  

  constructor(
    formulaData: readonly FormulaDatum[],
    appliedFormulae : readonly FormulaIndex[],
    subTableaus?: {readonly left: Tableau, readonly right: Tableau}
  ) {
    this.formulaData = formulaData;
    this.appliedFormulae = appliedFormulae;
    this.subTableaus = subTableaus;

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

  updateTableau(
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
	    [...tableau.appliedFormulae, formulaIdx]	    
	  )
	);
	return new Tableau(
	  tableau.formulaData,
	  tableau.appliedFormulae,
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
	tableauIdx.startsWith(idx[0]) && 
	!tableau.appliedFormulae.some(idxp => eqIdx(idx, idxp))
    );
  }

  isFormulaFullyApplied(idx: FormulaIndex) : boolean {
    return this.getApplicableBranches(idx).length === 0;
  }

  isLeaf() : boolean {
    return this.subTableaus === undefined;
  }
}

interface TableauProps {
  tableau: Tableau,
  formulaProps: (idx: FormulaIndex) => DOMElementProps,
  tableauProps: (idx: TableauIndex) => DOMElementProps,
  currTableauIndex?: TableauIndex,
  tableauDivRef?: any,
  tableauWidthRef?: any,
}

function BaseTableauComponent(props: TableauProps) : null | React.ReactElement {
  let { tableau,
	formulaProps,
	tableauProps,
	currTableauIndex,
	tableauDivRef, } = props;
  
  let leftTableauRef = React.useRef<any>(null);
  let rightTableauRef = React.useRef<any>(null);
  let childrenRef = React.useRef<any>(null);
  // React.useEffect(() => {
  //   if (tableauDivRef !== undefined) {
  //     console.log(currTableauIndex);
  //     let d = tableauDivRef.current;
  //     let m = Math.max(...[...d.children].map((x:any) => x.clientWidth));
  //     console.log(m);
  //     console.log("before:", d.scrollWidth);
  //     d.style.width = `${m}px`;
  //     console.log("after:", d.scrollWidth);
  //   } else if (tableau.subTableaus !== undefined) {
  //     let c = childrenRef.current;
  //     let l = leftTableauRef.current;
  //     let r = rightTableauRef.current;
  //     let lw = window.getComputedStyle(l).width;
  //     let rw = window.getComputedStyle(r).width;
  //     console.log(l, lw, r, rw);
  //     let m = Math.max(l.clientWidth, r.clientWidth);
  //     c.style.gridAutoColumns = `${m}px`;
  //   }
    
  //   // if (tableau.subTableaus === undefined) {return;}
  //     // childrenRef.scrollWidth = `${l.scrollWid

  // });
  
  

  
  // https://github.com/microsoft/TypeScript/issues/33319
  let currTableauIndexP =
    currTableauIndex === undefined ? "" : currTableauIndex;
  
  if (!tableau) {
    return null;
  } else {
    // construct the formula components
    let children = tableau.formulaData.map(
      (datum, arrayIdx) => {
	let idx: FormulaIndex = [currTableauIndexP, arrayIdx];
	let extraProps = formulaProps(idx);
	let props : FormulaProps & {key: number} = {
	  formula: datum.formula,
	  ...extraProps,
	  key: arrayIdx
	};
	return e(FormulaComponent, props);
      }
    );

    // construct subtableau components
    let subTableaus = null;
    if (tableau.subTableaus) {
      subTableaus =
	// e("div", {className: "childrenBox"},
	e("div", {
	  className: "children",
	  ref: childrenRef
	},
	  e(BaseTableauComponent, {
	    tableau: tableau.subTableaus.left,
	    formulaProps: formulaProps,
	    tableauProps: tableauProps,
	    currTableauIndex:  currTableauIndexP + "L",
	    tableauDivRef: leftTableauRef,
	  }),
	  e(BaseTableauComponent, {
	    tableau: tableau.subTableaus.right,
	    formulaProps: formulaProps,
	    tableauProps: tableauProps,
	    currTableauIndex: currTableauIndexP + "R",
	    tableauDivRef: rightTableauRef,
	  }));
    }

    // construct the actual tableau
    // if (!tableauDivRef) { throw "err"; }
    
    let props = tableauProps(currTableauIndexP);
    props.classes.push("tableau");
    return e("div", {
      className: props.classes.join(" "), ...props.attributes,
      ref: (el:any) => {
	if (el) {
	  let ws = [...el.children].map(
	    x => {
	      if ([...x.classList].includes("children")) {
		let rowGap =  window.getComputedStyle(x).rowGap;
		let leftWidth = x.children[0].dataset.calculatedWidth;
		let rightWidth = x.children[1].dataset.calculatedWidth;
		console.log(rowGap, leftWidth, rightWidth);
		return Number(rowGap.slice(0,-2)) + Number(leftWidth) + Number(rightWidth);
	      } else {
		return x.clientWidth;
	      }
	    }
	  );
	  console.log(ws, el.scrollWidth, el.clientWidth);
	  let m = Math.max(...ws, el.scrollWidth, el.clientWidth);
	  el.dataset.calculatedWidth = m;
	  console.log(el, el.scrollWidth, el.clientWidth, m);
	  el.style.width = `${m}px`;
	  el.style.height = `${el.scrollHeight}px`;
	}
      }
      // tableauDivRef,
      // // (e:any) => {
      // // 	if (e) {
      // // 	  e.style.height = `${e.scrollHeight}px`;
      // // 	  // e.style.width = `${e.scrollWidth+1}px`;
      // // 	}
      // // }
    }, children, subTableaus);
  }
}

function TableauComponent(props: TableauProps) {
  return e(BaseTableauComponent, {
    ...props,
    formulaProps: formulaIdx => {
      let oldProps = props.formulaProps(formulaIdx)
      if (props.tableau.isFormulaFullyApplied(formulaIdx)) {
	return {
	  ...oldProps,
	  classes: [...oldProps.classes, "fully-applied"]
	}
      } else {
	return oldProps
      }
    }
  });
}

function ReducingTableauComponent(
  props: {
    tableau: Tableau,
    onClickApplicableFormula: () => void,
    onClickNonApplicableFormula: () => void,
  }
) {
  let { tableau,
	onClickApplicableFormula,
	onClickNonApplicableFormula, } = props;
  return e(TableauComponent, {
    tableau: tableau,
    formulaProps: formulaIdx => {
      let formulaProps : DOMElementProps =
	{classes: ["hoverable"], attributes: {}};
      if (!tableau.isFormulaFullyApplied(formulaIdx) &&
	reducible(tableau.formulaAt(formulaIdx).formula)) {
	if (tableau.tableauAt(formulaIdx[0]).isLeaf()) {
	  formulaProps.attributes = {
	    onClick: (_) => onClickApplicableFormula(),
	    // (_) => this.reduceFormula(formulaIdx, formulaIdx[0])
	  } 
	} else {
	  formulaProps.attributes = {
	    onClick: (_) => onClickNonApplicableFormula(),
	      // this.transitionToSelecting(formulaIdx)
	  }
	}
      }
      return formulaProps
    },
    tableauProps: _ => ({
      classes: [],
      attributes: {},
    }),
  });
}

let nTransitivity = not(implies(implies(v("p"), v("q")),
				implies(implies(v("q"), v("r")),
					implies(v("p"), v("r")))));

function randomFormula(n : number, d : number) : Formula {
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

let neg = not(not(not(not(v("p_1")))));
let p = v("p");
// let test = randomFormula(5, 4);
let test = or(p, p);
test = or(test, test);
test = and(test, test);
test = or(test, test);

interface AppState {
  tableau: Tableau
  state:  {tag: "reducing"} |
    {tag: "selecting" | "closing", selectedIdx: FormulaIndex}
}

class App extends React.Component<{}, AppState> {
  constructor(props: {}) {
    super(props);
    let t = new Tableau([{formula: test}], []);
    // t.formulaDatum.push({formula: nTransitivity, selected: false});
    this.state = {
      tableau: t,
      state: {tag: "reducing"}
    };
  }

  onFormulaClick: (formulaIdx: FormulaIndex) => React.MouseEventHandler =
    formulaIdx => _ => 
    this.setState((state, _) => {
      if (reducible(state.tableau.formulaAt(formulaIdx).formula) &&
	!state.tableau.isFormulaFullyApplied(formulaIdx)) {
	if (state.tableau.isLeaf()) {
	  
	  return {
	    ...state,
	    tableau: state.tableau.reduceFormula(formulaIdx, "")
	  }
	} else {
	  return {
	    ...state,
	    state: {tag: "selecting", selectedIdx: formulaIdx}
	  }
	}
      } else {
	return null;
      }
    });

  reduceFormula = (formulaIdx: FormulaIndex, tableauIdx: TableauIndex) => {
    this.setState((state, _) => {
      return {
	tableau: state.tableau.reduceFormula(formulaIdx, tableauIdx),
	state: {tag: "reducing"}
      }
    }) 
  }

  transitionToSelecting = (selectedIdx: FormulaIndex) => {
    this.setState({state: {tag: "selecting", selectedIdx: selectedIdx}});
  }

  transitionToReducing = () => {
    this.setState({state: {tag: "reducing"}});
  }

  renderTableauReducing() {
    // return e(ReducingTableauComponent, {
    //   tableau: this.state.tableau,
    //   onClickApplicableFormula: () => this.
    // })
    return e(TableauComponent, {
      tableau: this.state.tableau,
      formulaProps: formulaIdx => {
	let props = {classes: ["hoverable"], attributes: {}}
	if (!this.state.tableau.isFormulaFullyApplied(formulaIdx) &&
	  reducible(this.state.tableau.formulaAt(formulaIdx).formula)) {
	  if (this.state.tableau.tableauAt(formulaIdx[0]).isLeaf()) {
	    props.attributes = {
	      onClick: (_:any) => this.reduceFormula(formulaIdx, formulaIdx[0])
	    } 
	  } else {
	    props.attributes = {
	      onClick: (_:any) => this.transitionToSelecting(formulaIdx)
	    }
	  }
	}
	return props
      },
      tableauProps: _ => ({
	classes: [],
	attributes: {},
      }),
    });
  }

  renderTableauSelecting(selectedIdx: FormulaIndex) {
    return e(TableauComponent, {
      tableau: this.state.tableau,
      formulaProps: formulaIdx => {
	if (eqIdx(formulaIdx, selectedIdx)) {
	  return {classes: ["selected"], attributes: {}}
	} else {
	  return {classes: [], attributes: {}}
	}
      },
      tableauProps: tableauIdx => {
	let tableau = this.state.tableau.tableauAt(tableauIdx);
	
	if (
	  this.state.tableau.getApplicableBranches(selectedIdx)
	    .some(([_, idxp]) => tableauIdx === idxp)
	) {
	  return {
	    classes: ["selectable"],
	    attributes: {
	      onClick: e => {
		this.reduceFormula(selectedIdx, tableauIdx);
		e.stopPropagation();
	      },
	    }
	  }
	} else {
	  return {
	    classes: [],
	    attributes: {},
	  }
	}
      },
    });
  }

  renderTableau() {
    switch (this.state.state.tag) {
      case "reducing":
	return this.renderTableauReducing();
      case "selecting":
	return this.renderTableauSelecting(this.state.state.selectedIdx);
      case "closing":
	throw "err"
    }
  }
  
  render() {
    let props: HTMLAttributes = {}
    if (this.state.state.tag === "selecting" ||
      this.state.state.tag === "closing") {
      props.onClick = _ => {
	this.transitionToReducing();
	console.log("hi");
      }
    }
    return e("main", props, this.renderTableau());
  }
}

const reactRoot = document.createElement("div");
reactRoot.id = "react-root";
document.body.appendChild(reactRoot);

ReactDOM.render(
  e(App),
  reactRoot,
)
