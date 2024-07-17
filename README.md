# vitefolts
Vite Folts poc

## Project Overview

vitefolts is a project to build a TypeScript First Order Logic engine.

It is called vitefolts because this variation is integrated with a Vite frontend.  https://vitejs.dev/

## Properties

Logic is a systematic construction ("deduction") of truth through formal methods that may be automated.

First-order logic is a particular subset of logic that enjoys some user-friendly properties:
  * It's able to talk about countable infinities and rules of always or never
  * It can express much of what people think of as classical mathematics that can be considered based on ZF set theory
  * It has simple complete techniques to construct and verify proofs
  * It is relatively easy to understand compared to the "black box" of neural networks and deep learning
  * It supports deduction verification and automated search using techniques such as linear resolution with paramodulation.

This prover is a FOL prover with paramodulation. In general, a logical procedure begins with a set of axioms which are
sentences in a formal logical language. We can consider all of these to be assumed true for the purposes of the argument.
Next we can take a "top clause" which is an inverted conclusion we wish to prove. The proof proceeds by contradiction to find a counterexample 
when combining the top clause with the axiom set.

## Differentiating features

The folts system distinguishes itself from other provers by the data structure design. It is built entirely on persistent functional data structures.
This means that each operation simply appends more information into a "TruthBag" according to the formal rules of logic.  Even though the structures all have different handles to each historical variation as they were constructed, the memory usage is reasonable because most of the data is shared between most of the versions and TypeScript has an efficient garbage collector. By using immutable.js for all of the underlying "state" we are able to gain an automatic value semantics for all logical expressions that enjoys a comparison operation that supports at least equality comparison. That means that we automatically deduplicate logical sentences in the TruthBag without ever defining an explicit equality relation.  It also means we never need to use locks and support parallel search. Each variation of the TruthBag before and after any operation remains valid. This allows us to take advantage of multi-core CPU's and computing clusters or distributed computing using web browser javscript engines more easily. It also prevents many classes of errors that are only possible when using more common mutable data structures popular in all OOP languages.



