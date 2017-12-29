/*
TreeScope, Version 1.0
Author Harsh Bhatia
LLNL-CODE-743437

Copyright (c) 2017, Lawrence Livermore National Security, LLC.
Produced at the Lawrence Livermore National Laboratory.
Written by Harsh Bhatia, hbhatia@llnl.gov. LLNL-CODE-743437.

All rights reserved.

This file is part of TreeScope. For details, see https://github.com/LLNL/TreeScope.

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

/*
  This component handles a color map, such that
    supply any number of colors
    specify 2 (min, max), or 3 (min, mid, max)  values

    values are interpolated to match the number of colors to take advantage
    of the complete spectrum of colors
*/
import * as d3 from 'd3';

export default function () {

  let cscale = d3.scaleLinear().domain([0,1]).range(['white', 'black']);

  function cmap(v) {  return cscale(v); }

  cmap.colors = function (_) {  return cmap.range(_);   }
  cmap.values = function (_) {  return cmap.domain(_);  }

  cmap.range = function (_) {
    if (!arguments.length) return cscale.range();
    cscale.range(_);
    return cmap;
  };

  cmap.domain = function (_) {
    if (!arguments.length) return cscale.domain();

    let d = _;

    let crange = cscale.range();
    if (_.length != crange.length) {

      let minval = _[0];
      let maxval = _[_.length-1];

      if (_.length == 2) {

        let q = d3.scaleLinear().domain([0,1]).range(_);

        d = crange.map( (c,i) => {

          let f = parseFloat(i)/parseFloat(crange.length-1);
          return q(f);
        });
      }
      else if(_.length == 3) {

        let q0 = d3.scaleLinear().domain([0,0.5]).range([_[0],_[1]]);
        let q1 = d3.scaleLinear().domain([0.5,1]).range([_[1],_[2]]);

        d = crange.map( (c,i) => {

          let f = parseFloat(i)/parseFloat(crange.length-1);
          return (f <= 0.5) ? q0(f) : q1(f);
        });
      }
      else {
        console.error('ColorMap() can only handle 2 or 3 values in the domain!');
      }
    }

    cscale.domain(d);
    return cmap;
  };




  return cmap;
};
