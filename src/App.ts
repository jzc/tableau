import * as katex from "katex";
import * as React from "react";
import { createElement as e } from "react";
import {
  Formula, not, prettyString, reducible, 
} from "./Formula"
import {
  Tableau, FormulaIndex, TableauIndex, eqIdx
} from "./Tableau"


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
  if (!props.classes.includes("formula")) {
    props.classes.push("formula");
  }
  return e("p", {
    ref: (el) => {
      if (el) {
	if (!katex) {
	  el.textContent = prettyString(props.formula, {unicode:true});	  
	} else {	  
	  katex.render(
	    prettyString(props.formula, {highlightPrincipalOp: true}),
	    el,
	    {output: "html", trust: true}
	  )
	}
	
	let fontSizeStr = window.getComputedStyle(el).fontSize;
	let fontSize = Number(fontSizeStr.slice(0, -2));
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

export class App extends React.Component<AppProps, AppState> {
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
	}

	// Style the fully-applied formulae
	if (this.state.tableau.isFormulaFullyApplied(formulaIdx)) {
	  props.classes.push("fully-applied");
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
