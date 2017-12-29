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
import Topology from './topology';

let data = new Map();
let timeSteps = [];

function parse(text) {

  let rows = d3.csvParse(text)
  rows.forEach( function(row){
    for (let col in row) {
      if (col != 'node_id')
        row[col] = +row[col]
    }
  });
  return rows;
}

function add_topology(counters) {

  if (Topology.isnull())
    return;

  //logger.log(' Counters.add_topology()');
  counters.forEach( function(counter) {

    // get the end nodes for this link
    counter.nodefrom = Topology.node_or_switch_by_id( counter.node_id );
    counter.portfrom = counter.nodefrom.ports[ counter.port_idx-1 ];

    counter.nodeto = Topology.node_or_switch_by_id( counter.portfrom.dest_node );
    counter.portto = counter.portfrom.dest_port;

    // even if its link is broken, a port may still show performance counters
    if (counter.nodeto) {
      counter.type = (counter.nodefrom.lvl < counter.nodeto.lvl) ? 'up' : 'down';
    }
    else {
      counter.type = 'unknown';
    }
  })
  return counters;
}

function sortswitches(a, b) {
  return d3.ascending(a.lvl, b.lvl) ||
         d3.ascending(a.pod, b.pod) ||
         d3.ascending(a.idx, b.idx);
}
function sortlinks(a,b){
  return d3.ascending(a.type, b.type) ||
         sortswitches(a.nodeto, b.nodeto) ||
         sortswitches(a.nodefrom, b.nodefrom);
}

// -------------------------------------

// TODO: add all variables
function aggregate(timerange) {

  let tstamps = Array.from(data.keys());
  if (timerange != undefined) {
    tstamps = tstamps.filter( d => d >= timerange[0] && d <= timerange[1] );
  }
  logger.log(' Counters.aggregate(',timerange,'). #tstamps =', tstamps.length);
  //window.astatus('aggregating counters for (',timerange,'). #tstamps =', tstamps.length);

  // -----------------------------------------------
  // aggergated links will always be the sum

  let linkmap = new Map();
  tstamps.forEach( function(ts) {

    let counters = data.get(ts);
    counters.forEach( d => {

      let key = d['node_id']+":"+d['port_idx']

      if (!linkmap.has(key)){
        linkmap.set(key, {  node_id:  d.node_id,
                            port_idx: d.port_idx,
                            rcv_data: 0
                          });
      }
      linkmap.get(key).rcv_data += d.rcv_data;
    });
  });

  let agglinks = Array.from(linkmap.values());
  add_topology(agglinks);


  // -----------------------------------------------
  let swtchmap = new Map();
  agglinks.forEach( link => {

    if (link.nodefrom != undefined) {

      let fid = link.nodefrom.id;

      if (!swtchmap.has(fid)){
        //console.log('creating new', fid)
        swtchmap.set(fid, { node: Topology.node_or_switch_by_id(fid),
                            in_data: { /*sum: 0,*/ max: 0, vals: [] },
                            out_data: { /*sum: 0,*/ max: 0, vals: [] }
                          });
      }
      //swtchmap.get(fid).in_data.vals.push( link.rcv_data );
      swtchmap.get(fid).out_data.vals.push( link.rcv_data );
    }

    if (link.nodeto != undefined) {

      let tid = link.nodeto.id;

      if (!swtchmap.has(tid)){
        swtchmap.set(tid, { node: Topology.node_or_switch_by_id(tid),
                            in_data: { /*sum: 0,*/ max: 0, vals: [] },
                            out_data: { /*sum: 0,*/ max: 0, vals: [] }
                          });
      }
      //swtchmap.get(tid).out_data.vals.push( link.rcv_data );
      swtchmap.get(tid).in_data.vals.push( link.rcv_data );
    }
  });

  let aggswitches = Array.from(swtchmap.values());

  // -----------------------------------------------

  aggswitches = aggswitches.sort(sortswitches);
  agglinks = agglinks.sort(sortswitches);

  aggswitches.forEach(swtch => {
    //swtch.in_data.sum = d3.sum(swtch.in_data.vals);
    //swtch.out_data.sum = d3.sum(swtch.out_data.vals);
    swtch.in_data.max = d3.max(swtch.in_data.vals);
    swtch.out_data.max = d3.max(swtch.out_data.vals);
  });

  // -----------------------------------------------

  return {links: agglinks, switches: aggswitches};
}

// -------------------------------------
function fix() {

  logger.log('Counters.fix()');

  let tstamps = Array.from(data.keys());
  tstamps.sort();

  let prev_vals = new Map();
  tstamps.forEach( function(ts) {

    let counters = data.get(ts);
    //logger.log(ts, counters.length);

    counters.forEach( function (c) {

      let key = c.node_id+":"+c.port_idx;
      let val = c.rcv_data;

      if(!prev_vals.has(key))   c.rcv_data = 0
      else                      c.rcv_data = val - prev_vals.get(key);

      // not the right way to handle negative values
      // the problem is that if a link is reset, its counter will reset
      // but i would not notice that
      if (c.rcv_data < 0) {
        c.rcv_data = 0;
      }
      prev_vals.set (key, val);
    });
  });
}

// -------------------------------------

function load(tstamp, filename) {

  //logger.log(' Counters.load(', tstamp, ',', filename, ')');
  return fetch(filename)
          .then(response => response.text())
          .then(parse)
          .then(counters => data.set(tstamp, counters));
}

export default {

  load(tstamp, filename) {  return load(tstamp, filename);  },
  data() {                  return data;                    },

  fix() {                   return fix(); },
  aggregate(timerange) {    return aggregate(timerange);    }
}
