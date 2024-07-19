# vitefolts

## vitefolts: A TypeScript First Order Logic Engine

**vitefolts** is a project aimed at building a TypeScript-based First Order Logic (FOL) engine. The name "vitefolts" is derived from its integration with a Vite frontend. More information about Vite can be found at [vitejs.dev](https://vitejs.dev/).

### Properties of vitefolts

Logic involves the systematic construction ("deduction") of truth through formal methods, which can often be automated. First-order logic (FOL) is a particular subset of logic that offers several user-friendly properties:

- **Expressiveness**: FOL can discuss countable infinities and rules of "always" or "never".
- **Mathematical Foundation**: Much of classical mathematics, particularly those based on Zermelo-Fraenkel set theory, can be expressed in FOL.
- **Proof Techniques**: FOL has straightforward and complete techniques for constructing and verifying proofs.
- **Understandability**: Compared to the "black box" nature of neural networks and deep learning, FOL is relatively easy to understand.
- **Automation**: It supports deduction verification and automated search using techniques like linear resolution with paramodulation.

### Differentiating Features of vitefolts

vitefolts distinguishes itself through its data structure design, relying entirely on persistent functional data structures. Key features include:

- **Persistent Functional Data Structures**: Each operation appends information to a "TruthBag" following formal logic rules. Despite keeping all historical versions of every data structure, memory usage remains efficient due to shared data and TypeScript's garbage collection. Parallelism and consistency capability is amplified.
- **Immutable.js**: Utilizes Immutable.js for underlying state management, ensuring value semantics for logical expressions. This facilitates automatic deduplication of logical sentences without explicitly defining equality relations.
- **Parallelism and Lock-free Operation**: The system supports parallel search and avoids the need for locks. Each version of the TruthBag remains valid, enabling the use of multi-core CPUs, computing clusters, or distributed computing using web browser JavaScript engines.
- **Error Prevention**: The use of immutable data structures prevents many errors common in mutable data structures used in OOP languages.

### Core Logic of vitefolts

vitefolts is based on First Order Logic with Paramodulation, supporting standard propositional logical operations, universal and existential quantifiers, and equality. For reference, here are Peano's Axioms in vitefolts' terms:

Peano Axioms Example

### Name | Type | Arity
| Name  | Type      | Arity |
|-------|-----------|-------|
| NAT   | Predicate | 1     |
| 0     | Function  | 0     |
| succ  | Function  | 1     |
| +     | Function  | 2     |

### Sentences



| Sentence                                                                           | Description   |
|------------------------------------------------------------------------------------|---------------|
| [NAT(x)]∧[NAT(y)]∧[NAT(z)] → [x=y]∧[y=z] → x=z                                      | [transitivity]|
| ∀x.NAT(x) → x=x                                                                    | [reflection]  |
| NAT(0)                                                                             |               |
| ∀x.x+0=x                                                                           |               |
| NAT(x) → NAT(succ(x))                                                              | [closure]     |
| [NAT(x)]∧[x=y] → NAT(y)                                                            | [closure]     |
| succ(x)=succ(y) → x=y                                                              |               |
| ∀x.succ(x)=0                                                                       |               |
| [NAT(x)]∧[NAT(y)] → x=y ↔ y=x                                                      | [symmetry]    |

For an introduction to clausal form and the resolution procedure, visit [Stanford's Resolution Procedure](http://intrologic.stanford.edu/extras/resolution.html).

For a longer guide have a look at the [Open Logic Project](https://builds.openlogicproject.org/content/first-order-logic/first-order-logic.pdf) book

### Building vitefolts

To build and run vitefolts, follow these steps:

1. Ensure you have JavaScript Node installed (version 20 or later is recommended).
2. Clone the repository:
   ```bash
   git clone git@github.com:rudi-cilibrasi/vitefolts.git
   cd vitefolts
   ```
3. Install dependencies and start the development server:
   ```bash
   npm i
   npm run dev
   ```
4. Open the URL shown in your web browser.
5. Click the almost invisible top count button to trigger clausal form reductions.

By following these steps, you can start exploring the capabilities of vitefolts and its unique approach to First Order Logic.

