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
import * as Layout from './layout';

export default function(name) {

  let svg = null;
  let labelg = null;
  let label_podname = {w: 20, h: 20};

  let dispatch = d3.dispatch('selected', 'mouseover');

  let links, sl1, sl2, sl3;

  let jobl1 = [], nl0_per_l1 = 1;

  let switchcolormode;
  let switchcolors;
  let cmap_links, cmap_switches;

  let highlighted_switches = [];
  let highlighted_links = [];
  let selected_switches = { selectedLeft: [], selectedRight: [] };
  let selected_links = { selectedLeft: [], selectedRight: [] };


  // ------------------------------------------------------------------------
  function linkmatch(a,b) {
    return a.nodefrom == b.nodefrom && a.nodeto == b.nodeto;
  }

  function selected_switch(type, d) {
    return selected_switches[type].includes(d);
  }
  function selected_link(type, d){
    for(let l of selected_links[type]) {
      if ( linkmatch(d,l) )
        return true;
    }
    return false;
  }

  function highlight_needed() {
    return highlighted_switches.length > 0 || highlighted_links.length > 0;
  }
  function fade_switch(s) {

    if (!highlight_needed())
      return false;

    return !highlighted_switches.includes(s.lid);
  }
  function fade_link(l) {

    if (!highlight_needed())
      return false;

    let tobehighlighted = false;
    highlighted_links.forEach(h => {
      if (h.from == l.nodefrom.lid && h.to == l.nodeto.lid) {
        tobehighlighted = true;
      }
    });
    return !tobehighlighted;
  }

  // ------------------------------------------------------------------------
  function panel(selection) {

    svg = selection.append('svg')
          .attr('class', 'pod');

    svg.append('g').attr('class', 'podlabels')
       .append('text').attr('id', 'podid')
       .text(name).attr('x', 5).attr('y', 10)

    svg.append('g').attr('class', 'switches');
    svg.append('g').attr('class', 'links');
  }

  // ------------------------------------------------------------------------
  function clicked(d){

    //console.log('fatpod clicked: ', d, d3.event.shiftKey, d3.event.metaKey)

    let d3e = d3.select(this);

    let stype = undefined;
    let scomponent = undefined;

    if (d3e.classed('switch')){     stype = 'switch'; scomponent = d.node; }
    else if (d3e.classed('link')){  stype = 'link';   scomponent = d;      }

    dispatch.call('selected', this, { type: stype, component: scomponent,
                                      mode_mselect: d3.event.metaKey,
                                      mode_lr: (d3.event.shiftKey ? 'selectedRight' : 'selectedLeft')
                                    });
  }

  // ------------------------------------------------------------------------

  function clone(d){  return JSON.parse(JSON.stringify(d)); }


  function horizontal_split(d) {

    const dx = 0;

    let b1 = clone(d);
    let b2 = clone(d);

    b1._loc.w = b1._loc.w*0.5 - dx;
    b1._col = (switchcolormode == 'counters') ? cmap_switches['in'](b1.out_data.max) :
                                                switchcolors[b1.node.lvl];

    b2._loc.x += b1._loc.w + 2.0*dx;
    b2._loc.w = b2._loc.w*0.5 - dx;
    b2._col = (switchcolormode == 'counters') ? cmap_switches['out'](b2.in_data.max) :
                                                switchcolors[b2.node.lvl];
    return [b1, b2];
  }

  function horizontal_repeat(d) {
    let b1 = clone(d);
    let b2 = clone(d);

    b1._col = (switchcolormode == 'counters') ? cmap_switches['in'](b1.in_data.max) :
                                                switchcolors[b1.node.lvl];

    b2._type = 1;  // tag the redundant so i can change the rendering if needed
    b2._loc.x += Layout.offset_x_dir(d.node);
    b2._col = (switchcolormode == 'counters') ? cmap_switches['out'](b2.out_data.max) :
                                                switchcolors[b2.node.lvl];
    return [b1, b2];
  }

  function create_switchboxes() {

    let boxes = [];

    // need value-based rendering of all switches
    if (switchcolormode == 'counters' ) {

      sl1.forEach(d => {
        let b = horizontal_split(d);
        boxes.push(b[0]); boxes.push(b[1]);
      });
      sl3.forEach(d => {
        let b = horizontal_split(d);
        boxes.push(b[0]); boxes.push(b[1]);
      });

      if (Layout.type() == 'interleaved') {
        sl2.forEach(d => {
          let b = horizontal_split(d);
          boxes.push(b[0]); boxes.push(b[1]);
        });
      }
      else {
        sl2.forEach(d => {
          let b = horizontal_repeat(d);
          boxes.push(b[0]); boxes.push(b[1]);
        });
      }

      return boxes;
    }

    if (switchcolormode == 'levels') {

      sl1.forEach(d => {
        let b = horizontal_split(d);
        boxes.push(b[0]); boxes.push(b[1]);
      });
      sl3.forEach(d => {
        let b = horizontal_split(d);
        boxes.push(b[0]); boxes.push(b[1]);
      });

      if (Layout.type() == 'interleaved') {
        sl2.forEach(d => {
          let b = horizontal_split(d);
          boxes.push(b[0]); boxes.push(b[1]);
        });
      }
      else {
        sl2.forEach(d => {
          let b = horizontal_repeat(d);
          boxes.push(b[0]); boxes.push(b[1]);
        });
      }
      return boxes;
    }

    // need job-based rendering of L1 switches!
    if (switchcolormode == 'jobs') {

      // add one box each for l2 and l3
      sl3.forEach(d => {
        let b = clone(d);
        b._col = switchcolors[0];
        boxes.push(b);
      });
      sl2.forEach(d => {
        let b = horizontal_repeat(d);
        b[0]._col = switchcolors[0];
        b[1]._col = switchcolors[0];
        boxes.push(b[0]); boxes.push(b[1]);
      });

      sl1.forEach(d => {

        // L1 switch
        let dj = jobl1.filter(n => n.id == d.node.id);

        let x = 0;
        let n = 0;

        dj.forEach(j => {

          let b = clone(d);

          b._loc.x = x;
          b._loc.w = parseFloat(j.ncount) / parseFloat(nl0_per_l1) * parseFloat(d._loc.w);
          b._col = j.col;
          boxes.push(b);

          x += b._loc.w;
          n += j.ncount;
        });

        // add a last one for remaining
        if (n < nl0_per_l1) {

          let b = clone(d);

          b._loc.x = x;
          b._loc.w = parseFloat(nl0_per_l1-n) / parseFloat(nl0_per_l1) * parseFloat(d._loc.w);
          b._col = switchcolors[0];
          boxes.push(b);
        }
      });
    }
    return boxes;
  }

  function render_switches() {

    sl1.forEach(d => {d._loc = Layout.switch_loc(d.node)});
    sl2.forEach(d => {d._loc = Layout.switch_loc(d.node)});
    sl3.forEach(d => {d._loc = Layout.switch_loc(d.node)});

    let boxes = create_switchboxes();

    // render the boxes
    let d3switches = svg.select('g.switches')
                        .selectAll('.switch')
                        .data(boxes);

    d3switches.enter()
      .append('rect')
      .merge(d3switches)
        .attr('class', d => 'switch')
        .attr('width', d => d._loc.w)
        .attr('height', d => d._loc.h)
        .attr('x', d => d._loc.x)
        .attr('y', d => d._loc.y + label_podname.h)
        .on('click', clicked)
        .on('mouseout', d => dispatch.call('mouseover', this, undefined))
        .on('mouseover', d => dispatch.call('mouseover', this, {type: 'switch', component: d}))
        .attr('fill', d => d._col)
        /*
        .filter(d => d._type == 1)          // different rendering for duplicates
        .attr('stroke', d => d._col)
        .attr('fill', d => 'none')
        .attr('width', d => d._loc.w-1)
        .attr('height', d => d._loc.h-1)
        .attr('x', d => d._loc.x + 0.5)
        .attr('y', d => d._loc.y + label_podname.h + 0.5)
        */

    d3switches.exit().remove();
  }

  function render_links() {

    // join new data with old elements
    let d3links = svg.select('g.links')
                     .selectAll('.link')
                     .data(links);

    // create new elements as needed
    d3links.enter()
      .append('rect')
      .merge(d3links)
      //.filter(d => d.type == 'up')
      .each(d => d._loc = Layout.link_loc(d))
        .attr('class', 'link')
        .on('click', clicked)
        .on('mouseout', d => dispatch.call('mouseover', this, undefined))
        .on('mouseover', d => dispatch.call('mouseover', this, {type: 'link', component: d}))
        .attr('width', d => d._loc.w)
        .attr('height', d => d._loc.h)
        .attr('x', d => d._loc.x)
        .attr('y', d => d._loc.y + label_podname.h)
        .attr('fill', d => cmap_links[d.type](d.rcv_data))
        //.attr('fill', d => d.type == 'up' ? '#66c2a5' :  '#fc8d62')
        //.attr('fill', d => d.type == 'up' ? '#66c2a5' :  '#8da0cb')
        //.attr('opacity', '0.6')


    // remove old elements as needed
    d3links.exit().remove();
  }

  // ------------------------------------------------------------------------
  panel.update = function(redraw) {

    if (redraw) {

      let sz = Layout.pod_sz();
      svg.attr('width', sz.w).attr('height', sz.h + label_podname.h);

      //labelg.select('text').attr('x', sz.w/2-label_podname.w).attr('y', 10)
      svg.select('g.podlabels')
         .select('text').attr('x', sz.w/2-label_podname.w).attr('y', 10)

      render_switches();
      render_links();
    }

    // update classes
    svg.select('g.switches')
       .selectAll('.switch')
       .classed('unhighlighted', d => fade_switch(d.node))
       .classed('selectedLeft', d => selected_switch('selectedLeft', d.node))
       .classed('selectedRight', d => selected_switch('selectedRight', d.node));

    svg.select('g.links')
       .selectAll('.link')
       .classed('unhighlighted', d => fade_link(d))
       .classed('selectedLeft', d => selected_link('selectedLeft', d))
       .classed('selectedRight', d => selected_link('selectedRight', d));
  };

  // ------------------------------------------------------------------------
  panel.switches = function(_switches) {

    sl1 = [];   sl2 = [];   sl3 = [];
    _switches.forEach(s => {
      switch (s.node.lvl) {
        case 1:   sl1.push(s);  break;
        case 2:   sl2.push(s);  break;
        case 3:   sl3.push(s);  break;
      }
    });
    return this;
  };

  panel.links = function(_links) {
    links = _links;
    return this;
  };

  panel.jobl1 = function(_jobl1, _nl0_per_l1) {
    jobl1 = _jobl1;
    nl0_per_l1 = _nl0_per_l1;
    return this;
  }

  // ------------------------------------------------------------------------
  panel.highlight_switches = function(_) {
    highlighted_switches = _;
    return this;
  };
  panel.highlight_links = function(_) {
    highlighted_links = _;
    return this;
  };
  panel.select_switches = function(_) {
    selected_switches = _;
    return this;
  };
  panel.select_links = function(_) {
    selected_links = _;
    return this;
  };

  // ------------------------------------------------------------------------
  panel.set_dir = function(type) {

    svg.select('g.links')
       .selectAll('.link')
       .style("visibility", d => (type == 'both' || type == d.type) ? 'visible' : 'hidden');
  }

  panel.switchcolormode = function(_) {
    switchcolormode = _;
    return this;
  }
  panel.switchcolors = function (_){
    switchcolors = _;
    return this;
  }
  panel.colormap_switches = function(_) {
    cmap_switches = _;
    return this;
  }
  panel.colormap_links = function(_) {
    cmap_links = _;
    return this;
  }

  panel.on = function(typename, callback) {
    dispatch.on(typename, callback);
    return this;
  }

  // ------------------------------------------------------------------------

  return panel;
}
