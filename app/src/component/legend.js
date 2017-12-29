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

import * as d3 from 'd3';

export default function () {

  let svg = null,
      entries = [];

  let bdims, ldims;
  let dispatch = d3.dispatch('click', 'mouseover');

  function legend(_) {
    svg = _.append('div').attr('id', 'legend')
           .append('svg')

    // --------------------------------------------------
    // create and remove a legend box and find out its height and margins
    let temprect = svg.append('rect')
                      .attr('class', 'legendbox')
                      .style('display', 'none')

    bdims = { w: parseFloat(temprect.style('width')),
                 h: parseFloat(temprect.style('height')),
                 l: parseFloat(temprect.style('margin-left')),
                 r: parseFloat(temprect.style('margin-right')),
                 t: parseFloat(temprect.style('margin-top')),
                 b: parseFloat(temprect.style('margin-bottom'))
               };
   ldims = { w: bdims.w, h: bdims.h,
             l: bdims.l, r: 3*bdims.r, t: bdims.t, b: bdims.b
            };

    temprect.remove();
    // --------------------------------------------------
  }
  // coords of the box
  function x(i,n) {

    let cidx = (n == 3) ? Math.floor(i%3) : Math.floor(i/2);
    return bdims.l + cidx*(bdims.l + bdims.w + bdims.r +
                           ldims.l + ldims.w + ldims.r);
  }
  function y(i,n) {

    let ridx = (n == 3) ? Math.floor(i/3) : Math.floor(i%2);
    return bdims.t + ridx*(bdims.b + bdims.h + bdims.t);
  }

  function draw() {

    if (svg == null) return;

    let d3box = svg.selectAll('.legendbox')
                   .data(entries);

    let n = entries.length;

    d3box.enter()
        .append('rect')
        .merge(d3box)
        .attr('class', d => ('legendbox '+ d.cls))
        .attr("x", (d,i) => x(i,n))
        .attr("y", (d,i) => y(i,n))
        .on('click', d => dispatch.call('click', this, d))
        .on('mouseover', d => dispatch.call('mouseover', this, d))
        .on('mouseout', d => dispatch.call('mouseover', this, undefined))

    d3box.exit().remove();

    let d3lab = svg.selectAll('.legendlabel')
                   .data(entries);

    d3lab.enter()
        .append('text')
        .attr('class', 'legendlabel')
        .merge(d3lab)
        .attr("x", (d,i) => x(i,n) + bdims.w + bdims.r + ldims.l)
        .attr("y", (d,i) => y(i,n) + bdims.h)
        .on('mouseover', d => dispatch.call('mouseover', this, d))
        .on('mouseout', d => dispatch.call('mouseover', this, undefined))
        .text(d => d.label);

    d3lab.exit().remove();
  }

  legend.data = function(_) {
    entries = _;
    draw()
    return this;
  }
  legend.on = function(typename, callback) {
    dispatch.on(typename, callback);
    return this;
  }

  return legend;
};
