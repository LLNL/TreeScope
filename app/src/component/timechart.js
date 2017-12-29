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

  let series = [],
      timeSteps = [],
      classes = [];

  let xscale, yscale, xAxis, yAxis;

  let dispatch = d3.dispatch('brushed');
  let labelformat = d3.timeFormat('%Y.%m.%d %H:%M:%S');

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

    let psize = {  w: svgsize.w - pmargin.left - pmargin.right,
                   h: svgsize.h - pmargin.top - pmargin.bottom
                };

    svg.append("g")
        .attr("transform", "translate(" + label.x + ", " + label.y + ")")
        .attr("class", "label axis")
        .append('text')
          .attr('id', 'trangelabel')

    svg = svg.append("g")
              .attr("transform", "translate(" + pmargin.left + "," + pmargin.top + ")");

    svg.append('g')
       .attr('class', 'timechart');

    brush = d3.brushX()
              .extent([[0,0], [psize.w+1, psize.h+1]])
              .on("end", brush_ended)
              .handleSize(3);

    handle = svg.append('g')
                .attr('class', 'brush')
                .call(brush);

    xscale = d3.scaleTime().domain([0,1]).range([0, psize.w]);
    yscale = d3.scaleLinear().domain([0,1]).range([psize.h, 0]);
    xAxis = d3.axisBottom(xscale).ticks(4);
    yAxis = d3.axisLeft(yscale).ticks(4).tickFormat(d3.format(".0s"));

    svg.append('g')
       .attr('class', 'x axis')
       .attr('transform', 'translate(0,' + psize.h + ')')
       .call(xAxis);

    svg.append('g')
       .attr('class', 'y axis')
       .call(yAxis);

    update_label();
  }

  panel.on = function(type, listener) {
    dispatch.on(type, listener);
    return this;
  }
  panel.data = function(_timeSteps, _series, _classes) {
    timeSteps = _timeSteps;
    series = _series;
    classes = _classes;
    update();
    return this;
  }

  panel.select = function(trange) {

    //console.log('timechart.select(', trange, ')');

    let px = [0,0];
    let p = undefined;

    if (trange == undefined) {

      p = [d3.min(timeSteps), d3.max(timeSteps)];
      px = p.map(d => xscale(d));
    }

    else {

      let i = snap2nearest(trange);

      // defined selection
      if (i != undefined) {

        p = i.map(d => timeSteps[d]);
        px = p.map(d => xscale(d));

        // single time-step selection
        //if (trange[0] == trange[1]) {
        if (i[0] == i[1]) {

          if (timeSteps.length == 2) {
            i = [0,1];
          }
          else if (i[1] != timeSteps.length-1)  i[1] = i[1]+1
          else                                  i[0] = i[0]-1

          // update only px, not p
          px = i.map(d => xscale(timeSteps[d]));

          //TODO
            // Harsh forced this fixing, for simulation data with 2 tsteps only
          if (timeSteps.length == 2) {
            p = i.map(d => timeSteps[d]);
          }
        }
      }
    }

    brush.move(handle, px);
    dispatch.call('brushed', this, p);
    update_label(p);
    return this;
  }


  function brush_ended() {

    if (!d3.event) {
      window.aerror('timechart.brush_ended gets null event!');
      return;
    }
    if (!d3.event.sourceEvent)  return;   // Only transition after input.

    let px = d3.brushSelection(this);
    if (px == null) {   update_label();   return; }

    let p = px.map(d => xscale.invert(d));

    let i = snap2nearest(p);
    p = i.map(d => timeSteps[d]);
    px = p.map(d => xscale(d));

    d3.select(this).transition().call(brush.move, px);
    dispatch.call('brushed', this, p);
    update_label(p);
  }

  function update () {

    if (svg == null)  return;

    //let ymin = d3.min(series, d => d3.min(d.values));
    let ymax = d3.max(series, d => d3.max(d.values));

    let xmin = d3.min(timeSteps);
    let xmax = d3.max(timeSteps);

    xscale.domain([xmin, xmax]);
    yscale.domain([0, ymax]);

    let plots = [];
    series.forEach( (d, sidx) => {

      if (d.values.length == 0)
        return;

      let plot = {
        line: 'M ',
        cls: classes[sidx]
      };

      d.values.forEach( (v, tidx) => {

        let x0 = xscale(timeSteps[tidx]),
            x1 = xscale(timeSteps[tidx]);

        if(timeSteps[tidx+1]) {
          x1 = xscale(timeSteps[tidx+1]);
        }

        if (tidx === 0) { plot.line += `${x0},${yscale(v)} `;  }
        else {            plot.line += `V${yscale(v)} `;       }

        plot.line += `H${x1} `;
      });
      plots.push(plot);
    });

    let d3plots = svg.select('.timechart')
                     .selectAll('path')
                     .data(plots);

    d3plots.enter()
           .append('path')
            .merge(d3plots)
            .attr('name', d => d.name)
            .attr('class', d => d.cls)
            .attr('d', d => d.line);

    d3plots.exit().remove();

    svg.select('.x').call(xAxis);
    svg.select('.y').call(yAxis);
  }

  // snap to the nearesy value in the array
  function snap2nearest(trange) {

    let minval = d3.min(timeSteps);
    let maxval = d3.max(timeSteps);

    let i = trange.map(val => {

      if (val < minval)  return undefined;
      if (val > maxval)  return undefined;

      let res = timeSteps.map( (v,i) => ({ dv: Math.abs(v-val), idx: i}) );
      res.sort( (a,b) => d3.ascending(a.dv, b.dv) )
      return res[0].idx;
    });

    // trange does not overlap with the current data timerange
    if (i[0] == undefined && i[1] == undefined) {
      return undefined;
    }

    if (i[0] == undefined) {  i[0] = 0;                   } // fix left as it is out of range
    if (i[1] == undefined) {  i[1] = timeSteps.length-1;  } // fix right as it is out of range
    if (i[1] < i[0]) {        i = [ i[1], i[0] ];         } // ensure correct ordering

    return i;
  }

  function update_label(_) {
    if(_ == undefined)
      d3.select('#trangelabel').text('[undefined, undefined]');
    else
      d3.select('#trangelabel').text('[' + labelformat(_[0]) + ', ' + labelformat(_[1]) + ']');
  }

  return panel;
 };
