# CSS Unit

_Visual regression unit testing for HTML/CSS._


Work in progress.

## TL;DR

Basic plan: Exercise a small bit of HTML+CSS by rendering it in a browser. Take a screenshot and store it. Compare future runs against the stored screenshot. 

CSS Unit's part of the plan is to do the rendering, taking the screenshots, and comparing a new screenshot against an old one. It only handles one file at a time, and it doesn't persist the screenshots in any way. Clients of css-unit are responsible for that stuff.

Usage with gulp provided by https://github.com/leff/gulp-css-unit.



