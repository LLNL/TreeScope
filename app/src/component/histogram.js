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
      brush = null,
      handle = null;

  let data = null,
      classes = [];

  let nbins_requested = 1;
  let nbins = 1, binwidth = 0.0;

  let xscale, yscale, xAxis, yAxis;

  let dispatch = d3.dispatch('brushed');
  let labelformat = d3.format(',.0f')

  let psize = undefined;

  function panel(context) {

    // plot margin is the margin between svg and plot
        // useful for axis labels
    let pmargin = {left: 35, right: 5, top: 20, bottom: 20};

    // label position with respect to the svg
    let label = {x: 45, y: 14};

    svg = context.append("svg")

    let svgsize = { w: parseFloat(svg.style('width')),
                    h: parseFloat(svg.style('height'))
                  };

    psize = {  w: svgsize.w - pmargin.left - pmargin.right,
                   h: svgsize.h - pmargin.top - pmargin.bottom
            };

    svg.append("g")
        .attr("transform", "translate(" + label.x + ", " + label.y + ")")
        .attr("class", "label axis")
        .append('text')
          .attr('id', 'hrangelabel');

    svg = svg.append("g")
            .attr("transform", "translate(" + pmargin.left + "," + pmargin.top + ")");

    svg.append('g')
      .attr('class', 'histogram');

    brush = d3.brushX()
              .extent([[0,0], [psize.w+1, psize.h+1]])
              .on("end", brush_ended)
              .handleSize(3);

    handle = svg.append('g')
        .attr('class', 'brush')
        .call(brush);

    xscale = d3.scaleLinear().domain([0,1]).range([0, psize.w]);
    yscale = d3.scaleLinear().domain([0,1]).range([psize.h, 0]);
    xAxis = d3.axisBottom(xscale).ticks(3).tickFormat(d3.format(".4s"));
    yAxis = d3.axisLeft(yscale).ticks(4).tickFormat(d3.format(",.0f"));

    svg.append('g')
      .attr('class', 'x axis')
      .attr('transform', 'translate(0,' + psize.h + ')')
      .call(xAxis);

    svg.append('g')
      .attr('class', 'y axis')
      .call(yAxis);

    update_label();
  }

  panel.selection = function() {
    return d3.brushSelection(handle.node())
             .map(d => xscale.invert(d));
  }

  panel.on = function(type, listener) {
    dispatch.on(type, listener);
    return this;
  }

  panel.snap2bins = function() {

    //console.log('histo.snap2bins');

    let px = d3.brushSelection(handle.node());
    if (px == null) {
      px = [0, psize.w];
    }
    let p = px.map(d => xscale.invert(d));

    // snap
    p = p.map(d => Math.round(Math.round(d/binwidth) * binwidth));
    px = p.map(d => xscale(d));

    d3.select(handle.node()).transition().call(brush.move, px);
    dispatch.call('brushed', this, p);
    update_label(p);

    return this;
  }

  panel.num_bins = function(_) {
    nbins_requested = _;
    update();
    return this;
  }

  panel.data = function(_data, _classes) {
    data = _data;
    classes = _classes;
    update();
    return this;
  };

  function update() {

    if (svg == null) return;

    // --------------------------------------------------
    let drange = [ d3.min(data.map(d => d3.min(d))),
                   d3.max(data.map(d => d3.max(d))),
                 ];

    //console.log('histo.update', drange)
    if(drange[0] == undefined)  drange[0] = 0;
    if(drange[1] == undefined)  drange[1] = 0;

    let histograms = data.map( d =>
      d3.histogram().domain(drange).thresholds(nbins_requested)(d)
    );

    nbins = histograms[0].length;
    binwidth = histograms[0][0].x1-histograms[0][0].x0;

    // --------------------------------------------------
    let bars = [];
    let hcounts = new Array(nbins).fill(0);

    histograms.forEach(function(histo, hidx) {
    histo.forEach(function(bin, bidx) {

      bars.push( { cls: classes[hidx], x0: bin.x0,
                   y0: hcounts[bidx], y1: hcounts[bidx]+bin.length
                 });
      hcounts[bidx] += bin.length
    })
    })

    //console.log([0, histograms[0][0].x0 + nbins*binwidth])
    xscale.domain( [0, histograms[0][0].x0 + nbins*binwidth] );
    yscale.domain( [0, d3.max(hcounts)] );

    // --------------------------------------------------
    let dx = xscale(binwidth);
    var d3bars = svg.select('.histogram')
                    .selectAll('.bar')
                    .data(bars);

    d3bars.enter()
      .append("rect")
      .merge(d3bars)
      .attr("class", d => "bar "+d.cls)
        .attr("x", d => xscale(d.x0))
        .attr("y", d => yscale(d.y1))
        .attr("height", d => (psize.h - yscale(d.y1-d.y0)))
        .attr("width", dx)

    d3bars.exit().remove();

    svg.select('.x').call(xAxis);
    svg.select('.y').call(yAxis);

    return this;
  }

  function brush_ended() {

    if (!d3.event) {
      window.aerror('histogram.brush_ended gets null event!');
      return;
    }

    if (!d3.event.sourceEvent)  return;   // Only transition after input.

    panel.snap2bins();
  }

  function update_label(_) {

    if(_ == undefined)
      d3.select('#hrangelabel').text('[undefined, undefined]');
    else
      d3.select('#hrangelabel').text('[' + labelformat(_[0]) + ', ' + labelformat(_[1]) + ']');
  }

  return panel;
};
