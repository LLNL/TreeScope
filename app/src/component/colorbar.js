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

var vertical = 1,
    horizontal = 2;

function translateAxis(orient, width, height) {
  var tX = orient === horizontal ? 0 : width;
  var tY = orient === horizontal ? height : 0;
  return tX + "," + tY;
}

function colorbar(orient, scale, show_axis, show_mean) {

  let size = {height: 20, width: 180};
  let margin = {left: 30, right: 30, top: 5, bottom: 20};

  let context = null;
  let axisGroup = null;
  let barGroup = null;

  var barRange = (orient === horizontal) ? size.width : size.height;
  var barThickness = (orient === horizontal) ? size.height : size.width;

  var linearScale = d3.scaleLinear().range([0, barRange]);
  var interScale = d3.scaleLinear().domain([0, barRange]);

  let valueAxis = (orient === horizontal) ? d3.axisBottom(linearScale) : d3.axisRight(linearScale);
  valueAxis.tickFormat(d3.format(".4s"));

  var tickValues = scale.domain();

  var barData = [];
  var trueDL = 0;

  function colorbar(_) {

    context = _;

    // The finer, the more continuous it looks
    var dL = 2;
    var nBars = Math.floor(barRange / dL);
    trueDL = barRange * 1. / nBars;

    for (var i = 0; i < nBars; i++) {
      barData.push(i * (trueDL));
    }

    context = context.append("svg")
              .attr("height", margin.bottom + size.height + margin.top)
              .append('g')
              .attr("class", "colorscale")
              .attr("transform", "translate(" + margin.left + ',' + margin.top + ")");

    barGroup = context.append("g")
                      .attr("class", "colorbar");

    axisGroup = context.append("g")
                      .attr("class", "colorbar axis")
                      .attr("transform", "translate(" + translateAxis(orient, size.width, size.height) + ")");

    draw();
  }

  function draw() {

    let s = scale.domain();
    s = [s[0], s[s.length-1]]

    linearScale.domain(s);
    interScale.range(s);

    // new bars
    var d3bars = barGroup.selectAll("rect")
          .data(barData);

    d3bars.enter()
        .append("rect")
        .merge(d3bars)
          .attr("x", d => (orient === horizontal) ? d : 0)
          .attr("y", d => (orient === horizontal) ? 0 : d)
          .attr("width", (orient === horizontal) ? trueDL : barThickness)
          .attr("height", (orient === horizontal) ? barThickness : trueDL)
          .style("stroke-width", "0px")
          .style("fill", function (d, i) {
              return scale(interScale(d))
          });

    d3bars.exit().remove();

    s = scale.domain();

    if (s.length%2 != 0 && s.length > 2){
      tickValues = [ s[0], s[(s.length-1)/2], s[s.length-1]];
    }
    else {
      tickValues = s;
    }

    // new tick values
    if (tickValues == null) tickValues = valueAxis.tickValues();
    else                    valueAxis.tickValues(tickValues);

    axisGroup.call(valueAxis)
              .selectAll(".tick")
              .data(tickValues);

    if(!show_axis) {
      axisGroup.selectAll(".tick")
            .attr("visibility","hidden");
    }
  }

  // set and return for chaining, or get
  colorbar.scale = function (_) {

    if (arguments.length == 0)
      return scale;

    scale = _;
    draw();
    return colorbar;
  };

  return colorbar;
}

export function colorbarV(scale, show_axis, show_mean) {
  return colorbar(vertical, scale, show_axis, show_mean);
}
export function colorbarH(scale, show_axis, show_mean) {
  return colorbar(horizontal, scale, show_axis, show_mean);
}
