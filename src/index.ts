import * as ReactDOM from "react-dom";
import { createElement as e } from "react";

import "./style.css";
import "katex/dist/katex.min.css";
import {
  not, implies, and, or, bot, v, randomFormula
} from "./Formula";
import { App } from "./App";


let neg = not(not(not(not(v("p_1")))));
let p = v("p");
// let test = nTransitivity;
let test = randomFormula(0, 4);
// let test = or(bot(), bot());
let nTransitivity = not(implies(implies(v("p"), v("q")),
				implies(implies(v("q"), v("r")),
					implies(v("p"), v("r")))));

// let test = or(p, p);
// test = or(test, test);
// test = and(test, test);
// test = or(test, test);


const reactRoot = document.createElement("div");
reactRoot.id = "react-root";
document.body.appendChild(reactRoot);

ReactDOM.render(
  e(App, {initialFormula: test}),
  reactRoot,
)
