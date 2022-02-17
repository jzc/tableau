import {
  Formula, not, reducible, reduce,
  isContradictionPair, randomFormula
} from "./Formula";

function hasContradiction(conjunct: Formula[]) {
  for (let f of conjunct) {
    if (f.tag === "bot") {
      return true;
    }
  }

  for (let i = 0; i < conjunct.length-1; i++) {
    for (let j = i+1; j < conjunct.length; j++) {
      if (isContradictionPair(conjunct[i], conjunct[j])) {
	return true;
      }
    }
  }
  
  return false;
}

function isReducible(conjunct: Formula[]) : null | number {
  for (let i = 0; i < conjunct.length; i++) {
    if (reducible(conjunct[i])) {
      return i;
    }
  }
  return null;
}

export function isTautology(f: Formula): boolean {
  let disjuncts_of_conjuncts: Formula[][] = [[not(f)]];
  while (disjuncts_of_conjuncts.length > 0) {
    let conjunct = disjuncts_of_conjuncts.pop() as Formula[];
    if (!hasContradiction(conjunct)) {
      let i = isReducible(conjunct);
      if (i === null) {
	return false;
      } else {
	let res = reduce(conjunct[i]);
	if ("conjuncts" in res) {
	  conjunct.splice(i, 1, ...res.conjuncts);
	  disjuncts_of_conjuncts.push(conjunct);
	} else {
	  let conjunct_cp = [...conjunct];
	  conjunct[i] = res.disjuncts[0];
	  conjunct_cp[i] = res.disjuncts[1];
	  disjuncts_of_conjuncts.push(conjunct_cp);
	  disjuncts_of_conjuncts.push(conjunct);
	}
      }
    }
  }
  return true; 
}

export function randomTautology(n: number, d: number) : Formula {
  while (true) {
    let f = randomFormula(n, d);
    if (isTautology(f)) {
      return f;
    }
  }
}
