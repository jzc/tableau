import katex from "katex";
import * as React from "react";
import { createElement as e } from "react";

import {
  Formula, not, prettyString, reducible, bot
} from "./Formula";
import {
  Tableau, FormulaIndex, TableauIndex, eqIdx
} from "./Tableau";
import {
  randomTautology
} from "./Solver";

import "./style.css";
import "katex/dist/katex.min.css";

//@ts-ignore
import help_html from "./help.html";

type HTMLAttributes = React.HTMLAttributes<unknown>;

interface DOMElementProps {
  classes: string[],
  attributes: HTMLAttributes,
}

interface FormulaProps extends DOMElementProps {
  formula: Formula,
  sizeObj?: {width: number, height: number},
}

let katexMemo: Map<String, String> = new Map;
function renderToStringMemo(s: string) : string {
  if (katexMemo.has(s)) {
    return katexMemo.get(s) as string;
  } else {
    let x = katex.renderToString(s, {
      output: "html",
      trust: true,
      strict: "ignore",
    });
    katexMemo.set(s, x);
    return x;    
  }
}

function FormulaComponent(props: FormulaProps) {
  if (!props.classes.includes("formula")) {
    props.classes.push("formula");
  }

  let html = renderToStringMemo(
    prettyString(props.formula, {highlightPrincipalOp: true})
  );
  
  return e("p", {
    dangerouslySetInnerHTML: {__html: html},
    className: props.classes.join(" "),
    ...props.attributes,
  });
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

  // reference to the containing div of the tableau we are rendering
  let thisTableauDiv : HTMLElement; 
  // references to the containing divs of the formulae in this tableau
  let formulaeDivs : HTMLElement[] = []; 
  // reference to the containing div of the left subtableau
  let leftSize = {width: 0, height: 0}; 
  // reference to the containing div of the right subtableau
  let rightSize = {width: 0, height: 0};
  // reference to the div containing the subtableaus
  let childrenDiv : HTMLElement | null = null;
  
  React.useEffect(() => {
    // Compute the size of children (width and height are 0) if
    // the tableau has no subtableau
    
    let childrenWidth = 0;
    let childrenHeight = Math.max(leftSize.height,
				  rightSize.height);
    let childrenTop = 0;
    let closedMarkerWidth = 0;
    let closedMarkedHeight = 0;   
    if (childrenDiv !== null) {
      let style = getComputedStyle(childrenDiv);
      // let fontSize = Number(style.fontSize.slice(0, -2));
      // let rowGap = Number(style.rowGap.slice(0, -2));
      let rowGap = 48;
      // let m = Math.max(leftSizeRef.current.width, rightSizeRef.current.width);
      childrenWidth =
	rowGap // rowGap + 2 * m
	+ leftSize.width
	+ rightSize.width;
      childrenTop =
	[style.marginTop, style.borderTopWidth, style.paddingTop]
	  .map(s => Number(s.slice(0, -2)))
	  .reduce((x,y)=>x+y);
    }

    // Compute the width and height of the tableau we are rendering
    let tableauWidth =
      Math.max(
	childrenWidth,
	...formulaeDivs.map(el=>el.getBoundingClientRect().width)
      );

    let heights = [
      childrenTop,
      childrenHeight,
      ...formulaeDivs.map(el=>el.getBoundingClientRect().height)
    ];
    let tableauHeight = heights.reduce((x,y)=>x+y);

    // Propogate the size of the tableau we rendered up
    if (props.sizeObj !== undefined) {
      props.sizeObj.width = tableauWidth;
      props.sizeObj.height = tableauHeight;
    }

    // Set the styles
    thisTableauDiv.style.width = `${tableauWidth}px`;
    thisTableauDiv.style.height = `${tableauHeight}px`;
    
    if (childrenDiv !== null) {
      childrenDiv.classList.remove("hidden");
    }
    for (let fdiv of formulaeDivs) {
      fdiv.classList.remove("hidden");
    }
  });  
  
  if (!tableau) {
    return null;
  } else {
    // construct the formula components    
    let children = tableau.formulaData.map(
      (datum, arrayIdx) => {
	// currTableauIndex shouldn't be undefined as we checked
	// earlier and updated its value accordingly, but the type
	// checker seems to be weird when we capture currTableauIndex
	// inside an arrow function, so we need the type assertion
	// (the other uses of currTableauIndex later in the function
	// type check fine because they are not within an arrow function...)
	// https://github.com/microsoft/TypeScript/issues/33319
	let idx: FormulaIndex = [(currTableauIndex as TableauIndex), arrayIdx];
	return (
	  e("div",
	    { className: "formula-box hidden",
	      key: arrayIdx,
	      ref: (el) => { if (el) formulaeDivs.push(el); } },
	    e(FormulaComponent,
	      { formula: datum.formula,
		...indexedFormulaProps(tableau, datum.formula, idx) }))
	);
      }
    );

    // construct subtableau components
    let last = null;
    if (tableau.subTableaus) {
      last =
	e("div",
	  { className: "children hidden",
	    ref: (el) => { if (el) childrenDiv = el; } },
	  e(BaseTableauComponent,
	    { tableau: tableau.subTableaus.left,
	      indexedFormulaProps: indexedFormulaProps,
	      indexedTableauProps: indexedTableauProps,
	      currTableauIndex:  currTableauIndex + "L",
	      sizeObj: leftSize }),
	  e(BaseTableauComponent,
	    { tableau: tableau.subTableaus.right,
	      indexedFormulaProps: indexedFormulaProps,
	      indexedTableauProps: indexedTableauProps,
	      currTableauIndex: currTableauIndex + "R",
	      sizeObj: rightSize}));
    } else if (tableau.isClosed) {
      last = e("p", {}, "X");
    }

    // construct the actual tableau    
    let props = indexedTableauProps(tableau, currTableauIndex);
    props.classes.push("tableau");
    return (
      e("div",
	{ className: props.classes.join(" "),
	  ref: (el : HTMLElement | null) => { if (el) thisTableauDiv = el; },
	  ...props.attributes },
	children,
	last)
    );
  }
}





interface AppProps {
  initialFormula: Formula,
}

interface AppState {
  tableau: Tableau,
  swapTableau: Tableau,
  helpFocused: boolean,
  state:  {tag: "default"} |
    {tag: "selectReduce" | "selectClose", selectedIdx: FormulaIndex}
}

export class App extends React.Component<AppProps, AppState> {
  constructor(props: AppProps) {
    super(props);
    this.state = {
      tableau: Tableau.initialTableau(props.initialFormula),
      swapTableau: Tableau.initialTableau(not(props.initialFormula)),
      helpFocused: false,
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

      // Every formula be right-clickable, closed or not
      props.classes.push("hoverable");
      props.attributes.onContextMenu = () => {
	if (formula.tag === "bot") {
	  this.closeBranchWithBot(formulaIdx);
	} else {
	  this.transitionToSelectClose(formulaIdx);
	}
      }

      // Formulae in non-closed tableaus should be left-clickable
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

      // Style the fully-applied formulae
      if (fullyApplied) {
	props.classes.push("fully-applied");
      }
      
      return props;
    },
    indexedTableauProps: (currTableau, _) => {
      // Style the closed tableaus
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
	// Style the formula we selected
	if (eqIdx(selectedIdx, formulaIdx)) {
	  props.classes.push("selected");
	}

	// Style the fully-applied formulae
	if (this.state.tableau.isFormulaFullyApplied(formulaIdx)) {
	  props.classes.push("fully-applied");
	}
	return props;
      },
      indexedTableauProps: (currTableau, tableauIdx) => {
	let props: DOMElementProps = {classes: [], attributes: {}};
	// Style the branches we can apply the selected formula to
	if (this.state.tableau.getApplicableBranches(selectedIdx)
	  .some(([_, idxp]) => tableauIdx === idxp)) {
	  props.classes.push("selectable");
	  props.attributes.onClick = e => {
	    this.reduceFormula(selectedIdx, tableauIdx);
	    e.stopPropagation();
	  }
	}

	// Style the closed tableau
	if (currTableau.isClosed) {
	  props.classes.push("closed");
	} 
	
	return props;
      }
    });

  renderTableauSelectClose = (selectedIdx: FormulaIndex) =>
    e(BaseTableauComponent, {
      tableau: this.state.tableau,
      indexedFormulaProps: (currTableau, formula, formulaIdx) => {
	let props: DOMElementProps = {classes: [], attributes: {}};

	// Style the formula we selected
	if (eqIdx(formulaIdx, selectedIdx)) {
	  props.classes.push("selected");
	}

	// Style the formulae that share a branch with the selected
	// formula
	let ancestors = this.state.tableau.getAncestors(selectedIdx[0]);
	let descendants = this.state.tableau.getDescendants(selectedIdx[0]);
	let both = [selectedIdx[0], ...ancestors, ...descendants];
	if (both.includes(formulaIdx[0]) && !eqIdx(formulaIdx, selectedIdx)) {
	  props.classes.push("selectable");
	  props.classes.push("hoverable");
	}

	// Style the fully-applied formulae
	if (this.state.tableau.isFormulaFullyApplied(formulaIdx)) {
	  props.classes.push("fully-applied");
	}
	// props.onContextMenu = () => {
	  
	// };
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

  renderHelp() {
    let classes = ["help"];
    if (this.state.helpFocused) {
      classes.push("focused");
    }
    return e("section", {
      className: classes.join(" "),
      dangerouslySetInnerHTML:{__html: help_html},
    });
  }

  renderControls() {
    return (
      e("div",
	{ id: "controls" },
	e("ul", {},
	  e("li",
	    { onClick: () => this.setState({helpFocused: true})},
	    "info"),
	  e("li",
	    { onClick: () =>
	      this.setState(
		{ tableau: Tableau.initialTableau(
		  not(randomTautology(5 , 4, true, 100) ?? bot()))})},
	    "new formula"),
	  e("li",
	    {},
	    "auto solve")))
    );
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
    props.onClick = () => {
      if (this.state.state.tag === "selectReduce" ||
	this.state.state.tag === "selectClose") {
	this.transitionToDefault();
      };
      this.setState({helpFocused: false});
    }
    
    return (
      e(React.Fragment, {},
	this.renderControls(),
	this.renderHelp(),
	e("main",
	  {...props,
	   className: this.state.helpFocused ? "unfocused" : "",
	   tabIndex: -1},
	  this.renderTableau()))
    );
  }
}
